"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  TOKENS,
  type Token,
  getTokenBySymbol,
} from "../data/tokens";

interface MarketDataContextValue {
  tokens: Token[];
  loading: boolean;
  getToken: (symbol: string) => Token | undefined;
}

const MarketDataContext = createContext<MarketDataContextValue>({
  tokens: TOKENS,
  loading: true,
  getToken: (symbol) => getTokenBySymbol(symbol),
});

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<Token[]>(TOKENS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/market")
      .then((response) => response.json())
      .then((data: { tokens?: Token[] }) => {
        if (!cancelled && data.tokens?.length) {
          setTokens(data.tokens);
        }
      })
      .catch(() => {
        // Keep static fallback tokens on failure.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const getToken = useCallback(
    (symbol: string) => getTokenBySymbol(symbol, tokens),
    [tokens]
  );

  const value = useMemo(
    () => ({ tokens, loading, getToken }),
    [tokens, loading, getToken]
  );

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
