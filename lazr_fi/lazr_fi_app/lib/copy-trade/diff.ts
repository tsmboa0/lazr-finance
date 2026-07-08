import type { BasketSnapshot, PositionMetrics, TradeType } from "flash-v2";

export type MirrorEventKind = "OPEN" | "GROW" | "SHRINK" | "CLOSE";

export interface MirrorEvent {
  kind: MirrorEventKind;
  market: string;
  side: TradeType;
  deltaUsd: number;
  leverage: number;
  leaderCollateralUsd: number;
}

type PosKey = string;

function keyOf(p: PositionMetrics): PosKey {
  return `${p.marketSymbol}:${p.sideUi.toUpperCase()}`;
}

/**
 * Diff consecutive leader basket snapshots into mirror events.
 * Only call with `basket` frames — metrics frames re-price and would spam events.
 */
export function diffLeaderSnapshots(
  prev: BasketSnapshot | undefined,
  next: BasketSnapshot
): MirrorEvent[] {
  const events: MirrorEvent[] = [];
  const before = new Map<PosKey, PositionMetrics>(
    Object.values(prev?.positionMetrics ?? {}).map((p) => [keyOf(p), p])
  );
  const after = new Map<PosKey, PositionMetrics>(
    Object.values(next.positionMetrics ?? {}).map((p) => [keyOf(p), p])
  );

  for (const [, now] of after) {
    const was = before.get(keyOf(now));
    const side = now.sideUi.toUpperCase() as TradeType;
    const sizeNow = Number(now.sizeUsdUi);
    const lev = Number.parseFloat(now.leverageUi) || 1;
    const col = Number(now.collateralUsdUi);
    if (!was) {
      events.push({
        kind: "OPEN",
        market: now.marketSymbol,
        side,
        deltaUsd: sizeNow,
        leverage: lev,
        leaderCollateralUsd: col,
      });
    } else {
      const deltaUsd = sizeNow - Number(was.sizeUsdUi);
      if (Math.abs(deltaUsd) > 0.01) {
        events.push({
          kind: deltaUsd > 0 ? "GROW" : "SHRINK",
          market: now.marketSymbol,
          side,
          deltaUsd: Math.abs(deltaUsd),
          leverage: lev,
          leaderCollateralUsd: col,
        });
      }
    }
  }

  for (const [, was] of before) {
    if (!after.has(keyOf(was))) {
      events.push({
        kind: "CLOSE",
        market: was.marketSymbol,
        side: was.sideUi.toUpperCase() as TradeType,
        deltaUsd: Number(was.sizeUsdUi),
        leverage: 1,
        leaderCollateralUsd: Number(was.collateralUsdUi),
      });
    }
  }

  return events;
}
