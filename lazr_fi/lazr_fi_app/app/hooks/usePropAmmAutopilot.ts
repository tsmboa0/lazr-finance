"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "./useBankBalances";
import type { StrategyId } from "../components/autopilot/strategies";
import {
  executeStartAutopilot,
  executeStopAutopilot,
  executeUpdateAutopilot,
  fetchAutopilotSnapshot,
} from "../../lib/prop-amm/autopilot";
import type { AutopilotStateView } from "../../lib/prop-amm/autopilot-decode";

export function usePropAmmAutopilot(assetSymbol: string) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const wallet = useAnchorWallet();
  const [state, setState] = useState<AutopilotStateView | null>(null);
  const [statusLabel, setStatusLabel] = useState("Not set up");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setState(null);
      setStatusLabel("Not set up");
      setIsActive(false);
      return;
    }
    setRefreshing(true);
    try {
      const snapshot = await fetchAutopilotSnapshot(
        connection,
        assetSymbol,
        publicKey
      );
      setState(snapshot.state);
      setStatusLabel(snapshot.statusLabel);
      setIsActive(snapshot.isActive);
    } catch {
      setState(null);
      setStatusLabel("Not set up");
      setIsActive(false);
    } finally {
      setRefreshing(false);
    }
  }, [assetSymbol, connection, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(
    async (strategy: StrategyId, capitalUsdc: number) => {
      if (!publicKey || !wallet || !signTransaction) {
        throw new Error("Connect your wallet to start Autopilot.");
      }
      setLoading(true);
      setError(null);
      try {
        const result = await executeStartAutopilot({
          assetSymbol,
          strategy,
          capitalUsdc,
          user: publicKey,
          connection,
          wallet,
          signTransaction,
        });
        await refresh();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start Autopilot.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      assetSymbol,
      connection,
      publicKey,
      refresh,
      signTransaction,
      wallet,
    ]
  );

  const stop = useCallback(async () => {
    if (!publicKey || !wallet || !signTransaction) {
      throw new Error("Connect your wallet to stop Autopilot.");
    }
    setLoading(true);
    setError(null);
    try {
      await executeStopAutopilot({
        assetSymbol,
        user: publicKey,
        connection,
        wallet,
        signTransaction,
      });
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to stop Autopilot.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [assetSymbol, connection, publicKey, refresh, signTransaction, wallet]);

  const update = useCallback(
    async (strategy: StrategyId, capitalUsdc: number) => {
      if (!publicKey || !wallet || !signTransaction) {
        throw new Error("Connect your wallet to update Autopilot.");
      }
      setLoading(true);
      setError(null);
      try {
        await executeUpdateAutopilot({
          assetSymbol,
          strategy,
          capitalUsdc,
          user: publicKey,
          connection,
          wallet,
          signTransaction,
        });
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update Autopilot.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      assetSymbol,
      connection,
      publicKey,
      refresh,
      signTransaction,
      wallet,
    ]
  );

  return {
    state,
    statusLabel,
    isActive,
    loading,
    refreshing,
    error,
    clearError,
    refresh,
    start,
    stop,
    update,
    connected,
  };
}
