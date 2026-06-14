"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Copy } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useOptionalFlashTrade } from "../../providers/flash-trade-context";
import { useCopyLeaders, useLeaderSnapshot } from "../../../lib/copy-trade/hooks";
import { DEFAULT_LEADER_SELECTION } from "../../../lib/copy-trade/leaders";
import {
  loadLeaderSelection,
  saveLeaderSelection,
} from "../../../lib/copy-trade/storage";
import type { LeaderSelection } from "../../../lib/copy-trade/types";
import { isValidLeaderAddress, truncateAddress } from "../../../lib/copy-trade/validate";
import { fmtPnlUsd, fmtUsd } from "../../../lib/flash-trade/format";
import LeaderPicker from "./LeaderPicker";
import LeaderPositionsPreview from "./LeaderPositionsPreview";

export default function PerpsAutopilotPanel({
  onRequestEnable,
}: {
  onRequestEnable?: () => void;
}) {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const flash = useOptionalFlashTrade();
  const followerAddress = publicKey?.toBase58() ?? null;

  const { leaders, loading: leadersLoading } = useCopyLeaders();
  const [selection, setSelection] = useState<LeaderSelection | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelection(loadLeaderSelection() ?? DEFAULT_LEADER_SELECTION);
    setHydrated(true);
  }, []);

  // If env adds curated leaders and nothing is saved, prefer the API's first entry.
  useEffect(() => {
    if (!hydrated || leadersLoading || leaders.length === 0) return;
    const saved = loadLeaderSelection();
    if (saved) return;
    setSelection({
      kind: "curated",
      leaderId: leaders[0]!.id,
      address: leaders[0]!.address,
    });
  }, [hydrated, leaders, leadersLoading]);

  const handleSelect = useCallback((next: LeaderSelection | null) => {
    setSelection(next);
    saveLeaderSelection(next);
  }, []);

  const leaderAddress = useMemo(() => {
    if (!selection) return null;
    const addr = selection.address.trim();
    return isValidLeaderAddress(addr) ? addr : null;
  }, [selection]);

  const { snapshot, stats, loading: leaderLoading, error: leaderError } =
    useLeaderSnapshot(leaderAddress);

  const isPerpsEnabled = flash?.isPerpsEnabled ?? false;
  const ownerLoaded = flash?.ownerLoaded ?? false;
  const needsEnable = connected && flash && ownerLoaded && !isPerpsEnabled;

  const selfCopy =
    followerAddress && leaderAddress && followerAddress === leaderAddress;

  const hasValidLeader = Boolean(leaderAddress);
  const canStartCopying =
    connected && isPerpsEnabled && hasValidLeader && !selfCopy;

  if (!hydrated) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 via-background to-background p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 border border-gold/25">
            <Copy className="w-5 h-5 text-gold" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Copy Trade</h3>
            <p className="text-xs text-tertiary mt-0.5 leading-relaxed">
              Browse traders and preview their live Flash perps positions. Enable
              perps when you&apos;re ready to mirror their moves automatically.
            </p>
          </div>
        </div>
      </div>

      <LeaderPicker
        selected={selection}
        onSelect={handleSelect}
        followerAddress={followerAddress}
        previewMode
      />

      {hasValidLeader && (
        <div className="rounded-xl border border-border-subtle bg-elevated/20 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">
              Leader preview
            </span>
            <span className="text-[11px] text-tertiary font-mono truncate">
              {truncateAddress(leaderAddress!)}
            </span>
          </div>
          {stats.openCount > 0 ? (
            <div className="grid grid-cols-2 divide-x divide-border-subtle border-b border-border-subtle">
              <PreviewStat
                label="Open notional"
                value={fmtUsd(stats.totalNotionalUsd)}
              />
              <PreviewStat
                label="Unrealized PnL"
                value={fmtPnlUsd(stats.unrealizedPnlUsd)}
                valueClassName={
                  stats.unrealizedPnlUsd >= 0 ? "text-green" : "text-red"
                }
              />
            </div>
          ) : (
            !leaderLoading &&
            !leaderError && (
              <div className="grid grid-cols-2 divide-x divide-border-subtle border-b border-border-subtle">
                <PreviewStat label="Open positions" value="0" />
                <PreviewStat label="Notional" value="$0.00" />
              </div>
            )
          )}
          <div className="px-3 py-2">
            <LeaderPositionsPreview
              snapshot={snapshot}
              loading={leaderLoading}
              error={leaderError}
            />
          </div>
        </div>
      )}

      {selfCopy && connected && (
        <p className="text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
          This is your wallet — you can preview it, but you can&apos;t copy
          yourself. Pick a different trader to start mirroring.
        </p>
      )}

      {!connected ? (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          Connect to start copying
        </button>
      ) : needsEnable ? (
        <button
          type="button"
          onClick={onRequestEnable}
          className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          Enable Perps to start copying
        </button>
      ) : (
        <button
          type="button"
          disabled={!canStartCopying}
          className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          {selfCopy
            ? "Choose a different trader"
            : !hasValidLeader
              ? "Select a trader"
              : "Start copying"}
        </button>
      )}
    </div>
  );
}

function PreviewStat({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <span className="text-[10px] text-tertiary uppercase tracking-wide">
        {label}
      </span>
      <p
        className={`mt-1 text-sm font-bold font-mono tabular-nums ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}
