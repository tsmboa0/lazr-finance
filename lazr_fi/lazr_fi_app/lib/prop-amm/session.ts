import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type Connection,
  type TransactionInstruction,
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
import { sendWalletTransaction } from "./transactions";

const STORAGE_PREFIX = "lazr_session_signer_";

export function loadSessionKeypair(user: PublicKey): Keypair | null {
  if (typeof window === "undefined") return null;

  const storageKey = `${STORAGE_PREFIX}${user.toBase58()}`;
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return null;

  try {
    const secret = JSON.parse(saved) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  } catch {
    return null;
  }
}

export function persistSessionKeypair(user: PublicKey, keypair: Keypair): void {
  if (typeof window === "undefined") return;

  const storageKey = `${STORAGE_PREFIX}${user.toBase58()}`;
  window.localStorage.setItem(
    storageKey,
    JSON.stringify(Array.from(keypair.secretKey))
  );
}

export function getOrCreateSessionKeypair(user: PublicKey): Keypair {
  const existing = loadSessionKeypair(user);
  if (existing) return existing;

  const keypair = Keypair.generate();
  persistSessionKeypair(user, keypair);
  return keypair;
}

export type PreparedBankSession = {
  sessionKeypair: Keypair;
  sessionToken: PublicKey;
  sessionInstructions: TransactionInstruction[];
  /** Session signer secret was present in localStorage before this call. */
  hasStoredSessionKey: boolean;
  /** On-chain session token must be created (bundle or send first). */
  needsSessionSetup: boolean;
};

export async function prepareSessionForBankActivity(
  wallet: PropAmmWallet,
  connection: Connection,
  user: PublicKey
): Promise<PreparedBankSession> {
  let sessionKeypair = loadSessionKeypair(user);
  const hasStoredSessionKey = sessionKeypair !== null;

  if (!sessionKeypair) {
    sessionKeypair = Keypair.generate();
    persistSessionKeypair(user, sessionKeypair);
  }

  const { instructions, sessionToken } = await buildCreateSessionInstructions(
    wallet,
    connection,
    user,
    sessionKeypair
  );

  return {
    sessionKeypair,
    sessionToken,
    sessionInstructions: instructions,
    hasStoredSessionKey,
    needsSessionSetup: instructions.length > 0,
  };
}

/** Sends a standalone L1 tx to create/fund the session when it cannot be bundled. */
export async function sendSessionSetupIfNeeded(
  connection: Connection,
  wallet: PropAmmWallet,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  prepared: PreparedBankSession,
  label: string
): Promise<void> {
  if (!prepared.needsSessionSetup) return;

  const tx = new Transaction().add(...prepared.sessionInstructions);
  await sendWalletTransaction(
    connection,
    wallet,
    signTransaction,
    tx,
    [prepared.sessionKeypair],
    400_000,
    label
  );
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
