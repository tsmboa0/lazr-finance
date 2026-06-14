import BN from "bn.js";
import { PublicKey, type Connection } from "@solana/web3.js";
import type { PropAmmWallet } from "./wallet";
import { getDevnetManifest } from "../devnet-config";
import { fromRawAmount } from "./amounts";
import { ER_ENDPOINT } from "./constants";
import { getDelegationStatus } from "./delegation";
import { userBankPda } from "./pdas";
import { getErProgram, getL1Program } from "./program";

interface BankEntry {
  mint: PublicKey;
  balance: BN;
}

function decimalsForMint(mint: string): number {
  const manifest = getDevnetManifest();
  if (mint === manifest.usdcMint) return manifest.usdcDecimals;
  const token = manifest.tokens.find((t) => t.assetMint === mint);
  return token?.decimals ?? 8;
}

export async function fetchBankBalances(
  connection: Connection,
  wallet: PropAmmWallet,
  user: PublicKey,
  mints: PublicKey[]
): Promise<Record<string, number>> {
  const userBank = userBankPda(user);
  const delegation = await getDelegationStatus(userBank);
  const bankExistsOnL1 = (await connection.getAccountInfo(userBank)) !== null;

  if (!delegation.isDelegated && !bankExistsOnL1) {
    const empty: Record<string, number> = {};
    for (const mint of mints) {
      empty[mint.toBase58()] = 0;
    }
    return empty;
  }

  const program =
    delegation.isDelegated
      ? getErProgram(wallet, ER_ENDPOINT)
      : getL1Program(connection, wallet);

  try {
    const bank = await (program.account as {
      userBank: { fetch: (pk: PublicKey) => Promise<{ entries: BankEntry[] }> };
    }).userBank.fetch(userBank);
    const balances: Record<string, number> = {};

    for (const mint of mints) {
      const entry = (bank.entries as BankEntry[]).find((e) =>
        e.mint.equals(mint)
      );
      balances[mint.toBase58()] = entry
        ? fromRawAmount(entry.balance, decimalsForMint(mint.toBase58()))
        : 0;
    }

    return balances;
  } catch {
    const empty: Record<string, number> = {};
    for (const mint of mints) {
      empty[mint.toBase58()] = 0;
    }
    return empty;
  }
}
