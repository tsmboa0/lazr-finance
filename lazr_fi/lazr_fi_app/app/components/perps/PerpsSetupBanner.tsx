"use client";

import { Zap } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useOptionalFlashTrade } from "../../providers/flash-trade-context";

export default function PerpsSetupBanner({
  onEnable,
}: {
  onEnable: () => void;
}) {
  const { connected } = useWallet();
  const flash = useOptionalFlashTrade();
  const ownerLoaded = flash?.ownerLoaded ?? false;
  const isPerpsEnabled = flash?.isPerpsEnabled ?? false;

  if (!connected || !flash || !ownerLoaded || isPerpsEnabled) {
    return null;
  }

  return (
    <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5 border-b border-gold/20 bg-gold/5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          Activate Flash Trade perps
        </p>
        <p className="text-xs text-secondary mt-0.5">
          One-time setup on mainnet — session key, basket, and delegation. No
          USDC moves until you deposit.
        </p>
      </div>
      <button
        type="button"
        onClick={onEnable}
        className="shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Zap className="w-3.5 h-3.5" />
        Enable Perps
      </button>
    </div>
  );
}
