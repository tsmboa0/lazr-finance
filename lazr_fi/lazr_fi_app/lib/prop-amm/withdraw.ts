import {
  Keypair,
  PublicKey,
  Transaction,
  type Connection,
} from "@solana/web3.js";
import {
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
} from "./delegation";
import { userBankPda } from "./pdas";
import { getErProgram, getL1Program } from "./program";
import { recoverUserBankAfterAbortedFundsTx } from "./recovery";
import {
  prepareSessionForBankActivity,
  sendSessionSetupIfNeeded,
} from "./session";
import {
  assertSessionFundedOnEr,
  sendErSessionTransaction,
  sendWalletTransaction,
} from "./transactions";

export interface WithdrawParams {
  symbol: string;
  amount: number;
  user: PublicKey;
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

function withdrawAccounts(
  pool: PoolContext,
  user: PublicKey,
  withdrawMint: PublicKey
) {
  const isUsdc = withdrawMint.toBase58() === pool.usdcMint;
  const userTokenAccount = getAssociatedTokenAddressSync(withdrawMint, user);
  const vault = new PublicKey(isUsdc ? pool.usdcVault : pool.assetVault);

  return {
    assetMint: new PublicKey(pool.assetMint),
    usdcMint: new PublicKey(pool.usdcMint),
    pool: new PublicKey(pool.pool),
    userTokenAccount,
    vault,
    withdrawMint,
  };
}

export async function executeWithdraw(
  params: WithdrawParams
): Promise<{ signature: string }> {
  const { symbol, amount, user, connection, wallet, signTransaction } = params;

  logStep("withdraw", "Starting withdraw", {
    symbol,
    amount,
    user: user.toBase58(),
    l1Rpc: connection.rpcEndpoint,
  });

  try {
    const pool = getPoolForSymbol(symbol);
    const withdrawMint = new PublicKey(
      symbol === "USDC" ? pool.usdcMint : pool.assetMint
    );
    const decimals = symbol === "USDC" ? pool.usdcDecimals : pool.decimals;
    const rawAmount = toRawAmount(amount, decimals);

    logStep("withdraw", "Resolved pool + mint", {
      pool: pool.pool,
      withdrawMint: withdrawMint.toBase58(),
      rawAmount: rawAmount.toString(),
    });

    if (rawAmount.isZero()) {
      throw new Error("Withdraw amount must be greater than zero.");
    }

    const userBank = userBankPda(user);
    logStep("withdraw", "Derived user bank PDA", {
      userBank: userBank.toBase58(),
    });

    const delegation = await getDelegationStatus(userBank);
    const bankExistsOnL1 = (await connection.getAccountInfo(userBank)) !== null;

    logStep("withdraw", "Bank state", {
      bankExistsOnL1,
      bankDelegated: delegation.isDelegated,
      erFqdn: delegation.fqdn ?? null,
    });

    if (!delegation.isDelegated && !bankExistsOnL1) {
      throw new Error("User bank not initialized. Deposit first.");
    }

    if (!delegation.isDelegated) {
      throw new Error("User bank is not delegated. Deposit again to sync state.");
    }

    const erEndpoint = requireErEndpoint(delegation);

    const session = await prepareSessionForBankActivity(
      wallet,
      connection,
      user
    );
    const { sessionKeypair, sessionToken, sessionInstructions } = session;

    logStep("withdraw", "Session check", {
      sessionSigner: sessionKeypair.publicKey.toBase58(),
      hasStoredSessionKey: session.hasStoredSessionKey,
      needsSessionSetup: session.needsSessionSetup,
      newSessionInstructions: sessionInstructions.length,
      sessionToken: sessionToken.toBase58(),
    });

    if (session.needsSessionSetup) {
      logStep("withdraw", "Creating session on L1 first");
      await sendSessionSetupIfNeeded(
        connection,
        wallet,
        signTransaction,
        session,
        "withdraw create session"
      );
    }

    await assertSessionFundedOnEr(sessionKeypair, erEndpoint);

    const programEr = getErProgram(wallet, erEndpoint);
    logStep("withdraw", "Building withdrawFromBankEr instruction", {
      erEndpoint,
      pool: pool.pool,
    });

    const withdrawErIx = await programEr.methods
      .withdrawFromBankEr({
        amount: rawAmount,
        withdrawMint,
      })
      .accountsPartial({
        payer: sessionKeypair.publicKey,
        sessionToken,
        userBank,
        pool: new PublicKey(pool.pool),
      })
      .instruction();

    logStep("withdraw", "Built ER withdraw instruction", {
      programId: withdrawErIx.programId.toBase58(),
      dataLength: withdrawErIx.data.length,
    });

    const erTx = new Transaction().add(withdrawErIx);
    await sendErSessionTransaction(
      erTx,
      sessionKeypair,
      erEndpoint,
      400_000,
      "withdraw ER"
    );

    logStep("withdraw", "ER withdraw complete — settling on L1");

    const program = getL1Program(connection, wallet);
    const accounts = withdrawAccounts(pool, user, withdrawMint);

    const withdrawIx = await program.methods
      .withdrawFromBank(rawAmount, true)
      .accountsPartial({
        user,
        ...accounts,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(erValidatorRemainingAccounts())
      .instruction();

    const settleTx = new Transaction().add(withdrawIx);
    logTxInstructions("withdraw L1 settle bundle (pre-send)", settleTx);

    try {
      const signature = await sendWalletTransaction(
        connection,
        wallet,
        signTransaction,
        settleTx,
        [],
        500_000,
        "withdraw L1 settle"
      );

      logStep("withdraw", "Withdraw complete", { signature });
      return { signature };
    } catch (error) {
      throw await recoverUserBankAfterAbortedFundsTx(
        { user, connection, wallet, signTransaction },
        error,
        true
      );
    }
  } catch (error) {
    logError("withdraw", "executeWithdraw", error);
    throw error;
  }
}
