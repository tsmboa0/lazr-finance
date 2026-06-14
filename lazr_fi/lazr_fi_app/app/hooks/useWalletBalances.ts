"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "../../lib/solana-tokens";
import { getTradeTokens } from "../../lib/devnet-config";

const LAMPORTS_PER_SOL = 1_000_000_000;

interface BalanceState {
  sol: number;
  byMint: Record<string, number>;
  loading: boolean;
}

const EMPTY: BalanceState = { sol: 0, byMint: {}, loading: false };

const tradeTokens = getTradeTokens();
const mintByTicker = Object.fromEntries(
  tradeTokens.map((t) => [t.ticker.toUpperCase(), t.mint])
);

function balanceForTicker(ticker: string, balances: BalanceState): number | null {
  if (ticker.toUpperCase() === "USDC") {
    return balances.byMint[mintByTicker.USDC] ?? 0;
  }
  if (ticker.toUpperCase() === "SOL") {
    return balances.sol;
  }
  const mint = mintByTicker[ticker.toUpperCase()];
  if (mint) {
    return balances.byMint[mint] ?? 0;
  }
  return 0;
}

export function useWalletBalances() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balances, setBalances] = useState<BalanceState>(EMPTY);

  const refresh = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalances(EMPTY);
      return;
    }

    setBalances((prev) => ({ ...prev, loading: true }));

    try {
      const lamports = await connection.getBalance(publicKey);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey(TOKEN_PROGRAM_ID) }
      );

      const byMint: Record<string, number> = {};
      for (const { account } of tokenAccounts.value) {
        const parsed = account.data.parsed;
        if (parsed?.type !== "account") continue;
        const mint = parsed.info.mint as string;
        const uiAmount = parsed.info.tokenAmount.uiAmount;
        if (typeof uiAmount === "number") {
          byMint[mint] = uiAmount;
        }
      }

      setBalances({
        sol: lamports / LAMPORTS_PER_SOL,
        byMint,
        loading: false,
      });
    } catch {
      setBalances((prev) => ({ ...prev, loading: false }));
    }
  }, [connection, publicKey, connected]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!publicKey || !connected) return;

    const intervalId = window.setInterval(refresh, 15000);
    return () => window.clearInterval(intervalId);
  }, [publicKey, connected, refresh]);

  const getBalance = useCallback(
    (ticker: string, _token?: { ticker: string; splMint?: string }) => {
      if (!connected) return null;
      return balanceForTicker(ticker, balances);
    },
    [connected, balances]
  );

  return { balances, getBalance, refresh, loading: balances.loading };
}
