import { notFound } from "next/navigation";
import Header from "../../components/Header";
import TradeView from "./TradeView";
import { TOKEN_META, getTokenMetaBySymbol } from "../../data/tokens";

export function generateStaticParams() {
  return TOKEN_META.map((token) => ({ symbol: token.symbol }));
}

export default async function TradePage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const meta = getTokenMetaBySymbol(symbol);

  if (!meta) {
    notFound();
  }

  return (
    <div className="flex flex-col h-screen min-h-0 bg-background">
      <Header />
      <div className="flex-1 min-h-0 flex flex-col">
        <TradeView symbol={meta.symbol} tvSymbol={meta.tvSymbol} />
      </div>
    </div>
  );
}
