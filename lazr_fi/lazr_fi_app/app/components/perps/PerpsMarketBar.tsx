"use client";

import Link from "next/link";
import TokenIcon from "../TokenIcon";
import { PERPS_SYMBOLS } from "../../data/tokens";
import { useMarketData } from "../../providers/MarketDataProvider";
import { useFlashPrice } from "../../../lib/flash-trade/hooks";
import { fmtPrice } from "../../../lib/flash-trade/format";

function StatCell({
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
      <span className="text-[11px] text-tertiary whitespace-nowrap">{label}</span>
      <span
        className={`text-sm font-mono tabular-nums font-medium whitespace-nowrap ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function PerpsMarketBar({ activeSymbol }: { activeSymbol: string }) {
  const { getToken } = useMarketData();
  const token = getToken(activeSymbol);
  const { markUsd, loading: priceLoading } = useFlashPrice(activeSymbol);

  const markDisplay =
    markUsd !== null
      ? `$${fmtPrice(markUsd)}`
      : priceLoading
        ? "…"
        : token?.price ?? "—";

  return (
    <div className="flex items-center justify-between gap-4 px-4 h-[52px] border-b border-border bg-background flex-shrink-0 min-w-0">
      <div className="flex items-center gap-2 flex-shrink-0">
        {PERPS_SYMBOLS.map((symbol) => {
          const t = getToken(symbol);
          const isActive = symbol === activeSymbol;

          return (
            <Link
              key={symbol}
              href={`/perps/${symbol}`}
              className={`flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-xl border transition-all ${
                isActive
                  ? "border-gold/50 bg-gold/10 shadow-[0_0_0_1px_rgba(200,162,23,0.15)]"
                  : "border-border bg-elevated/40 hover:bg-elevated hover:border-border-subtle"
              }`}
            >
              {t && <TokenIcon token={t} size={26} showQuote={false} />}
              <span
                className={`text-sm font-semibold ${
                  isActive ? "text-foreground" : "text-secondary"
                }`}
              >
                {symbol}
              </span>
            </Link>
          );
        })}
      </div>

      {token && (
        <div className="flex items-center gap-6 lg:gap-8 overflow-x-auto scrollbar-none min-w-0">
          <StatCell label="Mark Price" value={markDisplay} valueClassName="text-gold" />
          <StatCell
            label="24H Change"
            value={token.priceChange}
            valueClassName={token.priceChangePositive ? "text-green" : "text-red"}
          />
          <StatCell label="24H Vol" value={token.volume24h} />
          <StatCell label="24H High" value={token.high24h} />
          <StatCell label="24H Low" value={token.low24h} />
        </div>
      )}
    </div>
  );
}
