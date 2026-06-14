import type { BasketSnapshot } from "flash-v2";
import { allPositions } from "../flash-trade/hooks";
import { num } from "../flash-trade/format";
import type { LeaderStats } from "./types";

export function summarizeLeaderStats(
  snapshot: BasketSnapshot | null | undefined
): LeaderStats {
  const positions = allPositions(snapshot ?? null);
  let totalNotionalUsd = 0;
  let unrealizedPnlUsd = 0;
  let totalCollateralUsd = 0;

  for (const p of positions) {
    totalNotionalUsd += num(p.sizeUsdUi) ?? 0;
    unrealizedPnlUsd += num(p.pnlWithFeeUsdUi) ?? 0;
    totalCollateralUsd += num(p.collateralUsdUi) ?? 0;
  }

  return {
    openCount: positions.length,
    totalNotionalUsd,
    unrealizedPnlUsd,
    totalCollateralUsd,
  };
}
