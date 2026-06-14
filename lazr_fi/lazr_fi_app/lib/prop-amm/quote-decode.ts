import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import idl from "./idl.json";

const accountsCoder = new BorshAccountsCoder(idl as Idl);

export interface PoolQuote {
  fairPriceE8: bigint;
  executablePriceE8: bigint;
  bidPriceE8: bigint;
  askPriceE8: bigint;
  spreadBps: bigint;
  lastUpdateSlot: bigint;
  lastUpdateTs: bigint;
}

export interface PoolConfigQuote {
  virtualDepthK: bigint;
  maxOracleStalenessSec: bigint;
}

function readI64(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(String(value));
}

function readU64(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(String(value));
}

function field<T>(decoded: Record<string, unknown>, snake: string, camel: string): T {
  return (decoded[camel] ?? decoded[snake]) as T;
}

export function decodeQuoteState(data: Buffer): PoolQuote | null {
  try {
    const decoded = accountsCoder.decode(
      "QuoteState",
      data
    ) as Record<string, unknown>;
    return {
      fairPriceE8: readI64(field(decoded, "fair_price_e8", "fairPriceE8")),
      executablePriceE8: readI64(
        field(decoded, "executable_price_e8", "executablePriceE8")
      ),
      bidPriceE8: readI64(field(decoded, "bid_price_e8", "bidPriceE8")),
      askPriceE8: readI64(field(decoded, "ask_price_e8", "askPriceE8")),
      spreadBps: readU64(field(decoded, "spread_bps", "spreadBps")),
      lastUpdateSlot: readU64(
        field(decoded, "last_update_slot", "lastUpdateSlot")
      ),
      lastUpdateTs: readI64(field(decoded, "last_update_ts", "lastUpdateTs")),
    };
  } catch {
    return null;
  }
}

export function decodePoolConfig(data: Buffer): PoolConfigQuote | null {
  try {
    const decoded = accountsCoder.decode("Config", data) as Record<string, unknown>;
    return {
      virtualDepthK: readU64(
        field(decoded, "virtual_depth_k", "virtualDepthK")
      ),
      maxOracleStalenessSec: readU64(
        field(decoded, "max_oracle_staleness_sec", "maxOracleStalenessSec")
      ),
    };
  } catch {
    return null;
  }
}

export function isQuoteFresh(
  quote: PoolQuote,
  maxStalenessSec: bigint,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  if (quote.executablePriceE8 <= BigInt(0)) return false;
  const age = BigInt(nowSec) - quote.lastUpdateTs;
  return age >= BigInt(0) && age <= maxStalenessSec;
}
