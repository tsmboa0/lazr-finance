"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import TokenIcon from "./TokenIcon";
import { getTradeTokens } from "../../lib/devnet-config";
import { useWalletBalances } from "../hooks/useWalletBalances";
import { useBankBalances } from "../hooks/useBankBalances";
import { usePropAmmActions } from "../hooks/usePropAmmActions";
import { useOptionalFlashTrade } from "../providers/flash-trade-context";
import { explorerTx } from "../../lib/flash-trade/client";
import { hasInsufficientBalance } from "../../lib/balance-validation";
import { formatBankBalance } from "../../lib/format-numbers";
import InsufficientBalanceError from "./InsufficientBalanceError";

const DEPOSIT_TOKENS = getTradeTokens();

type ActionMode = "deposit" | "withdraw";
type FundsVenue = "propamm" | "perps";

type DepositDropdownVariant = "header" | "bottomNav";

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0.00";
  if (value < 0.0001) return value.toFixed(8);
  if (value < 1) return value.toFixed(6);
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function NavIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`w-6 h-0.5 rounded-full mb-0.5 ${
        active ? "bg-foreground" : "bg-transparent"
      }`}
    />
  );
}

export default function DepositDropdown({
  variant = "header",
}: {
  variant?: DepositDropdownVariant;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ActionMode | null>(null);
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState(
    DEPOSIT_TOKENS[0]?.symbol ?? "USDC"
  );
  const [venue, setVenue] = useState<FundsVenue>("propamm");
  const pathname = usePathname();
  const [txSignature, setTxSignature] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedToken =
    DEPOSIT_TOKENS.find((t) => t.symbol === selectedSymbol) ??
    DEPOSIT_TOKENS[0] ??
    null;
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { getBalance, refresh: refreshWallet, loading: walletLoading } =
    useWalletBalances();
  const { getBankBalance, refresh: refreshBank, loading: bankLoading } =
    useBankBalances();
  const { deposit, withdraw, loading: txLoading, error, clearError } =
    usePropAmmActions();
  const flash = useOptionalFlashTrade();
  const depositMargin =
    flash?.depositMargin ??
    (async () => ({ ok: false as const, error: "Perps loading…" }));
  const withdrawMargin =
    flash?.withdrawMargin ??
    (async () => ({ ok: false as const, error: "Perps loading…" }));
  const fundsLoading = flash?.fundsLoading ?? false;
  const fundsStep = flash?.fundsStep ?? null;
  const marginBalanceUsd = flash?.marginBalanceUsd ?? 0;
  const marginLoading = flash?.marginLoading ?? false;
  const isPerpsEnabled = flash?.isPerpsEnabled ?? false;
  const perpsWalletUsdc = flash?.perpsWalletUsdc ?? null;
  const perpsWalletLoading = flash?.perpsWalletLoading ?? false;
  const refreshPerpsWallet =
    flash?.refreshPerpsWallet ?? (async () => undefined);
  const clearFundsStep = flash?.clearFundsStep ?? (() => undefined);
  const perpsReady = flash !== null;

  const isBottomNav = variant === "bottomNav";
  const isDeposit = modalMode === "deposit";
  const isPerpsVenue = venue === "perps";
  const activeToken = isPerpsVenue
    ? DEPOSIT_TOKENS.find((t) => t.symbol === "USDC") ?? selectedToken
    : selectedToken;

  useEffect(() => {
    if (pathname?.startsWith("/perps")) {
      setVenue("perps");
    }
  }, [pathname]);

  useEffect(() => {
    if (modalMode && isPerpsVenue) {
      void refreshPerpsWallet();
    }
  }, [modalMode, isPerpsVenue, refreshPerpsWallet]);

  useEffect(() => {
    if (!menuOpen && !modalMode) return;
    clearError();
  }, [menuOpen, modalMode, clearError]);

  useEffect(() => {
    if (isBottomNav || (!menuOpen && !modalMode)) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
        setModalMode(null);
        setTokenMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen, modalMode, isBottomNav]);

  const numericAmount = parseFloat(amount) || 0;
  const walletBalance = activeToken ? getBalance(activeToken.ticker) : null;
  const bankBalance = activeToken
    ? getBankBalance(activeToken.symbol)
    : null;
  const perpsBalance = marginBalanceUsd;
  const perpsDepositBalance = perpsWalletUsdc;
  const availableBalance = isPerpsVenue
    ? isDeposit
      ? perpsDepositBalance
      : perpsBalance
    : isDeposit
      ? walletBalance
      : bankBalance;
  const balanceLoading = isPerpsVenue
    ? isDeposit
      ? perpsWalletLoading
      : marginLoading
    : isDeposit
      ? walletLoading
      : bankLoading;
  const actionLoading = isPerpsVenue ? fundsLoading : txLoading;

  const insufficientBalance = hasInsufficientBalance(
    numericAmount,
    availableBalance,
    connected
  );
  const canSubmit =
    numericAmount > 0 &&
    activeToken !== null &&
    !insufficientBalance &&
    !actionLoading &&
    (!isPerpsVenue || (perpsReady && (isPerpsEnabled || !isDeposit)));

  const resetStatus = () => {
    setTxSignature("");
    setSuccessMessage("");
    clearError();
    clearFundsStep();
  };

  const openModal = (mode: ActionMode) => {
    setMenuOpen(false);
    setModalMode(mode);
    setAmount("");
    setTokenMenuOpen(false);
    if (pathname?.startsWith("/perps")) {
      setVenue("perps");
    }
    resetStatus();
  };

  const closeAll = () => {
    setMenuOpen(false);
    setModalMode(null);
    setTokenMenuOpen(false);
    resetStatus();
  };

  const handleSubmit = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }
    if (!canSubmit || !activeToken) return;

    resetStatus();

    try {
      if (isPerpsVenue) {
        const amountStr = amount;
        const result = isDeposit
          ? await depositMargin(amountStr)
          : await withdrawMargin(amountStr);
        if (result.ok) {
          setSuccessMessage(
            isDeposit
              ? `Deposited ${formatBankBalance(numericAmount, "USDC")} USDC to perps margin.`
              : `Withdrew ${formatBankBalance(numericAmount, "USDC")} USDC to your wallet.`
          );
          setAmount("");
          await Promise.all([
            refreshPerpsWallet(),
            isPerpsVenue ? Promise.resolve() : refreshWallet(),
          ]);
        } else if (result.error) {
          setSuccessMessage("");
        }
        return;
      }

      const action = isDeposit ? deposit : withdraw;
      const result = await action(activeToken.symbol, numericAmount);
      setTxSignature(result.signature);
      setSuccessMessage(
        isDeposit
          ? `Deposited ${formatNumber(numericAmount)} ${activeToken.ticker} to your bank.`
          : `Withdrew ${formatNumber(numericAmount)} ${activeToken.ticker} to your wallet.`
      );
      setAmount("");
      await Promise.all([refreshWallet(), refreshBank()]);
    } catch {
      // error surfaced via hook
    }
  };

  const portfolioActive = menuOpen || modalMode !== null;

  const modalContent = (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {isDeposit ? "Deposit" : "Withdraw"}
        </span>
        <span className="text-xs text-tertiary">
          {isPerpsVenue
            ? isDeposit
              ? "Wallet → Perps"
              : "Perps → Wallet"
            : isDeposit
              ? "Wallet → Bank"
              : "Bank → Wallet"}
        </span>
      </div>

      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-elevated/60 border border-border">
        {(["propamm", "perps"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setVenue(v);
              resetStatus();
            }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              venue === v
                ? "bg-background text-foreground shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            {v === "propamm" ? "PropAMM" : "Perps"}
          </button>
        ))}
      </div>

      {isPerpsVenue && !perpsReady && (
        <p className="text-xs text-secondary bg-elevated/60 border border-border rounded-xl px-3 py-2">
          Open a perps market page to load margin deposits, or switch to PropAMM
          for devnet bank funds.
        </p>
      )}

      {isPerpsVenue && !isPerpsEnabled && isDeposit && perpsReady && (
        <p className="text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
          Enable perps on the perps page before depositing margin.
        </p>
      )}

      {isPerpsVenue && isDeposit && (
        <p className="text-[11px] text-tertiary">
          Uses mainnet USDC from your wallet. Switch your wallet to Solana
          mainnet for perps deposits.
        </p>
      )}

      <div
        className={`rounded-2xl bg-input border p-4 ${
          insufficientBalance ? "border-red/40" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex flex-col gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!isPerpsVenue) setTokenMenuOpen((prev) => !prev);
              }}
              disabled={isPerpsVenue}
              className="flex items-center gap-2 rounded-full bg-elevated px-2 py-1.5 hover:bg-hover transition-colors disabled:cursor-default"
              aria-expanded={tokenMenuOpen}
              aria-haspopup="listbox"
            >
              {activeToken && (
                <TokenIcon
                  token={activeToken}
                  size={24}
                  showQuote={activeToken.symbol !== "USDC"}
                />
              )}
              <span className="text-sm font-semibold text-foreground">
                {activeToken?.ticker ?? "—"}
              </span>
              {!isPerpsVenue && (
                <ChevronDown
                  className={`w-4 h-4 text-secondary transition-transform ${
                    tokenMenuOpen ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            {connected && activeToken && (
              <button
                type="button"
                onClick={() => {
                  if (availableBalance !== null && availableBalance > 0) {
                    setAmount(
                      isPerpsVenue
                        ? formatBankBalance(availableBalance, "USDC")
                        : formatNumber(availableBalance)
                    );
                    resetStatus();
                  }
                }}
                className="text-[11px] text-tertiary hover:text-gold transition-colors font-mono tabular-nums pl-0.5 text-left"
              >
                {balanceLoading
                  ? "…"
                  : `${isPerpsVenue ? formatBankBalance(availableBalance ?? 0, "USDC") : formatNumber(availableBalance ?? 0)} ${activeToken.ticker}`}
              </button>
            )}

            {tokenMenuOpen && !isPerpsVenue && (
              <ul
                className="absolute left-0 top-full mt-1.5 z-10 min-w-[160px] rounded-xl border border-border bg-elevated py-1 shadow-lg max-h-56 overflow-y-auto"
                role="listbox"
              >
                {DEPOSIT_TOKENS.map((token) => (
                  <li key={token.symbol}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={token.symbol === selectedSymbol}
                      onClick={() => {
                        setSelectedSymbol(token.symbol);
                        setTokenMenuOpen(false);
                        resetStatus();
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        token.symbol === selectedToken?.symbol
                          ? "bg-hover text-foreground"
                          : "text-secondary hover:bg-hover hover:text-foreground"
                      }`}
                    >
                      <TokenIcon
                        token={token}
                        size={22}
                        showQuote={token.symbol !== "USDC"}
                      />
                      <span className="font-semibold">{token.ticker}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col items-end min-w-0 flex-1">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) {
                  setAmount(v);
                  resetStatus();
                }
              }}
              placeholder="0.00"
              className="w-full text-right text-2xl font-semibold text-foreground bg-transparent outline-none placeholder:text-tertiary font-mono tabular-nums"
            />
            <InsufficientBalanceError
              show={insufficientBalance}
              className="text-right mt-1"
            />
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-green/25 bg-green/10 px-4 py-3 text-sm text-green">
          <p className="text-center">{successMessage}</p>
          {txSignature && (
            <a
              href={
                isPerpsVenue
                  ? explorerTx(txSignature)
                  : `https://solscan.io/tx/${txSignature}?cluster=devnet`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1 text-xs text-green/90 hover:text-green underline"
            >
              View on Solscan
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {(error || fundsStep?.phase === "error") && (
        <div className="rounded-xl border border-red/25 bg-red/10 px-4 py-3 text-sm text-red text-center">
          {error ?? fundsStep?.note}
        </div>
      )}

      {fundsStep && fundsStep.phase !== "error" && fundsStep.phase !== "done" && (
        <div className="rounded-xl border border-border bg-elevated/40 px-4 py-3 text-sm text-secondary text-center">
          {fundsStep.note ?? fundsStep.label}
        </div>
      )}

      {connected ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-11 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {actionLoading
            ? isDeposit
              ? "Depositing…"
              : "Withdrawing…"
            : numericAmount <= 0
              ? "Enter an amount"
              : insufficientBalance
                ? "Insufficient balance"
                : isPerpsVenue && !perpsReady
                  ? "Loading perps…"
                  : isPerpsVenue && !isPerpsEnabled && isDeposit
                  ? "Enable perps first"
                  : isDeposit
                    ? "Deposit"
                    : "Withdraw"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="h-11 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity"
        >
          Connect
        </button>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={containerRef}
        className={
          isBottomNav
            ? "relative flex flex-1 min-w-0 h-full self-stretch"
            : "relative"
        }
        onMouseEnter={() =>
          !isBottomNav && !modalMode && setMenuOpen(true)
        }
        onMouseLeave={() => !isBottomNav && setMenuOpen(false)}
      >
        {isBottomNav ? (
          <button
            type="button"
            onClick={() => {
              if (modalMode) {
                closeAll();
              } else {
                setMenuOpen((prev) => !prev);
              }
            }}
            className={`flex flex-col items-center justify-center gap-0.5 w-full h-full min-w-0 transition-colors ${
              portfolioActive
                ? "text-foreground"
                : "text-tertiary hover:text-secondary"
            }`}
            aria-expanded={portfolioActive}
            aria-haspopup="menu"
            aria-label="Wallet actions"
          >
            <NavIndicator active={portfolioActive} />
            <Wallet className="w-5 h-5" strokeWidth={1.75} />
            <span className="text-[10px] font-medium truncate max-w-full px-1 leading-none">
              Portfolio
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (modalMode) {
                closeAll();
              } else {
                setMenuOpen((prev) => !prev);
              }
            }}
            className={`p-2.5 rounded-lg transition-colors text-gold ${
              portfolioActive ? "bg-elevated" : "hover:bg-elevated/50"
            }`}
            aria-expanded={portfolioActive}
            aria-haspopup="menu"
            aria-label="Wallet actions"
          >
            <Wallet className="w-5 h-5" />
          </button>
        )}

        {!isBottomNav && menuOpen && !modalMode && (
          <div className="absolute right-0 top-full z-50 pt-1.5">
            <div
              className="min-w-[148px] rounded-xl border border-border bg-elevated py-1 shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => openModal("deposit")}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-secondary hover:bg-hover hover:text-foreground transition-colors"
              >
                <ArrowDownToLine className="w-4 h-4 text-gold" />
                Deposit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => openModal("withdraw")}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-secondary hover:bg-hover hover:text-foreground transition-colors"
              >
                <ArrowUpFromLine className="w-4 h-4 text-gold" />
                Withdraw
              </button>
            </div>
          </div>
        )}

        {!isBottomNav && modalMode && (
          <div className="absolute right-0 top-full z-50 pt-2">
            <div
              className="w-[320px] rounded-2xl border border-border bg-background shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
              role="dialog"
              aria-label={isDeposit ? "Deposit" : "Withdraw"}
            >
              {modalContent}
            </div>
          </div>
        )}
      </div>

      {isBottomNav && menuOpen && !modalMode && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute inset-x-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] max-w-md mx-auto rounded-xl border border-border bg-elevated py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => openModal("deposit")}
              className="flex w-full items-center gap-2.5 px-4 py-3.5 text-sm font-medium text-secondary hover:bg-hover hover:text-foreground transition-colors"
            >
              <ArrowDownToLine className="w-4 h-4 text-gold" />
              Deposit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => openModal("withdraw")}
              className="flex w-full items-center gap-2.5 px-4 py-3.5 text-sm font-medium text-secondary hover:bg-hover hover:text-foreground transition-colors"
            >
              <ArrowUpFromLine className="w-4 h-4 text-gold" />
              Withdraw
            </button>
          </div>
        </div>
      )}

      {isBottomNav && modalMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close"
            onClick={closeAll}
          />
          <div
            className="relative w-full max-w-md mx-4 mb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] rounded-2xl border border-border bg-background shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
            role="dialog"
            aria-label={isDeposit ? "Deposit" : "Withdraw"}
          >
            {modalContent}
          </div>
        </div>
      )}
    </>
  );
}
