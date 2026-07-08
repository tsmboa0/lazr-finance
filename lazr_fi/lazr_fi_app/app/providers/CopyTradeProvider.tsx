"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flash } from "../../lib/flash-trade/client";
import {
  loadCopyTradeConfig,
  notifyCopyTradeStateChanged,
  saveCopyTradeConfig,
} from "../../lib/copy-trade/config-storage";
import {
  followerCollateralUsd,
  startCopyTradeEngine,
  type MirrorLogEntry,
} from "../../lib/copy-trade/engine";
import { useOptionalFlashTrade } from "./flash-trade-context";
import { CopyTradeContext } from "./copy-trade-context";

export function CopyTradeProvider({ children }: { children: ReactNode }) {
  const flashCtx = useOptionalFlashTrade();
  const owner = flashCtx?.owner ?? null;
  const activeSigner = flashCtx?.activeSigner ?? null;
  const marginBalanceUsd = flashCtx?.marginBalanceUsd ?? 0;
  const followerSnapshot = flashCtx?.snapshot ?? null;
  const needsSessionRefresh = flashCtx?.needsSessionRefresh ?? false;
  const isPerpsEnabled = flashCtx?.isPerpsEnabled ?? false;

  const engineRef = useRef<ReturnType<typeof startCopyTradeEngine> | null>(null);
  const marginRef = useRef(marginBalanceUsd);
  const snapshotRef = useRef(followerSnapshot);
  const resumedRef = useRef(false);
  const [isCopying, setIsCopying] = useState(false);
  const [leaderAddress, setLeaderAddress] = useState<string | null>(null);
  const [maxFollowUsd, setMaxFollowUsdState] = useState(100);
  const [lastMirror, setLastMirror] = useState<MirrorLogEntry | null>(null);
  const [mirrorError, setMirrorError] = useState<string | null>(null);

  useEffect(() => {
    marginRef.current = marginBalanceUsd;
  }, [marginBalanceUsd]);

  useEffect(() => {
    snapshotRef.current = followerSnapshot;
  }, [followerSnapshot]);

  useEffect(() => {
    if (!owner) {
      resumedRef.current = false;
      engineRef.current?.stop();
      engineRef.current = null;
      setIsCopying(false);
      setLeaderAddress(null);
      return;
    }
    const cfg = loadCopyTradeConfig(owner);
    if (cfg?.enabled && cfg.leaderAddress) {
      setLeaderAddress(cfg.leaderAddress);
      setMaxFollowUsdState(cfg.maxFollowUsd);
    } else {
      setIsCopying(false);
      setLeaderAddress(cfg?.leaderAddress ?? null);
      if (cfg?.maxFollowUsd) setMaxFollowUsdState(cfg.maxFollowUsd);
    }
  }, [owner]);

  const stopEngine = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setIsCopying(false);
    if (owner) {
      const cfg = loadCopyTradeConfig(owner);
      saveCopyTradeConfig(
        owner,
        cfg
          ? { ...cfg, enabled: false }
          : leaderAddress
            ? {
                enabled: false,
                leaderAddress,
                maxFollowUsd: maxFollowUsd,
              }
            : null
      );
      notifyCopyTradeStateChanged();
    }
  }, [owner, leaderAddress, maxFollowUsd]);

  const startEngine = useCallback(
    async (leader: string): Promise<{ ok: boolean; error?: string }> => {
      if (!owner || !activeSigner) {
        return {
          ok: false,
          error: needsSessionRefresh
            ? "Refresh your session key before copying."
            : "Enable perps and connect wallet first.",
        };
      }
      if (!isPerpsEnabled) {
        return { ok: false, error: "Enable perps before copying." };
      }
      if (owner === leader) {
        return { ok: false, error: "You cannot copy your own wallet." };
      }

      stopEngine();
      setMirrorError(null);
      setLeaderAddress(leader);

      try {
        const leaderSnap = await flash.owner(leader);
        const engine = startCopyTradeEngine({
          leaderAddress: leader,
          followerOwner: owner,
          maxFollowUsd,
          signer: activeSigner,
          followerCollateralUsd: () =>
            followerCollateralUsd(marginRef.current, snapshotRef.current),
          callbacks: {
            onLog: (entry) => {
              setLastMirror(entry);
              setMirrorError(null);
            },
            onError: (msg) => setMirrorError(msg),
          },
        });
        engine.seedSnapshot(leaderSnap);
        engineRef.current = engine;
        setIsCopying(true);

        saveCopyTradeConfig(owner, {
          enabled: true,
          leaderAddress: leader,
          maxFollowUsd,
        });
        notifyCopyTradeStateChanged();
        return { ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMirrorError(message);
        return { ok: false, error: message };
      }
    },
    [
      owner,
      activeSigner,
      needsSessionRefresh,
      isPerpsEnabled,
      maxFollowUsd,
      stopEngine,
    ]
  );

  useEffect(() => {
    if (!owner || resumedRef.current) return;
    const cfg = loadCopyTradeConfig(owner);
    if (!cfg?.enabled || !cfg.leaderAddress) return;
    if (engineRef.current) return;
    if (!activeSigner || !isPerpsEnabled) return;
    resumedRef.current = true;
    void startEngine(cfg.leaderAddress);
  }, [owner, activeSigner, isPerpsEnabled, startEngine]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  const setMaxFollowUsd = useCallback(
    (value: number) => {
      const next = Math.max(11, Math.min(10_000, value));
      setMaxFollowUsdState(next);
      if (owner) {
        const cfg = loadCopyTradeConfig(owner);
        saveCopyTradeConfig(owner, {
          enabled: cfg?.enabled ?? isCopying,
          leaderAddress: cfg?.leaderAddress ?? leaderAddress ?? "",
          maxFollowUsd: next,
        });
      }
    },
    [owner, isCopying, leaderAddress]
  );

  const startCopying = useCallback(
    (leader: string) => startEngine(leader),
    [startEngine]
  );

  const stopCopying = useCallback(() => {
    stopEngine();
  }, [stopEngine]);

  const value = useMemo(
    () => ({
      isCopying,
      maxFollowUsd,
      setMaxFollowUsd,
      leaderAddress,
      lastMirror,
      mirrorError,
      clearMirrorError: () => setMirrorError(null),
      startCopying,
      stopCopying,
    }),
    [
      isCopying,
      maxFollowUsd,
      setMaxFollowUsd,
      leaderAddress,
      lastMirror,
      mirrorError,
      startCopying,
      stopCopying,
    ]
  );

  return (
    <CopyTradeContext.Provider value={value}>
      {children}
    </CopyTradeContext.Provider>
  );
}
