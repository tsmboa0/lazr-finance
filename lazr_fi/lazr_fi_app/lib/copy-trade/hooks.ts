"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeOwner, type BasketSnapshot } from "flash-v2";
import { flash } from "../flash-trade/client";
import { summarizeLeaderStats } from "./leader-stats";
import type { CopyLeader, LeaderStats } from "./types";
import { isValidLeaderAddress } from "./validate";

export function useCopyLeaders(): {
  leaders: CopyLeader[];
  loading: boolean;
  error: string | null;
} {
  const [leaders, setLeaders] = useState<CopyLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setError(null);

    fetch("/api/copy-leaders")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load traders");
        return res.json() as Promise<{ leaders?: CopyLeader[] }>;
      })
      .then((body) => {
        if (dead) return;
        setLeaders(Array.isArray(body.leaders) ? body.leaders : []);
      })
      .catch((e: unknown) => {
        if (!dead) {
          setLeaders([]);
          setError(e instanceof Error ? e.message : "Could not load traders");
        }
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });

    return () => {
      dead = true;
    };
  }, []);

  return { leaders, loading, error };
}

export function useLeaderSnapshot(leaderAddress: string | null): {
  snapshot: BasketSnapshot | null;
  stats: LeaderStats;
  loading: boolean;
  error: string | null;
} {
  const [snapshot, setSnapshot] = useState<BasketSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = leaderAddress ? isValidLeaderAddress(leaderAddress) : false;

  useEffect(() => {
    if (!valid || !leaderAddress) {
      setSnapshot(null);
      setLoading(false);
      setError(null);
      return;
    }

    let dead = false;
    setLoading(true);
    setError(null);
    setSnapshot(null);

    flash
      .owner(leaderAddress)
      .then((snap) => {
        if (!dead) {
          setSnapshot(snap);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!dead) {
          setError("Could not load trader data");
          setLoading(false);
        }
      });

    const stream = subscribeOwner({
      owner: leaderAddress,
      network: flash.network,
      onUpdate: (snap) => {
        if (!dead) setSnapshot(snap);
      },
    });

    return () => {
      dead = true;
      stream.close();
    };
  }, [leaderAddress, valid]);

  const stats = useMemo(() => summarizeLeaderStats(snapshot), [snapshot]);

  return { snapshot, stats, loading, error };
}
