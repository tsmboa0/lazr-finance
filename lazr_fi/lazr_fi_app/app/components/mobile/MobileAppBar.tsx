"use client";

import Link from "next/link";
import {
  Search,
  Settings,
  SlidersHorizontal,
  Plus,
} from "lucide-react";
import { useMarketData } from "../../providers/MarketDataProvider";
import FaucetModal from "../faucet/FaucetModal";
import MobileWalletButton from "./MobileWalletButton";

export default function MobileAppBar() {
  const { getToken } = useMarketData();
  const sol = getToken("SOL");
  const lazr = getToken("LAZR");

  return (
    <div className="lg:hidden flex-shrink-0 border-b border-border-subtle bg-background">
      <div className="flex items-center gap-2 px-3 h-12">
        <Link href="/" className="flex-shrink-0">
          <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent text-lg font-extrabold tracking-tight">
            LA⚡R
          </span>
        </Link>

        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" />
          <input
            type="text"
            placeholder="Search"
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-input border border-border text-xs text-foreground placeholder:text-tertiary focus:outline-none focus:border-gold/40 transition-colors"
          />
        </div>

        <FaucetModal variant="mobile" />

        <button
          type="button"
          className="p-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-elevated/50 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <MobileWalletButton />
      </div>

      <div className="flex items-center gap-2 px-3 h-9 border-t border-border-subtle overflow-x-auto">
        <button
          type="button"
          className="p-1 rounded-md text-tertiary hover:text-foreground flex-shrink-0"
          aria-label="Filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
          <span className="text-foreground font-medium">SOL</span>
          <span className="text-foreground font-mono tabular-nums">
            {sol?.price ?? "--"}
          </span>
          <span
            className={`font-mono tabular-nums ${
              sol?.priceChangePositive ? "text-green" : "text-red"
            }`}
          >
            {sol?.priceChange ?? "--"}
          </span>
        </div>

        <div className="w-px h-3 bg-border flex-shrink-0" />

        <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-gold-light to-gold-dark" />
          <span className="text-foreground font-medium">LAZR</span>
          <span className="text-foreground font-mono tabular-nums">
            {lazr?.price ?? "$0.17212"}
          </span>
          <span
            className={`font-mono tabular-nums ${
              lazr?.priceChangePositive ? "text-green" : "text-red"
            }`}
          >
            {lazr?.priceChange ?? "1.9%"}
          </span>
        </div>

        <button
          type="button"
          className="p-1 rounded-md text-tertiary hover:text-foreground flex-shrink-0 ml-auto"
          aria-label="Add ticker"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
