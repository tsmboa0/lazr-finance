"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  listPropAmmTxs,
  TX_HISTORY_UPDATED_EVENT,
  type PropAmmTxRecord,
} from "../../lib/prop-amm/tx-history";

export function usePropAmmTxHistory() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [txs, setTxs] = useState<PropAmmTxRecord[]>([]);

  const refresh = useCallback(() => {
    if (!wallet) {
      setTxs([]);
      return;
    }
    setTxs(listPropAmmTxs(wallet));
  }, [wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener(TX_HISTORY_UPDATED_EVENT, refresh);
    return () =>
      window.removeEventListener(TX_HISTORY_UPDATED_EVENT, refresh);
  }, [refresh]);

  return { txs, refresh };
}
