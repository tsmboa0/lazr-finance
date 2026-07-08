"use client";

import { createContext, useContext } from "react";
import type { MirrorLogEntry } from "../../lib/copy-trade/engine";

export interface CopyTradeContextValue {
  isCopying: boolean;
  maxFollowUsd: number;
  setMaxFollowUsd: (value: number) => void;
  leaderAddress: string | null;
  lastMirror: MirrorLogEntry | null;
  mirrorError: string | null;
  clearMirrorError: () => void;
  startCopying: (leaderAddress: string) => Promise<{ ok: boolean; error?: string }>;
  stopCopying: () => void;
}

export const CopyTradeContext = createContext<CopyTradeContextValue | null>(
  null
);

export function useCopyTrade(): CopyTradeContextValue {
  const ctx = useContext(CopyTradeContext);
  if (!ctx) {
    throw new Error("useCopyTrade must be used within CopyTradeProvider");
  }
  return ctx;
}

export function useOptionalCopyTrade(): CopyTradeContextValue | null {
  return useContext(CopyTradeContext);
}
