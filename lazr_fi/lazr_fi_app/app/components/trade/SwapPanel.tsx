"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp, ChevronDown, Zap } from "lucide-react";
import AutopilotPanel from "../autopilot/AutopilotPanel";
import AutopilotTabButton from "../autopilot/AutopilotTabButton";
import TokenIcon from "../TokenIcon";
import { USDC_ICON_SRC } from "../../data/tokens";
import type { Token } from "../../data/tokens";
import { useBankBalances } from "../../hooks/useBankBalances";
import { usePoolQuoteContext } from "../../providers/PoolQuoteProvider";
import { usePropAmmActions } from "../../hooks/usePropAmmActions";
import { useUserBankDelegation } from "../../hooks/useUserBankDelegation";
import UserBankRedelegateBanner from "../propamm/UserBankRedelegateBanner";
import { getPoolForSymbol } from "../../../lib/devnet-config";
import { hasInsufficientBalance } from "../../../lib/balance-validation";
import InsufficientBalanceError from "../InsufficientBalanceError";
import ShortToast from "../ShortToast";
import {
  formatBankBalance,
  formatSwapAmount,
} from "../../../lib/format-numbers";
import {
  PROPAMM_SWAP_TAB_EVENT,
  type PropAmmSwapTabDetail,
} from "../../../lib/onboarding/propamm-tour-steps";
import { appendPropAmmTx } from "../../../lib/prop-amm/tx-history";

const ORDER_TABS = ["Market", "Limit"] as const;
type OrderTab = "Market" | "Limit" | "Autopilot";

const INSUFFICIENT_FUNDS_MSG =
  "Insufficient funds. Deposit via the wallet icon.";
const USDC = {
  ticker: "USDC",
  iconSrc: USDC_ICON_SRC,
};

type SwapToken = Token | typeof USDC;

function formatNumber(value: number, ticker?: string): string {
  return formatSwapAmount(value, ticker);
}

function formatLimitPriceInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(8);
}

function isDecimalInput(value: string): boolean {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

function TokenPillBalance({
  balance,
  ticker,
  loading,
}: {
  balance: number | null;
  ticker: string;
  loading: boolean;
}) {
  if (balance === null) return null;

  return (
    <span className="text-[11px] text-tertiary font-mono tabular-nums pl-0.5">
      {loading ? "…" : `${formatBankBalance(balance, ticker)} ${ticker}`}
    </span>
  );
}

function ActionButton({
  connected,
  disabled,
  disabledLabel,
  actionLabel,
  loading = false,
  onConnect,
  onAction,
}: {
  connected: boolean;
  disabled: boolean;
  disabledLabel: string;
  actionLabel: string;
  loading?: boolean;
  onConnect: () => void;
  onAction: () => void;
}) {
  if (!connected) {
    return (
      <button
        type="button"
        onClick={onConnect}
        className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity"
      >
        Connect
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onAction}
      disabled={disabled || loading}
      className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? "Swapping…" : disabled ? disabledLabel : actionLabel}
    </button>
  );
}

export default function SwapPanel({
  token,
  embedded = false,
}: {
  token: Token;
  embedded?: boolean;
}) {
  const [orderTab, setOrderTab] = useState<OrderTab>("Market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [inverted, setInverted] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { getBankBalance, refresh, loading: balancesLoading } =
    useBankBalances();
  const { swap, loading: swapLoading, error: swapError, clearError } =
    usePropAmmActions();
  const {
    needsRedelegate,
    redelegateLoading,
    redelegateError,
    redelegate,
    refresh: refreshUserBankDelegation,
  } = useUserBankDelegation();
  const poolCtx = useMemo(() => getPoolForSymbol(token.ticker), [token.ticker]);
  const poolQuote = usePoolQuoteContext();

  useEffect(() => {
    if (orderTab === "Limit" && limitPrice === "") {
      const seed =
        poolQuote.fairPriceUsd > 0 ? poolQuote.fairPriceUsd : token.priceUsd;
      setLimitPrice(formatLimitPriceInput(seed));
    }
  }, [orderTab, limitPrice, token.priceUsd, poolQuote.fairPriceUsd]);

  useEffect(() => {
    const handleTourTab = (event: Event) => {
      const tab = (event as CustomEvent<PropAmmSwapTabDetail>).detail?.tab;
      if (tab === "Market" || tab === "Limit" || tab === "Autopilot") {
        setOrderTab(tab);
      }
    };
    window.addEventListener(PROPAMM_SWAP_TAB_EVENT, handleTourTab);
    return () => window.removeEventListener(PROPAMM_SWAP_TAB_EVENT, handleTourTab);
  }, []);

  const numericAmount = parseFloat(amount) || 0;
  const numericLimitPrice = parseFloat(limitPrice.replace(/,/g, "")) || 0;
  const marketPrice =
    poolQuote.fresh && poolQuote.fairPriceUsd > 0
      ? poolQuote.fairPriceUsd
      : token.priceUsd;
  const effectivePrice =
    orderTab === "Limit" ? numericLimitPrice : marketPrice;

  const swapEstimate = useMemo(() => {
    if (orderTab !== "Market" || !poolQuote.fresh || numericAmount <= 0) {
      return null;
    }
    return poolQuote.estimateSwap(
      numericAmount,
      inverted ? "asset_for_usdc" : "usdc_for_asset",
      poolCtx.decimals,
      poolCtx.usdcDecimals
    );
  }, [
    orderTab,
    poolQuote.fresh,
    poolQuote.estimateSwap,
    numericAmount,
    inverted,
    poolCtx.decimals,
    poolCtx.usdcDecimals,
  ]);

  const { sellToken, buyToken, outputAmount, sellUsd, buyUsd } = useMemo(() => {
    if (!effectivePrice || effectivePrice <= 0) {
      return {
        sellToken: inverted ? token : USDC,
        buyToken: inverted ? USDC : token,
        outputAmount: 0,
        sellUsd: 0,
        buyUsd: 0,
      };
    }

    if (orderTab === "Market" && swapEstimate) {
      const output = swapEstimate.outputHuman;
      if (!inverted) {
        return {
          sellToken: USDC as SwapToken,
          buyToken: token,
          outputAmount: output,
          sellUsd: numericAmount,
          buyUsd: output * marketPrice,
        };
      }
      return {
        sellToken: token,
        buyToken: USDC as SwapToken,
        outputAmount: output,
        sellUsd: numericAmount * marketPrice,
        buyUsd: output,
      };
    }

    if (!inverted) {
      const output = numericAmount / effectivePrice;
      return {
        sellToken: USDC as SwapToken,
        buyToken: token,
        outputAmount: output,
        sellUsd: numericAmount,
        buyUsd: output * effectivePrice,
      };
    }

    const output = numericAmount * effectivePrice;
    return {
      sellToken: token,
      buyToken: USDC as SwapToken,
      outputAmount: output,
      sellUsd: numericAmount * effectivePrice,
      buyUsd: output,
    };
  }, [
    inverted,
    numericAmount,
    token,
    effectivePrice,
    orderTab,
    swapEstimate,
    marketPrice,
  ]);

  const sellBalance = getBankBalance(sellToken.ticker);
  const buyBalance = getBankBalance(buyToken.ticker);
  const usdcBalance = getBankBalance("USDC");

  const limitVsMarketPct =
    orderTab === "Limit" && numericLimitPrice > 0 && marketPrice > 0
      ? ((numericLimitPrice - marketPrice) / marketPrice) * 100
      : 0;

  const quoteReady =
    orderTab !== "Market" || (poolQuote.fresh && !poolQuote.loading);
  const insufficientSellBalance = hasInsufficientBalance(
    numericAmount,
    sellBalance,
    connected
  );
  const canSubmitMarket =
    numericAmount > 0 &&
    !insufficientSellBalance &&
    !swapLoading &&
    !needsRedelegate &&
    quoteReady &&
    (swapEstimate?.outputHuman ?? 0) > 0;
  const canSubmitLimit =
    numericAmount > 0 &&
    numericLimitPrice > 0 &&
    effectivePrice > 0 &&
    !insufficientSellBalance;

  const handleMarketSwap = async () => {
    if (!canSubmitMarket || !swapEstimate) return;
    clearError();

    const soldAmount = numericAmount;
    const soldTicker = sellToken.ticker;
    const boughtAmount = swapEstimate.outputHuman;
    const boughtTicker = buyToken.ticker;

    try {
      const result = await swap({
        assetSymbol: token.ticker,
        sellSymbol: sellToken.ticker,
        amountIn: numericAmount,
        minAmountOut: swapEstimate.minAmountOutHuman,
      });
      setAmount("");
      setSuccessToast(
        `Swapped ${formatBankBalance(soldAmount, soldTicker)} ${soldTicker} → ${formatBankBalance(boughtAmount, boughtTicker)} ${boughtTicker}`
      );
      if (publicKey) {
        appendPropAmmTx(publicKey.toBase58(), {
          kind: "swap",
          signature: result.signature,
          pair: `${token.ticker}/USDC`,
          direction: inverted ? "sell" : "buy",
          amountLabel: `${formatBankBalance(soldAmount, soldTicker)} ${soldTicker} → ${formatBankBalance(boughtAmount, boughtTicker)} ${boughtTicker}`,
        });
      }
      await refresh();
    } catch {
      // surfaced via swapError
    } finally {
      void refreshUserBankDelegation();
    }
  };

  const placeLimitOrder = () => {
    if (!canSubmitLimit) return;
    setAmount("");
    setSuccessToast(
      `Limit ${inverted ? "sell" : "buy"} order placed for ${token.ticker}`
    );
  };

  const showOrderForm = orderTab === "Market" || orderTab === "Limit";

  return (
    <aside
      className={
        embedded
          ? "flex-1 min-h-0 w-full flex flex-col overflow-y-auto bg-background"
          : "w-[360px] flex-shrink-0 border-l border-border bg-background flex flex-col overflow-y-auto"
      }
    >
      <div className="flex items-center justify-between px-4 h-12 border-b border-border">
        <div className="flex items-center gap-1">
          {ORDER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setOrderTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                orderTab === tab
                  ? "text-foreground bg-elevated"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
          <AutopilotTabButton
            active={orderTab === "Autopilot"}
            onClick={() => setOrderTab("Autopilot")}
            size="md"
            tourId="propamm-autopilot-tab"
          />
        </div>
      </div>

      {orderTab === "Autopilot" ? (
        <div
          className={`p-4 ${embedded ? "pb-6" : ""}`}
          data-tour="propamm-autopilot"
        >
          <AutopilotPanel
            context="swap"
            tokenTicker={token.ticker}
            capitalBalance={usdcBalance}
            balancesLoading={balancesLoading}
            connected={connected}
            onConnect={() => setVisible(true)}
          />
        </div>
      ) : (
        <div
          className={`p-4 flex flex-col gap-1.5 ${embedded ? "pb-6" : ""}`}
          data-tour="propamm-swap"
        >
          <UserBankRedelegateBanner
            needsRedelegate={needsRedelegate}
            loading={redelegateLoading}
            error={redelegateError}
            onRedelegate={() => void redelegate()}
            className="mb-2"
          />
          {/* Sell */}
          <div
            className={`rounded-2xl bg-input border p-4 ${
              insufficientSellBalance ? "border-red/40" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-secondary">Sell</span>
              {orderTab === "Limit" && sellBalance !== null && (
                <button
                  type="button"
                  onClick={() => {
                    if (sellBalance !== null && sellBalance > 0) {
                      setAmount(formatBankBalance(sellBalance, sellToken.ticker));
                    }
                  }}
                  className="text-[11px] text-gold hover:text-gold-light transition-colors font-medium"
                >
                  Max
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full bg-elevated px-2 py-1.5 hover:bg-hover transition-colors"
                >
                  <TokenIcon token={sellToken} size={24} showQuote={false} />
                  <span className="text-sm font-semibold text-foreground">
                    {sellToken.ticker}
                  </span>
                  <ChevronDown className="w-4 h-4 text-secondary" />
                </button>
                <TokenPillBalance
                  balance={sellBalance}
                  ticker={sellToken.ticker}
                  loading={balancesLoading}
                />
              </div>
              <div className="flex flex-col items-end min-w-0">
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
                <span className="text-xs text-tertiary font-mono tabular-nums">
                  ${formatNumber(sellUsd)}
                </span>
                <InsufficientBalanceError
                  show={insufficientSellBalance}
                  message={INSUFFICIENT_FUNDS_MSG}
                  className="text-right mt-1"
                />
              </div>
            </div>
          </div>

          <div className="relative h-0 flex items-center justify-center z-10">
            <button
              type="button"
              onClick={() => setInverted((prev) => !prev)}
              className="absolute w-9 h-9 rounded-xl bg-elevated border-4 border-background text-gold hover:bg-hover transition-colors flex items-center justify-center"
              aria-label="Invert swap direction"
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>
          </div>

          {/* Buy */}
          <div className="rounded-2xl bg-input border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-secondary">Buy</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full bg-elevated px-2 py-1.5 hover:bg-hover transition-colors"
                >
                  <TokenIcon token={buyToken} size={24} showQuote={false} />
                  <span className="text-sm font-semibold text-foreground">
                    {buyToken.ticker}
                  </span>
                  <ChevronDown className="w-4 h-4 text-secondary" />
                </button>
                <TokenPillBalance
                  balance={buyBalance}
                  ticker={buyToken.ticker}
                  loading={balancesLoading}
                />
              </div>
              <div className="flex flex-col items-end min-w-0">
                <span className="w-full text-right text-2xl font-semibold text-foreground font-mono tabular-nums truncate">
                  {formatNumber(outputAmount, buyToken.ticker)}
                </span>
                <span className="text-xs text-tertiary font-mono tabular-nums">
                  ${formatNumber(buyUsd)}
                </span>
              </div>
            </div>
          </div>

          {orderTab === "Limit" && (
            <div className="rounded-2xl bg-input border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-secondary">Limit price</span>
                <button
                  type="button"
                  onClick={() =>
                    setLimitPrice(formatLimitPriceInput(marketPrice))
                  }
                  className="text-[11px] text-gold hover:text-gold-light transition-colors font-medium"
                >
                  Use market
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-tertiary flex-shrink-0">
                  1 {token.ticker} =
                </span>
                <div className="flex flex-col items-end min-w-0 flex-1">
                  <div className="flex items-center gap-1 w-full justify-end">
                    <span className="text-lg text-secondary font-mono">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={limitPrice}
                      onChange={(e) => {
                        if (isDecimalInput(e.target.value)) {
                          setLimitPrice(e.target.value);
                        }
                      }}
                      placeholder="0.00"
                      className="w-full text-right text-xl font-semibold text-foreground bg-transparent outline-none placeholder:text-tertiary font-mono tabular-nums"
                    />
                  </div>
                  <span
                    className={`text-[11px] font-mono tabular-nums ${
                      limitVsMarketPct > 0
                        ? "text-green"
                        : limitVsMarketPct < 0
                          ? "text-red"
                          : "text-tertiary"
                    }`}
                  >
                    {numericLimitPrice > 0
                      ? `${limitVsMarketPct >= 0 ? "+" : ""}${limitVsMarketPct.toFixed(2)}% vs market (${formatNumber(marketPrice)})`
                      : "Set a limit price"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-tertiary leading-relaxed">
                Order fills when {token.ticker} reaches your limit price. Open
                until cancelled.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between px-1 py-2 text-xs text-tertiary">
            <span className="flex items-center gap-1.5">
              {orderTab === "Limit" ? "Limit rate" : "Rate"}
              {orderTab === "Market" && poolQuote.connected && (
                <span className="inline-flex items-center gap-1 text-[10px] text-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                  live
                </span>
              )}
            </span>
            <span className="font-mono tabular-nums">
              1 {token.ticker} = ${formatNumber(effectivePrice)}
            </span>
          </div>

          {orderTab === "Market" ? (
            <>
              <ActionButton
                connected={connected}
                disabled={!canSubmitMarket}
                disabledLabel={
                  insufficientSellBalance
                    ? "Insufficient funds"
                    : poolQuote.loading
                      ? "Loading quote…"
                      : !poolQuote.fresh
                        ? "Quote stale"
                        : numericAmount <= 0
                          ? "Enter an amount"
                          : "Enter an amount"
                }
                actionLabel="Swap"
                loading={swapLoading}
                onConnect={() => setVisible(true)}
                onAction={handleMarketSwap}
              />
              {swapError && (
                <p className="text-xs text-red font-medium px-1 -mt-1">
                  {swapError}
                </p>
              )}
            </>
          ) : (
            <ActionButton
              connected={connected}
              disabled={!canSubmitLimit}
              disabledLabel={
                insufficientSellBalance
                  ? "Insufficient funds"
                  : numericAmount <= 0
                    ? "Enter an amount"
                    : "Enter a limit price"
              }
              actionLabel="Place limit order"
              onConnect={() => setVisible(true)}
              onAction={placeLimitOrder}
            />
          )}
        </div>
      )}

      {successToast && (
        <ShortToast
          message={successToast}
          onDismiss={() => setSuccessToast(null)}
        />
      )}
    </aside>
  );
}
