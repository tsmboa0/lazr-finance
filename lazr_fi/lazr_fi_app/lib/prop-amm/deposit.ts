import {
  Keypair,
  PublicKey,
  Transaction,
  type Connection,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PropAmmWallet } from "./wallet";
import { getPoolForSymbol, type PoolContext } from "../devnet-config";
import { toRawAmount } from "./amounts";
import { logError, logStep, logTxInstructions } from "./debug";
import {
  erValidatorRemainingAccounts,
  getDelegationStatus,
  requireErEndpoint,
  waitForUndelegated,
} from "./delegation";
import { userBankPda } from "./pdas";
import { getErProgram, getL1Program } from "./program";
import {
  buildCreateSessionInstructions,
  getOrCreateSessionKeypair,
} from "./session";
import {
  assertSessionFundedOnEr,
  sendErSessionTransaction,
  sendWalletTransaction,
} from "./transactions";

export interface DepositParams {
  symbol: string;
  amount: number;
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

function depositAccounts(
  pool: PoolContext,
  user: PublicKey,
  depositMint: PublicKey
) {
  const isUsdc = depositMint.toBase58() === pool.usdcMint;
  const userTokenAccount = getAssociatedTokenAddressSync(depositMint, user);
  const vault = new PublicKey(isUsdc ? pool.usdcVault : pool.assetVault);

  return {
    assetMint: new PublicKey(pool.assetMint),
    usdcMint: new PublicKey(pool.usdcMint),
    pool: new PublicKey(pool.pool),
    userTokenAccount,
    vault,
    depositMint,
  };
}

async function ensureTokenAccountIx(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey
) {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (info) return null;

  return createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
}

export async function executeDeposit(
  params: DepositParams
): Promise<{ signature: string }> {
  const { symbol, amount, user, connection, wallet, signTransaction } = params;

  logStep("deposit", "Starting deposit", {
    symbol,
    amount,
    user: user.toBase58(),
    l1Rpc: connection.rpcEndpoint,
  });

  try {
    const pool = getPoolForSymbol(symbol);
    const depositMint = new PublicKey(
      symbol === "USDC" ? pool.usdcMint : pool.assetMint
    );
    const decimals = symbol === "USDC" ? pool.usdcDecimals : pool.decimals;
    const rawAmount = toRawAmount(amount, decimals);

    logStep("deposit", "Resolved pool + mint", {
      pool: pool.pool,
      depositMint: depositMint.toBase58(),
      rawAmount: rawAmount.toString(),
    });

    if (rawAmount.isZero()) {
      throw new Error("Deposit amount must be greater than zero.");
    }

    const program = getL1Program(connection, wallet);
    const userBank = userBankPda(user);

    logStep("deposit", "Derived user bank PDA", {
      userBank: userBank.toBase58(),
    });

    const delegation = await getDelegationStatus(userBank);
    const bankExistsOnL1 = await accountExists(connection, userBank);
    const bankExists = delegation.isDelegated || bankExistsOnL1;
    const bankDelegated = delegation.isDelegated;

    logStep("deposit", "Bank state", {
      bankExistsOnL1,
      bankDelegated,
      bankExists,
      erFqdn: delegation.fqdn ?? null,
    });

    const sessionKeypair = getOrCreateSessionKeypair(user);
    logStep("deposit", "Session keypair ready", {
      sessionSigner: sessionKeypair.publicKey.toBase58(),
    });

    const { instructions: sessionIxs } = await buildCreateSessionInstructions(
      wallet,
      connection,
      user,
      sessionKeypair
    );

    logStep("deposit", "Session setup", {
      newSessionInstructions: sessionIxs.length,
    });

    if (bankDelegated) {
      logStep("deposit", "Bank delegated — undelegate on ER first");

      const erEndpoint = requireErEndpoint(delegation);
      const { sessionToken } = await buildCreateSessionInstructions(
        wallet,
        connection,
        user,
        sessionKeypair
      );

      logStep("deposit", "Undelegate accounts", {
        erEndpoint,
        sessionToken: sessionToken.toBase58(),
        payer: sessionKeypair.publicKey.toBase58(),
      });

      await assertSessionFundedOnEr(sessionKeypair, erEndpoint);

      const programEr = getErProgram(wallet, erEndpoint);
      const undelegateIx = await programEr.methods
        .undelegateUserBank()
        .accountsPartial({
          payer: sessionKeypair.publicKey,
          sessionToken,
          userBank,
        })
        .instruction();

      logStep("deposit", "Built undelegate instruction", {
        programId: undelegateIx.programId.toBase58(),
        dataLength: undelegateIx.data.length,
      });

      const undelegateTx = new Transaction().add(undelegateIx);
      await sendErSessionTransaction(
        undelegateTx,
        sessionKeypair,
        erEndpoint,
        400_000,
        "deposit undelegate"
      );
      await waitForUndelegated(userBank);
      logStep("deposit", "Undelegate complete — proceeding to L1 deposit");
    } else {
      logStep("deposit", "Bank not delegated — skipping ER undelegate");
    }

    const tx = new Transaction();
    if (sessionIxs.length > 0) {
      tx.add(...sessionIxs);
    }

    if (!bankExists) {
      logStep("deposit", "Adding initUserBank instruction");
      const initIx = await program.methods
        .initUserBank()
        .accountsPartial({ authority: user })
        .instruction();
      tx.add(initIx);
    } else {
      logStep("deposit", "Skipping initUserBank — bank already exists");
    }

    const createAtaIx = await ensureTokenAccountIx(
      connection,
      user,
      depositMint,
      user
    );
    if (createAtaIx) {
      logStep("deposit", "Adding create ATA instruction", {
        mint: depositMint.toBase58(),
      });
      tx.add(createAtaIx);
    } else {
      logStep("deposit", "ATA already exists — skipping create", {
        mint: depositMint.toBase58(),
      });
    }

    const accounts = depositAccounts(pool, user, depositMint);
    logStep("deposit", "Building depositToBank instruction", {
      pool: accounts.pool.toBase58(),
      vault: accounts.vault.toBase58(),
      userTokenAccount: accounts.userTokenAccount.toBase58(),
    });

    const depositIx = await program.methods
      .depositToBank(rawAmount, true)
      .accountsPartial({
        user,
        ...accounts,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(erValidatorRemainingAccounts())
      .instruction();
    tx.add(depositIx);

    logTxInstructions("deposit L1 bundle (pre-send)", tx);

    const needsSessionSigner = sessionIxs.length > 0;
    const signature = await sendWalletTransaction(
      connection,
      wallet,
      signTransaction,
      tx,
      needsSessionSigner ? [sessionKeypair] : [],
      400_000,
      "deposit L1"
    );

    logStep("deposit", "Deposit complete", { signature });
    return { signature };
  } catch (error) {
    logError("deposit", "executeDeposit", error);
    throw error;
  }
}
