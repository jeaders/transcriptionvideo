import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export function GET() {
  const p = aiProvider();
  return NextResponse.json({ serverWhisper: Boolean(p), provider: p?.name ?? null });
}
