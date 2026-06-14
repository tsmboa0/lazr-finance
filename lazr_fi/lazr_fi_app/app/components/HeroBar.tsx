"use client";

import { Zap, ArrowRight } from "lucide-react";

export default function HeroBar() {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-surface via-background to-surface border-b border-border">
      {/* Mobile */}
      <div className="lg:hidden flex flex-col items-center py-8 px-[5%]">
        <div className="w-[90%] flex flex-col items-center text-center gap-2">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Experience Lazer-Fast Trading
          </h2>
          <p className="text-sm text-secondary leading-relaxed">
            Sub-10ms execution. Zero slippage pools. DeFi without the wait.
          </p>
        </div>

        <div className="w-[90%] flex flex-row items-center justify-center gap-3 mt-5">
          <button
            type="button"
            className="flex-1 min-w-0 flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Zap className="w-4 h-4 shrink-0" />
            Try it now
          </button>
          <button
            type="button"
            className="flex-1 min-w-0 flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border text-secondary text-sm font-medium hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Explore
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex items-center justify-between px-6 py-9">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Experience Lazer-Fast Trading
            </h2>
            <p className="text-base text-secondary">
              Sub-10ms execution. Zero slippage pools. DeFi without the wait.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Zap className="w-4 h-4" />
              Try it now
            </button>
            <button
              type="button"
              className="flex items-center gap-2 h-10 px-5 rounded-xl border border-border text-secondary text-sm font-medium hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Explore
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-tertiary">Total Value Locked</span>
            <span className="text-xl font-bold text-foreground font-mono">
              $299.42M
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-tertiary">Swap Volume</span>
            <span className="text-xl font-bold text-foreground font-mono">
              $328.02B
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-tertiary">Fees Generated</span>
            <span className="text-xl font-bold text-foreground font-mono">
              $1.82B
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
