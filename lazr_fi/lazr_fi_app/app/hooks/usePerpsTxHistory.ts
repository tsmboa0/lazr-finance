"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  listPerpsTxs,
  PERPS_TX_HISTORY_UPDATED_EVENT,
  type PerpsTxRecord,
} from "../../lib/flash-trade/tx-history";

export function usePerpsTxHistory() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [txs, setTxs] = useState<PerpsTxRecord[]>([]);

  const refresh = useCallback(() => {
    if (!wallet) {
      setTxs([]);
      return;
    }
    setTxs(listPerpsTxs(wallet));
  }, [wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener(PERPS_TX_HISTORY_UPDATED_EVENT, refresh);
    return () =>
      window.removeEventListener(PERPS_TX_HISTORY_UPDATED_EVENT, refresh);
  }, [refresh]);

  return { txs, refresh };
}
