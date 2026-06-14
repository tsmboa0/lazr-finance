import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createMintToInstruction,
} from "@solana/spl-token";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  claimAmountRaw,
  getDevnetManifest,
  getFaucetClaimAmount,
  getFaucetToken,
} from "./devnet-config";

function loadFaucetAuthority(): Keypair {
  const raw = process.env.FAUCET_AUTHORITY_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "FAUCET_AUTHORITY_SECRET_KEY is not set. Add the mint authority keypair to .env.local."
    );
  }

  let secret: Uint8Array;
  try {
    const parsed = JSON.parse(raw) as number[];
    if (!Array.isArray(parsed) || parsed.length < 64) {
      throw new Error("invalid array");
    }
    secret = Uint8Array.from(parsed);
  } catch {
    throw new Error(
      "FAUCET_AUTHORITY_SECRET_KEY must be a JSON byte array (Solana keypair format)."
    );
  }

  return Keypair.fromSecretKey(secret);
}

function getConnection(): Connection {
  const rpc =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    process.env.SOLANA_RPC_URL ??
    "https://api.devnet.solana.com";
  return new Connection(rpc, "confirmed");
}

export async function mintFaucetTokens(
  recipientAddress: string,
  symbol: string
): Promise<{ signature: string; amount: number; mint: string }> {
  const manifest = getDevnetManifest();
  if (manifest.network !== "devnet") {
    throw new Error("Faucet is only available on devnet.");
  }

  const token = getFaucetToken(symbol);
  if (!token) {
    throw new Error(`Unsupported faucet token: ${symbol}`);
  }

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(recipientAddress);
  } catch {
    throw new Error("Invalid Solana wallet address.");
  }

  const authority = loadFaucetAuthority();
  const manifestAuthority = new PublicKey(manifest.mintAuthority);
  if (!authority.publicKey.equals(manifestAuthority)) {
    throw new Error(
      "Faucet authority does not match devnet manifest mintAuthority."
    );
  }

  const connection = getConnection();
  const mint = new PublicKey(token.mint);
  const amount = claimAmountRaw(token);

  const recipientAta = getAssociatedTokenAddressSync(mint, recipient);
  const ataInfo = await connection.getAccountInfo(recipientAta);

  const tx = new Transaction();
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        recipientAta,
        recipient,
        mint
      )
    );
  }

  tx.add(
    createMintToInstruction(mint, recipientAta, authority.publicKey, amount)
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [authority], {
    commitment: "confirmed",
    skipPreflight: false,
  });

  return {
    signature,
    amount: getFaucetClaimAmount(symbol),
    mint: token.mint,
  };
}
