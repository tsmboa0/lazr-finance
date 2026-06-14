/** Parse an API decimal string defensively. */
export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function usdDigits(abs: number, base: number): number {
  if (abs === 0) return base;
  if (abs < 0.01) return 4;
  if (abs < 1) return 3;
  return base;
}

export function fmtUsd(
  v: string | number | null | undefined,
  digits = 2
): string {
  const n = num(v);
  if (n === null) return "—";
  const abs = Math.abs(n);
  const d = usdDigits(abs, digits);
  const sign = n < 0 ? "−" : "";
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}

export function fmtPnlUsd(v: string | number | null | undefined): string {
  const n = num(v);
  if (n === null) return "—";
  const abs = Math.abs(n);
  return `${n >= 0 ? "+" : "−"}$${abs.toFixed(usdDigits(abs, 2))}`;
}

export function fmtPct(
  v: string | number | null | undefined,
  digits = 2
): string {
  const n = num(v);
  if (n === null) return "—";
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`;
}

export function fmtPrice(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (v >= 1000) {
    return v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (v >= 1) return v.toFixed(digits);
  return v.toFixed(4);
}

export function fmtLeverage(v: string | number | null | undefined): string {
  const n = num(v);
  return n === null ? "∞×" : `${n.toFixed(1)}×`;
}

export interface PositionView {
  pnlUsd: number;
  pnlPct: number;
  leverage: number;
  liqUi: number | null;
}

export function computePositionView(
  p: {
    sideUi: string;
    sizeUsdUi: string;
    collateralUsdUi: string;
    entryPriceUi: string;
    exitFeeUsd: string;
    borrowFeeUsd: string;
  },
  markUi: number | null
): PositionView | null {
  const size = num(p.sizeUsdUi);
  const coll = num(p.collateralUsdUi);
  const entry = num(p.entryPriceUi);
  if (size === null || coll === null || entry === null || entry <= 0 || markUi === null) {
    return null;
  }
  const dir = p.sideUi.toUpperCase() === "LONG" ? 1 : -1;
  const fees = ((num(p.exitFeeUsd) ?? 0) + (num(p.borrowFeeUsd) ?? 0)) / 1e6;
  const pnlUsd = ((markUi - entry) / entry) * size * dir - fees;
  const pnlPct = coll > 0 ? (pnlUsd / coll) * 100 : 0;
  const leverage = coll > 0 ? size / coll : 0;
  const liqUi = size > 0 ? entry * (1 - dir * (coll / size) * 0.92) : null;
  return { pnlUsd, pnlPct, leverage, liqUi };
}
