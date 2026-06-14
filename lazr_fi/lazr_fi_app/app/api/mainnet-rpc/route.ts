import { NextRequest, NextResponse } from "next/server";

const UPSTREAM =
  process.env.MAINNET_RPC_URL ??
  process.env.NEXT_PUBLIC_BASE_RPC ??
  process.env.NEXT_PUBLIC_FLASH_BASE_RPC ??
  "https://api.mainnet-beta.solana.com";

/** Proxies mainnet JSON-RPC so the browser is not blocked by public RPC 403s. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Mainnet RPC proxy failed" },
        id: null,
      },
      { status: 502 }
    );
  }
}
