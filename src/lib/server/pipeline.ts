import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transcripts, type Transcript } from "@/db/schema";
import type { Segment } from "@/lib/format";
import { youtubeId } from "@/lib/platform";
import { aiProvider, normalizeLang, translateSegments, whisperFile } from "./ai";
import { normalizeSegments, parseAnyCaption } from "./captions";
import { downloadAudio, getInfo, type SubTrack } from "./ytdlp";
import { fetchTrack, pickTrack, youtubePlayer, type YtTrack } from "./youtube";

async function update(id: string, patch: Partial<Transcript>) {
  await db
    .update(transcripts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(transcripts.id, id));
}

async function fetchSub(tracks: SubTrack[]): Promise<Segment[]> {
  const order = ["json3", "vtt", "srv3", "srv1", "srt", "ttml"];
  const sorted = [...tracks].sort((a, b) => (order.indexOf(a.ext) + 99) % 99 - (order.indexOf(b.ext) + 99) % 99);
  for (const t of sorted) {
    try {
      const res = await fetch(t.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const segs = parseAnyCaption(await res.text());
      if (segs.length) return segs;
    } catch {}
  }
  return [];
}

function pickSubLang(map: Record<string, SubTrack[]> | undefined, spoken?: string, auto = false): string | null {
  if (!map) return null;
  const keys = Object.keys(map).filter((k) => k !== "live_chat" && map[k]?.length);
  if (!keys.length) return null;
  if (auto) {
    const orig = keys.find((k) => k.endsWith("-orig"));
    if (orig) return orig;
  }
  const base = (k: string) => k.split(/[-_]/)[0].toLowerCase();
  return (
    (spoken && keys.find((k) => base(k) === spoken)) ||
    (auto ? null : keys.find((k) => base(k) === "it") || keys.find((k) => base(k) === "en") || keys[0]) ||
    null
  );
}

export async function processTranscript(id: string, opts: { language?: string; target?: string }) {
  const [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  if (!t || !t.url) return;
  const url = t.url;
  const hint = opts.language && opts.language !== "auto" ? opts.language : undefined;
  try {
    let segments: Segment[] = [];
    let sourceLang: string | undefined;
    let method = "captions";

    // 1) YouTube native captions (fast path)
    if (t.platform === "youtube") {
      const vid = youtubeId(url);
      if (vid) {
        const meta = await youtubePlayer(vid);
        if (meta) {
          await update(id, {
            title: meta.title,
            author: meta.author ?? null,
            duration: meta.duration ?? null,
            thumbnail: meta.thumbnail,
            meta: { ...t.meta, videoId: vid, ytTracks: meta.tracks },
          });
          const track = pickTrack(meta.tracks, hint);
          if (track) {
            segments = await fetchTrack(track.baseUrl);
            sourceLang = normalizeLang(track.lang);
            method = track.kind === "asr" ? "auto-captions" : "captions";
          }
        }
      }
    }

    // 2) yt-dlp metadata + subtitles (all platforms)
    if (!segments.length) {
      const info = await getInfo(url);
      const spoken = normalizeLang(info.language) ?? hint;
      await update(id, {
        title: (info.title || info.fulltitle || info.description || t.title).slice(0, 300),
        author: info.uploader || info.channel || info.creator || null,
        duration: info.duration ? Math.round(info.duration) : null,
        thumbnail: info.thumbnail || t.thumbnail,
      });
      const manual = pickSubLang(info.subtitles, spoken);
      if (manual) {
        segments = await fetchSub(info.subtitles![manual]);
        sourceLang = normalizeLang(manual);
        method = "captions";
      }
      if (!segments.length) {
        const auto = pickSubLang(info.automatic_captions, spoken, true);
        if (auto) {
          segments = await fetchSub(info.automatic_captions![auto]);
          sourceLang = normalizeLang(auto.replace("-orig", ""));
          method = "auto-captions";
        }
      }
      if (sourceLang === undefined && spoken) sourceLang = spoken;
    }

    // 3) Server-side Whisper
    if (!segments.length && aiProvider()) {
      await update(id, { status: "transcribing" });
      const file = await downloadAudio(url, id, 24);
      await update(id, { mediaPath: file });
      const r = await whisperFile(file, hint);
      segments = r.segments;
      sourceLang = r.language ?? sourceLang;
      method = "whisper-api";
    }

    // 4) Browser Whisper fallback
    if (!segments.length) {
      await update(id, { status: "awaiting_client", sourceLang: sourceLang ?? hint ?? null });
      return;
    }

    segments = normalizeSegments(segments);
    await update(id, { segments, sourceLang: sourceLang ?? null, method, status: "done", error: null });

    if (opts.target && opts.target !== "none" && opts.target !== sourceLang) {
      try {
        await ensureTranslation(id, opts.target);
      } catch {}
    }
  } catch (e) {
    await update(id, { status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}

export async function ensureTranslation(id: string, target: string): Promise<Segment[]> {
  const [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  if (!t) throw new Error("Trascrizione non trovata");
  if (t.translations?.[target]?.length) return t.translations[target];
  if (!t.segments.length) throw new Error("Nessun testo da tradurre");
  let result: Segment[] = [];

  // YouTube: native track in target language or YouTube auto-translation
  const tracks = (t.meta?.ytTracks as YtTrack[] | undefined) ?? [];
  if (tracks.length) {
    const native = tracks.find((tr) => tr.kind !== "asr" && tr.lang.split("-")[0] === target);
    try {
      if (native) result = await fetchTrack(native.baseUrl);
      if (!result.length) {
        const base = pickTrack(tracks, t.sourceLang ?? undefined);
        if (base) result = await fetchTrack(base.baseUrl, target);
      }
    } catch {
      result = [];
    }
    if (result.length) result = normalizeSegments(result);
  }

  if (!result.length) result = await translateSegments(t.segments, target, t.sourceLang);
  const [fresh] = await db.select({ translations: transcripts.translations }).from(transcripts).where(eq(transcripts.id, id));
  await update(id, { translations: { ...(fresh?.translations ?? {}), [target]: result } });
  return result;
}
