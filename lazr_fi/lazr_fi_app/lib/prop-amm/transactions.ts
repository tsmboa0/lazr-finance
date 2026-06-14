import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  type Connection,
} from "@solana/web3.js";
import { MAGIC_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import type { PropAmmWallet } from "./wallet";
import { getErConnection } from "./program";
import { logStep, logTxInstructions } from "./debug";

export const MAGIC_CONTEXT = new PublicKey(
  "MagicContext1111111111111111111111111111111"
);

export const magicAccounts = () => ({
  magicProgram: MAGIC_PROGRAM_ID,
  magicContext: MAGIC_CONTEXT,
});

export async function sendErSessionTransaction(
  tx: Transaction,
  sessionKeypair: Keypair,
  erEndpoint: string,
  computeUnits = 400_000,
  label = "ER session tx"
): Promise<string> {
  logStep("tx", `Preparing ${label}`, {
    erEndpoint,
    sessionSigner: sessionKeypair.publicKey.toBase58(),
    incomingInstructionCount: tx.instructions.length,
  });
  logTxInstructions(`${label} (incoming)`, tx);

  const erConnection = getErConnection(erEndpoint);
  const budgeted = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 })
  );
  budgeted.add(...tx.instructions);

  logTxInstructions(`${label} (budgeted)`, budgeted);

  if (budgeted.instructions.length <= 2) {
    throw new Error(
      `Failed to build ER session transaction (no instructions). label=${label}, incoming=${tx.instructions.length}, budgeted=${budgeted.instructions.length}, endpoint=${erEndpoint}`
    );
  }

  budgeted.feePayer = sessionKeypair.publicKey;
  const latest = await erConnection.getLatestBlockhash("confirmed");
  budgeted.recentBlockhash = latest.blockhash;
  budgeted.partialSign(sessionKeypair);

  logStep("tx", `Sending ${label}`, {
    erEndpoint,
    feePayer: sessionKeypair.publicKey.toBase58(),
    blockhash: latest.blockhash,
  });

  const sig = await erConnection.sendRawTransaction(budgeted.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  await erConnection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed"
  );

  logStep("tx", `${label} confirmed`, { signature: sig, erEndpoint });
  return sig;
}

/** Session signer must have ER SOL (from createSessionV2 top-up). Never ask the wallet to sign ER txs. */
export async function assertSessionFundedOnEr(
  sessionKeypair: Keypair,
  erEndpoint: string
): Promise<void> {
  const erConnection = getErConnection(erEndpoint);
  const minBalance = 1_000_000;
  const sessionBalance = await erConnection.getBalance(
    sessionKeypair.publicKey
  );

  logStep("tx", "Checking session ER balance", {
    erEndpoint,
    sessionSigner: sessionKeypair.publicKey.toBase58(),
    balanceLamports: sessionBalance,
    minBalanceLamports: minBalance,
  });

  if (sessionBalance >= minBalance) return;

  throw new Error(
    `Session key has insufficient SOL on ER (${sessionBalance} lamports on ${erEndpoint}). Clear lazr_session_signer_* from localStorage, then deposit again so the 0.01 devnet SOL session fund is bundled on L1.`
  );
}

export async function sendWalletTransaction(
  connection: Connection,
  wallet: PropAmmWallet,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  tx: Transaction,
  extraSigners: Keypair[] = [],
  computeUnits = 400_000,
  label = "L1 wallet tx"
): Promise<string> {
  logStep("tx", `Preparing ${label}`, {
    rpc: connection.rpcEndpoint,
    feePayer: wallet.publicKey.toBase58(),
    incomingInstructionCount: tx.instructions.length,
    extraSigners: extraSigners.map((s) => s.publicKey.toBase58()),
  });
  logTxInstructions(`${label} (incoming)`, tx);

  const budgeted = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 })
  );
  budgeted.add(...tx.instructions);

  logTxInstructions(`${label} (budgeted)`, budgeted);

  if (budgeted.instructions.length <= 2) {
    throw new Error(
      `Failed to build L1 transaction (no instructions). label=${label}, incoming=${tx.instructions.length}, budgeted=${budgeted.instructions.length}, rpc=${connection.rpcEndpoint}`
    );
  }

  budgeted.feePayer = wallet.publicKey;
  budgeted.recentBlockhash = (
    await connection.getLatestBlockhash("confirmed")
  ).blockhash;

  for (const signer of extraSigners) {
    budgeted.partialSign(signer);
  }

  logStep("tx", `Requesting wallet signature for ${label}`, {
    blockhash: budgeted.recentBlockhash,
    instructionCount: budgeted.instructions.length,
  });

  const signed = await signTransaction(budgeted);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, "confirmed");

  logStep("tx", `${label} confirmed`, { signature: sig });
  return sig;
}
