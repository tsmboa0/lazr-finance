import { notFound } from "next/navigation";
import Header from "../../components/Header";
import PerpsView from "./PerpsView";
import {
  PERPS_SYMBOLS,
  getTokenMetaBySymbol,
} from "../../data/tokens";

export function generateStaticParams() {
  return PERPS_SYMBOLS.map((symbol) => ({ symbol }));
}

export default async function PerpsPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const meta = getTokenMetaBySymbol(symbol);

  if (
    !meta ||
    !PERPS_SYMBOLS.includes(symbol.toUpperCase() as typeof PERPS_SYMBOLS[number])
  ) {
    notFound();
  }

  return (
    <div className="flex flex-col h-screen min-h-0 bg-background">
      <Header />
      <div className="flex-1 min-h-0 flex flex-col">
        <PerpsView symbol={meta.symbol} tvSymbol={meta.tvSymbol} />
      </div>
    </div>
  );
}
