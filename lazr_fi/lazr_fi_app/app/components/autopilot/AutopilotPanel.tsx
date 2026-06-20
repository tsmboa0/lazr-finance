"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  AUTOPILOT_STRATEGIES,
  type StrategyId,
} from "./strategies";
import { usePropAmmAutopilot } from "../../hooks/usePropAmmAutopilot";
import {
  formatCrankInterval,
  ON_CHAIN_STRATEGY_PARAMS,
} from "../../../lib/prop-amm/autopilot-events";
import { hasInsufficientBalance } from "../../../lib/balance-validation";
import InsufficientBalanceError from "../InsufficientBalanceError";
import ShortToast from "../ShortToast";

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

function riskToneClass(tone: "low" | "medium" | "high"): string {
  if (tone === "low") return "text-green border-green/30 bg-green/10";
  if (tone === "high") return "text-red border-red/30 bg-red/10";
  return "text-gold border-gold/30 bg-gold/10";
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
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [startSuccess, setStartSuccess] = useState<{
    message: string;
    signature: string;
  } | null>(null);

  const autopilot = usePropAmmAutopilot(tokenTicker);

  const strategy =
    AUTOPILOT_STRATEGIES.find((s) => s.id === strategyId) ??
    AUTOPILOT_STRATEGIES[1];

  const onChainParams = ON_CHAIN_STRATEGY_PARAMS[strategyId];

  const numericCapital = parseFloat(capital) || 0;

  const projections = useMemo(() => {
    const monthlyUsd = numericCapital * (strategy.monthlyPnlPct / 100);
    return {
      monthlyPct: strategy.monthlyPnlPct,
      monthlyUsd,
    };
  }, [numericCapital, strategy]);

  const canStart =
    context === "swap" &&
    connected &&
    !autopilot.isActive &&
    numericCapital > 0 &&
    !hasInsufficientBalance(numericCapital, capitalBalance, connected) &&
    !autopilot.loading;
  const insufficientCapital = hasInsufficientBalance(
    numericCapital,
    capitalBalance,
    connected
  );

  const handleStart = async () => {
    if (!connected) {
      onConnect();
      return;
    }
    if (context !== "swap") return;
    setStartSuccess(null);
    try {
      const result = await autopilot.start(strategyId, numericCapital);
      const signature =
        result.signatures[0] ??
        result.signatures[result.signatures.length - 1];
      if (signature) {
        setStartSuccess({
          message: `${strategy.label} Autopilot started for ${tokenTicker}/USDC`,
          signature,
        });
      }
    } catch {
      // surfaced via autopilot.error
    }
  };

  const handleStop = async () => {
    if (context !== "swap") return;
    try {
      await autopilot.stop();
      setSuccessToast("Autopilot stopped");
    } catch {
      // surfaced via autopilot.error
    }
  };

  const handleUpdate = async () => {
    if (context !== "swap" || autopilot.isActive) return;
    try {
      await autopilot.update(strategyId, numericCapital);
      setSuccessToast("Autopilot settings updated");
    } catch {
      // surfaced via autopilot.error
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 via-background to-background p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 border border-gold/25">
            <Bot className="w-5 h-5 text-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">Autopilot</h3>
              {context === "swap" && connected && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                    autopilot.isActive
                      ? "text-green border-green/30 bg-green/10"
                      : "text-tertiary border-border bg-elevated/60"
                  }`}
                >
                  {autopilot.statusLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-tertiary mt-0.5 leading-relaxed">
              {context === "perps"
                ? `Automated ${tokenTicker} perps execution on Lazr pools.`
                : `Automated ${tokenTicker}/USDC band trading on Lazr PropAMM — one wallet sign to set up, then the bot runs on the rollup.`}
            </p>
            {context === "swap" && autopilot.isActive && autopilot.state && (
              <p className="text-[11px] text-gold mt-1.5 font-medium font-mono tabular-nums">
                {autopilot.state.tradesToday} trades today ·{" "}
                {autopilot.state.totalTrades} total · checks every{" "}
                {formatCrankInterval(onChainParams.tickIntervalMs)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <span className="text-sm text-secondary mb-2 block">Choose strategy</span>
        <div className="flex gap-1 p-0.5 rounded-lg bg-elevated/60 border border-border">
          {AUTOPILOT_STRATEGIES.map((item) => {
            const selected = item.id === strategyId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStrategyId(item.id)}
                disabled={context === "swap" && autopilot.isActive}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
        <p className="mt-2 text-xs text-secondary leading-relaxed">
          {strategy.description}
        </p>
        <p className="mt-1.5 text-[11px] text-tertiary leading-relaxed">
          Crank checks every {formatCrankInterval(onChainParams.tickIntervalMs)} ·
          up to {onChainParams.maxTradesPerDay} trades/day on-chain
        </p>
      </div>

      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/5 to-transparent overflow-hidden">
        <div className="px-3 py-2 border-b border-gold/15 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-gold uppercase tracking-wide">
            Strategy preview
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskToneClass(strategy.riskTone)}`}
          >
            {strategy.riskLabel}
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gold/10">
          <HeroStat
            label="Monthly PnL"
            value={`+${projections.monthlyPct}%`}
            subValue={
              numericCapital > 0
                ? `$${formatNumber(projections.monthlyUsd)}`
                : "Enter capital"
            }
            accent="green"
          />
          <HeroStat
            label="Trades / day"
            value={String(strategy.tradesPerDay)}
            subValue="Target frequency"
            accent="gold"
          />
          <HeroStat
            label="Win rate"
            value={`${strategy.winRate}%`}
            subValue={`Max DD ${strategy.maxDrawdown}%`}
            accent="cyan"
          />
        </div>
      </div>
      <p className="text-[10px] text-red leading-relaxed px-0.5">
        Disclaimer: Projected stats are illustrative estimates, not guarantees of future
        performance.
      </p>

      <div
        className={`rounded-2xl bg-input border p-4 ${
          insufficientCapital ? "border-red/40" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-secondary">Capital to allocate</span>
          {capitalBalance !== null && (
            <button
              type="button"
              onClick={() => {
                if (capitalBalance > 0) setCapital(formatBalance(capitalBalance));
              }}
              className="text-[11px] text-gold hover:text-gold-light transition-colors font-medium font-mono tabular-nums"
            >
              {balancesLoading ? "…" : `${formatBalance(capitalBalance)} USDC bank`}
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
            disabled={context === "swap" && autopilot.isActive}
            className="w-full text-2xl font-semibold text-foreground bg-transparent outline-none placeholder:text-tertiary font-mono tabular-nums disabled:opacity-60"
          />
        </div>
        <InsufficientBalanceError show={insufficientCapital} className="mt-2" />
      </div>

      {context === "swap" && startSuccess && (
        <div className="rounded-xl border border-green/25 bg-green/10 px-4 py-3 text-sm text-green">
          <p className="text-center">{startSuccess.message}</p>
          <a
            href={`https://solscan.io/tx/${startSuccess.signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-1 text-xs text-green/90 hover:text-green underline"
          >
            View on Solscan
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {context === "swap" && autopilot.error && (
        <p className="text-xs text-red leading-relaxed">{autopilot.error}</p>
      )}

      {connected ? (
        context === "swap" && autopilot.isActive ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={autopilot.loading}
            className="h-12 rounded-2xl border border-red/40 bg-red/10 text-red text-base font-bold hover:bg-red/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {autopilot.loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            Stop Autopilot
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {context === "swap" && autopilot.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
              {numericCapital <= 0
                ? "Enter capital to start"
                : insufficientCapital
                  ? "Insufficient balance"
                  : context === "swap"
                    ? "Start Autopilot"
                    : "Start Autopilot (coming soon)"}
            </button>
            {context === "swap" && autopilot.state && !autopilot.isActive && (
              <button
                type="button"
                onClick={handleUpdate}
                disabled={
                  autopilot.loading ||
                  numericCapital <= 0 ||
                  insufficientCapital
                }
                className="h-10 rounded-xl border border-border text-sm font-semibold text-secondary hover:text-foreground hover:border-gold/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save settings
              </button>
            )}
          </div>
        )
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

      {successToast && (
        <ShortToast
          message={successToast}
          onDismiss={() => setSuccessToast(null)}
        />
      )}
    </div>
  );
}

function HeroStat({
  label,
  value,
  subValue,
  accent,
}: {
  label: string;
  value: string;
  subValue: string;
  accent: "green" | "gold" | "cyan";
}) {
  const valueClass =
    accent === "green"
      ? "text-green"
      : accent === "gold"
        ? "text-gold"
        : "text-cyan-400";

  return (
    <div className="px-2.5 py-3 text-center sm:px-3">
      <span className="text-[9px] sm:text-[10px] text-tertiary uppercase tracking-wide block">
        {label}
      </span>
      <p
        className={`mt-1 text-xl sm:text-2xl font-black font-mono tabular-nums leading-none ${valueClass}`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] text-secondary font-mono tabular-nums truncate">
        {subValue}
      </p>
    </div>
  );
}
