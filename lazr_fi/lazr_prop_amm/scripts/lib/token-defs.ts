import { PublicKey } from "@solana/web3.js";

export const PYTH_LAZER_PROGRAM = new PublicKey(
  "PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd"
);

export const ER_ENDPOINT =
  process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
  "https://devnet-eu.magicblock.app/";

export const ER_WS_ENDPOINT =
  process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet-eu.magicblock.app/";

export const ER_VALIDATOR = new PublicKey(
  "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e"
);

export const DEFAULT_POOL_PARAMS = {
  targetInventoryBps: 5_000,
  baseSpreadBps: 5,
  maxSpreadBps: 200,
  virtualDepthK: 1_000_000_000,
  volatilityWindowSize: 32,
  crankIntervalMs: 50,
  maxTradeSize: 1_000_000_000_000,
  lambda: 100,
  maxOracleStalenessSec: 10,
} as const;

/** Initial vault seeding (raw token units) — applied before delegation. */
export const DEFAULT_LIQUIDITY = {
  assetAmount: 100_000_000_000,
  usdcAmount: 500_000_000_000,
} as const;

export const CRANK_ITERATIONS = 0;

export interface TokenDefinition {
  symbol: string;
  name: string;
  /** If true, mint is loaded from tests/test-mints.json (BTC). */
  useExistingBtcMint?: boolean;
  decimals: number;
  pythLazerId: number;
  oracleExponent: number;
}

export const SUPPORTED_TOKENS: TokenDefinition[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    useExistingBtcMint: true,
    decimals: 8,
    pythLazerId: 1,
    oracleExponent: -8,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 8,
    pythLazerId: 2,
    oracleExponent: -8,
  },
  {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    pythLazerId: 6,
    oracleExponent: -8,
  },
  {
    symbol: "PEPE",
    name: "Pepe",
    decimals: 6,
    pythLazerId: 4,
    oracleExponent: -10,
  },
  {
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    pythLazerId: 9,
    oracleExponent: -10,
  },
];

/** Each token has its own Pyth Lazer feed PDA (seeded by feed id). */
export function pythOraclePda(feedId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("price_feed"),
      Buffer.from("pyth-lazer"),
      Buffer.from(String(feedId)),
    ],
    PYTH_LAZER_PROGRAM
  );
  return pda;
}

export function oracleFeedForToken(token: TokenDefinition): PublicKey {
  return pythOraclePda(token.pythLazerId);
}
