import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import { detectPlatform, youtubeId } from "@/lib/platform";
import { processTranscript } from "@/lib/server/pipeline";
import { newId } from "@/lib/server/util";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string; language?: string; target?: string };
  let url = (body.url ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) throw new Error();
  } catch {
    return NextResponse.json({ error: "Inserisci un link video valido" }, { status: 400 });
  }
  const platform = detectPlatform(url);
  const vid = platform === "youtube" ? youtubeId(url) : null;
  const id = newId();
  try {
    await db.insert(transcripts).values({
      id,
      url,
      platform,
      title: "Analisi del video in corso…",
      thumbnail: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : null,
      status: "processing",
      meta: vid ? { videoId: vid } : {},
    });
    after(() => processTranscript(id, { language: body.language, target: body.target }));
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore durante l'avvio della trascrizione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
