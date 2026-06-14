"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Layers } from "lucide-react";

const TABS = ["Transactions", "Holders", "Top Traders", "News"];

export default function PositionsPanel() {
  const [activeTab, setActiveTab] = useState("Transactions");
  const { connected } = useWallet();

  return (
    <div className="flex flex-col h-full border-t border-border bg-background min-h-0">
      {/* Tabs */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative px-3 h-10 text-[13px] font-medium transition-colors ${
                activeTab === tab
                  ? "text-foreground"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gold" />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          Switch Layout
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto min-h-0">
        {connected ? (
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-tertiary border-b border-border">
                <th className="text-left font-normal py-2 px-4">Age</th>
                <th className="text-left font-normal py-2 px-3">Type</th>
                <th className="text-right font-normal py-2 px-3">Price</th>
                <th className="text-right font-normal py-2 px-3">Amount</th>
                <th className="text-right font-normal py-2 px-3">Total</th>
                <th className="text-right font-normal py-2 px-4">Maker</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-[13px] text-tertiary"
                >
                  No transactions yet
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1 py-12">
            <span className="text-[13px] text-secondary">
              Connect your wallet to view {activeTab.toLowerCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
