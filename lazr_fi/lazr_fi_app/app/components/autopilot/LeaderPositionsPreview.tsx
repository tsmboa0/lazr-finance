"use client";

import { allPositions } from "../../../lib/flash-trade/hooks";
import { fmtPnlUsd, fmtPrice, fmtUsd, num } from "../../../lib/flash-trade/format";
import type { BasketSnapshot } from "flash-v2";
import { Loader2 } from "lucide-react";

export default function LeaderPositionsPreview({
  snapshot,
  loading,
  error,
}: {
  snapshot: BasketSnapshot | null;
  loading: boolean;
  error: string | null;
}) {
  const positions = allPositions(snapshot);

  if (loading && !snapshot) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-tertiary">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />
        Loading live positions…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-tertiary py-2">{error}</p>
    );
  }

  if (positions.length === 0) {
    return (
      <p className="text-xs text-tertiary py-2">
        This trader has no open Flash V2 positions right now.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle overflow-hidden">
      {positions.map((p) => {
        const side = p.sideUi.toUpperCase();
        const isLong = side === "LONG";
        const pnl = num(p.pnlWithFeeUsdUi) ?? 0;
        return (
          <div
            key={`${p.marketSymbol}-${side}`}
            className="flex items-center justify-between gap-2 px-3 py-2 text-xs bg-elevated/10"
          >
            <div className="min-w-0">
              <span className="font-semibold text-foreground">
                {p.marketSymbol}
              </span>{" "}
              <span
                className={`font-medium ${isLong ? "text-green" : "text-red"}`}
              >
                {side}
              </span>
              <p className="text-[10px] text-tertiary font-mono mt-0.5">
                {fmtUsd(p.sizeUsdUi)} · {p.leverageUi}x
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p
                className={`font-mono tabular-nums ${
                  pnl >= 0 ? "text-green" : "text-red"
                }`}
              >
                {fmtPnlUsd(p.pnlWithFeeUsdUi)}
              </p>
              <p className="text-[10px] text-tertiary font-mono">
                @ ${fmtPrice(num(p.entryPriceUi))}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
