import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import { aiProvider, whisperFile } from "@/lib/server/ai";
import { normalizeSegments } from "@/lib/server/captions";
import { ensureTranslation } from "@/lib/server/pipeline";
import { newId } from "@/lib/server/util";
import { MEDIA_DIR } from "@/lib/server/ytdlp";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Server-side transcription of an uploaded file (requires API key) */
export async function POST(req: Request) {
  if (!aiProvider()) return NextResponse.json({ error: "Trascrizione server non configurata" }, { status: 501 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File mancante" }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "File oltre 25MB" }, { status: 413 });
  const language = String(form.get("language") ?? "auto");
  const target = String(form.get("target") ?? "none");
  const duration = Number(form.get("duration") ?? 0);
  const id = newId();
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const ext = path.extname(file.name) || ".mp4";
  const dest = path.join(/*turbopackIgnore: true*/ MEDIA_DIR, `${id}${ext}`);
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
  await db.insert(transcripts).values({
    id,
    platform: "upload",
    title: file.name.slice(0, 300),
    duration: duration ? Math.round(duration) : null,
    status: "transcribing",
    mediaPath: dest,
  });
  try {
    const r = await whisperFile(dest, language);
    await db
      .update(transcripts)
      .set({ segments: normalizeSegments(r.segments), sourceLang: r.language ?? null, status: "done", method: "whisper-api" })
      .where(eq(transcripts.id, id));
    if (target !== "none" && target !== r.language) await ensureTranslation(id, target).catch(() => {});
  } catch (e) {
    await db
      .update(transcripts)
      .set({ status: "error", error: e instanceof Error ? e.message : "Errore" })
      .where(eq(transcripts.id, id));
  }
  return NextResponse.json({ id });
}
