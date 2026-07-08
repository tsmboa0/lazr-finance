"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Copy, Loader2, Square } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useOptionalCopyTrade } from "../../providers/copy-trade-context";
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
  const copy = useOptionalCopyTrade();
  const followerAddress = publicKey?.toBase58() ?? null;

  const { leaders, loading: leadersLoading } = useCopyLeaders();
  const [selection, setSelection] = useState<LeaderSelection | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setSelection(loadLeaderSelection() ?? DEFAULT_LEADER_SELECTION);
    setHydrated(true);
  }, []);

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
  const needsSessionRefresh = flash?.needsSessionRefresh ?? false;
  const marginBalanceUsd = flash?.marginBalanceUsd ?? 0;

  const selfCopy =
    followerAddress && leaderAddress && followerAddress === leaderAddress;

  const hasValidLeader = Boolean(leaderAddress);
  const isCopying = copy?.isCopying ?? false;
  const canStartCopying =
    connected &&
    isPerpsEnabled &&
    hasValidLeader &&
    !selfCopy &&
    !needsSessionRefresh &&
    Boolean(flash?.activeSigner);

  const handleStart = useCallback(async () => {
    if (!copy || !leaderAddress || !canStartCopying) return;
    copy.clearMirrorError();
    setStarting(true);
    try {
      await copy.startCopying(leaderAddress);
    } finally {
      setStarting(false);
    }
  }, [copy, leaderAddress, canStartCopying]);

  const handleStop = useCallback(() => {
    copy?.stopCopying();
  }, [copy]);

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
              Mirror a leader&apos;s Flash perps moves while this tab is open.
              New positions only — existing leader positions are not copied on
              start. Sized to your margin with a hard cap per trade.
            </p>
          </div>
        </div>
      </div>

      {isCopying && (
        <div className="rounded-xl border border-green/30 bg-green/5 px-3 py-2.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
          </span>
          <p className="text-xs text-green font-medium">
            Copying {truncateAddress(copy?.leaderAddress ?? leaderAddress ?? "")}
            — keep this tab open
          </p>
        </div>
      )}

      <LeaderPicker
        selected={selection}
        onSelect={handleSelect}
        followerAddress={followerAddress}
        previewMode
      />

      <div className="rounded-xl border border-border-subtle bg-elevated/20 px-3 py-3 flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">
          Max mirror size (USD notional per trade)
        </label>
        <input
          type="number"
          min={11}
          max={10000}
          step={10}
          value={copy?.maxFollowUsd ?? 100}
          disabled={isCopying}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) copy?.setMaxFollowUsd(n);
          }}
          className="h-10 rounded-xl bg-input border border-border px-3 text-sm font-mono text-foreground disabled:opacity-50"
        />
        <p className="text-[11px] text-tertiary">
          Your free margin: {fmtUsd(marginBalanceUsd)} — mirrors scale
          proportionally to the leader, capped here.
        </p>
      </div>

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

      {copy?.lastMirror && (
        <p className="text-xs text-secondary bg-elevated/30 border border-border-subtle rounded-xl px-3 py-2">
          Last mirror: {copy.lastMirror.kind} {copy.lastMirror.side}{" "}
          {copy.lastMirror.market} — {copy.lastMirror.detail}
        </p>
      )}

      {(copy?.mirrorError || needsSessionRefresh) && (
        <p className="text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
          {needsSessionRefresh
            ? "Refresh your session key before copying."
            : copy?.mirrorError}
        </p>
      )}

      {selfCopy && connected && (
        <p className="text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
          This is your wallet — pick a different trader to copy.
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
      ) : needsSessionRefresh ? (
        <button
          type="button"
          onClick={onRequestEnable}
          className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          Refresh session to copy
        </button>
      ) : isCopying ? (
        <button
          type="button"
          onClick={handleStop}
          className="h-12 rounded-2xl border border-red/40 bg-red/10 text-red text-base font-bold hover:bg-red/15 transition-colors flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4" />
          Stop copying
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStartCopying || starting}
          className="h-12 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {starting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
          {selfCopy
            ? "Choose a different trader"
            : !hasValidLeader
              ? "Select a trader"
              : marginBalanceUsd <= 0
                ? "Deposit margin to copy"
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
