"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getTradeTokens } from "../../lib/devnet-config";
import { fetchBankBalances } from "../../lib/prop-amm/bank";
import type { PropAmmWallet } from "../../lib/prop-amm/wallet";

export function useAnchorWallet(): PropAmmWallet | null {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  return useMemo(() => {
    if (!publicKey || !signTransaction) return null;
    return {
      publicKey,
      signTransaction,
      signAllTransactions:
        signAllTransactions ??
        (async (txs) => Promise.all(txs.map((tx) => signTransaction(tx)))),
    };
  }, [publicKey, signTransaction, signAllTransactions]);
}

export function useBankBalances() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { publicKey, connected } = useWallet();
  const [byMint, setByMint] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const tradeTokens = useMemo(() => getTradeTokens(), []);
  const mints = useMemo(
    () => tradeTokens.map((t) => new PublicKey(t.mint)),
    [tradeTokens]
  );

  const refresh = useCallback(async () => {
    if (!publicKey || !connected || !anchorWallet) {
      setByMint({});
      return;
    }

    setLoading(true);
    try {
      const balances = await fetchBankBalances(
        connection,
        anchorWallet,
        publicKey,
        mints
      );
      setByMint(balances);
    } catch {
      setByMint({});
    } finally {
      setLoading(false);
    }
  }, [connection, anchorWallet, publicKey, connected, mints]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getBankBalance = useCallback(
    (symbol: string): number | null => {
      if (!connected) return null;
      const token = tradeTokens.find(
        (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
      );
      if (!token) return 0;
      return byMint[token.mint] ?? 0;
    },
    [connected, tradeTokens, byMint]
  );

  return { getBankBalance, refresh, loading, byMint };
}
