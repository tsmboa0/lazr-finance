import { PublicKey } from "@solana/web3.js";
import type { CopyLeader, LeaderSelection } from "./types";

/** Shown when COPY_LEADERS_JSON is unset — gives visitors a live example immediately. */
export const DEFAULT_COPY_LEADERS: CopyLeader[] = [
  {
    id: "lazr-demo",
    address: "8tmUuXnBRHbg8UYAPor6mDcmbzcENnu4tVz2sr7dmx9B",
    displayName: "Lazr Demo",
    description: "Example trader — preview live Flash V2 positions before you copy.",
    verified: true,
  },
];

export const DEFAULT_LEADER_SELECTION: LeaderSelection = {
  kind: "curated",
  leaderId: DEFAULT_COPY_LEADERS[0]!.id,
  address: DEFAULT_COPY_LEADERS[0]!.address,
};

function parseLeadersJson(raw: string, source: string): CopyLeader[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[copy-leaders] Invalid JSON in ${source}`);
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn(`[copy-leaders] ${source} must be a JSON array`);
    return [];
  }

  const out: CopyLeader[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const address = String(row.address ?? "").trim();
    const displayName = String(row.displayName ?? row.name ?? "").trim();
    const id = String(row.id ?? address).trim();
    if (!address || !displayName) continue;
    try {
      new PublicKey(address);
    } catch {
      console.warn(`[copy-leaders] Skipping invalid address in ${source}: ${address}`);
      continue;
    }
    out.push({
      id,
      address,
      displayName,
      description:
        typeof row.description === "string" ? row.description : undefined,
      verified: row.verified === true,
    });
  }
  return out;
}

/** Server-side: env COPY_LEADERS_JSON, then baked-in defaults. */
export function getServerCopyLeaders(): CopyLeader[] {
  const fromEnv = process.env.COPY_LEADERS_JSON?.trim();
  if (fromEnv) {
    const parsed = parseLeadersJson(fromEnv, "COPY_LEADERS_JSON");
    if (parsed.length > 0) return parsed;
  }
  return DEFAULT_COPY_LEADERS;
}
