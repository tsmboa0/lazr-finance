import { TOKEN_META, type Token, type TokenMeta, type TimeChange, createFallbackToken } from "../app/data/tokens";
import {
  formatCompactUsd,
  formatPercentChange,
  formatPercentDisplay,
  formatUsdPrice,
  normalizeSparkline,
  percentChange,
} from "./format-numbers";

const COINGECKO_IDS = TOKEN_META.map((token) => token.coinGeckoId).join(",");

interface CoinGeckoMarket {
  id: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h?: number;
  low_24h?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h?: number;
  sparkline_in_7d?: { price: number[] };
}

function buildTimeChanges(
  prices: number[],
  change24h: number
): TimeChange[] {
  const len = prices.length;
  const last = prices[len - 1] ?? 0;
  const oneHourAgo = prices[len - 2] ?? last;
  const sixHoursAgo = prices[len - 7] ?? last;

  const change1h = percentChange(last, oneHourAgo);
  const change6h = percentChange(last, sixHoursAgo);
  const change5m = change1h / 12;

  return [
    { label: "5m", change: formatPercentChange(change5m), positive: change5m >= 0 },
    { label: "1h", change: formatPercentChange(change1h), positive: change1h >= 0 },
    { label: "6h", change: formatPercentChange(change6h), positive: change6h >= 0 },
    {
      label: "24h",
      change: formatPercentChange(change24h),
      positive: change24h >= 0,
    },
  ];
}

function mergeMetaWithMarket(meta: TokenMeta, market: CoinGeckoMarket): Token {
  const prices = market.sparkline_in_7d?.price ?? [];
  const change24h = market.price_change_percentage_24h ?? 0;

  return {
    ...meta,
    priceUsd: market.current_price,
    price: formatUsdPrice(market.current_price),
    priceChange: formatPercentChange(change24h),
    priceChangePositive: change24h >= 0,
    mcap: formatCompactUsd(market.market_cap),
    fdv: formatCompactUsd(
      market.fully_diluted_valuation ?? market.market_cap
    ),
    volume24h: formatCompactUsd(market.total_volume),
    high24h: formatUsdPrice(market.high_24h ?? market.current_price),
    low24h: formatUsdPrice(market.low_24h ?? market.current_price),
    sparklineData: normalizeSparkline(prices),
    timeChanges: buildTimeChanges(prices, change24h),
  };
}

export async function fetchLiveTokens(): Promise<Token[]> {
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("ids", COINGECKO_IDS);
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("sparkline", "true");
  url.searchParams.set("price_change_percentage", "1h,24h");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`CoinGecko error: ${response.status}`);
  }

  const markets = (await response.json()) as CoinGeckoMarket[];
  const marketById = new Map(markets.map((market) => [market.id, market]));

  return TOKEN_META.map((meta) => {
    const market = marketById.get(meta.coinGeckoId);
    if (!market) return createFallbackToken(meta);
    return mergeMetaWithMarket(meta, market);
  });
}

export async function fetchSolTicker(): Promise<{
  priceUsd: number;
  price: string;
  change24h: number;
  changeDisplay: string;
  positive: boolean;
}> {
  const tokens = await fetchLiveTokens();
  const sol = tokens.find((token) => token.symbol === "SOL");

  if (!sol) {
    throw new Error("SOL market data missing");
  }

  const change24h = parseFloat(sol.priceChange.replace("%", "").replace("+", ""));

  return {
    priceUsd: sol.priceUsd,
    price: sol.price,
    change24h,
    changeDisplay: formatPercentDisplay(change24h),
    positive: sol.priceChangePositive,
  };
}
