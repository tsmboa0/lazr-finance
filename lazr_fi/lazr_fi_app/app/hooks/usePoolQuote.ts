"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getPoolForSymbol } from "../../lib/devnet-config";
import { getErSubscriptionConnection } from "../../lib/prop-amm/er-connection";
import {
  computeSwapAssetForUsdc,
  computeSwapUsdcForAsset,
  computeVirtualReservesE8,
  e8ToUsd,
  humanToRaw,
  rawToHuman,
} from "../../lib/prop-amm/quote-math";
import {
  decodePoolConfig,
  decodeQuoteState,
  isQuoteFresh,
  type PoolConfigQuote,
  type PoolQuote,
} from "../../lib/prop-amm/quote-decode";

const DEFAULT_VIRTUAL_DEPTH_K = BigInt(1_000_000_000);
const DEFAULT_MAX_STALENESS_SEC = BigInt(10);
/** Slippage applied to on-chain estimate when building minAmountOut. */
export const SWAP_SLIPPAGE_BPS = BigInt(50);

export interface SwapEstimate {
  outputHuman: number;
  minAmountOutHuman: number;
}

export interface PoolQuoteView {
  quote: PoolQuote | null;
  config: PoolConfigQuote | null;
  fairPriceUsd: number;
  bidPriceUsd: number;
  askPriceUsd: number;
  spreadBps: number;
  loading: boolean;
  connected: boolean;
  fresh: boolean;
  estimateSwap: (
    amountIn: number,
    direction: "usdc_for_asset" | "asset_for_usdc",
    assetDecimals: number,
    usdcDecimals: number
  ) => SwapEstimate | null;
}

export function usePoolQuote(assetSymbol: string): PoolQuoteView {
  const [quote, setQuote] = useState<PoolQuote | null>(null);
  const [config, setConfig] = useState<PoolConfigQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const pool = useMemo(() => getPoolForSymbol(assetSymbol), [assetSymbol]);
  const quotePk = useMemo(() => new PublicKey(pool.quoteState), [pool.quoteState]);
  const configPk = useMemo(() => new PublicKey(pool.config), [pool.config]);

  useEffect(() => {
    let cancelled = false;
    const connection = getErSubscriptionConnection();

    const applyQuote = (data: Buffer) => {
      const decoded = decodeQuoteState(data);
      if (!decoded || cancelled) return;
      setQuote(decoded);
      setConnected(true);
      setLoading(false);
    };

    const bootstrap = async () => {
      setLoading(true);
      try {
        const [quoteInfo, configInfo] = await Promise.all([
          connection.getAccountInfo(quotePk, "confirmed"),
          connection.getAccountInfo(configPk, "confirmed"),
        ]);

        if (cancelled) return;

        if (configInfo?.data) {
          const decodedConfig = decodePoolConfig(configInfo.data);
          if (decodedConfig) setConfig(decodedConfig);
        }

        if (quoteInfo?.data) {
          applyQuote(quoteInfo.data);
        }
      } catch {
        // ER quote unavailable; UI falls back to market data.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();

    const subId = connection.onAccountChange(
      quotePk,
      (accountInfo) => {
        if (accountInfo?.data) applyQuote(accountInfo.data);
      },
      "confirmed"
    );

    return () => {
      cancelled = true;
      void connection.removeAccountChangeListener(subId);
    };
  }, [quotePk, configPk, assetSymbol]);

  const virtualDepthK = config?.virtualDepthK ?? DEFAULT_VIRTUAL_DEPTH_K;
  const maxStalenessSec =
    config?.maxOracleStalenessSec ?? DEFAULT_MAX_STALENESS_SEC;

  const fresh = quote ? isQuoteFresh(quote, maxStalenessSec) : false;

  const fairPriceUsd = quote ? e8ToUsd(quote.fairPriceE8) : 0;
  const bidPriceUsd = quote ? e8ToUsd(quote.bidPriceE8) : 0;
  const askPriceUsd = quote ? e8ToUsd(quote.askPriceE8) : 0;
  const spreadBps = quote ? Number(quote.spreadBps) : 0;

  const estimateSwap = useCallback(
    (
      amountIn: number,
      direction: "usdc_for_asset" | "asset_for_usdc",
      assetDecimals: number,
      usdcDecimals: number
    ): SwapEstimate | null => {
      if (!quote || !fresh || amountIn <= 0) return null;

      const reserves = computeVirtualReservesE8(
        quote.executablePriceE8,
        virtualDepthK,
        assetDecimals,
        usdcDecimals
      );
      if (!reserves) return null;

      const [vx, vy] = reserves;
      let rawOut = BigInt(0);

      if (direction === "usdc_for_asset") {
        const rawIn = humanToRaw(amountIn, usdcDecimals);
        rawOut = computeSwapUsdcForAsset(rawIn, vx, vy, quote.spreadBps);
        const outputHuman = rawToHuman(rawOut, assetDecimals);
        const minRaw =
          rawOut - (rawOut * SWAP_SLIPPAGE_BPS) / BigInt(10_000);
        return {
          outputHuman,
          minAmountOutHuman: rawToHuman(
            minRaw > BigInt(0) ? minRaw : BigInt(0),
            assetDecimals
          ),
        };
      }

      const rawIn = humanToRaw(amountIn, assetDecimals);
      rawOut = computeSwapAssetForUsdc(rawIn, vx, vy, quote.spreadBps);
      const outputHuman = rawToHuman(rawOut, usdcDecimals);
      const minRaw = rawOut - (rawOut * SWAP_SLIPPAGE_BPS) / BigInt(10_000);
      return {
        outputHuman,
        minAmountOutHuman: rawToHuman(
          minRaw > BigInt(0) ? minRaw : BigInt(0),
          usdcDecimals
        ),
      };
    },
    [quote, fresh, virtualDepthK]
  );

  return {
    quote,
    config,
    fairPriceUsd,
    bidPriceUsd,
    askPriceUsd,
    spreadBps,
    loading,
    connected,
    fresh,
    estimateSwap,
  };
}
