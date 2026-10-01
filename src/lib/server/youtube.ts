import type { Segment } from "@/lib/format";
import { parseTimedText } from "./captions";

export type YtTrack = { lang: string; name: string; kind?: string; baseUrl: string };
export type YtMeta = {
  title: string;
  author?: string;
  duration?: number;
  thumbnail: string;
  tracks: YtTrack[];
};

const CLIENT = { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34, hl: "en", gl: "US" };

export async function youtubePlayer(videoId: string): Promise<YtMeta | null> {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
      },
      body: JSON.stringify({ context: { client: CLIENT }, videoId }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      videoDetails?: { title?: string; author?: string; lengthSeconds?: string };
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: { baseUrl: string; languageCode: string; kind?: string; name?: { runs?: { text: string }[]; simpleText?: string } }[];
        };
      };
    };
    const tracks: YtTrack[] = (d.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).map((t) => ({
      lang: t.languageCode,
      kind: t.kind,
      name: t.name?.simpleText ?? t.name?.runs?.map((r) => r.text).join("") ?? t.languageCode,
      baseUrl: t.baseUrl,
    }));
    return {
      title: d.videoDetails?.title ?? "Video YouTube",
      author: d.videoDetails?.author,
      duration: d.videoDetails?.lengthSeconds ? Number(d.videoDetails.lengthSeconds) : undefined,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      tracks,
    };
  } catch {
    return null;
  }
}

export async function fetchTrack(baseUrl: string, tlang?: string): Promise<Segment[]> {
  let url = baseUrl.replace(/&fmt=[^&]*/, "") + "&fmt=srv3";
  if (tlang) url += `&tlang=${tlang}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const body = await res.text();
  if (!body.includes("<timedtext") && !body.includes("<transcript")) return [];
  return parseTimedText(body);
}

/** Pick best track: manual in preferred langs > manual any > asr */
export function pickTrack(tracks: YtTrack[], prefer?: string): YtTrack | null {
  if (!tracks.length) return null;
  const base = (l: string) => l.split("-")[0].toLowerCase();
  const manual = tracks.filter((t) => t.kind !== "asr");
  const asr = tracks.filter((t) => t.kind === "asr");
  // the ASR track language = spoken language: prefer manual in that language
  const spoken = asr[0] ? base(asr[0].lang) : prefer;
  return (
    (spoken && manual.find((t) => base(t.lang) === spoken)) ||
    (prefer && manual.find((t) => base(t.lang) === prefer)) ||
    asr[0] ||
    manual[0] ||
    null
  );
}
