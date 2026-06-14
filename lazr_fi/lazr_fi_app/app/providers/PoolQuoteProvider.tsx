"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  usePoolQuote,
  type PoolQuoteView,
} from "../hooks/usePoolQuote";

const PoolQuoteContext = createContext<PoolQuoteView | null>(null);

export function PoolQuoteProvider({
  assetSymbol,
  children,
}: {
  assetSymbol: string;
  children: ReactNode;
}) {
  const quote = usePoolQuote(assetSymbol);
  return (
    <PoolQuoteContext.Provider value={quote}>{children}</PoolQuoteContext.Provider>
  );
}

export function usePoolQuoteContext(): PoolQuoteView {
  const ctx = useContext(PoolQuoteContext);
  if (!ctx) {
    throw new Error("usePoolQuoteContext must be used within PoolQuoteProvider");
  }
  return ctx;
}
