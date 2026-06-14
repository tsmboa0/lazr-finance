import { NextResponse } from "next/server";
import { mintFaucetTokens } from "../../../lib/faucet-server";

export const runtime = "nodejs";

const COOLDOWN_MS = 30_000;
const recentClaims = new Map<string, number>();

function claimKey(address: string, symbol: string): string {
  return `${address}:${symbol.toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      symbol?: string;
    };

    const address = body.address?.trim();
    const symbol = body.symbol?.trim();

    if (!address || !symbol) {
      return NextResponse.json(
        { error: "address and symbol are required." },
        { status: 400 }
      );
    }

    const key = claimKey(address, symbol);
    const lastClaim = recentClaims.get(key);
    if (lastClaim && Date.now() - lastClaim < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - lastClaim)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSec}s before claiming ${symbol} again.` },
        { status: 429 }
      );
    }

    const result = await mintFaucetTokens(address, symbol);
    recentClaims.set(key, Date.now());

    return NextResponse.json({
      ok: true,
      signature: result.signature,
      amount: result.amount,
      symbol: symbol.toUpperCase(),
      mint: result.mint,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Faucet request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
