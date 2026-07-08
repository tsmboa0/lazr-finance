export interface CopyTradeConfig {
  enabled: boolean;
  leaderAddress: string;
  maxFollowUsd: number;
}

const STORAGE_KEY = "lazr-copy-trade-config";
const DEFAULT_MAX = 100;

type Stored = Record<string, CopyTradeConfig>;

function loadAll(): Stored {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return {};
  }
}

function saveAll(data: Stored): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadCopyTradeConfig(wallet: string): CopyTradeConfig | null {
  const cfg = loadAll()[wallet];
  if (!cfg?.leaderAddress) return null;
  return {
    enabled: Boolean(cfg.enabled),
    leaderAddress: cfg.leaderAddress,
    maxFollowUsd:
      typeof cfg.maxFollowUsd === "number" && cfg.maxFollowUsd > 0
        ? cfg.maxFollowUsd
        : DEFAULT_MAX,
  };
}

export function saveCopyTradeConfig(
  wallet: string,
  config: CopyTradeConfig | null
): void {
  const all = loadAll();
  if (!config) {
    delete all[wallet];
  } else {
    all[wallet] = config;
  }
  saveAll(all);
}

export const COPY_TRADE_STATE_EVENT = "lazr-copy-trade-state";

export function notifyCopyTradeStateChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COPY_TRADE_STATE_EVENT));
  }
}
