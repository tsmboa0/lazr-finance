import * as anchor from "@anchor-lang/core";
import { Transaction } from "@solana/web3.js";
import { ER_ENDPOINT, ER_WS_ENDPOINT } from "./token-defs";

/** Send an ER transaction with no preflight/simulation (low latency). */
export async function sendErTransaction(
  erProvider: anchor.AnchorProvider,
  tx: Transaction
): Promise<string> {
  tx.feePayer = erProvider.wallet.publicKey;
  const latest = await erProvider.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;

  const signed = await erProvider.wallet.signTransaction(tx);
  const sig = await erProvider.connection.sendRawTransaction(
    signed.serialize(),
    { skipPreflight: true, maxRetries: 3 }
  );
  const result = await erProvider.connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed"
  );
  if (result.value.err) {
    throw new Error(`ER tx failed: ${JSON.stringify(result.value.err)}`);
  }
  return sig;
}

export function createErProvider(
  baseProvider: anchor.AnchorProvider
): anchor.AnchorProvider {
  return new anchor.AnchorProvider(
    new anchor.web3.Connection(ER_ENDPOINT, {
      wsEndpoint: ER_WS_ENDPOINT,
      commitment: "confirmed",
    }),
    baseProvider.wallet,
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
}
