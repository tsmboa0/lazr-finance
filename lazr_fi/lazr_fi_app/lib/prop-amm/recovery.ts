import type { Connection, PublicKey, Transaction } from "@solana/web3.js";
import type { PropAmmWallet } from "./wallet";
import { isUserBankOnL1, isWalletTransactionCancelled } from "./delegation";
import { UserBankNeedsRedelegateError } from "./errors";
import { logStep } from "./debug";
import { userBankPda } from "./pdas";

type RecoveryParams = {
  user: PublicKey;
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export async function recoverUserBankAfterAbortedFundsTx(
  params: RecoveryParams,
  error: unknown,
  didMoveBankToL1: boolean
): Promise<never> {
  if (!didMoveBankToL1 || !isWalletTransactionCancelled(error)) {
    throw error;
  }

  const userBank = userBankPda(params.user);
  const stillOnL1 = await isUserBankOnL1(params.connection, userBank);
  if (!stillOnL1) {
    throw error;
  }

  logStep(
    "recovery",
    "Wallet cancelled after bank moved to L1 — prompt user to re-delegate manually",
    { userBank: userBank.toBase58() }
  );

  throw new UserBankNeedsRedelegateError();
}
