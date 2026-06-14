export interface CopyLeader {
  id: string;
  address: string;
  displayName: string;
  description?: string;
  verified?: boolean;
}

export interface LeaderStats {
  openCount: number;
  totalNotionalUsd: number;
  unrealizedPnlUsd: number;
  totalCollateralUsd: number;
}

export type LeaderSelection =
  | { kind: "curated"; leaderId: string; address: string }
  | { kind: "custom"; address: string };
