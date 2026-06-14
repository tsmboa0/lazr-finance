"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { fmtPnlUsd, fmtUsd } from "../../../lib/flash-trade/format";
import { flash } from "../../../lib/flash-trade/client";
import { summarizeLeaderStats } from "../../../lib/copy-trade/leader-stats";
import { useCopyLeaders } from "../../../lib/copy-trade/hooks";
import type { CopyLeader, LeaderSelection, LeaderStats } from "../../../lib/copy-trade/types";
import { isValidLeaderAddress, truncateAddress } from "../../../lib/copy-trade/validate";

function LeaderStatsLine({
  stats,
  loading,
}: {
  stats: LeaderStats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="text-[11px] text-tertiary flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading…
      </span>
    );
  }
  if (!stats) {
    return <span className="text-[11px] text-tertiary">No live data</span>;
  }
  if (stats.openCount === 0) {
    return <span className="text-[11px] text-tertiary">No open positions</span>;
  }
  const pnlClass =
    stats.unrealizedPnlUsd >= 0 ? "text-green" : "text-red";
  return (
    <span className="text-[11px] text-tertiary font-mono tabular-nums">
      {stats.openCount} open · {fmtUsd(stats.totalNotionalUsd)} notional ·{" "}
      <span className={pnlClass}>{fmtPnlUsd(stats.unrealizedPnlUsd)}</span>
    </span>
  );
}

function LeaderCard({
  leader,
  selected,
  stats,
  statsLoading,
  onSelect,
}: {
  leader: CopyLeader;
  selected: boolean;
  stats: LeaderStats | null;
  statsLoading: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
        selected
          ? "border-gold/50 bg-gold/10"
          : "border-border bg-input hover:border-border-subtle hover:bg-elevated/30"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
            selected ? "border-gold/30 bg-gold/15" : "border-border bg-elevated/60"
          }`}
        >
          <UserRound
            className={`w-4 h-4 ${selected ? "text-gold" : "text-secondary"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {leader.displayName}
            </span>
            {leader.verified && (
              <ShieldCheck className="w-3.5 h-3.5 text-gold flex-shrink-0" />
            )}
            {selected && (
              <Check className="w-3.5 h-3.5 text-gold flex-shrink-0 ml-auto" />
            )}
          </div>
          <p className="text-[11px] text-tertiary font-mono mt-0.5">
            {truncateAddress(leader.address)}
          </p>
          {leader.description && (
            <p className="text-[11px] text-secondary mt-1 leading-relaxed line-clamp-2">
              {leader.description}
            </p>
          )}
          <div className="mt-1.5">
            <LeaderStatsLine stats={stats} loading={statsLoading} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function LeaderPicker({
  selected,
  onSelect,
  followerAddress,
  previewMode = false,
}: {
  selected: LeaderSelection | null;
  onSelect: (selection: LeaderSelection | null) => void;
  followerAddress?: string | null;
  /** When true, any leader can be selected for preview (including your own wallet). */
  previewMode?: boolean;
}) {
  const { leaders, loading: listLoading, error: listError } = useCopyLeaders();
  const [customAddress, setCustomAddress] = useState("");
  const [statsByAddress, setStatsByAddress] = useState<
    Record<string, LeaderStats>
  >({});
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    if (selected?.kind === "custom") {
      setCustomAddress(selected.address);
    }
  }, [selected?.kind, selected?.address]);

  useEffect(() => {
    if (leaders.length === 0) return;
    let dead = false;

    for (const leader of leaders) {
      setStatsLoading((prev) => ({ ...prev, [leader.address]: true }));
      flash
        .owner(leader.address)
        .then((snap) => {
          if (dead) return;
          setStatsByAddress((prev) => ({
            ...prev,
            [leader.address]: summarizeLeaderStats(snap),
          }));
        })
        .catch(() => {
          if (dead) return;
        })
        .finally(() => {
          if (dead) return;
          setStatsLoading((prev) => ({ ...prev, [leader.address]: false }));
        });
    }

    return () => {
      dead = true;
    };
  }, [leaders]);

  const selectedAddress =
    selected?.kind === "curated"
      ? selected.address
      : selected?.kind === "custom"
        ? selected.address
        : null;

  const customSelected =
    selected?.kind === "custom" && selected.address === customAddress.trim();

  const selfCopy =
    !previewMode &&
    followerAddress &&
    selectedAddress &&
    followerAddress === selectedAddress;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-secondary">Choose a trader to copy</span>
        {!listLoading && leaders.length > 0 && (
          <span className="text-[11px] text-tertiary">{leaders.length} listed</span>
        )}
      </div>

      {listLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-tertiary">
          <Loader2 className="w-4 h-4 animate-spin text-gold" />
          Loading traders…
        </div>
      ) : listError ? (
        <p className="text-xs text-tertiary bg-elevated/30 border border-border rounded-xl px-3 py-2">
          {listError}. You can still paste a wallet below.
        </p>
      ) : leaders.length === 0 ? (
        <p className="text-xs text-tertiary bg-elevated/30 border border-border rounded-xl px-3 py-2 leading-relaxed">
          No curated traders configured yet. Paste a Flash V2 wallet address below,
          or ask your admin to set{" "}
          <span className="font-mono text-secondary">COPY_LEADERS_JSON</span>.
        </p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-0.5">
          {leaders.map((leader) => {
            const isSelected =
              selected?.kind === "curated" && selected.leaderId === leader.id;
            const isSelf =
              !previewMode &&
              followerAddress &&
              followerAddress === leader.address;
            return (
              <div key={leader.id} className={isSelf ? "opacity-50" : undefined}>
                <LeaderCard
                  leader={leader}
                  selected={isSelected}
                  stats={statsByAddress[leader.address] ?? null}
                  statsLoading={statsLoading[leader.address] ?? false}
                  onSelect={() => {
                    if (isSelf) return;
                    setCustomAddress("");
                    onSelect({
                      kind: "curated",
                      leaderId: leader.id,
                      address: leader.address,
                    });
                  }}
                />
                {isSelf && (
                  <p className="text-[10px] text-red mt-1 px-1">
                    You cannot copy your own wallet
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`rounded-xl border p-3 ${
          customSelected ? "border-gold/50 bg-gold/10" : "border-border bg-input"
        }`}
      >
        <label
          htmlFor="custom-leader-address"
          className="text-xs font-medium text-secondary block mb-2"
        >
          Or paste a wallet address
        </label>
        <input
          id="custom-leader-address"
          type="text"
          value={customAddress}
          onChange={(e) => {
            setCustomAddress(e.target.value);
            const value = e.target.value.trim();
            if (!value) {
              if (selected?.kind === "custom") onSelect(null);
              return;
            }
            if (isValidLeaderAddress(value)) {
              onSelect({ kind: "custom", address: value });
            } else if (selected?.kind === "curated") {
              onSelect(null);
            }
          }}
          placeholder="Solana wallet pubkey"
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-transparent outline-none text-sm font-mono text-foreground placeholder:text-tertiary"
        />
        {customAddress.trim() && customSelected && (
          <p className="text-[11px] text-gold mt-2">Custom trader selected</p>
        )}
      </div>

      {selfCopy && (
        <p className="text-xs text-red bg-red/10 border border-red/20 rounded-xl px-3 py-2">
          You cannot copy your own wallet. Choose a different trader.
        </p>
      )}
    </div>
  );
}
