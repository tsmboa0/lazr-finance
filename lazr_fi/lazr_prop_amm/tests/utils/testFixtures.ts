import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const testsDir = path.join(process.cwd(), "tests");
const TEST_KEYPAIR_PATH = path.join(testsDir, "test-keypair2.json");
const TEST_MINTS_PATH = path.join(testsDir, "test-mints.json");

export interface SavedTestMints {
  assetMint: string;
  usdcMint: string;
}

export function loadOrCreateTestKeypair(): Keypair {
  if (existsSync(TEST_KEYPAIR_PATH)) {
    const secret = JSON.parse(
      readFileSync(TEST_KEYPAIR_PATH, "utf8")
    ) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }

  const keypair = Keypair.generate();
  writeFileSync(TEST_KEYPAIR_PATH, JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

export async function loadOrCreateTestMints(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey
): Promise<{ assetMint: PublicKey; usdcMint: PublicKey }> {
  if (existsSync(TEST_MINTS_PATH)) {
    const saved = JSON.parse(
      readFileSync(TEST_MINTS_PATH, "utf8")
    ) as SavedTestMints;
    const assetMint = new PublicKey(saved.assetMint);
    const usdcMint = new PublicKey(saved.usdcMint);
    const [assetInfo, usdcInfo] = await Promise.all([
      connection.getAccountInfo(assetMint),
      connection.getAccountInfo(usdcMint),
    ]);
    if (assetInfo && usdcInfo) {
      return { assetMint, usdcMint };
    }
  }

  const assetMint = await createMint(
    connection,
    payer,
    mintAuthority,
    null,
    8
  );
  const usdcMint = await createMint(
    connection,
    payer,
    mintAuthority,
    null,
    6
  );

  const payload: SavedTestMints = {
    assetMint: assetMint.toString(),
    usdcMint: usdcMint.toString(),
  };
  writeFileSync(TEST_MINTS_PATH, JSON.stringify(payload, null, 2));
  return { assetMint, usdcMint };
}

export async function fundSolIfNeeded(
  connection: Connection,
  from: Keypair,
  to: PublicKey,
  minSol: number,
  topUpSol: number
): Promise<void> {
  const balance = await connection.getBalance(to);
  if (balance >= minSol * LAMPORTS_PER_SOL) {
    return;
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: Math.floor(topUpSol * LAMPORTS_PER_SOL),
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = from.publicKey;
  tx.sign(from);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
}

export async function getOrCreateTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const accounts = await connection.getTokenAccountsByOwner(owner, { mint });
  if (accounts.value.length > 0) {
    return accounts.value[0].pubkey;
  }

  return createAccount(connection, payer, mint, owner);
}

export async function ensureTokenBalance(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  tokenAccount: PublicKey,
  mintAuthority: Keypair,
  targetAmount: bigint
): Promise<void> {
  const target = targetAmount;
  const account = await getAccount(connection, tokenAccount);
  if (account.amount >= target) {
    return;
  }

  const topUp = target - account.amount;
  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount,
    mintAuthority,
    topUp
  );
}
