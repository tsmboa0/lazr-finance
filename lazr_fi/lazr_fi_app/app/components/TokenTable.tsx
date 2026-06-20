"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  ArrowDownUp,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import Sparkline from "./Sparkline";
import TokenIcon from "./TokenIcon";
import { type Token } from "../data/tokens";
import { useMarketData } from "../providers/MarketDataProvider";
import { useOptionalLiveQuote } from "../providers/AllPoolQuotesProvider";
import { formatUsdPrice } from "../../lib/format-numbers";

const CATEGORIES = [
  { label: "Cooking", icon: "🔥", active: true },
  { label: "Launchpads", active: false },
  { label: "Stocks", active: false },
  { label: "Top Traded", active: false },
  { label: "Stablecoins", active: false },
  { label: "Organic", active: false },
];

const TIME_FILTERS = ["5m", "1h", "6h", "24h"];

export default function TokenTable() {
  const [activeCategory, setActiveCategory] = useState("Cooking");
  const [activeTime, setActiveTime] = useState("24h");
  const [minAmount, setMinAmount] = useState("0.01");
  const { tokens } = useMarketData();

  return (
    <div className="flex-1 flex flex-col min-h-0" data-tour="tokens">
      {/* Category + Time Filters — mobile */}
      <div className="lg:hidden flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(cat.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                activeCategory === cat.label
                  ? "text-gold bg-elevated/70 border border-gold/20"
                  : "text-secondary hover:text-foreground hover:bg-elevated/40"
              }`}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle overflow-x-auto scrollbar-none">
          {TIME_FILTERS.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setActiveTime(time)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0 ${
                activeTime === time
                  ? "text-foreground bg-elevated"
                  : "text-tertiary hover:text-secondary"
              }`}
            >
              {time}
            </button>
          ))}
          <div className="w-px h-4 bg-border flex-shrink-0" />
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-secondary flex-shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-input border border-border flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-gold" />
            <input
              type="text"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-8 text-xs text-foreground bg-transparent outline-none text-right font-mono"
            />
          </div>
        </div>
      </div>

      {/* Category + Time Filters — desktop */}
      <div className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(cat.label)}
              className={`px-4 py-2 rounded-lg text-[15px] font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeCategory === cat.label
                  ? "text-gold bg-elevated/70 border border-gold/20"
                  : "text-secondary hover:text-foreground hover:bg-elevated/40"
              }`}
            >
              {cat.icon && <span className="text-[15px]">{cat.icon}</span>}
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {TIME_FILTERS.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setActiveTime(time)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTime === time
                  ? "text-foreground bg-elevated"
                  : "text-tertiary hover:text-secondary"
              }`}
            >
              {time}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-secondary hover:text-foreground hover:bg-elevated/40 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-input border border-border">
            <Zap className="w-4 h-4 text-gold" />
            <input
              type="text"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-10 text-sm text-foreground bg-transparent outline-none text-right font-mono"
            />
          </div>
        </div>
      </div>

      {/* Mobile token list */}
      <div className="lg:hidden flex-1 overflow-y-auto min-h-0">
        {tokens.map((token) => (
          <TokenMobileRow key={token.id} token={token} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block flex-1 overflow-auto min-h-0">
        <table className="w-full min-w-[1100px] table-fixed">
          <colgroup>
            <col className="w-[52px]" />
            <col className="w-[19%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[13%]" />
            <col className="w-[88px]" />
          </colgroup>
          <thead>
            <tr className="text-xs text-tertiary border-b border-border">
              <th className="sticky top-0 bg-background z-10 py-2.5 pl-6 pr-2 text-left font-normal" />
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-left font-normal">
                Token/Age
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-right font-normal">
                Price/%&Delta;
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-right font-normal">
                MC/FDV
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-right font-normal">
                <span className="inline-flex items-center gap-0.5">
                  24h Vol <ArrowDownUp className="w-3 h-3 inline" /> Net
                </span>
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-right font-normal">
                Liquidity
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-right font-normal">
                Holders/%&Delta;
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-right font-normal">
                Fees Paid
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 px-3 text-center font-normal">
                Last 24h
              </th>
              <th className="sticky top-0 bg-background z-10 py-2.5 pr-6 pl-3 text-center font-normal">
                Buy
              </th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <TokenRow key={token.id} token={token} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileStatColumn({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[76px] shrink-0">
      <span className="text-[10px] text-tertiary whitespace-nowrap">{label}</span>
      <div className="text-xs font-mono tabular-nums">{children}</div>
    </div>
  );
}

function useLiveTokenPrice(symbol: string, fallback: string): string {
  const live = useOptionalLiveQuote(symbol);
  if (live?.fresh && live.fairPriceUsd > 0) {
    return formatUsdPrice(live.fairPriceUsd);
  }
  return fallback;
}

function TokenMobileRow({ token }: { token: Token }) {
  const router = useRouter();
  const displayPrice = useLiveTokenPrice(token.symbol, token.price);

  const goToTrade = () => router.push(`/trade/${token.symbol}`);

  return (
    <div
      onClick={goToTrade}
      className="flex items-stretch border-b border-border hover:bg-surface/60 transition-colors cursor-pointer"
    >
      <div className="shrink-0 flex items-center gap-2 pl-3 pr-2 py-3 w-[108px]">
        <TokenIcon token={token} size={32} showQuote={false} />
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-sm text-foreground truncate block leading-tight">
            {token.ticker}
          </span>
          <span className="text-[10px] text-tertiary">{token.age}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-4 px-2 py-3 h-full">
          <MobileStatColumn label="Price">
            <span className="text-foreground">{displayPrice}</span>
            <span
              className={`text-[11px] ${
                token.priceChangePositive ? "text-green" : "text-red"
              }`}
            >
              {token.priceChange}
            </span>
          </MobileStatColumn>

          <MobileStatColumn label="MC / FDV">
            <span className="text-foreground">{token.mcap}</span>
            <span className="text-[11px] text-tertiary">{token.fdv}</span>
          </MobileStatColumn>

          <MobileStatColumn label="Vol / Net">
            <span className="text-foreground">{token.volume24h}</span>
            <span
              className={`text-[11px] ${
                token.volumeHighlighted ? "text-gold" : "text-tertiary"
              }`}
            >
              {token.volumeNet}
            </span>
          </MobileStatColumn>

          <MobileStatColumn label="Liquidity">
            <span
              className={
                token.liquidityHighlighted ? "text-gold" : "text-foreground"
              }
            >
              {token.liquidity}
            </span>
          </MobileStatColumn>

          <MobileStatColumn label="Holders">
            <span className="text-foreground">{token.holders}</span>
            <span
              className={`text-[11px] ${
                token.holdersChangePositive ? "text-green" : "text-red"
              }`}
            >
              {token.holdersChange}
            </span>
          </MobileStatColumn>

          <MobileStatColumn label="Fees">
            <span
              className={
                token.feesPaid !== "-" ? "text-gold" : "text-tertiary"
              }
            >
              {token.feesPaid}
            </span>
          </MobileStatColumn>

          <div className="shrink-0 flex flex-col gap-0.5 min-w-[88px]">
            <span className="text-[10px] text-tertiary">24h</span>
            <Sparkline data={token.sparklineData} width={80} height={28} />
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center pr-3 pl-2 py-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToTrade();
          }}
          className="w-11 h-9 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors flex items-center justify-center"
          aria-label={`Buy ${token.name}`}
        >
          <Zap className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TokenRow({ token }: { token: Token }) {
  const router = useRouter();
  const displayPrice = useLiveTokenPrice(token.symbol, token.price);

  const goToTrade = () => router.push(`/trade/${token.symbol}`);

  return (
    <tr
      onClick={goToTrade}
      className="border-b border-border hover:bg-surface/60 transition-colors group cursor-pointer"
    >
      <td className="py-4 pl-6 pr-2">
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-tertiary hover:text-gold transition-colors"
          aria-label={`Add ${token.name} to watchlist`}
        >
          <Star className="w-4 h-4" />
        </button>
      </td>

      <td className="py-4 px-3">
        <div className="flex items-center gap-3">
          <TokenIcon token={token} size={36} />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[15px] text-foreground truncate">
                {token.name}
              </span>
              <span className="text-[13px] text-tertiary">/USDC</span>
              {token.verified && (
                <span className="text-green text-xs">&#10003;</span>
              )}
              {token.badges && (
                <div className="flex items-center gap-0.5">
                  {token.badges.map((badge, i) => (
                    <span key={i} className="text-[11px] opacity-50">
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[13px] text-tertiary mt-0.5">{token.age}</span>
          </div>
        </div>
      </td>

      <td className="py-4 px-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[15px] font-medium text-foreground font-mono">
            {displayPrice}
          </span>
          <span
            className={`text-[13px] font-mono ${
              token.priceChangePositive ? "text-green" : "text-red"
            }`}
          >
            {token.priceChange}
          </span>
        </div>
      </td>

      <td className="py-4 px-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[15px] text-foreground font-mono">{token.mcap}</span>
          <span className="text-[13px] text-tertiary font-mono">{token.fdv}</span>
        </div>
      </td>

      <td className="py-4 px-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[15px] text-foreground font-mono">
            {token.volume24h}
          </span>
          <span
            className={`text-[13px] font-mono ${
              token.volumeHighlighted
                ? "bg-gold/15 text-gold px-1.5 py-0.5 rounded"
                : "text-tertiary"
            }`}
          >
            {token.volumeNet}
          </span>
        </div>
      </td>

      <td className="py-4 px-3 text-right">
        <span
          className={`text-[15px] font-mono ${
            token.liquidityHighlighted
              ? "bg-gold/15 text-gold px-2 py-1 rounded"
              : "text-foreground"
          }`}
        >
          {token.liquidity}
        </span>
      </td>

      <td className="py-4 px-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[15px] text-foreground font-mono">
            {token.holders}
          </span>
          <span
            className={`text-[13px] font-mono ${
              token.holdersChangePositive ? "text-green" : "text-red"
            }`}
          >
            {token.holdersChange}
          </span>
        </div>
      </td>

      <td className="py-4 px-3 text-right">
        <span
          className={`text-[15px] font-mono ${
            token.feesPaid !== "-"
              ? "bg-gold/15 text-gold px-2 py-1 rounded"
              : "text-tertiary"
          }`}
        >
          {token.feesPaid}
        </span>
      </td>

      <td className="py-4 px-3">
        <div className="flex justify-center">
          <Sparkline data={token.sparklineData} width={130} height={36} />
        </div>
      </td>

      <td className="py-4 pr-6 pl-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToTrade();
          }}
          className="w-12 h-9 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors flex items-center justify-center mx-auto"
          aria-label={`Buy ${token.name}`}
        >
          <Zap className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
