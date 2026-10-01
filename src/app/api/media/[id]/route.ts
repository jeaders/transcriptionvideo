import fs from "node:fs";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import { mimeFor } from "@/lib/server/ai";
import { downloadAudio } from "@/lib/server/ytdlp";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  if (!t) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  let file = t.mediaPath && fs.existsSync(t.mediaPath) ? t.mediaPath : null;
  if (!file) {
    if (!t.url) return NextResponse.json({ error: "Media non disponibile" }, { status: 404 });
    try {
      file = await downloadAudio(t.url, t.id);
      await db.update(transcripts).set({ mediaPath: file }).where(eq(transcripts.id, id));
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Download fallito" }, { status: 502 });
    }
  }
  const size = fs.statSync(file).size;
  const type = mimeFor(file);
  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" },
  });
}
