import {
  subscribeOwner,
  type BasketSnapshot,
  type TradeType,
} from "flash-v2";
import { flash } from "../flash-trade/client";
import type { ActiveSigner } from "../flash-trade/signer";
import { executeClosePosition, executeOpenPosition } from "../flash-trade/trade";
import { appendPerpsTx } from "../flash-trade/tx-history";
import { allPositions } from "../flash-trade/hooks";
import { num } from "../flash-trade/format";
import { diffLeaderSnapshots, type MirrorEvent } from "./diff";
import { sizeMirrorEvent } from "./mirror";

export interface MirrorLogEntry {
  at: number;
  kind: MirrorEvent["kind"];
  market: string;
  side: TradeType;
  detail: string;
  signature?: string;
  skipped?: boolean;
}

export interface CopyTradeEngineCallbacks {
  onLog: (entry: MirrorLogEntry) => void;
  onError: (message: string) => void;
}

export interface CopyTradeEngineParams {
  leaderAddress: string;
  followerOwner: string;
  followerCollateralUsd: () => number;
  maxFollowUsd: number;
  signer: ActiveSigner;
  callbacks: CopyTradeEngineCallbacks;
}

export function startCopyTradeEngine(
  params: CopyTradeEngineParams
): { stop: () => void; seedSnapshot: (snap: BasketSnapshot) => void } {
  let prev: BasketSnapshot | undefined;
  let processing = false;
  let queued: BasketSnapshot | undefined;
  let dead = false;

  const seedSnapshot = (snap: BasketSnapshot) => {
    prev = structuredClone(snap);
  };

  async function replay(event: MirrorEvent) {
    const followerCol = params.followerCollateralUsd();
    const sized = sizeMirrorEvent(event, followerCol, params.maxFollowUsd);

    if (event.kind === "OPEN" || event.kind === "GROW") {
      if (sized.skipReason || sized.collateralUsd <= 0) {
        params.callbacks.onLog({
          at: Date.now(),
          kind: event.kind,
          market: event.market,
          side: event.side,
          detail: sized.skipReason ?? "Skipped — insufficient sizing",
          skipped: true,
        });
        return;
      }

      const collateralStr = sized.collateralUsd.toFixed(2);
      const result = await executeOpenPosition(params.signer, {
        marketSymbol: event.market,
        collateralUsd: collateralStr,
        leverage: event.leverage,
        side: event.side,
        orderType: "MARKET",
        slippagePercentage: "0.8",
      });

      if (result.ok && result.signature) {
        appendPerpsTx(params.followerOwner, {
          kind: "open",
          chain: "er",
          signature: result.signature,
          market: event.market,
          direction: event.side === "LONG" ? "long" : "short",
          amountLabel: `$${collateralStr} @ ${event.leverage.toFixed(1)}×`,
          action: `copy ${event.kind.toLowerCase()} ${event.side.toLowerCase()}`,
        });
        params.callbacks.onLog({
          at: Date.now(),
          kind: event.kind,
          market: event.market,
          side: event.side,
          detail: `Mirrored $${sized.usd.toFixed(2)} (${sized.label})`,
          signature: result.signature,
        });
      } else {
        params.callbacks.onError(result.error ?? "Copy open failed");
      }
      return;
    }

    const closeUsd =
      event.kind === "CLOSE" ? "0" : sized.usd > 0 ? sized.usd.toFixed(2) : "0";

    const result = await executeClosePosition(params.signer, {
      marketSymbol: event.market,
      side: event.side,
      inputUsdUi: closeUsd,
    });

    if (result.ok && result.signature) {
      appendPerpsTx(params.followerOwner, {
        kind: "close",
        chain: "er",
        signature: result.signature,
        market: event.market,
        direction: event.side === "LONG" ? "long" : "short",
        amountLabel: closeUsd === "0" ? "Full close" : `$${closeUsd}`,
        action: `copy ${event.kind.toLowerCase()} ${event.side.toLowerCase()}`,
      });
      params.callbacks.onLog({
        at: Date.now(),
        kind: event.kind,
        market: event.market,
        side: event.side,
        detail:
          closeUsd === "0"
            ? "Mirrored full close"
            : `Mirrored close $${closeUsd}`,
        signature: result.signature,
      });
    } else {
      params.callbacks.onError(result.error ?? "Copy close failed");
    }
  }

  async function onBasketFrame(snap: BasketSnapshot) {
    if (dead) return;
    if (processing) {
      queued = snap;
      return;
    }
    processing = true;
    try {
      let next: BasketSnapshot | undefined = snap;
      while (next && !dead) {
        const events = diffLeaderSnapshots(prev, next);
        prev = structuredClone(next);
        for (const e of events) {
          try {
            await replay(e);
          } catch (err) {
            params.callbacks.onError(
              err instanceof Error ? err.message : String(err)
            );
          }
        }
        next = queued;
        queued = undefined;
      }
    } finally {
      processing = false;
    }
  }

  const stream = subscribeOwner({
    owner: params.leaderAddress,
    network: flash.network,
    onUpdate: (snap, source) => {
      if (source !== "basket") return;
      void onBasketFrame(snap);
    },
  });

  return {
    stop: () => {
      dead = true;
      stream.close();
    },
    seedSnapshot,
  };
}

/** Follower collateral for ratio sizing: free margin + position collateral. */
export function followerCollateralUsd(
  marginBalanceUsd: number,
  snapshot: BasketSnapshot | null
): number {
  const positions = allPositions(snapshot);
  let inPositions = 0;
  for (const p of positions) {
    inPositions += num(p.collateralUsdUi) ?? 0;
  }
  return marginBalanceUsd + inPositions;
}
