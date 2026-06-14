export function formatUsdPrice(price: number): string {
  if (!Number.isFinite(price)) return "--";
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}tn`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}bn`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${value.toFixed(2)}`;
}

export function formatPercentChange(pct: number): string {
  if (!Number.isFinite(pct)) return "--";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatPercentDisplay(pct: number): string {
  if (!Number.isFinite(pct)) return "--";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function normalizeSparkline(prices: number[], points = 24): number[] {
  if (prices.length === 0) return [];
  const slice = prices.slice(-points);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const range = max - min || 1;
  return slice.map((price) => 10 + ((price - min) / range) * 50);
}

export function percentChange(current: number, previous: number): number {
  if (!previous || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

/** Bank balances in swap/trade panels — BTC/ETH/SOL show 4 decimals to reflect small changes. */
export function formatBankBalance(value: number, ticker?: string): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const t = ticker?.toUpperCase();

  if (t === "USDC") {
    if (value < 1000) return value.toFixed(2);
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  if (t === "BTC" || t === "ETH" || t === "SOL") {
    if (value < 10_000) return value.toFixed(4);
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }

  if (value < 0.0001) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Swap output / amount fields — high-value assets use 4 decimals when small. */
export function formatSwapAmount(value: number, ticker?: string): string {
  if (!Number.isFinite(value) || value === 0) return "0.00";
  const t = ticker?.toUpperCase();

  if (t === "BTC" || t === "ETH") {
    if (value < 1000) return value.toFixed(4);
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }

  if (t === "USDC") {
    if (value < 1000) return value.toFixed(2);
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  if (value < 0.0001) return value.toFixed(8);
  if (value < 1) return value.toFixed(6);
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatFaucetClaimAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "--";
  if (Number.isInteger(amount)) {
    return amount.toLocaleString("en-US");
  }
  const decimals = amount < 1 ? 4 : amount < 100 ? 2 : 0;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}
