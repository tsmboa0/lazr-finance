"use client";

import { ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePropAmmTxHistory } from "../../hooks/usePropAmmTxHistory";
import {
  formatTxAge,
  propAmmTxExplorerUrl,
} from "../../../lib/prop-amm/tx-history";

function directionClass(direction: string): string {
  if (direction === "buy" || direction === "deposit") return "text-green";
  if (direction === "sell" || direction === "withdraw") return "text-red";
  if (direction === "check") return "text-secondary";
  if (direction === "skip") return "text-tertiary";
  return "text-foreground";
}

function directionLabel(direction: string): string {
  if (direction === "buy") return "Buy";
  if (direction === "sell") return "Sell";
  if (direction === "deposit") return "Deposit";
  if (direction === "withdraw") return "Withdraw";
  if (direction === "check") return "Check";
  if (direction === "skip") return "Skipped";
  return direction;
}

function kindLabel(kind: string): string {
  if (kind === "swap") return "Swap";
  if (kind === "deposit") return "Deposit";
  if (kind === "withdraw") return "Withdraw";
  if (kind === "autopilot") return "Autopilot";
  return kind;
}

export default function PositionsPanel() {
  const { connected } = useWallet();
  const { txs } = usePropAmmTxHistory();

  return (
    <div
      className="flex flex-col h-full border-t border-border bg-background min-h-0"
      data-tour="propamm-positions"
    >
      <div className="flex items-center px-4 h-10 border-b border-border flex-shrink-0">
        <span className="text-[13px] font-medium text-foreground">
          Transactions
        </span>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {!connected ? (
          <div className="flex flex-col items-center justify-center h-full gap-1 py-12">
            <span className="text-[13px] text-secondary">
              Connect your wallet to view transaction history
            </span>
          </div>
        ) : txs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-1 py-12">
            <span className="text-[13px] text-secondary">
              No transactions yet — swap or deposit to get started
            </span>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="text-[11px] text-tertiary border-b border-border">
                <th className="text-left font-normal py-2 px-4">Age</th>
                <th className="text-left font-normal py-2 px-3">Type</th>
                <th className="text-left font-normal py-2 px-3">Pair</th>
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
                    {tx.pair}
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
                      href={propAmmTxExplorerUrl(tx.kind, tx.signature)}
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
        )}
      </div>
    </div>
  );
}
