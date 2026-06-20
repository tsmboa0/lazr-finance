import devnetManifest from "../app/data/devnet-tokens.json";
import { TOKEN_META, USDC_ICON_SRC } from "../app/data/tokens";

export interface DevnetTokenEntry {
  symbol: string;
  name: string;
  assetMint: string;
  decimals: number;
  pythLazerId?: number;
  pool: string;
  config: string;
  quoteState: string;
  riskState?: string;
  assetVault: string;
  usdcVault: string;
  oracleFeed: string;
}

export interface DevnetManifest {
  version: number;
  network: string;
  programId: string;
  usdcMint: string;
  usdcDecimals: number;
  mintAuthority: string;
  erEndpoint: string;
  erValidator: string;
  faucetClaimAmount: number;
  faucetClaimAmounts?: Record<string, number>;
  tokens: DevnetTokenEntry[];
}

export interface PoolContext extends DevnetTokenEntry {
  usdcMint: string;
  usdcDecimals: number;
}

export interface FaucetToken {
  symbol: string;
  ticker: string;
  name: string;
  mint: string;
  decimals: number;
  iconSrc: string;
}

export interface TradeToken {
  symbol: string;
  ticker: string;
  name: string;
  mint: string;
  decimals: number;
  iconSrc: string;
}

const manifest = devnetManifest as DevnetManifest;

const iconBySymbol = Object.fromEntries(
  TOKEN_META.map((t) => [t.symbol, t.iconSrc])
);

export function getDevnetManifest(): DevnetManifest {
  return manifest;
}

export function getPoolForSymbol(symbol: string): PoolContext {
  const upper = symbol.toUpperCase();
  const poolToken =
    upper === "USDC"
      ? manifest.tokens[0]
      : manifest.tokens.find((t) => t.symbol.toUpperCase() === upper);

  if (!poolToken) {
    throw new Error(`No devnet pool configured for ${symbol}`);
  }

  return {
    ...poolToken,
    usdcMint: manifest.usdcMint,
    usdcDecimals: manifest.usdcDecimals,
  };
}

export function getMintForSymbol(symbol: string): {
  mint: string;
  decimals: number;
} {
  if (symbol.toUpperCase() === "USDC") {
    return { mint: manifest.usdcMint, decimals: manifest.usdcDecimals };
  }
  const token = manifest.tokens.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (!token) {
    throw new Error(`Unknown token symbol: ${symbol}`);
  }
  return { mint: token.assetMint, decimals: token.decimals };
}

export function getTradeTokens(): TradeToken[] {
  const assets: TradeToken[] = manifest.tokens.map((token) => ({
    symbol: token.symbol,
    ticker: token.symbol,
    name: token.name,
    mint: token.assetMint,
    decimals: token.decimals,
    iconSrc: iconBySymbol[token.symbol] ?? USDC_ICON_SRC,
  }));

  const usdc: TradeToken = {
    symbol: "USDC",
    ticker: "USDC",
    name: "USDC",
    mint: manifest.usdcMint,
    decimals: manifest.usdcDecimals,
    iconSrc: USDC_ICON_SRC,
  };

  return [usdc, ...assets];
}

export function getFaucetTokens(): FaucetToken[] {
  return getTradeTokens();
}

export function getFaucetToken(symbol: string): FaucetToken | undefined {
  return getFaucetTokens().find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

export function getFaucetClaimAmount(symbol: string): number {
  const upper = symbol.toUpperCase();
  const perToken = manifest.faucetClaimAmounts?.[upper];
  if (perToken !== undefined) return perToken;
  return manifest.faucetClaimAmount;
}

export function claimAmountRaw(token: FaucetToken): bigint {
  const human = getFaucetClaimAmount(token.symbol);
  const [wholePart, fractionPart = ""] = human.toString().split(".");
  const fraction = fractionPart.padEnd(token.decimals, "0").slice(0, token.decimals);
  const raw = `${wholePart}${fraction}`.replace(/^0+(?=\d)/, "");
  return BigInt(raw || "0");
}
