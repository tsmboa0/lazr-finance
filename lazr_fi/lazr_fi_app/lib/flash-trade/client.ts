import { Connection } from "@solana/web3.js";
import { FlashV2Client, type NetworkConfig } from "flash-v2";

/** Same-origin proxy — public mainnet RPC returns 403 from browsers directly. */
export const MAINNET_RPC_PROXY = "/api/mainnet-rpc";

function resolveBaseRpc(): string {
  const explicit =
    process.env.NEXT_PUBLIC_BASE_RPC ??
    process.env.NEXT_PUBLIC_FLASH_BASE_RPC;
  if (explicit) return explicit;

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  return `${origin.replace(/\/$/, "")}${MAINNET_RPC_PROXY}`;
}

function overridesFromEnv(): Partial<NetworkConfig> {
  const cfg: Partial<NetworkConfig> = {};
  const apiBase = process.env.NEXT_PUBLIC_FLASH_API_BASE;
  const erRpc = process.env.NEXT_PUBLIC_ER_RPC;

  if (apiBase) cfg.apiBase = apiBase;
  if (erRpc) cfg.erRpc = erRpc;
  cfg.baseRpc = resolveBaseRpc();
  return cfg;
}

export const flash = new FlashV2Client(overridesFromEnv());

export const baseConnection = new Connection(flash.network.baseRpc, {
  commitment: "confirmed",
  disableRetryOnRateLimit: true,
});

export const COLLATERAL_SYMBOL = "USDC";

export function explorerTx(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}
