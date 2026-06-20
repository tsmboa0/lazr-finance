import { BN } from "@coral-xyz/anchor";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";

export const SESSION_KEYS_PROGRAM = new PublicKey(
  "KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5"
);

export const MAGIC_TRADE_PROGRAM = new PublicKey(
  "FTv2RxXarPfNta45HTTMVaGvjzsGg27FXJ3hEKWBhrzV"
);

export interface SessionWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T
  ): Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(
    txs: T[]
  ) => Promise<T[]>;
}

export {
  loadSession,
  clearSession,
  persistSession,
  SESSION_STORAGE_KEY,
  type LoadedSession,
} from "./session-store";

export function deriveSessionToken(
  authority: PublicKey,
  sessionSigner: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("session_token_v2"),
      MAGIC_TRADE_PROGRAM.toBytes(),
      sessionSigner.toBytes(),
      authority.toBytes(),
    ],
    SESSION_KEYS_PROGRAM
  );
  return pda;
}

export interface BuiltSessionTransaction {
  tx: Transaction;
  sessionSigner: Keypair;
  sessionToken: string;
  validUntil: number;
}

export async function buildSessionTransaction(
  wallet: SessionWallet,
  connection: Connection,
  opts: { validHours?: number; topUpSol?: number } = {}
): Promise<BuiltSessionTransaction> {
  const { validHours = 24, topUpSol = 0.01 } = opts;
  const sessionSigner = Keypair.generate();
  const validUntil =
    Math.floor(Date.now() / 1000) + Math.floor(validHours * 3600);
  const sessionToken = deriveSessionToken(
    wallet.publicKey,
    sessionSigner.publicKey
  );

  const walletForManager = {
    ...wallet,
    signAllTransactions:
      wallet.signAllTransactions ??
      (async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
        const out: T[] = [];
        for (const tx of txs) out.push(await wallet.signTransaction(tx));
        return out;
      }),
  };

  const manager = new SessionTokenManager(walletForManager, connection);
  const tx: Transaction = await manager.program.methods
    .createSessionV2(true, new BN(validUntil), new BN(Math.round(topUpSol * 1e9)))
    .accountsPartial({
      sessionToken,
      sessionSigner: sessionSigner.publicKey,
      feePayer: wallet.publicKey,
      authority: wallet.publicKey,
      targetProgram: MAGIC_TRADE_PROGRAM,
    })
    .transaction();

  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (
    await connection.getLatestBlockhash("confirmed")
  ).blockhash;
  tx.partialSign(sessionSigner);
  return {
    tx,
    sessionSigner,
    sessionToken: sessionToken.toBase58(),
    validUntil,
  };
}
