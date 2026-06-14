"use client";

type MobileTradeView = "chart" | "trade";

export default function ChartTradeToggle({
  view,
  onChange,
}: {
  view: MobileTradeView;
  onChange: (view: MobileTradeView) => void;
}) {
  return (
    <div
      className="flex items-center rounded-full border border-gold/35 bg-background p-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      role="tablist"
      aria-label="Chart or trade"
    >
        {(["chart", "trade"] as const).map((tab) => {
          const active = view === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab)}
              className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-colors ${
                active
                  ? "bg-elevated text-foreground border border-gold/50"
                  : "text-secondary hover:text-foreground border border-transparent"
              }`}
            >
              {tab}
            </button>
          );
        })}
    </div>
  );
}
