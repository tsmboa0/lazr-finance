"use client";

import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PositionMetrics, TradeType } from "flash-v2";
import { ExternalLink, Loader2, X } from "lucide-react";
import ShortToast from "../ShortToast";
import { usePerpsTxHistory } from "../../hooks/usePerpsTxHistory";
import { useOptionalFlashTrade } from "../../providers/flash-trade-context";
import { allPositions, useFlashPrice } from "../../../lib/flash-trade/hooks";
import {
  fmtPnlUsd,
  fmtPrice,
  fmtUsd,
  num,
} from "../../../lib/flash-trade/format";
import {
  directionClass,
  directionLabel,
  formatTxAge,
  kindLabel,
  perpsTxExplorerUrl,
} from "../../../lib/flash-trade/tx-history";

const TABS = ["Transactions", "Positions"] as const;

export default function PerpsPositionsPanel({ compact = false }: { compact?: boolean }) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Transactions");
  const [closingKey, setClosingKey] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const flash = useOptionalFlashTrade();
  const { txs } = usePerpsTxHistory();

  const positions = useMemo(
    () => allPositions(flash?.snapshot ?? null),
    [flash?.snapshot]
  );

  const tradeBusy = flash?.tradeBusy ?? false;
  const isPerpsEnabled = flash?.isPerpsEnabled ?? false;

  const handleCloseAll = useCallback(async () => {
    if (!flash || positions.length === 0 || tradeBusy) return;
    const result = await flash.closeAllPositions();
    if (result.ok) {
      setSuccessToast("All positions closed");
    }
  }, [flash, positions.length, tradeBusy]);

  const handleCloseOne = useCallback(
    async (p: PositionMetrics) => {
      if (!flash || tradeBusy) return;
      const side = p.sideUi.toUpperCase() === "LONG" ? "LONG" : "SHORT";
      const key = `${p.marketSymbol}-${side}`;
      setClosingKey(key);
      try {
        const result = await flash.closePosition({
          marketSymbol: p.marketSymbol,
          side: side as TradeType,
        });
        if (result.ok) {
          setSuccessToast(`${p.marketSymbol} ${side} closed`);
        }
      } finally {
        setClosingKey(null);
      }
    },
    [flash, tradeBusy]
  );

  return (
    <div
      className={`flex flex-col border-t border-border bg-background min-h-0 ${
        compact ? "max-h-[220px] flex-shrink-0" : "h-full"
      }`}
      data-tour="perps-positions"
    >
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
        {activeTab === "Positions" && (
          <button
            type="button"
            onClick={handleCloseAll}
            disabled={
              !connected || !isPerpsEnabled || positions.length === 0 || tradeBusy
            }
            className="text-[12px] font-medium text-secondary hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {tradeBusy && closingKey === null ? "Closing…" : "Close All"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {connected ? (
          activeTab === "Transactions" ? (
            txs.length === 0 ? (
              <EmptyState message="No transactions yet — enable, deposit, or trade to get started" />
            ) : (
              <table className="w-full min-w-[640px]">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="text-[11px] text-tertiary border-b border-border">
                    <th className="text-left font-normal py-2 px-4">Age</th>
                    <th className="text-left font-normal py-2 px-3">Type</th>
                    <th className="text-left font-normal py-2 px-3">Market</th>
                    <th className="text-left font-normal py-2 px-3">Direction</th>
                    <th className="text-right font-normal py-2 px-3">Amount</th>
                    <th className="text-right font-normal py-2 px-4">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-border-subtle last:border-b-0 hover:bg-elevated/30 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-[12px] text-tertiary whitespace-nowrap">
                        {formatTxAge(tx.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 text-[12px] text-foreground whitespace-nowrap">
                        {kindLabel(tx.kind)}
                      </td>
                      <td className="py-2.5 px-3 text-[12px] font-medium text-foreground whitespace-nowrap">
                        {tx.market}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-[12px] font-medium whitespace-nowrap ${directionClass(tx.direction)}`}
                      >
                        {directionLabel(tx.direction)}
                      </td>
                      <td className="py-2.5 px-3 text-[12px] text-foreground font-mono tabular-nums text-right whitespace-nowrap">
                        {tx.amountLabel}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <a
                          href={perpsTxExplorerUrl(tx.chain, tx.signature)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-gold hover:text-gold-light transition-colors font-mono"
                          title="View on Solscan"
                        >
                          {tx.signature.slice(0, 4)}…{tx.signature.slice(-4)}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : !isPerpsEnabled ? (
            <EmptyState message="Enable perps to view positions" />
          ) : positions.length === 0 ? (
            <EmptyState message="No open positions" />
          ) : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-[11px] text-tertiary border-b border-border">
                  <th className="text-left font-normal py-2.5 px-4">Market</th>
                  <th className="text-left font-normal py-2.5 px-3">Side</th>
                  <th className="text-right font-normal py-2.5 px-3">Size</th>
                  <th className="text-right font-normal py-2.5 px-3">Entry</th>
                  <th className="text-right font-normal py-2.5 px-3">Mark</th>
                  <th className="text-right font-normal py-2.5 px-3">PnL</th>
                  <th className="text-right font-normal py-2.5 px-3">Liq.</th>
                  <th className="text-right font-normal py-2.5 px-4 w-16" />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <PositionRow
                    key={`${p.marketSymbol}-${p.sideUi}`}
                    position={p}
                    closing={
                      closingKey ===
                      `${p.marketSymbol}-${p.sideUi.toUpperCase() === "LONG" ? "LONG" : "SHORT"}`
                    }
                    onClose={() => handleCloseOne(p)}
                    disabled={tradeBusy}
                  />
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-14">
            <span className="text-[13px] text-secondary">
              Connect wallet to view {activeTab.toLowerCase()}
            </span>
            <button
              type="button"
              onClick={() => setVisible(true)}
              className="h-9 px-5 rounded-xl bg-gold/10 border border-gold/40 text-gold text-sm font-semibold hover:bg-gold/15 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      {successToast && (
        <ShortToast
          message={successToast}
          onDismiss={() => setSuccessToast(null)}
        />
      )}
    </div>
  );
}

function PositionRow({
  position: p,
  closing,
  onClose,
  disabled,
}: {
  position: PositionMetrics;
  closing: boolean;
  onClose: () => void;
  disabled: boolean;
}) {
  const { markUsd } = useFlashPrice(p.marketSymbol);
  const pnl = num(p.pnlWithFeeUsdUi);
  const pnlPositive = pnl !== null && pnl >= 0;
  const side = p.sideUi.toUpperCase();
  const isLong = side === "LONG";

  return (
    <tr className="text-[13px] border-b border-border-subtle hover:bg-elevated/30">
      <td className="py-2.5 px-4 font-medium">{p.marketSymbol}</td>
      <td className="py-2.5 px-3">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
            isLong ? "text-green bg-green/10" : "text-red bg-red/10"
          }`}
        >
          {side}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
        {fmtUsd(p.sizeUsdUi)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
        ${fmtPrice(num(p.entryPriceUi))}
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
        {markUsd !== null ? `$${fmtPrice(markUsd)}` : "—"}
      </td>
      <td
        className={`py-2.5 px-3 text-right font-mono tabular-nums ${
          pnlPositive ? "text-green" : "text-red"
        }`}
      >
        {fmtPnlUsd(p.pnlWithFeeUsdUi)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-tertiary">
        ${fmtPrice(num(p.liquidationPriceUi))}
      </td>
      <td className="py-2.5 px-4 text-right">
        <button
          type="button"
          onClick={onClose}
          disabled={disabled}
          aria-label={`Close ${p.marketSymbol} ${side}`}
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-secondary hover:text-red hover:bg-red/10 disabled:opacity-40 transition-colors"
        >
          {closing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
        </button>
      </td>
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-14 text-[13px] text-tertiary">
      {message}
    </div>
  );
}
