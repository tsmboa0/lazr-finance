"use client";

import { useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { getPoolForSymbol } from "../../lib/devnet-config";
import { subscribeAutopilotTicks } from "../../lib/prop-amm/autopilot-events";
import { usePropAmmAutopilot } from "../hooks/usePropAmmAutopilot";

export function AutopilotEventProvider({
  assetSymbol,
  children,
}: {
  assetSymbol: string;
  children: React.ReactNode;
}) {
  const { publicKey } = useWallet();
  const autopilot = usePropAmmAutopilot(assetSymbol);

  useEffect(() => {
    if (!publicKey || !autopilot.isActive) return;

    const pool = getPoolForSymbol(assetSymbol);
    return subscribeAutopilotTicks({
      wallet: publicKey.toBase58(),
      assetSymbol,
      poolPk: new PublicKey(pool.pool),
      onActivity: autopilot.refresh,
    });
  }, [assetSymbol, autopilot.isActive, autopilot.refresh, publicKey]);

  return children;
}
