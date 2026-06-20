"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  subscribeOwner,
  type BasketSnapshot,
  type TradeType,
} from "flash-v2";
import {
  executeClosePosition,
  executeOpenPosition,
  type OpenTradeParams,
} from "../../lib/flash-trade/trade";
import { allPositions } from "../../lib/flash-trade/hooks";
import { flash } from "../../lib/flash-trade/client";
import { fetchBasketBalance } from "../../lib/flash-trade/basket-balance";
import type { EnableState, EnableWalletCtx, LatencyEntry } from "../../lib/flash-trade/enable";
import type { FundsStep } from "../../lib/flash-trade/funds";
import {
  appendPerpsTx,
  appendPerpsTxFromLog,
} from "../../lib/flash-trade/tx-history";
import {
  loadSession,
  type LoadedSession,
} from "../../lib/flash-trade/session-store";
import type { SessionWallet } from "../../lib/flash-trade/session";
import type { ActiveSigner } from "../../lib/flash-trade/signer";
import { baseConnection } from "../../lib/flash-trade/client";
import { FlashTradeContext } from "./flash-trade-context";

export function FlashTradeProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey, signTransaction, signAllTransactions } =
    useWallet();

  const owner = connected && publicKey ? publicKey.toBase58() : null;

  const [snapshot, setSnapshot] = useState<BasketSnapshot | null>(null);
  const [ownerLoaded, setOwnerLoaded] = useState(false);
  const [streamStatus, setStreamStatus] =
    useState<import("./flash-trade-context").StreamStatus>("closed");
  const [usdcMint, setUsdcMint] = useState<string | null>(null);
  const [marginBalanceUsd, setMarginBalanceUsd] = useState(0);
  const [marginLoading, setMarginLoading] = useState(false);
  const [session, setSession] = useState<LoadedSession | null>(null);
  const [enableState, setEnableState] = useState<EnableState | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [fundsStep, setFundsStep] = useState<FundsStep | null>(null);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [walletSol, setWalletSol] = useState<number | null>(null);
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null);
  const [perpsWalletLoading, setPerpsWalletLoading] = useState(false);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const isPerpsEnabled = Boolean(snapshot?.basketPubkey);
  const needsSessionRefresh = Boolean(
    owner && ownerLoaded && isPerpsEnabled && !session
  );

  useEffect(() => {
    if (!owner) {
      setSession(null);
      return;
    }
    setSession(loadSession(owner));
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    let dead = false;
    flash
      .tokens()
      .then((tokens) => {
        if (dead) return;
        const usdc = tokens.find((t) => t.symbol.toUpperCase() === "USDC");
        setUsdcMint(usdc?.mintKey ?? null);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [owner]);

  useEffect(() => {
    setSnapshot(null);
    setOwnerLoaded(false);
    if (!owner) {
      setStreamStatus("closed");
      return;
    }
    setStreamStatus("connecting");
    let dead = false;

    flash
      .owner(owner)
      .then((snap) => {
        if (dead) return;
        setSnapshot((prev) => prev ?? snap);
        setOwnerLoaded(true);
      })
      .catch(() => {});

    const stream = subscribeOwner({
      owner,
      network: flash.network,
      onUpdate: (snap) => {
        if (dead) return;
        setSnapshot(snap);
        setOwnerLoaded(true);
      },
      onStatus: (s) => {
        if (!dead) setStreamStatus(s);
      },
    });

    return () => {
      dead = true;
      stream.close();
    };
  }, [owner]);

  const refreshMargin = useCallback(async () => {
    if (!owner || !usdcMint) {
      setMarginBalanceUsd(0);
      return;
    }
    setMarginLoading(true);
    try {
      const bal = await fetchBasketBalance({
        owner,
        basketPubkey: snapshot?.basketPubkey ?? null,
        usdcMint,
      });
      setMarginBalanceUsd(bal.inBasketUsd);
    } catch {
      // keep last value
    } finally {
      setMarginLoading(false);
    }
  }, [owner, usdcMint, snapshot?.basketPubkey]);

  useEffect(() => {
    void refreshMargin();
    if (!owner) return;
    const timer = setInterval(() => void refreshMargin(), 5000);
    return () => clearInterval(timer);
  }, [refreshMargin, owner]);

  const refreshOwner = useCallback(async () => {
    if (!owner) return;
    try {
      const snap = await flash.owner(owner);
      setSnapshot(snap);
      setOwnerLoaded(true);
    } catch {
      // non-fatal
    }
    await refreshMargin();
  }, [owner, refreshMargin]);

  const walletCtx = useMemo((): EnableWalletCtx | null => {
    if (!publicKey || !signTransaction) return null;
    return {
      publicKey,
      signTransaction,
      signAllTransactions,
    };
  }, [publicKey, signTransaction, signAllTransactions]);

  const anchorWallet = useMemo((): SessionWallet | null => {
    if (!publicKey || !signTransaction) return null;
    return {
      publicKey,
      signTransaction,
      ...(signAllTransactions ? { signAllTransactions } : {}),
    };
  }, [publicKey, signTransaction, signAllTransactions]);

  const [activeSigner, setActiveSigner] = useState<ActiveSigner | null>(null);

  useEffect(() => {
    if (!anchorWallet || !session) {
      setActiveSigner(null);
      return;
    }
    let cancelled = false;
    import("../../lib/flash-trade/signer").then((mod) => {
      if (!cancelled) {
        setActiveSigner(
          mod.makeSessionSigner(anchorWallet, session, flash.network)
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [anchorWallet, session]);

  const refreshWalletBalances = useCallback(async () => {
    if (!publicKey) {
      setWalletSol(null);
      setWalletUsdc(null);
      return;
    }
    setPerpsWalletLoading(true);
    try {
      const lamports = await baseConnection.getBalance(publicKey);
      setWalletSol(lamports / 1e9);
      if (usdcMint) {
        const res = await baseConnection.getParsedTokenAccountsByOwner(
          publicKey,
          { mint: new PublicKey(usdcMint) }
        );
        const total = res.value.reduce((sum, acc) => {
          const ui = acc.account.data.parsed?.info?.tokenAmount
            ?.uiAmount as number | null | undefined;
          return sum + (typeof ui === "number" ? ui : 0);
        }, 0);
        setWalletUsdc(total);
      }
    } catch {
      // keep last
    } finally {
      setPerpsWalletLoading(false);
    }
  }, [publicKey, usdcMint]);

  useEffect(() => {
    if (!owner) return;
    void refreshWalletBalances();
  }, [owner, refreshWalletBalances]);

  const logPerpsTx = useCallback(
    (entry: Omit<LatencyEntry, "id" | "at">) => {
      if (!owner) return;
      appendPerpsTxFromLog(owner, entry);
    },
    [owner]
  );

  const runEnable = useCallback(async (): Promise<boolean> => {
    if (!walletCtx || !anchorWallet || !owner) {
      return false;
    }
    setEnabling(true);
    setEnableState(null);
    await refreshWalletBalances();
    try {
      const { enableOneClickTrading } = await import(
        "../../lib/flash-trade/enable"
      );
      const result = await enableOneClickTrading({
        wallet: walletCtx,
        anchorWallet,
        snapshot,
        usdcMint,
        balances: { sol: walletSol, usdc: walletUsdc },
        onStep: setEnableState,
        onLog: logPerpsTx,
      });
      if (result.session) setSession(result.session);
      await refreshOwner();
      return result.ok;
    } finally {
      setEnabling(false);
    }
  }, [
    walletCtx,
    anchorWallet,
    owner,
    snapshot,
    usdcMint,
    walletSol,
    walletUsdc,
    refreshOwner,
    refreshWalletBalances,
    logPerpsTx,
  ]);

  const depositMargin = useCallback(
    async (amount: string) => {
      if (!walletCtx || !usdcMint) {
        return { ok: false, error: "Perps not ready. Connect wallet on mainnet." };
      }
      setFundsLoading(true);
      setFundsStep(null);
      try {
        const { depositUsdc } = await import("../../lib/flash-trade/funds");
        const result = await depositUsdc({
          wallet: walletCtx,
          usdcMint,
          amount,
          onStep: setFundsStep,
          onLog: logPerpsTx,
        });
        if (result.ok) await refreshOwner();
        return result;
      } finally {
        setFundsLoading(false);
      }
    },
    [walletCtx, usdcMint, refreshOwner, logPerpsTx]
  );

  const withdrawMargin = useCallback(
    async (amount: string) => {
      if (!walletCtx || !usdcMint) {
        return { ok: false, error: "Perps not ready. Connect wallet on mainnet." };
      }
      setFundsLoading(true);
      setFundsStep(null);
      try {
        const { withdrawUsdc } = await import("../../lib/flash-trade/funds");
        const result = await withdrawUsdc({
          wallet: walletCtx,
          usdcMint,
          amount,
          onStep: setFundsStep,
          onLog: logPerpsTx,
        });
        if (result.ok) await refreshOwner();
        return result;
      } finally {
        setFundsLoading(false);
      }
    },
    [walletCtx, usdcMint, refreshOwner, logPerpsTx]
  );

  const openPosition = useCallback(
    async (params: OpenTradeParams) => {
      if (!activeSigner) {
        return {
          ok: false,
          error: needsSessionRefresh
            ? "Refresh your session key to trade — tap the banner above."
            : "Perps not ready — enable and connect wallet.",
        };
      }
      setTradeBusy(true);
      setTradeError(null);
      try {
        const result = await executeOpenPosition(activeSigner, params);
        if (result.ok && result.signature && owner) {
          appendPerpsTx(owner, {
            kind: "open",
            chain: "er",
            signature: result.signature,
            market: params.marketSymbol,
            direction: params.side === "LONG" ? "long" : "short",
            amountLabel: `$${params.collateralUsd} @ ${params.leverage.toFixed(1)}×`,
            action:
              params.orderType === "LIMIT"
                ? `limit ${params.side.toLowerCase()}`
                : `market ${params.side.toLowerCase()}`,
          });
          await refreshOwner();
        } else if (result.error) {
          setTradeError(result.error);
        }
        return result;
      } finally {
        setTradeBusy(false);
      }
    },
    [activeSigner, needsSessionRefresh, owner, refreshOwner]
  );

  const closePosition = useCallback(
    async (params: {
      marketSymbol: string;
      side: TradeType;
      inputUsdUi?: string;
    }) => {
      if (!activeSigner) {
        return {
          ok: false,
          error: needsSessionRefresh
            ? "Refresh your session key to close positions — tap the banner above."
            : "Perps not ready — enable and connect wallet.",
        };
      }
      setTradeBusy(true);
      setTradeError(null);
      try {
        const result = await executeClosePosition(activeSigner, params);
        if (result.ok && result.signature && owner) {
          appendPerpsTx(owner, {
            kind: "close",
            chain: "er",
            signature: result.signature,
            market: params.marketSymbol,
            direction: params.side === "LONG" ? "long" : "short",
            amountLabel: params.inputUsdUi && params.inputUsdUi !== "0"
              ? `$${params.inputUsdUi}`
              : "Full close",
            action: `close ${params.side.toLowerCase()}`,
          });
          await refreshOwner();
        } else if (result.error) {
          setTradeError(result.error);
        }
        return result;
      } finally {
        setTradeBusy(false);
      }
    },
    [activeSigner, needsSessionRefresh, owner, refreshOwner]
  );

  const closeAllPositions = useCallback(async () => {
    const positions = allPositions(snapshot);
    if (positions.length === 0) return { ok: true };
    if (!activeSigner) {
      return {
        ok: false,
        error: needsSessionRefresh
          ? "Refresh your session key to close positions."
          : "Perps not ready.",
      };
    }
    setTradeBusy(true);
    setTradeError(null);
    try {
      for (const p of positions) {
        const side = p.sideUi.toUpperCase() === "LONG" ? "LONG" : "SHORT";
        const result = await executeClosePosition(activeSigner, {
          marketSymbol: p.marketSymbol,
          side: side as TradeType,
        });
        if (!result.ok) {
          setTradeError(result.error ?? "Close failed");
          return result;
        }
        if (result.signature && owner) {
          appendPerpsTx(owner, {
            kind: "close",
            chain: "er",
            signature: result.signature,
            market: p.marketSymbol,
            direction: side === "LONG" ? "long" : "short",
            amountLabel: "Full close",
            action: `close ${side.toLowerCase()}`,
          });
        }
      }
      await refreshOwner();
      return { ok: true };
    } finally {
      setTradeBusy(false);
    }
  }, [snapshot, activeSigner, needsSessionRefresh, owner, refreshOwner]);

  const value = useMemo(
    (): import("./flash-trade-context").FlashTradeContextValue => ({
      connected,
      owner,
      isPerpsEnabled,
      needsSessionRefresh,
      ownerLoaded,
      streamStatus,
      snapshot,
      session,
      activeSigner,
      usdcMint,
      marginBalanceUsd,
      marginLoading,
      perpsWalletUsdc: walletUsdc,
      perpsWalletLoading,
      refreshPerpsWallet: refreshWalletBalances,
      enableState,
      enabling,
      fundsStep,
      fundsLoading,
      tradeBusy,
      tradeError,
      refreshMargin,
      refreshOwner,
      runEnable,
      depositMargin,
      withdrawMargin,
      openPosition,
      closePosition,
      closeAllPositions,
      clearEnableState: () => setEnableState(null),
      clearFundsStep: () => setFundsStep(null),
      clearTradeError: () => setTradeError(null),
    }),
    [
      connected,
      owner,
      isPerpsEnabled,
      needsSessionRefresh,
      ownerLoaded,
      streamStatus,
      snapshot,
      session,
      activeSigner,
      usdcMint,
      marginBalanceUsd,
      marginLoading,
      walletUsdc,
      perpsWalletLoading,
      refreshWalletBalances,
      enableState,
      enabling,
      fundsStep,
      fundsLoading,
      tradeBusy,
      tradeError,
      refreshMargin,
      refreshOwner,
      runEnable,
      depositMargin,
      withdrawMargin,
      openPosition,
      closePosition,
      closeAllPositions,
    ]
  );

  return (
    <FlashTradeContext.Provider value={value}>
      {children}
    </FlashTradeContext.Provider>
  );
}
