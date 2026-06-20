"use client";

import { useState } from "react";
import {
  Star,
  Copy,
  Search,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import TokenIcon from "../TokenIcon";
import Sparkline from "../Sparkline";
import type { Token } from "../../data/tokens";
import { usePoolQuoteContext } from "../../providers/PoolQuoteProvider";
import { formatUsdPrice } from "../../../lib/format-numbers";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-tertiary">{label}</span>
      <span className="text-[13px] font-medium text-foreground font-mono">
        {value}
      </span>
    </div>
  );
}

export default function TokenDetailsPanel({
  token,
  loading = false,
}: {
  token: Token;
  loading?: boolean;
}) {
  const [tokenInfoOpen, setTokenInfoOpen] = useState(true);
  const poolQuote = usePoolQuoteContext();
  const hasLiveQuote = poolQuote.fresh && poolQuote.fairPriceUsd > 0;
  const displayPrice = hasLiveQuote
    ? formatUsdPrice(poolQuote.fairPriceUsd)
    : token.price;
  const priceLoading =
    !hasLiveQuote &&
    token.priceUsd === 0 &&
    (loading || poolQuote.loading);

  return (
    <aside className="w-[300px] flex-shrink-0 border-r border-border bg-background overflow-y-auto">
      {/* Header: icon, name, price */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <TokenIcon token={token} size={40} />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-foreground">
                  {token.name}
                </span>
                {token.verified && (
                  <span className="text-green text-xs">&#10003;</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-tertiary">
                <span>{token.age}</span>
                <span>·</span>
                <span className="font-mono">
                  {token.symbol}...{token.ticker.slice(0, 2)}
                </span>
                <button
                  type="button"
                  className="hover:text-foreground transition-colors"
                  aria-label="Copy address"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="hover:text-foreground transition-colors"
                  aria-label="Search"
                >
                  <Search className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="text-tertiary hover:text-gold transition-colors"
            aria-label="Add to watchlist"
          >
            <Star className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2" data-tour="propamm-er-quote">
          <div className="flex items-baseline gap-2">
            {priceLoading ? (
              <Loader2
                className="size-6 text-gold animate-spin"
                aria-label="Loading price"
              />
            ) : (
              <>
                <span className="text-2xl font-bold text-foreground font-mono tabular-nums">
                  {displayPrice}
                </span>
                {hasLiveQuote ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-green font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                    ER quote
                  </span>
                ) : (
                  <span
                    className={`text-sm font-mono tabular-nums ${
                      token.priceChangePositive ? "text-green" : "text-red"
                    }`}
                  >
                    {token.priceChange} (24h)
                  </span>
                )}
              </>
            )}
          </div>

          {hasLiveQuote && (
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums">
              <div className="flex flex-col gap-0.5">
                <span className="text-tertiary">Bid</span>
                <span className="text-green">
                  {formatUsdPrice(poolQuote.bidPriceUsd)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-tertiary">Ask</span>
                <span className="text-red">
                  {formatUsdPrice(poolQuote.askPriceUsd)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-tertiary">Spread</span>
                <span className="text-foreground">
                  {(poolQuote.spreadBps / 100).toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MC / FDV / Liquidity */}
      <div className="grid grid-cols-3 gap-3 px-4 py-3 border-b border-border">
        <Stat label="MC" value={token.mcap} />
        <Stat label="FDV" value={token.fdv} />
        <Stat label="Liquidity" value={token.liquidity} />
        <Stat label="Holders" value={token.holders} />
        <Stat label="Org Score" value={token.orgScore} />
      </div>

      {/* Time filters with % */}
      <div className="grid grid-cols-4 border-b border-border">
        {token.timeChanges.map((tf, i) => (
          <div
            key={tf.label}
            className={`flex flex-col items-center gap-1 py-2.5 ${
              i < token.timeChanges.length - 1 ? "border-r border-border" : ""
            } ${tf.label === "24h" ? "bg-elevated/40" : ""}`}
          >
            <span className="text-[11px] text-tertiary">{tf.label}</span>
            <span
              className={`text-[13px] font-mono ${
                tf.positive ? "text-green" : "text-red"
              }`}
            >
              {tf.change}
            </span>
          </div>
        ))}
      </div>

      {/* Volume + Buy bar */}
      <div className="px-4 py-3 border-b border-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-tertiary">24h Vol</span>
            <span className="text-[13px] font-medium text-foreground font-mono">
              {token.volume24h}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-tertiary">Net Vol</span>
            <span className="text-[13px] font-medium text-green font-mono">
              {token.volumeNet}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 w-24">
            <span className="text-[11px] text-green">
              {token.buyPercent}% Buy
            </span>
            <div className="w-full h-1.5 rounded-full bg-red/40 overflow-hidden">
              <div
                className="h-full bg-green rounded-full"
                style={{ width: `${token.buyPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-tertiary">24h Traders</span>
            <span className="text-[13px] font-medium text-foreground font-mono">
              {token.traders24h}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-tertiary">Net Buyers</span>
            <span className="text-[13px] font-medium text-foreground font-mono">
              {token.netBuyers}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 w-24">
            <span className="text-[11px] text-red">
              {token.sellPercent}% Sell
            </span>
            <div className="w-full h-1.5 rounded-full bg-green/40 overflow-hidden">
              <div
                className="h-full bg-red rounded-full ml-auto"
                style={{ width: `${token.sellPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Net buy trend chart */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[11px] text-tertiary">24h Net Buy Trend</span>
        <div className="mt-2 flex items-center justify-between text-[10px] text-tertiary">
          <span>$616k</span>
        </div>
        <div className="my-1">
          <Sparkline
            data={token.sparklineData}
            width={260}
            height={64}
            color="#22C55E"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-tertiary">
          <span>$33k</span>
        </div>
      </div>

      {/* % deltas */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-tertiary">Vol %&Delta;</span>
          <span className="text-[13px] font-mono text-red">-26.57%</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-tertiary">Liquidity %&Delta;</span>
          <span className="text-[13px] font-mono text-green">+20.67%</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-tertiary">Holders %&Delta;</span>
          <span className="text-[13px] font-mono text-green">
            {token.holdersChange}
          </span>
        </div>
      </div>

      {/* Token Info collapsible */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => setTokenInfoOpen((open) => !open)}
          className="flex items-center gap-1 text-[13px] font-medium text-foreground"
        >
          Token Info
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              tokenInfoOpen ? "" : "-rotate-90"
            }`}
          />
        </button>

        {tokenInfoOpen && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 rounded-lg bg-elevated/40 py-2.5">
              <span className="text-[13px] font-bold text-gold font-mono">
                {token.topHolders}
              </span>
              <span className="text-[10px] text-tertiary">Top 10 H.</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-elevated/40 py-2.5">
              <span className="text-[13px] font-bold text-green">No</span>
              <span className="text-[10px] text-tertiary">Freeze Auth</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-elevated/40 py-2.5">
              <span className="text-[13px] font-bold text-green">No</span>
              <span className="text-[10px] text-tertiary">Mint Auth</span>
            </div>
          </div>
        )}

        <a
          href="#"
          className="mt-3 flex items-center gap-1 text-[11px] text-tertiary hover:text-foreground transition-colors"
        >
          View on explorer
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </aside>
  );
}
