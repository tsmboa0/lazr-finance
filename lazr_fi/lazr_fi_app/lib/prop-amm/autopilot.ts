import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  type Connection,
} from "@solana/web3.js";
import type { PropAmmWallet } from "./wallet";
import { getPoolForSymbol } from "../devnet-config";
import { toRawAmount } from "./amounts";
import {
  AUTOPILOT_STRATEGY,
  decodeAutopilotState,
  type AutopilotSnapshot,
  resolveAutopilotLifecycle,
  autopilotStatusLabel,
} from "./autopilot-decode";
import {
  erValidatorRemainingAccounts,
  getDelegationStatus,
  isAccountDelegatedOnL1,
  isPropAmmAccountOnL1,
  requireErEndpoint,
  waitForPropAmmAccountOnL1,
  waitForUndelegated,
} from "./delegation";
import { logError, logStep, logTxInstructions } from "./debug";
import { autopilotPda, nextAutopilotCrankTaskId, userBankPda } from "./pdas";
import { getErProgram, getL1Program, PROGRAM_ID } from "./program";
import { prepareSessionForBankActivity, sendSessionSetupIfNeeded } from "./session";
import {
  assertSessionFundedOnEr,
  magicAccounts,
  sendErSessionTransaction,
  sendWalletTransaction,
} from "./transactions";

/** Scheduled tick count per autopilot crank (MagicBlock ScheduleTask). */
const AUTOPILOT_CRANK_ITERATIONS = 1_000_000;

export interface StartAutopilotParams {
  assetSymbol: string;
  strategy: keyof typeof AUTOPILOT_STRATEGY;
  capitalUsdc: number;
  user: PublicKey;
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export interface StopAutopilotParams {
  assetSymbol: string;
  user: PublicKey;
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export interface UpdateAutopilotParams {
  assetSymbol: string;
  strategy?: keyof typeof AUTOPILOT_STRATEGY;
  capitalUsdc?: number;
  user: PublicKey;
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

async function accountExists(
  connection: Connection,
  pubkey: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey);
  return info !== null;
}

async function autopilotAlreadyExists(
  connection: Connection,
  assetSymbol: string,
  user: PublicKey
): Promise<boolean> {
  const { autopilot } = poolAccounts(assetSymbol, user);
  if (await accountExists(connection, autopilot)) return true;
  const state = await fetchAutopilotState(connection, assetSymbol, user);
  return state !== null;
}

/** Stop + undelegate when autopilot exists; wait until PropAMM owns the PDA on L1. */
async function stopExistingAutopilotIfAny(
  params: StopAutopilotParams
): Promise<string[]> {
  const { assetSymbol, user, connection } = params;
  const { autopilot } = poolAccounts(assetSymbol, user);

  if (!(await autopilotAlreadyExists(connection, assetSymbol, user))) {
    logStep("autopilot", "No existing autopilot — skipping stop");
    return [];
  }

  const autopilotDelegation = await getDelegationStatus(autopilot);
  const delegatedOnL1 = await isAccountDelegatedOnL1(connection, autopilot);
  const onL1PropAmm = await isPropAmmAccountOnL1(connection, autopilot);

  if (
    onL1PropAmm &&
    !autopilotDelegation.isDelegated &&
    !delegatedOnL1
  ) {
    logStep(
      "autopilot",
      "Autopilot already on L1 under PropAMM — skipping stop/undelegate"
    );
    return [];
  }

  logStep("autopilot", "Stopping existing autopilot before restart");
  const result = await executeStopAutopilot(params);
  await waitForPropAmmAccountOnL1(connection, autopilot);
  return result.signatures;
}

async function runL1UpdateAndDelegate(params: {
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  user: PublicKey;
  poolPk: PublicKey;
  autopilot: PublicKey;
  assetMint: PublicKey;
  usdcMint: PublicKey;
  sessionKeypair: import("@solana/web3.js").Keypair;
  sessionInstructions: Transaction["instructions"];
  needsSessionSetup: boolean;
  updateArgs: {
    strategy: number;
    allocatedUsdc: BN;
    tickIntervalMs: null;
    crankTaskId: BN;
  };
}): Promise<string> {
  const {
    connection,
    wallet,
    signTransaction,
    user,
    poolPk,
    autopilot,
    assetMint,
    usdcMint,
    sessionKeypair,
    sessionInstructions,
    needsSessionSetup,
    updateArgs,
  } = params;

  const programL1 = getL1Program(connection, wallet);
  const l1Tx = new Transaction();
  let needsSessionSigner = false;

  if (needsSessionSetup) {
    logStep("autopilot", "Bundling session setup on L1");
    l1Tx.add(...sessionInstructions);
    needsSessionSigner = true;
  }

  logStep("autopilot", "Bundling updateAutopilot + delegateAutopilot on L1");
  const updateIx = await programL1.methods
    .updateAutopilot(updateArgs)
    .accountsPartial({
      payer: user,
      assetMint,
      usdcMint,
      pool: poolPk,
      autopilot,
      sessionToken: PROGRAM_ID,
    })
    .instruction();
  l1Tx.add(updateIx);

  const delegateIx = await programL1.methods
    .delegateAutopilot()
    .accountsPartial({
      payer: user,
      assetMint,
      usdcMint,
      pool: poolPk,
      autopilot,
    })
    .remainingAccounts(erValidatorRemainingAccounts())
    .instruction();
  l1Tx.add(delegateIx);

  logTxInstructions("autopilot L1 update+delegate (pre-send)", l1Tx);
  return sendWalletTransaction(
    connection,
    wallet,
    signTransaction,
    l1Tx,
    needsSessionSigner ? [sessionKeypair] : [],
    800_000,
    "autopilot update + delegate"
  );
}

async function resolveNextAutopilotCrankTaskId(
  connection: Connection,
  assetSymbol: string,
  user: PublicKey
): Promise<number> {
  const state = await fetchAutopilotState(connection, assetSymbol, user);
  return nextAutopilotCrankTaskId(state?.crankTaskId);
}

async function runErStartAndCrank(params: {
  wallet: PropAmmWallet;
  erEndpoint: string;
  sessionKeypair: import("@solana/web3.js").Keypair;
  sessionToken: PublicKey;
  poolPk: PublicKey;
  quoteState: PublicKey;
  autopilot: PublicKey;
  userBank: PublicKey;
  config: PublicKey;
  riskState: PublicKey;
  assetMint: PublicKey;
  usdcMint: PublicKey;
  rawCapital: BN;
  crankTaskId: number;
}): Promise<string[]> {
  const {
    wallet,
    erEndpoint,
    sessionKeypair,
    sessionToken,
    poolPk,
    quoteState,
    autopilot,
    userBank,
    config,
    riskState,
    assetMint,
    usdcMint,
    rawCapital,
    crankTaskId,
  } = params;

  const programEr = getErProgram(wallet, erEndpoint);
  await assertSessionFundedOnEr(sessionKeypair, erEndpoint);

  logStep("autopilot", "Sending startAutopilot on ER", { crankTaskId });
  const startIx = await programEr.methods
    .startAutopilot({ allocatedUsdc: rawCapital })
    .accountsPartial({
      payer: sessionKeypair.publicKey,
      sessionToken,
      pool: poolPk,
      quoteState,
      autopilot,
      userBank,
    })
    .instruction();

  const startTx = new Transaction().add(startIx);
  logTxInstructions("autopilot ER start (pre-send)", startTx);
  const startSig = await sendErSessionTransaction(
    startTx,
    sessionKeypair,
    erEndpoint,
    600_000,
    "autopilot start"
  );

  logStep("autopilot", "Sending setupAutopilotCrank on ER", {
    crankTaskId,
    iterations: AUTOPILOT_CRANK_ITERATIONS,
  });
  const crankIx = await programEr.methods
    .setupAutopilotCrank({
      iterations: new BN(AUTOPILOT_CRANK_ITERATIONS),
    })
    .accountsPartial({
      payer: sessionKeypair.publicKey,
      sessionToken,
      pool: poolPk,
      config,
      autopilot,
      quoteState,
      riskState,
      userBank,
      assetMint,
      usdcMint,
      program: PROGRAM_ID,
      ...magicAccounts(),
    })
    .instruction();

  const crankTx = new Transaction().add(crankIx);
  logTxInstructions("autopilot ER setup crank (pre-send)", crankTx);
  const crankSig = await sendErSessionTransaction(
    crankTx,
    sessionKeypair,
    erEndpoint,
    800_000,
    "autopilot setup crank"
  );

  return [startSig, crankSig];
}

function poolAccounts(assetSymbol: string, user: PublicKey) {
  const pool = getPoolForSymbol(assetSymbol);
  const poolPk = new PublicKey(pool.pool);
  return {
    pool,
    poolPk,
    autopilot: autopilotPda(poolPk, user),
    userBank: userBankPda(user),
    assetMint: new PublicKey(pool.assetMint),
    usdcMint: new PublicKey(pool.usdcMint),
    config: new PublicKey(pool.config),
    quoteState: new PublicKey(pool.quoteState),
    riskState: new PublicKey(pool.riskState ?? pool.quoteState),
  };
}

export async function fetchAutopilotState(
  connection: Connection,
  assetSymbol: string,
  user: PublicKey
) {
  const snapshot = await fetchAutopilotSnapshot(connection, assetSymbol, user);
  return snapshot.state;
}

/** Read autopilot from the correct layer — ER while delegated, L1 otherwise. */
export async function fetchAutopilotSnapshot(
  connection: Connection,
  assetSymbol: string,
  user: PublicKey
): Promise<AutopilotSnapshot> {
  const { autopilot, userBank } = poolAccounts(assetSymbol, user);
  const autopilotDelegation = await getDelegationStatus(autopilot);
  const bankDelegation = await getDelegationStatus(userBank);
  const delegatedOnL1 = await isAccountDelegatedOnL1(connection, autopilot);
  const isDelegated =
    autopilotDelegation.isDelegated || delegatedOnL1;

  const emptySnapshot = (): AutopilotSnapshot => ({
    state: null,
    source: null,
    isDelegated,
    lifecycle: "not_set_up",
    statusLabel: "Not set up",
    isActive: false,
  });

  // Active bots run on ER — L1 holds stale committed state (often still "stopped").
  if (isDelegated) {
    const erEndpoint = autopilotDelegation.isDelegated
      ? requireErEndpoint(autopilotDelegation)
      : requireErEndpoint(bankDelegation);
    const erConnection = getErProgram(
      { publicKey: user } as PropAmmWallet,
      erEndpoint
    ).provider.connection;
    const erInfo = await erConnection.getAccountInfo(autopilot);
    if (erInfo?.data) {
      const state = decodeAutopilotState(Buffer.from(erInfo.data));
      if (state) {
        const lifecycle = resolveAutopilotLifecycle(state);
        return {
          state,
          source: "er",
          isDelegated: true,
          lifecycle,
          statusLabel: autopilotStatusLabel(state.status),
          isActive: lifecycle === "active",
        };
      }
    }
  }

  if (await isPropAmmAccountOnL1(connection, autopilot)) {
    const l1Info = await connection.getAccountInfo(autopilot);
    if (l1Info?.data) {
      const state = decodeAutopilotState(Buffer.from(l1Info.data));
      if (state) {
        const lifecycle = resolveAutopilotLifecycle(state);
        return {
          state,
          source: "l1",
          isDelegated: false,
          lifecycle,
          statusLabel: autopilotStatusLabel(state.status),
          isActive: lifecycle === "active",
        };
      }
    }
  }

  // PDA never initialized, or delegation stub with no ER data yet.
  if (!(await accountExists(connection, autopilot))) {
    return emptySnapshot();
  }

  return emptySnapshot();
}

export async function executeStartAutopilot(
  params: StartAutopilotParams
): Promise<{ signatures: string[] }> {
  const {
    assetSymbol,
    strategy,
    capitalUsdc,
    user,
    connection,
    wallet,
    signTransaction,
  } = params;

  const signatures: string[] = [];
  const {
    pool,
    poolPk,
    autopilot,
    userBank,
    assetMint,
    usdcMint,
    config,
    quoteState,
    riskState,
  } = poolAccounts(assetSymbol, user);

  const bankDelegation = await getDelegationStatus(userBank);
  if (!bankDelegation.isDelegated) {
    throw new Error("Bank not on ER. Deposit USDC first, then start Autopilot.");
  }

  const erEndpoint = requireErEndpoint(bankDelegation);
  const rawCapital = toRawAmount(capitalUsdc, pool.usdcDecimals);
  const strategyId = AUTOPILOT_STRATEGY[strategy];

  try {
    const hadAutopilot = await autopilotAlreadyExists(
      connection,
      assetSymbol,
      user
    );

    if (hadAutopilot) {
      signatures.push(...(await stopExistingAutopilotIfAny(params)));
    }

    const crankTaskId = await resolveNextAutopilotCrankTaskId(
      connection,
      assetSymbol,
      user
    );

    logStep("autopilot", "Starting autopilot", {
      assetSymbol,
      strategy,
      capitalUsdc,
      crankTaskId,
      iterations: AUTOPILOT_CRANK_ITERATIONS,
    });

    const session = await prepareSessionForBankActivity(
      wallet,
      connection,
      user
    );
    const { sessionKeypair, sessionToken, sessionInstructions, needsSessionSetup } =
      session;

    const updateArgs = {
      strategy: strategyId,
      allocatedUsdc: rawCapital,
      tickIntervalMs: null,
      crankTaskId: new BN(crankTaskId),
    };

    if (!hadAutopilot) {
      const programL1 = getL1Program(connection, wallet);
      const initTx = new Transaction();
      let needsSessionSigner = false;

      logStep("autopilot", "Bundling initAutopilot on L1");
      const initIx = await programL1.methods
        .initAutopilot({
          strategy: strategyId,
          crankTaskId: new BN(crankTaskId),
        })
        .accountsPartial({
          authority: user,
          assetMint,
          usdcMint,
          pool: poolPk,
          autopilot,
        })
        .instruction();
      initTx.add(initIx);

      if (needsSessionSetup) {
        initTx.add(...sessionInstructions);
        needsSessionSigner = true;
      }

      logTxInstructions("autopilot L1 init (pre-send)", initTx);
      signatures.push(
        await sendWalletTransaction(
          connection,
          wallet,
          signTransaction,
          initTx,
          needsSessionSigner ? [sessionKeypair] : [],
          800_000,
          "autopilot init"
        )
      );
    }

    if (!(await isPropAmmAccountOnL1(connection, autopilot))) {
      throw new Error(
        "Autopilot is not on L1 yet. Wait a moment and try starting again."
      );
    }

    signatures.push(
      await runL1UpdateAndDelegate({
        connection,
        wallet,
        signTransaction,
        user,
        poolPk,
        autopilot,
        assetMint,
        usdcMint,
        sessionKeypair,
        sessionInstructions: hadAutopilot ? sessionInstructions : [],
        needsSessionSetup: hadAutopilot ? needsSessionSetup : false,
        updateArgs,
      })
    );

    signatures.push(
      ...(await runErStartAndCrank({
        wallet,
        erEndpoint,
        sessionKeypair,
        sessionToken,
        poolPk,
        quoteState,
        autopilot,
        userBank,
        config,
        riskState,
        assetMint,
        usdcMint,
        rawCapital,
        crankTaskId,
      }))
    );

    logStep("autopilot", "Autopilot started", { signatures, crankTaskId });
    return { signatures };
  } catch (error) {
    logError("autopilot", "executeStartAutopilot", error);
    throw error;
  }
}

export async function executeStopAutopilot(
  params: StopAutopilotParams
): Promise<{ signatures: string[] }> {
  const { assetSymbol, user, connection, wallet, signTransaction } = params;
  const { poolPk, autopilot, userBank, assetMint, usdcMint } = poolAccounts(
    assetSymbol,
    user
  );

  logStep("autopilot", "Stopping autopilot", { assetSymbol });

  try {
    const autopilotDelegation = await getDelegationStatus(autopilot);
    const bankDelegation = await getDelegationStatus(userBank);
    const delegatedOnL1 = await isAccountDelegatedOnL1(connection, autopilot);
    const needsErStop = autopilotDelegation.isDelegated || delegatedOnL1;

    if (needsErStop) {
      const erEndpoint = autopilotDelegation.isDelegated
        ? requireErEndpoint(autopilotDelegation)
        : requireErEndpoint(bankDelegation);
      const programEr = getErProgram(wallet, erEndpoint);
      const session = await prepareSessionForBankActivity(
        wallet,
        connection,
        user
      );
      const { sessionKeypair, sessionToken } = session;

      if (session.needsSessionSetup) {
        logStep("autopilot", "Creating session on L1 before ER stop");
        await sendSessionSetupIfNeeded(
          connection,
          wallet,
          signTransaction,
          session,
          "autopilot stop create session"
        );
      }

      await assertSessionFundedOnEr(sessionKeypair, erEndpoint);

      const stopIx = await programEr.methods
        .stopAutopilot()
        .accountsPartial({
          payer: sessionKeypair.publicKey,
          sessionToken,
          assetMint,
          usdcMint,
          pool: poolPk,
          autopilot,
        })
        .instruction();

      const undelegateIx = await programEr.methods
        .undelegateAutopilot()
        .accountsPartial({
          payer: sessionKeypair.publicKey,
          sessionToken,
          autopilot,
        })
        .instruction();

      const stopTx = new Transaction().add(stopIx, undelegateIx);
      logTxInstructions("autopilot ER stop bundle (pre-send)", stopTx);
      const signature = await sendErSessionTransaction(
        stopTx,
        sessionKeypair,
        erEndpoint,
        600_000,
        "stop autopilot + undelegate"
      );

      await waitForUndelegated(autopilot);
      await waitForPropAmmAccountOnL1(connection, autopilot);
      logStep("autopilot", "Autopilot stopped and undelegated to L1", {
        signature,
      });
      return { signatures: [signature] };
    }

    const programL1 = getL1Program(connection, wallet);
    const stopIx = await programL1.methods
      .stopAutopilot()
      .accountsPartial({
        payer: user,
        assetMint,
        usdcMint,
        pool: poolPk,
        autopilot,
        sessionToken: PROGRAM_ID,
      })
      .instruction();

    const stopTx = new Transaction().add(stopIx);
    const signature = await sendWalletTransaction(
      connection,
      wallet,
      signTransaction,
      stopTx,
      [],
      400_000,
      "stop autopilot"
    );

    return { signatures: [signature] };
  } catch (error) {
    logError("autopilot", "executeStopAutopilot", error);
    throw error;
  }
}

export async function executeUpdateAutopilot(
  params: UpdateAutopilotParams
): Promise<{ signatures: string[] }> {
  const {
    assetSymbol,
    strategy,
    capitalUsdc,
    user,
    connection,
    wallet,
    signTransaction,
  } = params;

  const signatures: string[] = [];
  const {
    pool,
    poolPk,
    autopilot,
    userBank,
    assetMint,
    usdcMint,
    config,
    quoteState,
    riskState,
  } = poolAccounts(assetSymbol, user);

  logStep("autopilot", "Updating autopilot", { assetSymbol, strategy, capitalUsdc });

  try {
    const bankDelegation = await getDelegationStatus(userBank);
    if (!bankDelegation.isDelegated) {
      throw new Error("Bank not on ER. Deposit USDC first, then update Autopilot.");
    }

    const erEndpoint = requireErEndpoint(bankDelegation);
    const existingState = await fetchAutopilotState(
      connection,
      assetSymbol,
      user
    );
    if (!existingState) {
      throw new Error("Autopilot not initialized. Start Autopilot first.");
    }

    const strategyId =
      strategy !== undefined
        ? AUTOPILOT_STRATEGY[strategy]
        : existingState.strategy;
    const rawCapital =
      capitalUsdc !== undefined
        ? toRawAmount(capitalUsdc, pool.usdcDecimals)
        : new BN(existingState.allocatedUsdc.toString());

    if (rawCapital.lte(new BN(0))) {
      throw new Error("Capital must be greater than zero.");
    }

    signatures.push(...(await stopExistingAutopilotIfAny(params)));

    if (!(await isPropAmmAccountOnL1(connection, autopilot))) {
      throw new Error(
        "Autopilot is not on L1 yet. Wait a moment and try updating again."
      );
    }

    const crankTaskId = await resolveNextAutopilotCrankTaskId(
      connection,
      assetSymbol,
      user
    );

    logStep("autopilot", "Updating autopilot crank schedule", {
      crankTaskId,
      iterations: AUTOPILOT_CRANK_ITERATIONS,
    });

    const session = await prepareSessionForBankActivity(
      wallet,
      connection,
      user
    );
    const { sessionKeypair, sessionToken, sessionInstructions, needsSessionSetup } =
      session;

    const updateArgs = {
      strategy: strategyId,
      allocatedUsdc: rawCapital,
      tickIntervalMs: null,
      crankTaskId: new BN(crankTaskId),
    };

    signatures.push(
      await runL1UpdateAndDelegate({
        connection,
        wallet,
        signTransaction,
        user,
        poolPk,
        autopilot,
        assetMint,
        usdcMint,
        sessionKeypair,
        sessionInstructions,
        needsSessionSetup,
        updateArgs,
      })
    );

    signatures.push(
      ...(await runErStartAndCrank({
        wallet,
        erEndpoint,
        sessionKeypair,
        sessionToken,
        poolPk,
        quoteState,
        autopilot,
        userBank,
        config,
        riskState,
        assetMint,
        usdcMint,
        rawCapital,
        crankTaskId,
      }))
    );

    logStep("autopilot", "Autopilot updated", { signatures, crankTaskId });
    return { signatures };
  } catch (error) {
    logError("autopilot", "executeUpdateAutopilot", error);
    throw error;
  }
}
