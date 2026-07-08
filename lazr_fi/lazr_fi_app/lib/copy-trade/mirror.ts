import { RECOMMENDED_MIN_COLLATERAL_USD } from "flash-v2";
import type { MirrorEvent } from "./diff";

export const DEFAULT_MAX_FOLLOW_USD = 100;

export interface MirrorSizeResult {
  usd: number;
  collateralUsd: number;
  label: string;
  skipReason?: string;
}

export function sizeMirrorEvent(
  event: MirrorEvent,
  followerCollateralUsd: number,
  maxFollowUsd: number
): MirrorSizeResult {
  const ratio =
    event.leaderCollateralUsd > 0 && followerCollateralUsd > 0
      ? followerCollateralUsd / event.leaderCollateralUsd
      : 0;

  const usd = Math.min(event.deltaUsd * ratio, maxFollowUsd);
  const label = `ratio ${ratio.toFixed(3)} (${followerCollateralUsd.toFixed(2)}/${event.leaderCollateralUsd.toFixed(2)} USDC)`;

  if (event.kind === "OPEN" || event.kind === "GROW") {
    const collateralUsd = event.leverage > 0 ? usd / event.leverage : usd;
    if (collateralUsd < RECOMMENDED_MIN_COLLATERAL_USD) {
      return {
        usd: 0,
        collateralUsd,
        label,
        skipReason: `Mirror too small ($${collateralUsd.toFixed(2)} collateral < $${RECOMMENDED_MIN_COLLATERAL_USD} floor)`,
      };
    }
    return { usd, collateralUsd, label };
  }

  return { usd, collateralUsd: usd, label };
}
