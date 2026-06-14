"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useAllPoolQuotes,
  type PoolQuoteSnapshot,
} from "../hooks/useAllPoolQuotes";

interface AllPoolQuotesContextValue {
  loading: boolean;
  getLiveQuote: (symbol: string) => PoolQuoteSnapshot | undefined;
}

const AllPoolQuotesContext = createContext<AllPoolQuotesContextValue | null>(
  null
);

export function AllPoolQuotesProvider({ children }: { children: ReactNode }) {
  const { loading, getLiveQuote } = useAllPoolQuotes();
  return (
    <AllPoolQuotesContext.Provider value={{ loading, getLiveQuote }}>
      {children}
    </AllPoolQuotesContext.Provider>
  );
}

export function useAllPoolQuotesContext(): AllPoolQuotesContextValue {
  const ctx = useContext(AllPoolQuotesContext);
  if (!ctx) {
    throw new Error(
      "useAllPoolQuotesContext must be used within AllPoolQuotesProvider"
    );
  }
  return ctx;
}

/** Live ER quote when provider is present; undefined otherwise. */
export function useOptionalLiveQuote(symbol: string): PoolQuoteSnapshot | undefined {
  const ctx = useContext(AllPoolQuotesContext);
  return ctx?.getLiveQuote(symbol);
}
