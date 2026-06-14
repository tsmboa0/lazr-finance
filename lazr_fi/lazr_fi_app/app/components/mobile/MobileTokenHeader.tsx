"use client";

import { Copy, Search, Star, Loader2 } from "lucide-react";
import TokenIcon from "../TokenIcon";
import type { Token } from "../../data/tokens";
import { useFlashPrice } from "../../../lib/flash-trade/hooks";
import { fmtPrice } from "../../../lib/flash-trade/format";

function Stat({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-tertiary">{label}</span>
      <span
        className={`text-xs font-medium font-mono tabular-nums truncate ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function MobileTokenHeader({
  token,
  loading = false,
  useFlashMark = false,
}: {
  token: Token;
  loading?: boolean;
  useFlashMark?: boolean;
}) {
  const { markUsd, loading: flashLoading } = useFlashPrice(
    useFlashMark ? token.symbol : ""
  );
  const displayPrice =
    useFlashMark && markUsd !== null
      ? `$${fmtPrice(markUsd)}`
      : token.price;
  const priceLoading =
    useFlashMark && flashLoading && markUsd === null
      ? true
      : loading && token.priceUsd === 0;
  return (
    <div className="flex-shrink-0 border-b border-border-subtle bg-background">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <TokenIcon token={token} size={36} showQuote={false} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground truncate">
                  {token.ticker}
                </span>
                {token.verified && (
                  <span className="text-green text-xs">&#10003;</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-tertiary mt-0.5">
                <span>{token.age}</span>
                <span>·</span>
                <span className="font-mono truncate">
                  {token.symbol}…{token.ticker.slice(0, 2)}
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
                  aria-label="Search token"
                >
                  <Search className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="text-tertiary hover:text-gold transition-colors p-1"
            aria-label="Add to watchlist"
          >
            <Star className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          {priceLoading ? (
            <Loader2
              className="size-5 text-gold animate-spin"
              aria-label="Loading price"
            />
          ) : (
            <>
              <span className="text-2xl font-bold text-foreground font-mono tabular-nums">
                {displayPrice}
              </span>
              <span
                className={`text-sm font-mono tabular-nums ${
                  token.priceChangePositive ? "text-green" : "text-red"
                }`}
              >
                {token.priceChange} (24h)
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4 py-2.5 border-t border-border-subtle">
        <Stat label="MC" value={token.mcap} />
        <Stat label="Liquidity" value={token.liquidity} />
        <Stat label="Holders" value={token.holders} />
        <Stat
          label="Org Score"
          value={token.orgScore}
          valueClassName="text-green"
        />
      </div>

      <div className="grid grid-cols-4 border-t border-border-subtle">
        {token.timeChanges.map((tf, i) => (
          <div
            key={tf.label}
            className={`flex flex-col items-center gap-0.5 py-2 ${
              i < token.timeChanges.length - 1 ? "border-r border-border-subtle" : ""
            } ${tf.label === "24h" ? "bg-elevated/40" : ""}`}
          >
            <span className="text-[10px] text-tertiary">{tf.label}</span>
            <span
              className={`text-xs font-mono tabular-nums ${
                tf.positive ? "text-green" : "text-red"
              }`}
            >
              {tf.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
