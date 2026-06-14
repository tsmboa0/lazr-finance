import { PublicKey } from "@solana/web3.js";
import { flash } from "./client";
import { MAGIC_TRADE_PROGRAM } from "./session";

const LEDGER_DISC_B58 = "9bYPoR9mRKo";
const LEDGER_OWNER_OFFSET = 16;
const LEDGER_COUNT_OFFSET = 48;
const LEDGER_ENTRIES_OFFSET = 52;
const LEDGER_ENTRY_SIZE = 40;

export interface BasketBalance {
  inBasketUsd: number;
  source: "er" | "base";
}

async function fetchLedgerEntries(
  rpcUrl: string,
  owner: string
): Promise<Map<string, number> | null> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getProgramAccounts",
      params: [
        MAGIC_TRADE_PROGRAM.toBase58(),
        {
          encoding: "base64",
          filters: [
            { memcmp: { offset: 0, bytes: LEDGER_DISC_B58 } },
            { memcmp: { offset: LEDGER_OWNER_OFFSET, bytes: owner } },
          ],
        },
      ],
    }),
  });
  const json = (await res.json()) as {
    result?: Array<{ account: { data: [string, string] } }>;
  };
  const acct = json.result?.[0];
  if (!acct) return null;
  const buf = Uint8Array.from(atob(acct.account.data[0]), (c) =>
    c.charCodeAt(0)
  );
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = view.getUint32(LEDGER_COUNT_OFFSET, true);
  const out = new Map<string, number>();
  for (let i = 0; i < Math.min(count, 20); i++) {
    const off = LEDGER_ENTRIES_OFFSET + i * LEDGER_ENTRY_SIZE;
    const mint = new PublicKey(buf.subarray(off, off + 32)).toBase58();
    const amount = Number(view.getBigUint64(off + 32, true));
    out.set(mint, (out.get(mint) ?? 0) + amount);
  }
  return out;
}

export async function fetchBasketBalance(args: {
  owner: string;
  basketPubkey: string | null;
  usdcMint: string;
  usdcDecimals?: number;
}): Promise<BasketBalance> {
  const { owner, basketPubkey, usdcMint, usdcDecimals = 6 } = args;

  let source: "er" | "base" = "er";
  let ledger = await fetchLedgerEntries(flash.network.erRpc, owner);
  if (ledger === null) {
    ledger = await fetchLedgerEntries(flash.network.baseRpc, owner);
    source = "base";
  }
  if (ledger === null) {
    return { inBasketUsd: 0, source: "base" };
  }

  const debits = new Map<string, number>();
  const pending = new Map<string, number>();
  if (basketPubkey) {
    const raw = await flash.rawBasket(basketPubkey);
    const acct = raw.account as {
      debits?: Array<{ mint: string; amount: number | string }>;
      pendingCredits?: Array<{ mint: string; amount: number | string }>;
    };
    for (const r of acct.debits ?? []) {
      debits.set(r.mint, (debits.get(r.mint) ?? 0) + Number(r.amount));
    }
    for (const r of acct.pendingCredits ?? []) {
      pending.set(
        r.mint,
        (pending.get(r.mint) ?? 0) + Number(r.amount)
      );
    }
  }

  const rawAvail =
    (ledger.get(usdcMint) ?? 0) -
    (debits.get(usdcMint) ?? 0) +
    (pending.get(usdcMint) ?? 0);
  const amountUi = Math.max(0, rawAvail) / 10 ** usdcDecimals;
  return { inBasketUsd: amountUi, source };
}
