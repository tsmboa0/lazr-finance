"use client";

import { Loader2 } from "lucide-react";
import TokenDetailsPanel from "../../components/trade/TokenDetailsPanel";
import TradingChart from "../../components/TradingChart";
import PositionsPanel from "../../components/trade/PositionsPanel";
import SwapPanel from "../../components/trade/SwapPanel";
import MobileTokenHeader from "../../components/mobile/MobileTokenHeader";
import MobileChartTradeSection from "../../components/mobile/MobileChartTradeSection";
import MobileBottomNav from "../../components/mobile/MobileBottomNav";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { useMarketData } from "../../providers/MarketDataProvider";
import { PoolQuoteProvider } from "../../providers/PoolQuoteProvider";
import { AutopilotEventProvider } from "../../providers/AutopilotEventProvider";
import { useState } from "react";

type MobileTradeView = "chart" | "trade";

export default function TradeView({
  symbol,
  tvSymbol,
}: {
  symbol: string;
  tvSymbol: string;
}) {
  const { getToken, loading } = useMarketData();
  const token = getToken(symbol);
  const [mobileView, setMobileView] = useState<MobileTradeView>("chart");
  const isDesktop = useIsDesktop();

  if (!token) {
    return null;
  }

  if (isDesktop === null) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <Loader2 className="size-8 text-gold animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (isDesktop) {
    return (
      <PoolQuoteProvider assetSymbol={token.ticker}>
        <AutopilotEventProvider assetSymbol={token.ticker}>
        <div className="flex flex-1 min-h-0 min-w-0">
          <TokenDetailsPanel token={token} loading={loading} />

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex flex-col flex-[7] min-h-0">
              <div className="flex-1 min-h-0 flex flex-col">
                <TradingChart symbol={tvSymbol} />
              </div>
            </div>
            <div className="flex-[3] min-h-0">
              <PositionsPanel />
            </div>
          </div>

          <SwapPanel token={token} />
        </div>
        </AutopilotEventProvider>
      </PoolQuoteProvider>
    );
  }

  return (
    <PoolQuoteProvider assetSymbol={token.ticker}>
      <AutopilotEventProvider assetSymbol={token.ticker}>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col">
        <MobileTokenHeader token={token} loading={loading} />

        <MobileChartTradeSection
          view={mobileView}
          onChange={setMobileView}
          chart={
            <div className="flex-1 min-h-0 flex flex-col">
              <TradingChart symbol={tvSymbol} />
            </div>
          }
          trade={<SwapPanel token={token} embedded />}
        />

        <MobileBottomNav />
      </div>
      </AutopilotEventProvider>
    </PoolQuoteProvider>
  );
}
