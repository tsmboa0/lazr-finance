"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Clock,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  AUTOPILOT_STRATEGIES,
  type StrategyId,
} from "./strategies";
import { hasInsufficientBalance } from "../../../lib/balance-validation";
import InsufficientBalanceError from "../InsufficientBalanceError";

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0.00";
  if (value < 0.0001) return value.toFixed(8);
  if (value < 1) return value.toFixed(6);
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatBalance(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (value < 0.0001) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function isDecimalInput(value: string): boolean {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

export default function AutopilotPanel({
  context,
  tokenTicker,
  capitalBalance,
  balancesLoading,
  connected,
  onConnect,
}: {
  context: "swap" | "perps";
  tokenTicker: string;
  capitalBalance: number | null;
  balancesLoading: boolean;
  connected: boolean;
  onConnect: () => void;
}) {
  const [capital, setCapital] = useState("");
  const [strategyId, setStrategyId] = useState<StrategyId>("balanced");

  const strategy =
    AUTOPILOT_STRATEGIES.find((s) => s.id === strategyId) ??
    AUTOPILOT_STRATEGIES[1];

  const numericCapital = parseFloat(capital) || 0;

  const projections = useMemo(() => {
    const monthlyUsd = numericCapital * (strategy.monthlyPnlPct / 100);
    return {
      monthlyPct: strategy.monthlyPnlPct,
      monthlyUsd,
      annualPct: strategy.annualPnlPct,
      annualUsd: numericCapital * (strategy.annualPnlPct / 100),
    };
  }, [numericCapital, strategy]);

  const canStart =
    connected &&
    numericCapital > 0 &&
    !hasInsufficientBalance(numericCapital, capitalBalance, connected);
  const insufficientCapital = hasInsufficientBalance(
    numericCapital,
    capitalBalance,
    connected
  );

  const handleStart = () => {
    if (!connected) {
      onConnect();
      return;
    }
    // On-chain autopilot not yet wired.
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 via-background to-background p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 border border-gold/25">
            <Bot className="w-5 h-5 text-gold" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Autopilot</h3>
            <p className="text-xs text-tertiary mt-0.5 leading-relaxed">
              {context === "perps"
                ? `Automated ${tokenTicker} perps execution on Lazr pools.`
                : `Automated ${tokenTicker}/USDC swaps on Lazr pools.`}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl bg-input border p-4 ${
          insufficientCapital ? "border-red/40" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-secondary">Capital</span>
          {capitalBalance !== null && (
            <button
              type="button"
              onClick={() => {
                if (capitalBalance > 0) setCapital(formatBalance(capitalBalance));
              }}
              className="text-[11px] text-gold hover:text-gold-light transition-colors font-medium font-mono tabular-nums"
            >
              {balancesLoading ? "…" : `${formatBalance(capitalBalance)} USDC`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg text-secondary font-mono">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={capital}
            onChange={(e) => {
              if (isDecimalInput(e.target.value)) setCapital(e.target.value);
            }}
            placeholder="0.00"
            className="w-full text-2xl font-semibold text-foreground bg-transparent outline-none placeholder:text-tertiary font-mono tabular-nums"
          />
        </div>
        <InsufficientBalanceError show={insufficientCapital} className="mt-2" />
      </div>

      <div>
        <span className="text-sm text-secondary mb-2 block">Choose Strategy</span>
        <div className="flex gap-1 p-0.5 rounded-lg bg-elevated/60 border border-border">
          {AUTOPILOT_STRATEGIES.map((item) => {
            const selected = item.id === strategyId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStrategyId(item.id)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${
                  selected
                    ? "bg-background text-gold shadow-sm"
                    : "text-secondary hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-elevated/20 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-3.5 h-3.5 text-gold flex-shrink-0" />
            <span className="text-xs font-medium text-foreground">
              Projected performance
            </span>
          </div>
          <span className="text-xs font-semibold text-gold truncate">
            {strategy.label}
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border-subtle">
          <StatCell
            label="Monthly PnL"
            value={`+${projections.monthlyPct}%`}
            subValue={
              numericCapital > 0
                ? `$${formatNumber(projections.monthlyUsd)}`
                : "—"
            }
            valueClassName="text-green"
          />
          <StatCell
            label="Annual est."
            value={`+${projections.annualPct}%`}
            subValue={
              numericCapital > 0
                ? `$${formatNumber(projections.annualUsd)}`
                : "—"
            }
            valueClassName="text-green"
          />
        </div>
        <div className="divide-y divide-border-subtle">
          <DetailRow
            icon={Target}
            label="Win rate"
            value={`${strategy.winRate}%`}
          />
          <DetailRow
            icon={Shield}
            label="Max drawdown"
            value={`${strategy.maxDrawdown}%`}
          />
          <DetailRow
            icon={Activity}
            label="Trades / day"
            value={String(strategy.tradesPerDay)}
          />
          <DetailRow
            icon={Clock}
            label="Avg hold"
            value={
              strategy.id === "aggressive"
                ? "2.4h"
                : strategy.id === "balanced"
                  ? "6.1h"
                  : "18h"
            }
          />
          {context === "perps" && strategy.suggestedLeverage && (
            <DetailRow
              icon={TrendingUp}
              label="Suggested leverage"
              value={`${strategy.suggestedLeverage}x`}
              valueClassName="text-gold"
            />
          )}
        </div>
      </div>

      {connected ? (
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          {numericCapital <= 0
            ? "Enter capital to start"
            : insufficientCapital
              ? "Insufficient balance"
              : "Start Autopilot"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          Connect to start
        </button>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  subValue,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  subValue: string;
  valueClassName?: string;
}) {
  return (
    <div className="px-3 py-3">
      <span className="text-[10px] text-tertiary uppercase tracking-wide">
        {label}
      </span>
      <p
        className={`mt-1 text-lg font-bold font-mono tabular-nums ${valueClassName}`}
      >
        {value}
      </p>
      <p className="text-[11px] text-tertiary font-mono tabular-nums">
        {subValue}
      </p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  valueClassName = "text-foreground",
}: {
  icon: typeof Target;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-xs">
      <span className="flex items-center gap-2 text-tertiary">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
      <span className={`font-mono tabular-nums ${valueClassName}`}>{value}</span>
    </div>
  );
}
