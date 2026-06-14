"use client";

import { useEffect, useRef, useState } from "react";
import type { BasketSnapshot, PositionMetrics, PriceInfo } from "flash-v2";
import { flash } from "./client";

export const FLASH_PRICE_POLL_MS = 2000;

export function useFlashPrice(symbol: string, intervalMs = FLASH_PRICE_POLL_MS): {
  price: PriceInfo | null;
  markUsd: number | null;
  loading: boolean;
} {
  const [price, setPrice] = useState<PriceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!symbol) {
      setPrice(null);
      setLoading(false);
      return;
    }
    setPrice(null);
    setLoading(true);
    last.current = null;
    let dead = false;

    const tick = async () => {
      try {
        const p = await flash.price(symbol);
        if (dead) return;
        last.current = p.priceUi;
        setPrice(p);
        setLoading(false);
      } catch {
        if (!dead) setLoading(false);
      }
    };

    void tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      dead = true;
      clearInterval(timer);
    };
  }, [symbol, intervalMs]);

  return { price, markUsd: price?.priceUi ?? null, loading };
}

export interface MarketLimits {
  minLeverage: number;
  maxLeverage: number;
  spreadLongPct: number;
  spreadShortPct: number;
}

const LEVERAGE_SCALE = 10_000;
const limitsCache = new Map<string, MarketLimits>();
let custodyPricing: Map<
  string,
  { min: number; max: number; spreadL: number; spreadS: number }
> | null = null;

export function useMarketLimits(marketSymbol: string): MarketLimits | null {
  const [limits, setLimits] = useState<MarketLimits | null>(
    limitsCache.get(marketSymbol) ?? null
  );

  useEffect(() => {
    const cached = limitsCache.get(marketSymbol);
    setLimits(cached ?? null);
    if (cached) return;

    let dead = false;
    void (async () => {
      try {
        if (!custodyPricing || custodyPricing.size === 0) {
          const res = await fetch(`${flash.network.apiBase}/raw/custodies`);
          const json = (await res.json()) as
            | Array<{
                account?: {
                  tokenMint?: string;
                  pricing?: {
                    minInitialLeverage?: number;
                    maxInitialLeverage?: number;
                    tradeSpreadLong?: number;
                    tradeSpreadShort?: number;
                  };
                };
              }>
            | { custodies?: unknown };
          const arr = Array.isArray(json) ? json : [];
          const map = new Map<
            string,
            { min: number; max: number; spreadL: number; spreadS: number }
          >();
          for (const c of arr) {
            const a = c.account;
            if (a?.tokenMint && a.pricing?.maxInitialLeverage) {
              map.set(a.tokenMint, {
                min: (a.pricing.minInitialLeverage ?? LEVERAGE_SCALE) / LEVERAGE_SCALE,
                max: a.pricing.maxInitialLeverage / LEVERAGE_SCALE,
                spreadL: (a.pricing.tradeSpreadLong ?? 0) / 10_000,
                spreadS: (a.pricing.tradeSpreadShort ?? 0) / 10_000,
              });
            }
          }
          if (map.size > 0) custodyPricing = map;
        }
        if (!custodyPricing) return;
        const tokens = await flash.tokens();
        if (dead) return;
        const mint = tokens.find(
          (t) => t.symbol.toUpperCase() === marketSymbol.toUpperCase()
        )?.mintKey;
        const p = mint ? custodyPricing.get(mint) : undefined;
        if (p) {
          const out: MarketLimits = {
            minLeverage: Math.max(1.1, p.min),
            maxLeverage: p.max,
            spreadLongPct: p.spreadL,
            spreadShortPct: p.spreadS,
          };
          limitsCache.set(marketSymbol, out);
          setLimits(out);
        }
      } catch {
        // fallback stays
      }
    })();

    return () => {
      dead = true;
    };
  }, [marketSymbol]);

  return limits;
}

export function positionsFor(
  snapshot: BasketSnapshot | null,
  marketSymbol: string
): PositionMetrics[] {
  if (!snapshot?.positionMetrics) return [];
  return Object.values(snapshot.positionMetrics).filter(
    (p) => p.marketSymbol?.toUpperCase() === marketSymbol.toUpperCase()
  );
}

export function allPositions(
  snapshot: BasketSnapshot | null
): PositionMetrics[] {
  if (!snapshot?.positionMetrics) return [];
  return Object.values(snapshot.positionMetrics);
}

export function allOpenOrders(snapshot: BasketSnapshot | null) {
  if (!snapshot?.orderMetrics) return [];
  return Object.values(snapshot.orderMetrics).flatMap((om) => {
    const rows: Array<{
      marketSymbol: string;
      side: string;
      type: string;
      sizeUsd: string;
      price: string;
    }> = [];
    for (const lo of om.limitOrders ?? []) {
      rows.push({
        marketSymbol: om.marketSymbol,
        side: om.sideUi,
        type: "Limit",
        sizeUsd: lo.sizeUsdUi ?? lo.sizeAmountUi,
        price: lo.limitPriceUi,
      });
    }
    for (const tp of om.takeProfitOrders ?? []) {
      rows.push({
        marketSymbol: om.marketSymbol,
        side: om.sideUi,
        type: "TP",
        sizeUsd: tp.sizeUsdUi ?? tp.sizeAmountUi,
        price: tp.triggerPriceUi,
      });
    }
    for (const sl of om.stopLossOrders ?? []) {
      rows.push({
        marketSymbol: om.marketSymbol,
        side: om.sideUi,
        type: "SL",
        sizeUsd: sl.sizeUsdUi ?? sl.sizeAmountUi,
        price: sl.triggerPriceUi,
      });
    }
    return rows;
  });
}
