import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { getPoolForSymbol } from "../devnet-config";
import { fromRawAmount } from "./amounts";
import { logStep } from "./debug";
import { getErSubscriptionConnection } from "./er-connection";
import idl from "./idl.json";
import { PROGRAM_ID } from "./program";
import { appendPropAmmTx } from "./tx-history";

const coder = new BorshCoder(idl as Idl);
const parser = new EventParser(PROGRAM_ID, coder);

export const AUTOPILOT_OUTCOME = {
  skip: 0,
  buy: 1,
  sell: 2,
} as const;

export const AUTOPILOT_SKIP = {
  none: 0,
  inactive: 1,
  volatility: 2,
  drawdown: 3,
  cooldown: 4,
  dailyLimit: 5,
  noSignal: 6,
} as const;

const SKIP_LABELS: Record<number, string> = {
  [AUTOPILOT_SKIP.inactive]: "Inactive",
  [AUTOPILOT_SKIP.volatility]: "Volatility pause",
  [AUTOPILOT_SKIP.drawdown]: "Drawdown stop",
  [AUTOPILOT_SKIP.cooldown]: "Cooldown",
  [AUTOPILOT_SKIP.dailyLimit]: "Daily limit",
  [AUTOPILOT_SKIP.noSignal]: "No signal",
};

/** On-chain strategy crank cadence (matches lazr_prop_amm math/autopilot.rs). */
export const ON_CHAIN_STRATEGY_PARAMS = {
  conservative: { tickIntervalMs: 300_000, maxTradesPerDay: 3 },
  balanced: { tickIntervalMs: 120_000, maxTradesPerDay: 8 },
  aggressive: { tickIntervalMs: 60_000, maxTradesPerDay: 20 },
} as const;

export function formatCrankInterval(tickIntervalMs: number): string {
  if (tickIntervalMs >= 60_000 && tickIntervalMs % 60_000 === 0) {
    const mins = tickIntervalMs / 60_000;
    return mins === 1 ? "1 min" : `${mins} min`;
  }
  if (tickIntervalMs >= 1_000) {
    return `${Math.round(tickIntervalMs / 1_000)}s`;
  }
  return `${tickIntervalMs}ms`;
}

interface AutopilotTickEventData {
  authority: PublicKey;
  pool: PublicKey;
  outcome: number;
  skipReason: number;
  amountIn: BN;
  amountOut: BN;
}

function readTickEvent(data: Record<string, unknown>): AutopilotTickEventData {
  const authority = data.authority ?? data.authority;
  const pool = data.pool ?? data.pool;
  const outcome = Number(data.outcome ?? 0);
  const skipReason = Number(
    data.skipReason ?? data.skip_reason ?? AUTOPILOT_SKIP.none
  );
  const amountInRaw = data.amountIn ?? data.amount_in ?? 0;
  const amountOutRaw = data.amountOut ?? data.amount_out ?? 0;

  return {
    authority: authority as PublicKey,
    pool: pool as PublicKey,
    outcome,
    skipReason,
    amountIn: BN.isBN(amountInRaw)
      ? amountInRaw
      : new BN(String(amountInRaw)),
    amountOut: BN.isBN(amountOutRaw)
      ? amountOutRaw
      : new BN(String(amountOutRaw)),
  };
}

function formatAutopilotAmountLabel(
  assetSymbol: string,
  outcome: number,
  skipReason: number,
  amountIn: BN,
  amountOut: BN
): { direction: "buy" | "sell" | "check" | "skip"; amountLabel: string } {
  const pool = getPoolForSymbol(assetSymbol);

  if (outcome === AUTOPILOT_OUTCOME.buy) {
    const usdc = fromRawAmount(amountIn, pool.usdcDecimals);
    const asset = fromRawAmount(amountOut, pool.decimals);
    return {
      direction: "buy",
      amountLabel: `${usdc.toFixed(4)} USDC → ${asset.toFixed(6)} ${assetSymbol}`,
    };
  }

  if (outcome === AUTOPILOT_OUTCOME.sell) {
    const asset = fromRawAmount(amountIn, pool.decimals);
    const usdc = fromRawAmount(amountOut, pool.usdcDecimals);
    return {
      direction: "sell",
      amountLabel: `${asset.toFixed(6)} ${assetSymbol} → ${usdc.toFixed(4)} USDC`,
    };
  }

  const reason = SKIP_LABELS[skipReason] ?? "No trade";
  return {
    direction: skipReason === AUTOPILOT_SKIP.noSignal ? "check" : "skip",
    amountLabel: reason,
  };
}

/**
 * Subscribe to AutopilotTick Anchor events on the ER via program logs.
 * MagicBlock ER uses standard Solana websocket log subscriptions.
 */
export function subscribeAutopilotTicks(params: {
  wallet: string;
  assetSymbol: string;
  poolPk: PublicKey;
  onActivity?: () => void;
}): () => void {
  const { wallet, assetSymbol, poolPk, onActivity } = params;
  const connection = getErSubscriptionConnection();
  const seenSignatures = new Set<string>();

  logStep("autopilot-events", "Subscribing to AutopilotTick on ER", {
    program: PROGRAM_ID.toBase58(),
    pool: poolPk.toBase58(),
  });

  const subscriptionId = connection.onLogs(
    PROGRAM_ID,
    (logs) => {
      const signature = logs.signature;
      if (!signature || seenSignatures.has(signature)) return;

      for (const event of parser.parseLogs(logs.logs)) {
        if (event.name !== "AutopilotTick") continue;

        const tick = readTickEvent(event.data as Record<string, unknown>);
        if (tick.authority.toBase58() !== wallet) continue;
        if (!tick.pool.equals(poolPk)) continue;

        seenSignatures.add(signature);

        const { direction, amountLabel } = formatAutopilotAmountLabel(
          assetSymbol,
          tick.outcome,
          tick.skipReason,
          tick.amountIn,
          tick.amountOut
        );

        appendPropAmmTx(wallet, {
          kind: "autopilot",
          signature,
          pair: `${assetSymbol}/USDC`,
          direction,
          amountLabel,
        });

        logStep("autopilot-events", "Recorded AutopilotTick", {
          signature,
          outcome: tick.outcome,
          skipReason: tick.skipReason,
          direction,
        });

        onActivity?.();
      }
    },
    "confirmed"
  );

  return () => {
    logStep("autopilot-events", "Unsubscribing from AutopilotTick");
    void connection.removeOnLogsListener(subscriptionId);
  };
}
