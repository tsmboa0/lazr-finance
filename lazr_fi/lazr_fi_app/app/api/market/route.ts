import { NextResponse } from "next/server";
import { TOKENS } from "../../data/tokens";
import { fetchLiveTokens } from "../../../lib/market-data";

export const revalidate = 60;

export async function GET() {
  try {
    const tokens = await fetchLiveTokens();
    return NextResponse.json({ tokens });
  } catch {
    return NextResponse.json({ tokens: TOKENS }, { status: 200 });
  }
}
