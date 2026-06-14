export interface TimeChange {
  label: string;
  change: string;
  positive: boolean;
}

export interface TokenMeta {
  id: string;
  symbol: string;
  name: string;
  ticker: string;
  verified: boolean;
  age: string;
  coinGeckoId: string;
  iconSrc: string;
  /** Solana mainnet SPL mint for wallet balance lookups. */
  splMint?: string;
  badges?: string[];
  tvSymbol: string;
  orgScore: string;
  topHolders: string;
  buyPercent: number;
  sellPercent: number;
  traders24h: string;
  netBuyers: string;
  volumeNet: string;
  volumeHighlighted?: boolean;
  liquidity: string;
  liquidityHighlighted?: boolean;
  holders: string;
  holdersChange: string;
  holdersChangePositive: boolean;
  feesPaid: string;
}

export interface TokenMarketFields {
  price: string;
  priceChange: string;
  priceChangePositive: boolean;
  mcap: string;
  fdv: string;
  volume24h: string;
  high24h: string;
  low24h: string;
  sparklineData: number[];
  priceUsd: number;
  timeChanges: TimeChange[];
}

export type Token = TokenMeta & TokenMarketFields;

export const USDC_ICON_SRC = "/usdc-logo.png";

export const TOKEN_META: TokenMeta[] = [
  {
    id: "1",
    symbol: "BTC",
    name: "BTC",
    ticker: "BTC",
    verified: true,
    age: "15y",
    coinGeckoId: "bitcoin",
    iconSrc: "/bitcoin-logo.png",
    splMint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ93vXXQzmGHpL",
    badges: ["🔗", "📋"],
    tvSymbol: "BINANCE:BTCUSDT",
    orgScore: "99.2",
    topHolders: "11.4%",
    buyPercent: 56,
    sellPercent: 44,
    traders24h: "1.83m",
    netBuyers: "5.18k",
    volumeNet: "$1.12bn",
    liquidity: "$2.02bn",
    holders: "52.9m",
    holdersChange: "+0.91%",
    holdersChangePositive: true,
    feesPaid: "-",
  },
  {
    id: "2",
    symbol: "ETH",
    name: "ETH",
    ticker: "ETH",
    verified: true,
    age: "10y",
    coinGeckoId: "ethereum",
    iconSrc: "/eth-logo.png",
    splMint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    tvSymbol: "BINANCE:ETHUSDT",
    orgScore: "98.7",
    topHolders: "24.1%",
    buyPercent: 61,
    sellPercent: 39,
    traders24h: "980k",
    netBuyers: "3.21k",
    volumeNet: "$546m",
    liquidity: "$1.85bn",
    holders: "121m",
    holdersChange: "+0.68%",
    holdersChangePositive: true,
    feesPaid: "-",
  },
  {
    id: "3",
    symbol: "SOL",
    name: "SOL",
    ticker: "SOL",
    verified: true,
    age: "5y",
    coinGeckoId: "solana",
    iconSrc: "/sol-logo.png",
    badges: ["📋", "🔍"],
    tvSymbol: "BINANCE:SOLUSDT",
    orgScore: "97.5",
    topHolders: "18.6%",
    buyPercent: 58,
    sellPercent: 42,
    traders24h: "1.21m",
    netBuyers: "4.02k",
    volumeNet: "$512m",
    volumeHighlighted: true,
    liquidity: "$1.85bn",
    liquidityHighlighted: true,
    holders: "8.21m",
    holdersChange: "+1.08%",
    holdersChangePositive: true,
    feesPaid: "-",
  },
  {
    id: "4",
    symbol: "PEPE",
    name: "PEPE",
    ticker: "PEPE",
    verified: true,
    age: "2y",
    coinGeckoId: "pepe",
    iconSrc: "/pepe-logo.png",
    splMint: "B5WTLaRwaUi7bF9er64dHkCeEj4vgPfFC4MiFtcGZuWr",
    tvSymbol: "BINANCE:PEPEUSDT",
    orgScore: "84.0",
    topHolders: "31.2%",
    buyPercent: 49,
    sellPercent: 51,
    traders24h: "612k",
    netBuyers: "1.18k",
    volumeNet: "$289m",
    liquidity: "$181m",
    holders: "425k",
    holdersChange: "-0.07%",
    holdersChangePositive: false,
    feesPaid: "-",
  },
  {
    id: "5",
    symbol: "BONK",
    name: "BONK",
    ticker: "BONK",
    verified: true,
    age: "2y",
    coinGeckoId: "bonk",
    iconSrc: "/bonk-logo.png",
    splMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    tvSymbol: "BINANCE:BONKUSDT",
    orgScore: "83.9",
    topHolders: "27.4%",
    buyPercent: 64,
    sellPercent: 36,
    traders24h: "488k",
    netBuyers: "2.04k",
    volumeNet: "$285m",
    liquidity: "$458m",
    liquidityHighlighted: true,
    holders: "923k",
    holdersChange: "+4.62%",
    holdersChangePositive: true,
    feesPaid: "-",
  },
  {
    id: "6",
    symbol: "WIF",
    name: "WIF",
    ticker: "WIF",
    verified: true,
    age: "1y",
    coinGeckoId: "dogwifcoin",
    iconSrc: "/wif-logo.png",
    splMint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    badges: ["📋", "🔍"],
    tvSymbol: "BINANCE:WIFUSDT",
    orgScore: "82.6",
    topHolders: "29.8%",
    buyPercent: 52,
    sellPercent: 48,
    traders24h: "204k",
    netBuyers: "918",
    volumeNet: "$170m",
    liquidity: "$60.5m",
    holders: "212k",
    holdersChange: "-0.03%",
    holdersChangePositive: false,
    feesPaid: "-",
  },
  {
    id: "7",
    symbol: "SUI",
    name: "SUI",
    ticker: "SUI",
    verified: true,
    age: "2y",
    coinGeckoId: "sui",
    iconSrc: "/sui-logo.jpg",
    splMint: "GjwAHMjq4HaEjiNsLV8eqLq2f4RDviSAJjFX7k3mqcW",
    tvSymbol: "BINANCE:SUIUSDT",
    orgScore: "94.1",
    topHolders: "22.7%",
    buyPercent: 55,
    sellPercent: 45,
    traders24h: "356k",
    netBuyers: "1.42k",
    volumeNet: "$158m",
    liquidity: "$508m",
    holders: "1.66m",
    holdersChange: "+0.02%",
    holdersChangePositive: true,
    feesPaid: "-",
  },
  {
    id: "8",
    symbol: "DOGE",
    name: "DOGE",
    ticker: "DOGE",
    verified: true,
    age: "11y",
    coinGeckoId: "dogecoin",
    iconSrc: "/doge-logo.png",
    splMint: "9zC99pBVuwVbt5pRFCMGWrFczAtcnThfDZsdKHfCD8eU",
    tvSymbol: "BINANCE:DOGEUSDT",
    orgScore: "90.3",
    topHolders: "19.5%",
    buyPercent: 47,
    sellPercent: 53,
    traders24h: "742k",
    netBuyers: "1.88k",
    volumeNet: "$131m",
    liquidity: "$175m",
    holders: "7.42m",
    holdersChange: "-5.03%",
    holdersChangePositive: false,
    feesPaid: "-",
  },
  {
    id: "9",
    symbol: "XRP",
    name: "XRP",
    ticker: "XRP",
    verified: true,
    age: "12y",
    coinGeckoId: "ripple",
    iconSrc: "/xrp-logo.png",
    splMint: "6FrrzDkJSJQZsFw2W1eaAu8bJBe9NN47S2joa13Xz69o",
    tvSymbol: "BINANCE:XRPUSDT",
    orgScore: "91.8",
    topHolders: "44.2%",
    buyPercent: 53,
    sellPercent: 47,
    traders24h: "534k",
    netBuyers: "1.61k",
    volumeNet: "$220m",
    liquidity: "$640m",
    holders: "5.31m",
    holdersChange: "+0.34%",
    holdersChangePositive: true,
    feesPaid: "-",
  },
  {
    id: "10",
    symbol: "BNB",
    name: "BNB",
    ticker: "BNB",
    verified: true,
    age: "8y",
    coinGeckoId: "binancecoin",
    iconSrc: "/bnb-logo.png",
    splMint: "9gP2knt4RVEldThN1RjdEaKYirCcrmhvzHz7fmBkvu2",
    tvSymbol: "BINANCE:BNBUSDT",
    orgScore: "96.4",
    topHolders: "83.98%",
    buyPercent: 60,
    sellPercent: 40,
    traders24h: "298k",
    netBuyers: "1.05k",
    volumeNet: "$190m",
    liquidity: "$720m",
    holders: "3.04m",
    holdersChange: "+0.12%",
    holdersChangePositive: true,
    feesPaid: "-",
  },
];

const EMPTY_TIME_CHANGES: TimeChange[] = [
  { label: "5m", change: "--", positive: true },
  { label: "1h", change: "--", positive: true },
  { label: "6h", change: "--", positive: true },
  { label: "24h", change: "--", positive: true },
];

export function createFallbackToken(meta: TokenMeta): Token {
  return {
    ...meta,
    price: "--",
    priceChange: "--",
    priceChangePositive: true,
    mcap: "--",
    fdv: "--",
    volume24h: "--",
    high24h: "--",
    low24h: "--",
    sparklineData: [],
    priceUsd: 0,
    timeChanges: EMPTY_TIME_CHANGES,
  };
}

/** Static fallback list used before live market data loads. */
export const TOKENS: Token[] = TOKEN_META.map(createFallbackToken);

export function getTokenBySymbol(
  symbol: string,
  tokens: Token[] = TOKENS
): Token | undefined {
  return tokens.find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export function getTokenMetaBySymbol(symbol: string): TokenMeta | undefined {
  return TOKEN_META.find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/** Perps markets available on the perps terminal. */
export const PERPS_SYMBOLS = ["SOL", "BTC", "ETH"] as const;
export type PerpsSymbol = (typeof PERPS_SYMBOLS)[number];
