import {
  Keypair,
  PublicKey,
  SystemProgram,
  type Connection,
} from "@solana/web3.js";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import BN from "bn.js";
import type { PropAmmWallet } from "./wallet";
import {
  PROGRAM_ID,
  SESSION_SIGNER_FUND_LAMPORTS,
  SESSION_TOKEN_SEED,
  SESSION_TOP_UP_LAMPORTS,
  SESSION_VALIDITY_SEC,
} from "./constants";

const STORAGE_PREFIX = "lazr_session_signer_";

export function getOrCreateSessionKeypair(user: PublicKey): Keypair {
  if (typeof window === "undefined") {
    return Keypair.generate();
  }

  const storageKey = `${STORAGE_PREFIX}${user.toBase58()}`;
  const saved = window.localStorage.getItem(storageKey);
  if (saved) {
    const secret = JSON.parse(saved) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }

  const keypair = Keypair.generate();
  window.localStorage.setItem(
    storageKey,
    JSON.stringify(Array.from(keypair.secretKey))
  );
  return keypair;
}

export function sessionTokenPda(
  sessionSigner: PublicKey,
  authority: PublicKey,
  sessionProgramId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(SESSION_TOKEN_SEED),
      PROGRAM_ID.toBuffer(),
      sessionSigner.toBuffer(),
      authority.toBuffer(),
    ],
    sessionProgramId
  );
  return pda;
}

export async function sessionTokenExists(
  connection: Connection,
  sessionToken: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(sessionToken);
  return info !== null;
}

export async function buildCreateSessionInstructions(
  wallet: PropAmmWallet,
  connection: Connection,
  user: PublicKey,
  sessionKeypair: Keypair
) {
  const manager = new SessionTokenManager(wallet as never, connection);
  const sessionToken = sessionTokenPda(
    sessionKeypair.publicKey,
    user,
    manager.program.programId
  );

  if (await sessionTokenExists(connection, sessionToken)) {
    return { instructions: [], sessionToken };
  }

  const validUntil = new BN(
    Math.floor(Date.now() / 1000) + SESSION_VALIDITY_SEC
  );
  const topUpLamports = new BN(SESSION_TOP_UP_LAMPORTS);

  const fundSessionIx = SystemProgram.transfer({
    fromPubkey: user,
    toPubkey: sessionKeypair.publicKey,
    lamports: SESSION_SIGNER_FUND_LAMPORTS,
  });
  // L1 devnet only — bundled into sendWalletTransaction via the app's devnet RPC.

  const ix = await manager.program.methods
    .createSessionV2(true, validUntil, topUpLamports)
    .accounts({
      targetProgram: PROGRAM_ID,
      sessionSigner: sessionKeypair.publicKey,
      feePayer: user,
      authority: user,
    })
    .instruction();

  return { instructions: [fundSessionIx, ix], sessionToken };
}
