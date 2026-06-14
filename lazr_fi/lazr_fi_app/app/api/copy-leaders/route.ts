import { NextResponse } from "next/server";
import { getServerCopyLeaders } from "../../../lib/copy-trade/leaders";

export const dynamic = "force-dynamic";

/** Curated copy-trade leaders. Flash V2 has no leaderboard endpoint — list is app-configured. */
export async function GET() {
  return NextResponse.json({ leaders: getServerCopyLeaders() });
}
