import { ER_ENDPOINT } from "./constants";

export type PropAmmTxKind = "swap" | "deposit" | "withdraw" | "autopilot";

export type PropAmmTxRecord = {
  id: string;
  timestamp: number;
  kind: PropAmmTxKind;
  signature: string;
  /** e.g. BTC/USDC for swaps */
  pair: string;
  /** buy | sell for swaps; deposit | withdraw for bank moves; check | skip for autopilot ticks */
  direction: "buy" | "sell" | "deposit" | "withdraw" | "check" | "skip";
  amountLabel: string;
};

const STORAGE_KEY = "lazr-propamm-tx-history";
const MAX_TXS_PER_WALLET = 100;

export const TX_HISTORY_UPDATED_EVENT = "lazr-propamm-tx-history-updated";

type StoredHistory = Record<string, PropAmmTxRecord[]>;

function loadAll(): StoredHistory {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredHistory;
  } catch {
    return {};
  }
}

function saveAll(data: StoredHistory): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function listPropAmmTxs(wallet: string): PropAmmTxRecord[] {
  const all = loadAll();
  return all[wallet] ?? [];
}

export function appendPropAmmTx(
  wallet: string,
  tx: Omit<PropAmmTxRecord, "id" | "timestamp">
): PropAmmTxRecord {
  const record: PropAmmTxRecord = {
    ...tx,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };
  const all = loadAll();
  const prev = all[wallet] ?? [];
  all[wallet] = [record, ...prev].slice(0, MAX_TXS_PER_WALLET);
  saveAll(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TX_HISTORY_UPDATED_EVENT));
  }
  return record;
}

/** Ephemeral rollup txs (swaps on MagicBlock ER). */
export function rollupExplorerTx(signature: string): string {
  const customUrl = encodeURIComponent(ER_ENDPOINT.replace(/\/$/, ""));
  return `https://solscan.io/tx/${signature}?cluster=custom&customUrl=${customUrl}`;
}

/** Devnet base-layer txs (deposits & withdrawals). */
export function devnetExplorerTx(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}

export function propAmmTxExplorerUrl(
  kind: PropAmmTxKind,
  signature: string
): string {
  return kind === "swap" || kind === "autopilot"
    ? rollupExplorerTx(signature)
    : devnetExplorerTx(signature);
}

export function formatTxAge(timestamp: number): string {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
