import fs from "node:fs";
import path from "node:path";
import type { Segment } from "@/lib/format";
import { prepareAudio } from "./audio";

type Provider = { name: "groq" | "openai"; base: string; key: string; sttModel: string; chatModel: string };

export function aiProvider(): Provider | null {
  if (process.env.GROQ_API_KEY)
    return {
      name: "groq",
      base: "https://api.groq.com/openai/v1",
      key: process.env.GROQ_API_KEY,
      sttModel: process.env.STT_MODEL || "whisper-large-v3-turbo",
      chatModel: process.env.CHAT_MODEL || "llama-3.3-70b-versatile",
    };
  if (process.env.OPENAI_API_KEY)
    return {
      name: "openai",
      base: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      key: process.env.OPENAI_API_KEY,
      sttModel: process.env.STT_MODEL || "whisper-1",
      chatModel: process.env.CHAT_MODEL || "gpt-4o-mini",
    };
  return null;
}

const MIME: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".mov": "video/quicktime",
};
export function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export async function whisperApi(
  data: Blob,
  filename: string,
  language?: string,
  opts?: { quality?: string; prompt?: string },
): Promise<{ segments: Segment[]; language?: string }> {
  const p = aiProvider();
  if (!p) throw new Error("Nessuna chiave API configurata");
  if (data.size > 25 * 1024 * 1024) throw new Error("File audio oltre 25MB: usa la modalità browser");
  const model = opts?.quality === "precise" && p.name === "groq" ? "whisper-large-v3" : p.sttModel;
  const form = new FormData();
  form.append("file", data, filename);
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (opts?.prompt) form.append("prompt", opts.prompt.slice(0, 900));
  if (language && language !== "auto") form.append("language", language);
  const res = await fetch(`${p.base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Errore trascrizione (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const d = (await res.json()) as { language?: string; text?: string; segments?: { start: number; end: number; text: string }[]; duration?: number };
  const segments = (d.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })).filter((s) => s.text);
  if (!segments.length && d.text) segments.push({ start: 0, end: d.duration ?? 0, text: d.text.trim() });
  return { segments, language: normalizeLang(d.language) };
}

export async function whisperFile(
  file: string,
  language?: string,
  opts?: { quality?: string; prompt?: string },
): Promise<{ segments: Segment[]; language?: string }> {
  // Solo i file oltre 24 MB vengono normalizzati/spezzati; altrimenti si usa l'audio originale
  // (la conversione 16k mp3 peggiora la qualità su musica e provoca allucinazioni).
  const chunks =
    fs.statSync(file).size > 24 * 1024 * 1024
      ? await prepareAudio(file)
      : [{ file, offset: 0 }];

  const all: Segment[] = [];
  let lang: string | undefined;
  const cleanup: string[] = [];
  try {
    for (const c of chunks) {
      const buf = fs.readFileSync(c.file);
      const r = await whisperApi(new Blob([buf], { type: mimeFor(c.file) }), path.basename(c.file), language, opts);
      for (const s of r.segments) all.push({ start: s.start + c.offset, end: s.end + c.offset, text: s.text });
      if (!lang) lang = r.language;
      if (c.file !== file) cleanup.push(c.file);
    }
  } finally {
    for (const f of cleanup) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
    try {
      const chunksDir = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}_chunks`);
      if (fs.existsSync(chunksDir)) fs.rmSync(chunksDir, { recursive: true, force: true });
    } catch {}
  }
  return { segments: all, language: lang };
}

const NAME_TO_CODE: Record<string, string> = {
  english: "en", italian: "it", spanish: "es", french: "fr", german: "de", portuguese: "pt", russian: "ru",
  japanese: "ja", chinese: "zh", korean: "ko", arabic: "ar", dutch: "nl", polish: "pl", turkish: "tr", hindi: "hi",
};
export function normalizeLang(l?: string | null): string | undefined {
  if (!l) return undefined;
  const low = l.toLowerCase();
  return NAME_TO_CODE[low] ?? low.split(/[-_]/)[0];
}

/* ---------------- Translation ---------------- */

function batches(segs: Segment[], maxChars: number): Segment[][] {
  const out: Segment[][] = [];
  let cur: Segment[] = [];
  let len = 0;
  for (const s of segs) {
    if (cur.length && len + s.text.length + 1 > maxChars) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(s);
    len += s.text.length + 1;
  }
  if (cur.length) out.push(cur);
  return out;
}

function mapBack(group: Segment[], lines: string[], joined: string): Segment[] {
  if (lines.length === group.length) return group.map((s, i) => ({ ...s, text: lines[i].trim() || s.text }));
  return [{ start: group[0].start, end: group[group.length - 1].end, text: joined.replace(/\s*\n\s*/g, " ").trim() }];
}

async function llmTranslate(group: Segment[], target: string): Promise<Segment[]> {
  const p = aiProvider()!;
  const lang = target === "it" ? "Italian" : "English";
  const res = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.chatModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a professional subtitle translator. Translate each string of the input JSON array "lines" into natural, fluent ${lang}. Keep the same number of items, same order. Reply ONLY with JSON: {"lines": [...]}.`,
        },
        { role: "user", content: JSON.stringify({ lines: group.map((s) => s.text) }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const d = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(d.choices[0].message.content) as { lines?: string[] };
  const lines = parsed.lines ?? [];
  if (lines.length !== group.length) throw new Error(`LLM ha restituito ${lines.length} righe invece di ${group.length}`);
  return mapBack(group, lines, lines.join(" "));
}

async function googleTranslate(group: Segment[], target: string): Promise<Segment[]> {
  const q = group.map((s) => s.text.replace(/\n/g, " ")).join("\n");
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  if (!res.ok) throw new Error(`Google ${res.status}`);
  const d = (await res.json()) as [[string, string][]];
  const joined = d[0].map((x) => x[0]).join("");
  return mapBack(group, joined.split("\n"), joined);
}

async function myMemoryTranslate(group: Segment[], target: string, source: string): Promise<Segment[]> {
  const q = group.map((s) => s.text.replace(/\n/g, " ")).join("\n");
  const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : "";
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${source || "en"}|${target}${email}`,
  );
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  const d = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number; quotaFinished?: boolean };
  if (d.quotaFinished || (d.responseStatus && d.responseStatus !== 200)) throw new Error("Quota di traduzione gratuita esaurita");
  const joined = d.responseData?.translatedText ?? "";
  return mapBack(group, joined.split("\n"), joined);
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export async function translateSegments(segs: Segment[], target: string, source?: string | null): Promise<Segment[]> {
  const src = (source ?? "").split("-")[0] || "en";
  const strategies: { name: string; size: number; conc: number; fn: (g: Segment[]) => Promise<Segment[]> }[] = [];
  if (aiProvider()) strategies.push({ name: "llm", size: 2500, conc: 3, fn: (g) => llmTranslate(g, target) });
  strategies.push({ name: "google", size: 1800, conc: 3, fn: (g) => googleTranslate(g, target) });
  strategies.push({ name: "mymemory", size: 450, conc: 2, fn: (g) => myMemoryTranslate(g, target, src) });
  let lastErr: unknown = null;
  for (const st of strategies) {
    try {
      const groups = batches(segs, st.size);
      const res = await pool(groups, st.conc, st.fn);
      return res.flat();
    } catch (e) {
      lastErr = e;
    }
  }
  // Fallback per-segmento: garantisce copertura completa anche se i batch falliscono il conteggio
  try {
    const out: Segment[] = [];
    for (const s of segs) {
      const r = await googleTranslate([s], target);
      out.push(...r);
    }
    return out;
  } catch (e) {
    lastErr = e;
  }
  throw new Error(`Traduzione non riuscita: ${lastErr instanceof Error ? lastErr.message : "errore"}`);
}
