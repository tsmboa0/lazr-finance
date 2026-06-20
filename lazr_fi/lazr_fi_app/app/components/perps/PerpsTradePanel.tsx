"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { RECOMMENDED_MIN_COLLATERAL_USD } from "flash-v2";
import { Loader2, Minus, Plus } from "lucide-react";
import PerpsAutopilotPanel from "../autopilot/PerpsAutopilotPanel";
import AutopilotTabButton from "../autopilot/AutopilotTabButton";
import TokenIcon from "../TokenIcon";
import ShortToast from "../ShortToast";
import { USDC_ICON_SRC } from "../../data/tokens";
import type { Token } from "../../data/tokens";
import { useOptionalFlashTrade } from "../../providers/flash-trade-context";
import { hasInsufficientBalance } from "../../../lib/balance-validation";
import { formatBankBalance } from "../../../lib/format-numbers";
import { fmtPrice, fmtUsd, num } from "../../../lib/flash-trade/format";
import { useFlashPrice, useMarketLimits } from "../../../lib/flash-trade/hooks";
import { previewOpenPosition } from "../../../lib/flash-trade/trade";
import {
  PERPS_TRADE_TAB_EVENT,
  type PerpsTradeTabDetail,
} from "../../../lib/onboarding/perps-tour-steps";
import InsufficientBalanceError from "../InsufficientBalanceError";

type Side = "long" | "short";
type OrderType = "market" | "limit" | "autopilot";

const USDC = { ticker: "USDC", iconSrc: USDC_ICON_SRC };
const LEVERAGE_STEP = 0.1;
const DEFAULT_MIN_LEV = 1.1;
const DEFAULT_MAX_LEV = 100;

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0.00";
  if (value < 0.0001) return value.toFixed(8);
  if (value < 1) return value.toFixed(6);
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function isDecimalInput(value: string): boolean {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

export default function PerpsTradePanel({
  token,
  embedded = false,
  onRequestEnable,
}: {
  token: Token;
  embedded?: boolean;
  onRequestEnable?: () => void;
}) {
  const [side, setSide] = useState<Side>("long");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [previewFee, setPreviewFee] = useState<string | null>(null);
  const [previewLiq, setPreviewLiq] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const flash = useOptionalFlashTrade();
  const { price: flashPrice, markUsd, loading: priceLoading } = useFlashPrice(
    token.symbol
  );
  const limits = useMarketLimits(token.symbol);

  const levMin = limits?.minLeverage ?? DEFAULT_MIN_LEV;
  const levMax = limits?.maxLeverage ?? DEFAULT_MAX_LEV;

  const isPerpsEnabled = flash?.isPerpsEnabled ?? false;
  const marginBalanceUsd = flash?.marginBalanceUsd ?? 0;
  const marginLoading = flash?.marginLoading ?? false;
  const ownerLoaded = flash?.ownerLoaded ?? false;
  const tradeBusy = flash?.tradeBusy ?? false;
  const tradeError = flash?.tradeError ?? null;

  const markPrice = markUsd ?? token.priceUsd;
  const numericAmount = parseFloat(amount) || 0;
  const tradeSide = side === "long" ? "LONG" : "SHORT";

  const entryPrice =
    orderType === "limit" && parseFloat(limitPrice) > 0
      ? parseFloat(limitPrice)
      : markPrice;

  const positionSizeUsd = numericAmount * leverage;
  const tpSlNeedsMin =
    tpSlEnabled && numericAmount > 0 && numericAmount < RECOMMENDED_MIN_COLLATERAL_USD;

  useEffect(() => {
    setLeverage((prev) => Math.min(levMax, Math.max(levMin, prev)));
  }, [levMin, levMax]);

  useEffect(() => {
    const handleTourTab = (event: Event) => {
      const tab = (event as CustomEvent<PerpsTradeTabDetail>).detail?.tab;
      if (tab === "market" || tab === "limit" || tab === "autopilot") {
        setOrderType(tab);
      }
    };
    window.addEventListener(PERPS_TRADE_TAB_EVENT, handleTourTab);
    return () => window.removeEventListener(PERPS_TRADE_TAB_EVENT, handleTourTab);
  }, []);

  useEffect(() => {
    if (!numericAmount || numericAmount <= 0 || !isPerpsEnabled) {
      setPreviewFee(null);
      setPreviewLiq(null);
      return;
    }
    let dead = false;
    const timer = setTimeout(() => {
      previewOpenPosition({
        marketSymbol: token.symbol,
        collateralUsd: amount,
        leverage,
        side: tradeSide,
        orderType: orderType === "limit" ? "LIMIT" : "MARKET",
        limitPrice:
          orderType === "limit" && parseFloat(limitPrice) > 0
            ? limitPrice
            : undefined,
      })
        .then((q) => {
          if (dead) return;
          setPreviewFee(q.entryFee ?? null);
          setPreviewLiq(q.newLiquidationPrice ?? null);
        })
        .catch(() => {
          if (!dead) {
            setPreviewFee(null);
            setPreviewLiq(null);
          }
        });
    }, 400);
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [
    amount,
    leverage,
    tradeSide,
    orderType,
    limitPrice,
    token.symbol,
    numericAmount,
    isPerpsEnabled,
  ]);

  const adjustLeverage = (delta: number) => {
    setLeverage((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.min(levMax, Math.max(levMin, next));
    });
  };

  const insufficientBalance = hasInsufficientBalance(
    numericAmount,
    marginBalanceUsd,
    connected
  );

  const canSubmit =
    flash &&
    isPerpsEnabled &&
    activeSignerReady(flash) &&
    numericAmount > 0 &&
    entryPrice > 0 &&
    !insufficientBalance &&
    !tradeBusy &&
    !tpSlNeedsMin &&
    (orderType !== "limit" || parseFloat(limitPrice) > 0);

  const needsEnable = connected && flash && ownerLoaded && !isPerpsEnabled;
  const needsSessionRefresh = flash?.needsSessionRefresh ?? false;

  const handleSubmit = useCallback(async () => {
    if (!flash || !canSubmit) return;
    flash.clearTradeError();

    const result = await flash.openPosition({
      marketSymbol: token.symbol,
      collateralUsd: amount,
      leverage,
      side: tradeSide,
      orderType: orderType === "limit" ? "LIMIT" : "MARKET",
      limitPrice:
        orderType === "limit" && parseFloat(limitPrice) > 0
          ? limitPrice
          : undefined,
      takeProfit: tpSlEnabled && takeProfit ? takeProfit : undefined,
      stopLoss: tpSlEnabled && stopLoss ? stopLoss : undefined,
    });

    if (result.ok) {
      setSuccessToast(
        orderType === "limit"
          ? `${tradeSide} limit placed`
          : `${tradeSide} position opened`
      );
      setAmount("");
      setTakeProfit("");
      setStopLoss("");
    }
  }, [
    flash,
    canSubmit,
    token.symbol,
    amount,
    leverage,
    tradeSide,
    orderType,
    limitPrice,
    tpSlEnabled,
    takeProfit,
    stopLoss,
  ]);

  const displayMark = priceLoading && !flashPrice
    ? token.price
    : `$${fmtPrice(markUsd)}`;

  return (
    <aside
      className={
        embedded
          ? "flex-1 min-h-0 w-full flex flex-col overflow-y-auto bg-background"
          : "w-[380px] flex-shrink-0 border-l border-border bg-background flex flex-col overflow-y-auto"
      }
    >
      <div data-tour="perps-trade">
      <div className="grid grid-cols-2 border-b border-border">
        <button
          type="button"
          onClick={() => setSide("long")}
          className={`h-12 text-sm font-semibold transition-colors relative ${
            side === "long"
              ? "text-green bg-green/5"
              : "text-secondary hover:text-foreground hover:bg-elevated/30"
          }`}
        >
          Long / Buy
          {side === "long" && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-green rounded-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setSide("short")}
          className={`h-12 text-sm font-semibold transition-colors relative ${
            side === "short"
              ? "text-red bg-red/5"
              : "text-secondary hover:text-foreground hover:bg-elevated/30"
          }`}
        >
          Short / Sell
          {side === "short" && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-red rounded-full" />
          )}
        </button>
      </div>

      <div className={`p-4 flex flex-col gap-4 ${embedded ? "pb-6" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-elevated/60 border border-border">
            {(["market", "limit"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                  orderType === type
                    ? "bg-background text-foreground shadow-sm"
                    : "text-secondary hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
            <AutopilotTabButton
              active={orderType === "autopilot"}
              onClick={() => setOrderType("autopilot")}
              tourId="perps-autopilot-tab"
            />
          </div>
          <span className="text-xs text-gold font-mono tabular-nums">
            {displayMark}
          </span>
        </div>

        {orderType === "autopilot" ? (
          <div data-tour="perps-autopilot-panel">
            <PerpsAutopilotPanel onRequestEnable={onRequestEnable} />
          </div>
        ) : (
          <>
            {orderType === "limit" && (
              <div className="rounded-xl bg-input border border-border px-3 py-2.5">
                <label className="text-[11px] text-tertiary">Limit price</label>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-secondary font-mono">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={limitPrice}
                    onChange={(e) => {
                      if (isDecimalInput(e.target.value)) setLimitPrice(e.target.value);
                    }}
                    placeholder={formatNumber(markPrice)}
                    className="w-full bg-transparent outline-none text-foreground font-mono tabular-nums text-sm"
                  />
                </div>
              </div>
            )}

            <div
              className={`rounded-2xl bg-input border p-4 ${
                insufficientBalance ? "border-red/40" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-secondary">Collateral (USDC)</span>
                {connected && (
                  <button
                    type="button"
                    onClick={() => {
                      if (marginBalanceUsd > 0) {
                        setAmount(formatBankBalance(marginBalanceUsd, "USDC"));
                      }
                    }}
                    className="text-[11px] text-tertiary hover:text-gold transition-colors font-mono tabular-nums"
                  >
                    {marginLoading
                      ? "…"
                      : `${formatBankBalance(marginBalanceUsd, "USDC")} margin`}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full bg-elevated px-2 py-1.5 flex-shrink-0"
                >
                  <TokenIcon token={USDC} size={24} showQuote={false} />
                  <span className="text-sm font-semibold text-foreground">USDC</span>
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    if (isDecimalInput(e.target.value)) setAmount(e.target.value);
                  }}
                  placeholder="0.00"
                  className="w-full text-right text-2xl font-semibold text-foreground bg-transparent outline-none placeholder:text-tertiary font-mono tabular-nums"
                />
              </div>
              <InsufficientBalanceError show={insufficientBalance} className="mt-2" />
            </div>

            <div className="rounded-2xl bg-input border border-border p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-secondary">Leverage</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustLeverage(-1)}
                    className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-secondary hover:text-foreground hover:bg-hover transition-colors"
                    aria-label="Decrease leverage"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-bold text-foreground font-mono tabular-nums min-w-[4ch] text-center">
                    {leverage.toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustLeverage(1)}
                    className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-secondary hover:text-foreground hover:bg-hover transition-colors"
                    aria-label="Increase leverage"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={levMin}
                max={levMax}
                step={LEVERAGE_STEP}
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded-full appearance-none cursor-pointer perps-leverage-slider ${
                  side === "long" ? "perps-leverage-long" : "perps-leverage-short"
                }`}
              />
              <div className="flex justify-between mt-2 text-[10px] text-tertiary font-mono tabular-nums">
                <span>{levMin.toFixed(1)}x</span>
                <span>{(levMax / 2).toFixed(0)}x</span>
                <span>{levMax.toFixed(0)}x</span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={tpSlEnabled}
                onChange={(e) => setTpSlEnabled(e.target.checked)}
                className="rounded border-border bg-input text-gold focus:ring-gold/40"
              />
              <span className="text-sm text-secondary group-hover:text-foreground transition-colors">
                Take Profit / Stop Loss
              </span>
            </label>

            {tpSlEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-input border border-border px-3 py-2">
                  <span className="text-[11px] text-tertiary">Take profit</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={takeProfit}
                    onChange={(e) => {
                      if (isDecimalInput(e.target.value)) setTakeProfit(e.target.value);
                    }}
                    placeholder="Price"
                    className="w-full mt-1 bg-transparent outline-none text-sm font-mono text-foreground"
                  />
                </div>
                <div className="rounded-xl bg-input border border-border px-3 py-2">
                  <span className="text-[11px] text-tertiary">Stop loss</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={stopLoss}
                    onChange={(e) => {
                      if (isDecimalInput(e.target.value)) setStopLoss(e.target.value);
                    }}
                    placeholder="Price"
                    className="w-full mt-1 bg-transparent outline-none text-sm font-mono text-foreground"
                  />
                </div>
              </div>
            )}

            {tpSlNeedsMin && (
              <p className="text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
                TP/SL requires at least ${RECOMMENDED_MIN_COLLATERAL_USD} USDC collateral.
              </p>
            )}

            {tradeError && (
              <p className="text-xs text-red bg-red/10 border border-red/20 rounded-xl px-3 py-2">
                {tradeError}
              </p>
            )}

            {connected ? (
              needsEnable ? (
                <button
                  type="button"
                  onClick={onRequestEnable}
                  className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity"
                >
                  Enable Perps to Trade
                </button>
              ) : needsSessionRefresh ? (
                <button
                  type="button"
                  onClick={onRequestEnable}
                  className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity"
                >
                  Refresh Session to Trade
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`h-12 rounded-2xl text-base font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    side === "long"
                      ? "bg-green text-background hover:opacity-90"
                      : "bg-red text-white hover:opacity-90"
                  }`}
                >
                  {tradeBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting…
                    </>
                  ) : canSubmit ? (
                    side === "long" ? "Long / Buy" : "Short / Sell"
                  ) : insufficientBalance ? (
                    "Insufficient margin"
                  ) : tpSlNeedsMin ? (
                    "Min $11 for TP/SL"
                  ) : (
                    "Enter an amount"
                  )}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity"
              >
                Connect
              </button>
            )}

            <div className="rounded-xl border border-border-subtle bg-elevated/20 divide-y divide-border-subtle">
              <DetailRow
                label="Entry Price"
                value={entryPrice > 0 ? `$${formatNumber(entryPrice)}` : "—"}
              />
              <DetailRow
                label="Liquidation Price"
                value={
                  previewLiq
                    ? `$${formatNumber(num(previewLiq) ?? 0)}`
                    : "—"
                }
              />
              <DetailRow
                label="Position Size"
                value={
                  positionSizeUsd > 0 ? `$${formatNumber(positionSizeUsd)}` : "—"
                }
              />
              <DetailRow label="Entry Fee" value={previewFee ? fmtUsd(previewFee) : "—"} />
              <DetailRow label="Slippage" value="0.5%" valueClassName="text-gold" />
            </div>
          </>
        )}
      </div>
      </div>

      {successToast && (
        <ShortToast
          message={successToast}
          onDismiss={() => setSuccessToast(null)}
        />
      )}
    </aside>
  );
}

function activeSignerReady(
  flash: NonNullable<ReturnType<typeof useOptionalFlashTrade>>
): boolean {
  return Boolean(flash.activeSigner && flash.session);
}

function DetailRow({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-xs">
      <span className="text-tertiary">{label}</span>
      <span className={`font-mono tabular-nums ${valueClassName}`}>{value}</span>
    </div>
  );
}
