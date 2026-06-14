"use client";

import type { ReactNode } from "react";
import ChartTradeToggle from "./ChartTradeToggle";

type MobileTradeView = "chart" | "trade";

export default function MobileChartTradeSection({
  view,
  onChange,
  chart,
  trade,
}: {
  view: MobileTradeView;
  onChange: (view: MobileTradeView) => void;
  chart: ReactNode;
  trade: ReactNode;
}) {
  return (
    <div className="flex flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {view === "chart" ? chart : trade}
      </div>
      <div className="shrink-0 flex justify-center py-2 border-t border-border-subtle bg-background">
        <ChartTradeToggle view={view} onChange={onChange} />
      </div>
    </div>
  );
}
