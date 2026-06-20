"use client";

import { ExternalLink, X } from "lucide-react";
import { useOptionalFlashTrade } from "../../providers/flash-trade-context";
import { explorerTx } from "../../../lib/flash-trade/client";
import type { EnableStepRow } from "../../../lib/flash-trade/enable";

function StepDot({ status }: { status: EnableStepRow["status"] }) {
  const cls =
    status === "done"
      ? "bg-green"
      : status === "active"
        ? "bg-gold animate-pulse"
        : status === "error"
          ? "bg-red"
          : status === "skipped"
            ? "bg-border"
            : "bg-border-subtle";
  return (
    <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />
  );
}

export default function PerpsEnableSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const flash = useOptionalFlashTrade();
  const enableState = flash?.enableState ?? null;
  const enabling = flash?.enabling ?? false;
  const runEnable = flash?.runEnable ?? (async () => false);
  const needsSessionRefresh = flash?.needsSessionRefresh ?? false;

  if (!open || !flash) return null;

  const locked = enableState?.phase === "signing";
  const done = enableState?.phase === "done";
  const stopped = enableState?.phase === "stopped";

  const handleEnable = async () => {
    const ok = await runEnable();
    if (ok) {
      setTimeout(onClose, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={locked ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-label="Enable perps trading"
        className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl border border-border bg-background shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border-subtle">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {needsSessionRefresh
                ? "Refresh Trading Session"
                : "Enable Perps Trading"}
            </h2>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              {needsSessionRefresh
                ? "Your Flash Trade basket is already on-chain. Create a session key in this browser for one-click trades — one wallet approval, small SOL top-up only."
                : "Account setup only on Solana mainnet. No USDC moves here — only a small SOL rent top-up for the session key."}
            </p>
          </div>
          {!locked && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-hover transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
          {enableState?.headline && (
            <p className="text-sm text-foreground font-medium">
              {enableState.headline}
            </p>
          )}

          {enableState?.fundingHint && (
            <p className="text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
              {enableState.fundingHint}
            </p>
          )}

          {enableState?.steps.map((step) => (
            <div key={step.id} className="flex items-start gap-3">
              <StepDot status={step.status} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{step.label}</p>
                {step.note && (
                  <p className="text-xs text-tertiary mt-0.5">{step.note}</p>
                )}
                {step.signature && (
                  <a
                    href={explorerTx(step.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline mt-1"
                  >
                    View tx
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {step.ms !== undefined && (
                <span className="text-[11px] text-tertiary font-mono tabular-nums">
                  {step.ms}ms
                </span>
              )}
            </div>
          ))}

          {enableState?.error && (
            <p className="text-sm text-red bg-red/10 border border-red/20 rounded-xl px-3 py-2">
              {enableState.error}
            </p>
          )}

          {done && enableState?.needsUsdc && (
            <p className="text-xs text-secondary">
              Setup complete. Deposit USDC margin via Portfolio → Perps to start
              trading.
            </p>
          )}
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2">
          {!done && (
            <button
              type="button"
              onClick={handleEnable}
              disabled={enabling || locked}
              className="h-11 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {enabling
                ? needsSessionRefresh
                  ? "Refreshing…"
                  : "Setting up…"
                : stopped
                  ? needsSessionRefresh
                    ? "Retry Refresh"
                    : "Retry Enable"
                  : needsSessionRefresh
                    ? "Approve Session in Wallet"
                    : "Approve in Wallet"}
            </button>
          )}
          {done && (
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-border text-foreground text-sm font-semibold hover:bg-hover transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
