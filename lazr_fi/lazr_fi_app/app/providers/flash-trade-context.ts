"use client";

import { createContext, useContext } from "react";
import type { BasketSnapshot, TradeType } from "flash-v2";
import type { EnableState } from "../../lib/flash-trade/enable";
import type { FundsStep } from "../../lib/flash-trade/funds";
import type { LoadedSession } from "../../lib/flash-trade/session-store";
import type { ActiveSigner } from "../../lib/flash-trade/signer";
import type { OpenTradeParams } from "../../lib/flash-trade/trade";

export type StreamStatus =
  | "connecting"
  | "open"
  | "reconnecting"
  | "polling"
  | "closed";

export interface FlashTradeContextValue {
  connected: boolean;
  owner: string | null;
  isPerpsEnabled: boolean;
  /** Basket exists on-chain but this browser has no valid session key in localStorage. */
  needsSessionRefresh: boolean;
  ownerLoaded: boolean;
  streamStatus: StreamStatus;
  snapshot: BasketSnapshot | null;
  session: LoadedSession | null;
  activeSigner: ActiveSigner | null;
  usdcMint: string | null;
  marginBalanceUsd: number;
  marginLoading: boolean;
  perpsWalletUsdc: number | null;
  perpsWalletLoading: boolean;
  refreshPerpsWallet: () => Promise<void>;
  enableState: EnableState | null;
  enabling: boolean;
  fundsStep: FundsStep | null;
  fundsLoading: boolean;
  tradeBusy: boolean;
  tradeError: string | null;
  refreshMargin: () => Promise<void>;
  refreshOwner: () => Promise<void>;
  runEnable: () => Promise<boolean>;
  depositMargin: (amount: string) => Promise<{ ok: boolean; error?: string }>;
  withdrawMargin: (
    amount: string
  ) => Promise<{ ok: boolean; error?: string; executePending?: boolean }>;
  openPosition: (
    params: OpenTradeParams
  ) => Promise<{ ok: boolean; signature?: string; error?: string }>;
  closePosition: (params: {
    marketSymbol: string;
    side: TradeType;
    inputUsdUi?: string;
  }) => Promise<{ ok: boolean; signature?: string; error?: string }>;
  closeAllPositions: () => Promise<{ ok: boolean; error?: string }>;
  clearEnableState: () => void;
  clearFundsStep: () => void;
  clearTradeError: () => void;
}

export const FlashTradeContext =
  createContext<FlashTradeContextValue | null>(null);

export function useFlashTrade(): FlashTradeContextValue {
  const ctx = useContext(FlashTradeContext);
  if (!ctx) {
    throw new Error("useFlashTrade must be used within FlashTradeProvider");
  }
  return ctx;
}

export function useOptionalFlashTrade(): FlashTradeContextValue | null {
  return useContext(FlashTradeContext);
}
