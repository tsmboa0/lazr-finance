import { Keypair } from "@solana/web3.js";
import { readFileSync, writeFileSync } from "fs";

export function initializeSessionSignerKeypair(): Keypair {
  if (!process.env.SESSION_SIGNER_PRIVATE_KEY) {
    const signer = Keypair.generate();
    writeFileSync(
      ".env",
      `SESSION_SIGNER_PRIVATE_KEY=[${signer.secretKey.toString()}]\n`,
      { flag: "a" }
    );
    return signer;
  }

  const secret = JSON.parse(
    process.env.SESSION_SIGNER_PRIVATE_KEY ?? ""
  ) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}
