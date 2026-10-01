import fs from "node:fs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import type { Segment } from "@/lib/format";
import { normalizeSegments } from "@/lib/server/captions";
import { ensureTranslation } from "@/lib/server/pipeline";
import { publicTranscript } from "@/lib/server/util";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  if (!t) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  return NextResponse.json(publicTranscript(t));
}

/** Save browser-side transcription result, or rename */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    segments?: Segment[];
    sourceLang?: string;
    method?: string;
    title?: string;
    target?: string;
    error?: string;
  };
  const [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  if (!t) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  const patch: Partial<typeof t> = { updatedAt: new Date() };
  if (body.title) patch.title = body.title.slice(0, 300);
  if (body.error) {
    patch.status = "error";
    patch.error = body.error.slice(0, 500);
  }
  if (Array.isArray(body.segments)) {
    const segs = body.segments
      .filter((s) => s && typeof s.text === "string")
      .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || Number(s.start) || 0, text: s.text.trim() }));
    patch.segments = normalizeSegments(segs);
    patch.status = "done";
    patch.error = null;
    patch.method = body.method ?? "whisper-browser";
    patch.sourceLang = body.sourceLang ?? t.sourceLang;
    patch.translations = {};
  }
  await db.update(transcripts).set(patch).where(eq(transcripts.id, id));
  if (body.target && body.target !== "none" && patch.segments && body.target !== patch.sourceLang) {
    try {
      await ensureTranslation(id, body.target);
    } catch {}
  }
  const [fresh] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  return NextResponse.json(publicTranscript(fresh));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  if (t?.mediaPath) fs.rm(t.mediaPath, { force: true }, () => {});
  await db.delete(transcripts).where(eq(transcripts.id, id));
  return NextResponse.json({ ok: true });
}
