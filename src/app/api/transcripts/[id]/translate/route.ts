import { NextResponse } from "next/server";
import { ensureTranslation } from "@/lib/server/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { target?: string };
  const target = body.target === "it" || body.target === "en" ? body.target : null;
  if (!target) return NextResponse.json({ error: "Lingua non supportata" }, { status: 400 });
  try {
    const segments = await ensureTranslation(id, target);
    return NextResponse.json({ segments });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}
