"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import PerpsMarketBar from "../../components/perps/PerpsMarketBar";
import PerpsPositionsPanel from "../../components/perps/PerpsPositionsPanel";
import PerpsTradePanel from "../../components/perps/PerpsTradePanel";
import PerpsSetupBanner from "../../components/perps/PerpsSetupBanner";
import PerpsEnableSheet from "../../components/perps/PerpsEnableSheet";
import TradingChart from "../../components/TradingChart";
import MobileTokenHeader from "../../components/mobile/MobileTokenHeader";
import MobilePerpsMarketBar from "../../components/mobile/MobilePerpsMarketBar";
import MobileChartTradeSection from "../../components/mobile/MobileChartTradeSection";
import MobileBottomNav from "../../components/mobile/MobileBottomNav";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { useMarketData } from "../../providers/MarketDataProvider";

type MobileTradeView = "chart" | "trade";

export default function PerpsView({
  symbol,
  tvSymbol,
}: {
  symbol: string;
  tvSymbol: string;
}) {
  const { getToken, loading } = useMarketData();
  const token = getToken(symbol);
  const [mobileView, setMobileView] = useState<MobileTradeView>("chart");
  const [enableOpen, setEnableOpen] = useState(false);
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
      <>
        <PerpsSetupBanner onEnable={() => setEnableOpen(true)} />
        <PerpsEnableSheet open={enableOpen} onClose={() => setEnableOpen(false)} />
        <div className="flex flex-1 min-h-0 min-w-0">
        <div className="flex-[7] flex flex-col min-w-0 min-h-0">
          <PerpsMarketBar activeSymbol={symbol} />
          <div className="flex flex-col flex-[7] min-h-0">
            <div className="flex-1 min-h-0 flex flex-col">
              <TradingChart symbol={tvSymbol} />
            </div>
          </div>
          <div className="flex-[3] min-h-0">
            <PerpsPositionsPanel />
          </div>
        </div>
        <PerpsTradePanel
          token={token}
          onRequestEnable={() => setEnableOpen(true)}
        />
        </div>
      </>
    );
  }

  return (
    <>
      <PerpsSetupBanner onEnable={() => setEnableOpen(true)} />
      <PerpsEnableSheet open={enableOpen} onClose={() => setEnableOpen(false)} />
      <div className="flex flex-1 min-h-0 min-w-0 flex-col">
      <MobileTokenHeader token={token} loading={loading} useFlashMark />
      <MobilePerpsMarketBar activeSymbol={symbol} />

      <MobileChartTradeSection
        view={mobileView}
        onChange={setMobileView}
        chart={
          <div className="flex-1 min-h-0 flex flex-col">
            <TradingChart symbol={tvSymbol} />
          </div>
        }
        trade={
          <PerpsTradePanel
            token={token}
            embedded
            onRequestEnable={() => setEnableOpen(true)}
          />
        }
      />

      <PerpsPositionsPanel compact />

      <MobileBottomNav />
      </div>
    </>
  );
}
