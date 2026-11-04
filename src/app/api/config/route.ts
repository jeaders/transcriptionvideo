import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export function GET() {
  const p = aiProvider();
  let dbHost: string | null = null;
  try {
    dbHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
  } catch {}
  return NextResponse.json({ serverWhisper: Boolean(p), provider: p?.name ?? null, dbHost });
}
