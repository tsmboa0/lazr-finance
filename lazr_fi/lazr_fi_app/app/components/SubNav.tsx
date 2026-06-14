"use client";

import { useState } from "react";

const TABS = [
  "Discover",
  "AlphaScan",
  "Tracker",
  "Positions",
  "Watchlist",
];

export default function SubNav() {
  const [activeTab, setActiveTab] = useState("Discover");

  return (
    <div className="flex items-center gap-2 px-6 h-12 border-b border-border bg-background flex-shrink-0">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          className={`relative px-4 h-full text-base font-medium transition-colors ${
            activeTab === tab
              ? "text-foreground"
              : "text-secondary hover:text-foreground"
          }`}
        >
          {tab}
          {activeTab === tab && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-gold" />
          )}
        </button>
      ))}
    </div>
  );
}
