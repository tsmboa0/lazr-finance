import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import idl from "./idl.json";

const accountsCoder = new BorshAccountsCoder(idl as Idl);

export const AUTOPILOT_STATUS = {
  inactive: 0,
  active: 1,
  paused: 2,
  stopped: 3,
} as const;

export const AUTOPILOT_STRATEGY = {
  conservative: 0,
  balanced: 1,
  aggressive: 2,
} as const;

export interface AutopilotStateView {
  authority: string;
  pool: string;
  status: number;
  strategy: number;
  allocatedUsdc: bigint;
  tickIntervalMs: number;
  totalTrades: number;
  tradesToday: number;
  lastTradeTs: bigint;
  crankTaskId: bigint;
}

function field<T>(decoded: Record<string, unknown>, snake: string, camel: string): T {
  return (decoded[camel] ?? decoded[snake]) as T;
}

export function decodeAutopilotState(data: Buffer): AutopilotStateView | null {
  try {
    const decoded = accountsCoder.decode(
      "AutopilotState",
      data
    ) as Record<string, unknown>;

    return {
      authority: String(field(decoded, "authority", "authority")),
      pool: String(field(decoded, "pool", "pool")),
      status: Number(field(decoded, "status", "status")),
      strategy: Number(field(decoded, "strategy", "strategy")),
      allocatedUsdc: BigInt(String(field(decoded, "allocated_usdc", "allocatedUsdc"))),
      tickIntervalMs: Number(
        field(decoded, "tick_interval_ms", "tickIntervalMs")
      ),
      totalTrades: Number(field(decoded, "total_trades", "totalTrades")),
      tradesToday: Number(field(decoded, "trades_today", "tradesToday")),
      lastTradeTs: BigInt(String(field(decoded, "last_trade_ts", "lastTradeTs"))),
      crankTaskId: BigInt(String(field(decoded, "crank_task_id", "crankTaskId"))),
    };
  } catch {
    return null;
  }
}

export function autopilotStatusLabel(status: number): string {
  if (status === AUTOPILOT_STATUS.active) return "Active";
  if (status === AUTOPILOT_STATUS.paused) return "Paused";
  if (status === AUTOPILOT_STATUS.stopped) return "Stopped";
  return "Inactive";
}

export type AutopilotLifecycle =
  | "not_set_up"
  | "inactive"
  | "active"
  | "paused"
  | "stopped";

/** Map on-chain status byte (+ presence) to UI lifecycle. */
export function resolveAutopilotLifecycle(
  state: AutopilotStateView | null
): AutopilotLifecycle {
  if (!state) return "not_set_up";
  if (state.status === AUTOPILOT_STATUS.active) return "active";
  if (state.status === AUTOPILOT_STATUS.paused) return "paused";
  if (state.status === AUTOPILOT_STATUS.stopped) return "stopped";
  return "inactive";
}

export interface AutopilotSnapshot {
  state: AutopilotStateView | null;
  /** Where the state was read — ER is authoritative while delegated. */
  source: "l1" | "er" | null;
  isDelegated: boolean;
  lifecycle: AutopilotLifecycle;
  statusLabel: string;
  isActive: boolean;
}
