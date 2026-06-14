"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getDevnetManifest } from "../../lib/devnet-config";
import { getErSubscriptionConnection } from "../../lib/prop-amm/er-connection";
import {
  decodeQuoteState,
  isQuoteFresh,
  type PoolQuote,
} from "../../lib/prop-amm/quote-decode";
import { e8ToUsd } from "../../lib/prop-amm/quote-math";

const DEFAULT_MAX_STALENESS_SEC = BigInt(10);

export interface PoolQuoteSnapshot {
  fairPriceUsd: number;
  bidPriceUsd: number;
  askPriceUsd: number;
  fresh: boolean;
}

function toSnapshot(quote: PoolQuote): PoolQuoteSnapshot {
  return {
    fairPriceUsd: e8ToUsd(quote.fairPriceE8),
    bidPriceUsd: e8ToUsd(quote.bidPriceE8),
    askPriceUsd: e8ToUsd(quote.askPriceE8),
    fresh: isQuoteFresh(quote, DEFAULT_MAX_STALENESS_SEC),
  };
}

export function useAllPoolQuotes() {
  const poolTokens = useMemo(() => getDevnetManifest().tokens, []);
  const [bySymbol, setBySymbol] = useState<Record<string, PoolQuoteSnapshot>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const connection = getErSubscriptionConnection();
    const subIds: number[] = [];

    const applyQuote = (symbol: string, data: Buffer) => {
      const decoded = decodeQuoteState(data);
      if (!decoded || cancelled) return;
      setBySymbol((prev) => ({
        ...prev,
        [symbol]: toSnapshot(decoded),
      }));
    };

    const bootstrap = async () => {
      setLoading(true);
      try {
        await Promise.all(
          poolTokens.map(async (token) => {
            const quotePk = new PublicKey(token.quoteState);
            const info = await connection.getAccountInfo(quotePk, "confirmed");
            if (info?.data) applyQuote(token.symbol, info.data);
          })
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();

    for (const token of poolTokens) {
      const quotePk = new PublicKey(token.quoteState);
      const subId = connection.onAccountChange(
        quotePk,
        (accountInfo) => {
          if (accountInfo?.data) applyQuote(token.symbol, accountInfo.data);
        },
        "confirmed"
      );
      subIds.push(subId);
    }

    return () => {
      cancelled = true;
      for (const subId of subIds) {
        void connection.removeAccountChangeListener(subId);
      }
    };
  }, [poolTokens]);

  const getLiveQuote = useCallback(
    (symbol: string): PoolQuoteSnapshot | undefined => {
      return bySymbol[symbol.toUpperCase()];
    },
    [bySymbol]
  );

  return { bySymbol, loading, getLiveQuote };
}
