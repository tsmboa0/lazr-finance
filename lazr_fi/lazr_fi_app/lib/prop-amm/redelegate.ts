import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import type { PropAmmWallet } from "./wallet";
import { erValidatorRemainingAccounts, isUserBankOnL1 } from "./delegation";
import { logStep } from "./debug";
import { userBankPda } from "./pdas";
import { getL1Program } from "./program";
import { sendWalletTransaction } from "./transactions";

export interface RedelegateParams {
  user: PublicKey;
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export async function executeRedelegateUserBank(
  params: RedelegateParams
): Promise<{ signature: string }> {
  const { user, connection, wallet, signTransaction } = params;
  const userBank = userBankPda(user);

  const onL1 = await isUserBankOnL1(connection, userBank);
  if (!onL1) {
    throw new Error("Your bank is already on the rollup — no re-delegate needed.");
  }

  logStep("redelegate", "Delegating user bank to ER on L1", {
    userBank: userBank.toBase58(),
  });

  const program = getL1Program(connection, wallet);
  const delegateIx = await program.methods
    .delegateUserBank()
    .accountsPartial({
      payer: user,
      userBank,
    })
    .remainingAccounts(erValidatorRemainingAccounts())
    .instruction();

  const tx = new Transaction().add(delegateIx);
  const signature = await sendWalletTransaction(
    connection,
    wallet,
    signTransaction,
    tx,
    [],
    400_000,
    "redelegate user bank"
  );

  logStep("redelegate", "Re-delegate complete", { signature });
  return { signature };
}
