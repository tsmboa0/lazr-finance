"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { isUserBankOnL1 } from "../../lib/prop-amm/delegation";
import { userBankPda } from "../../lib/prop-amm/pdas";
import { executeRedelegateUserBank } from "../../lib/prop-amm/redelegate";
import { useAnchorWallet } from "../hooks/useBankBalances";
import {
  UserBankDelegationContext,
  type UserBankDelegationContextValue,
} from "./user-bank-delegation-context";

export default function UserBankDelegationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [needsRedelegate, setNeedsRedelegate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [redelegateLoading, setRedelegateLoading] = useState(false);
  const [redelegateError, setRedelegateError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setNeedsRedelegate(false);
      return;
    }

    setChecking(true);
    try {
      const userBank = userBankPda(publicKey);
      setNeedsRedelegate(await isUserBankOnL1(connection, userBank));
    } finally {
      setChecking(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearRedelegateError = useCallback(() => {
    setRedelegateError(null);
  }, []);

  const redelegate = useCallback(async (): Promise<{ signature: string }> => {
    if (!publicKey || !anchorWallet || !signTransaction) {
      throw new Error("Connect your wallet first.");
    }

    setRedelegateLoading(true);
    setRedelegateError(null);
    try {
      const result = await executeRedelegateUserBank({
        user: publicKey,
        connection,
        wallet: anchorWallet,
        signTransaction,
      });
      await refresh();
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Re-delegate failed.";
      setRedelegateError(message);
      throw new Error(message);
    } finally {
      setRedelegateLoading(false);
    }
  }, [publicKey, anchorWallet, signTransaction, connection, refresh]);

  const value = useMemo<UserBankDelegationContextValue>(
    () => ({
      needsRedelegate,
      checking,
      redelegateLoading,
      redelegateError,
      redelegate,
      refresh,
      clearRedelegateError,
    }),
    [
      needsRedelegate,
      checking,
      redelegateLoading,
      redelegateError,
      redelegate,
      refresh,
      clearRedelegateError,
    ]
  );

  return (
    <UserBankDelegationContext.Provider value={value}>
      {children}
    </UserBankDelegationContext.Provider>
  );
}
