"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Settings,
  ChevronDown,
  Star,
  ArrowLeftRight,
  Droplets,
} from "lucide-react";
import WalletConnectButton from "./WalletConnectButton";
import DepositDropdown from "./DepositDropdown";
import MobileAppBar from "./mobile/MobileAppBar";
import { useMarketData } from "../providers/MarketDataProvider";

const NAV_ITEMS = [
  {
    label: "PropAMM",
    href: "/",
    isActive: (path: string) =>
      path === "/" || path.startsWith("/trade"),
  },
  {
    label: "Perps",
    href: "/perps/SOL",
    isActive: (path: string) => path.startsWith("/perps"),
  },
  { label: "Predict", href: "#", isActive: () => false },
  { label: "Lend", href: "#", isActive: () => false },
  { label: "Portfolio", href: "#", isActive: () => false },
  {
    label: "More",
    href: "#",
    isActive: () => false,
    hasDropdown: true,
  },
];

export default function Header() {
  const pathname = usePathname();
  const { getToken } = useMarketData();
  const sol = getToken("SOL");

  return (
    <header className="flex-shrink-0 bg-background">
      <div className="hidden lg:block">
      <div className="flex items-center gap-4 px-6 h-16 border-b border-border-subtle">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/" className="flex items-center mr-4 whitespace-nowrap">
            <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent text-2xl font-extrabold tracking-tight">
              LA⚡R
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              const className = `px-4 py-2 rounded-lg text-base font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                active
                  ? "text-gold bg-elevated/70"
                  : "text-secondary hover:text-foreground hover:bg-elevated/40"
              }`;

              if (item.href === "#") {
                return (
                  <button key={item.label} type="button" className={className}>
                    {item.label}
                    {item.hasDropdown && <ChevronDown className="w-4 h-4" />}
                  </button>
                );
              }

              return (
                <Link key={item.label} href={item.href} className={className}>
                  {item.label}
                  {item.hasDropdown && <ChevronDown className="w-4 h-4" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 flex justify-center items-center gap-2 px-4 min-w-0">
          <div className="relative flex items-center w-full max-w-xs min-w-[120px]">
            <Search className="absolute left-3 w-4 h-4 text-tertiary" />
            <input
              type="text"
              placeholder="Search anything"
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-input border border-border text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-gold/40 transition-colors"
            />
            <kbd className="absolute right-2.5 text-[11px] text-tertiary font-mono px-1.5 py-0.5 rounded border border-border bg-surface">
              /
            </kbd>
          </div>
          <Link
            href="/faucet"
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-md font-medium transition-colors whitespace-nowrap ${
              pathname === "/faucet"
                ? "text-foreground bg-elevated/70"
                : "text-secondary hover:text-foreground hover:bg-elevated/40"
            }`}
          >
            <Droplets className="w-3.6 h-3.6 text-gold flex-shrink-0" />
            Faucet
          </Link>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <DepositDropdown />

          <button
            type="button"
            className="p-2.5 rounded-lg text-secondary hover:text-foreground hover:bg-elevated/50 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <WalletConnectButton />
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 h-10 border-b border-border-subtle">
        <button
          type="button"
          className="p-1.5 rounded-md text-secondary hover:text-foreground hover:bg-elevated/50 transition-colors"
          aria-label="Convert"
        >
          <ArrowLeftRight className="w-4.5 h-4.5" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded-md text-secondary hover:text-foreground hover:bg-elevated/50 transition-colors"
          aria-label="Favorites"
        >
          <Star className="w-4.5 h-4.5" />
        </button>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex-shrink-0" />
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

        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gold-light to-gold-dark flex-shrink-0" />
          <span className="text-foreground font-medium">LAZR</span>
          <span className="text-foreground">$0.17212</span>
          <span className="text-green">1.9%</span>
        </div>
      </div>
      </div>

      <MobileAppBar />
    </header>
  );
}
