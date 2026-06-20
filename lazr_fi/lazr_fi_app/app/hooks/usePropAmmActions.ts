"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { executeDeposit } from "../../lib/prop-amm/deposit";
import { executeWithdraw } from "../../lib/prop-amm/withdraw";
import { executeSwap } from "../../lib/prop-amm/swap";
import { isUserBankNeedsRedelegateError } from "../../lib/prop-amm/errors";
import { useAnchorWallet } from "./useBankBalances";

function parseError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Transaction failed.";
}

export function usePropAmmActions() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (symbol: string, amount: number) => {
      if (!publicKey || !anchorWallet || !signTransaction) {
        throw new Error("Connect your wallet first.");
      }

      setLoading(true);
      setError(null);
      try {
        const result = await executeDeposit({
          symbol,
          amount,
          user: publicKey,
          connection,
          wallet: anchorWallet,
          signTransaction,
        });
        return result;
      } catch (err) {
        if (isUserBankNeedsRedelegateError(err)) {
          throw err;
        }
        const message = parseError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, anchorWallet, signTransaction, connection]
  );

  const withdraw = useCallback(
    async (symbol: string, amount: number) => {
      if (!publicKey || !anchorWallet || !signTransaction) {
        throw new Error("Connect your wallet first.");
      }

      setLoading(true);
      setError(null);
      try {
        const result = await executeWithdraw({
          symbol,
          amount,
          user: publicKey,
          connection,
          wallet: anchorWallet,
          signTransaction,
        });
        return result;
      } catch (err) {
        if (isUserBankNeedsRedelegateError(err)) {
          throw err;
        }
        const message = parseError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, anchorWallet, signTransaction, connection]
  );

  const swap = useCallback(
    async (params: {
      assetSymbol: string;
      sellSymbol: string;
      amountIn: number;
      minAmountOut: number;
    }) => {
      if (!publicKey || !anchorWallet || !signTransaction) {
        throw new Error("Connect your wallet first.");
      }

      setLoading(true);
      setError(null);
      try {
        const result = await executeSwap({
          ...params,
          user: publicKey,
          connection,
          wallet: anchorWallet,
          signTransaction,
        });
        return result;
      } catch (err) {
        const message = parseError(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, anchorWallet, signTransaction, connection]
  );

  const clearError = useCallback(() => setError(null), []);

  return { deposit, withdraw, swap, loading, error, clearError };
}
