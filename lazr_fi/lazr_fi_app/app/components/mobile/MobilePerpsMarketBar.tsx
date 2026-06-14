"use client";

import Link from "next/link";
import TokenIcon from "../TokenIcon";
import { PERPS_SYMBOLS } from "../../data/tokens";
import { useMarketData } from "../../providers/MarketDataProvider";

export default function MobilePerpsMarketBar({
  activeSymbol,
}: {
  activeSymbol: string;
}) {
  const { getToken } = useMarketData();

  return (
    <div className="flex-shrink-0 border-b border-border-subtle bg-background px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {PERPS_SYMBOLS.map((symbol) => {
          const token = getToken(symbol);
          const isActive = symbol === activeSymbol;

          return (
            <Link
              key={symbol}
              href={`/perps/${symbol}`}
              className={`flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-lg border transition-colors flex-shrink-0 ${
                isActive
                  ? "border-gold/50 bg-gold/10"
                  : "border-border bg-elevated/40 hover:bg-elevated"
              }`}
            >
              {token && (
                <TokenIcon token={token} size={22} showQuote={false} />
              )}
              <span
                className={`text-xs font-semibold ${
                  isActive ? "text-foreground" : "text-secondary"
                }`}
              >
                {symbol}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
