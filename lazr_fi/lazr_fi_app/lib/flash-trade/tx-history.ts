import { flash } from "./client";

export type PerpsTxKind = "setup" | "deposit" | "withdraw" | "open" | "close";

export type PerpsTxDirection =
  | "long"
  | "short"
  | "deposit"
  | "withdraw"
  | "setup";

export type PerpsTxRecord = {
  id: string;
  timestamp: number;
  kind: PerpsTxKind;
  chain: "base" | "er";
  signature: string;
  market: string;
  direction: PerpsTxDirection;
  amountLabel: string;
  action: string;
};

const STORAGE_KEY = "lazr-perps-tx-history";
const MAX_TXS_PER_WALLET = 100;

export const PERPS_TX_HISTORY_UPDATED_EVENT = "lazr-perps-tx-history-updated";

type StoredHistory = Record<string, PerpsTxRecord[]>;

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

export function listPerpsTxs(wallet: string): PerpsTxRecord[] {
  return loadAll()[wallet] ?? [];
}

export function appendPerpsTx(
  wallet: string,
  tx: Omit<PerpsTxRecord, "id" | "timestamp">
): PerpsTxRecord {
  const record: PerpsTxRecord = {
    ...tx,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };
  const all = loadAll();
  const prev = all[wallet] ?? [];
  all[wallet] = [record, ...prev].slice(0, MAX_TXS_PER_WALLET);
  saveAll(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERPS_TX_HISTORY_UPDATED_EVENT));
  }
  return record;
}

/** Map enable/funds latency log rows into persisted history records. */
export function appendPerpsTxFromLog(
  wallet: string,
  entry: { action: string; chain: "er" | "base"; signature: string }
): PerpsTxRecord {
  const action = entry.action;
  const lower = action.toLowerCase();

  if (lower.startsWith("deposit ")) {
    const m = action.match(/^deposit\s+([\d.]+)\s+(\w+)/i);
    return appendPerpsTx(wallet, {
      kind: "deposit",
      chain: entry.chain,
      signature: entry.signature,
      market: m?.[2]?.toUpperCase() ?? "USDC",
      direction: "deposit",
      amountLabel: m ? `$${m[1]}` : action,
      action,
    });
  }

  if (lower.includes("withdraw")) {
    const m = action.match(/([\d.]+)\s+(\w+)/i);
    return appendPerpsTx(wallet, {
      kind: "withdraw",
      chain: entry.chain,
      signature: entry.signature,
      market: m?.[2]?.toUpperCase() ?? "USDC",
      direction: "withdraw",
      amountLabel: m ? `$${m[1]}` : action,
      action,
    });
  }

  return appendPerpsTx(wallet, {
    kind: "setup",
    chain: entry.chain,
    signature: entry.signature,
    market: "Flash Trade",
    direction: "setup",
    amountLabel: action,
    action,
  });
}

export function mainnetExplorerTx(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function erExplorerTx(signature: string): string {
  const customUrl = encodeURIComponent(flash.network.erRpc.replace(/\/$/, ""));
  return `https://solscan.io/tx/${signature}?cluster=custom&customUrl=${customUrl}`;
}

export function perpsTxExplorerUrl(
  chain: "base" | "er",
  signature: string
): string {
  return chain === "er" ? erExplorerTx(signature) : mainnetExplorerTx(signature);
}

export function formatTxAge(timestamp: number): string {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function kindLabel(kind: PerpsTxKind): string {
  switch (kind) {
    case "setup":
      return "Setup";
    case "deposit":
      return "Deposit";
    case "withdraw":
      return "Withdraw";
    case "open":
      return "Open";
    case "close":
      return "Close";
  }
}

export function directionLabel(direction: PerpsTxDirection): string {
  switch (direction) {
    case "long":
      return "Long";
    case "short":
      return "Short";
    case "deposit":
      return "Deposit";
    case "withdraw":
      return "Withdraw";
    case "setup":
      return "Setup";
  }
}

export function directionClass(direction: PerpsTxDirection): string {
  if (direction === "long" || direction === "deposit") return "text-green";
  if (direction === "short" || direction === "withdraw") return "text-red";
  return "text-secondary";
}
