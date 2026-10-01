import type { Segment } from "@/lib/format";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** Parses YouTube timedtext XML (srv1 / srv3) */
export function parseTimedText(xml: string): Segment[] {
  const out: Segment[] = [];
  const p3 = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = p3.exec(xml))) {
    const text = clean(m[3]);
    if (!text) continue;
    const start = Number(m[1]) / 1000;
    out.push({ start, end: start + Number(m[2] ?? 0) / 1000, text });
  }
  if (out.length) return out;
  const p1 = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = p1.exec(xml))) {
    const text = clean(m[3]);
    if (!text) continue;
    const start = Number(m[1]);
    out.push({ start, end: start + Number(m[2] ?? 0), text });
  }
  return out;
}

function vttTime(t: string): number {
  const parts = t.trim().replace(",", ".").split(":");
  let s = 0;
  for (const p of parts) s = s * 60 + parseFloat(p);
  return s;
}

/** Parses WebVTT or SRT */
export function parseVtt(vtt: string): Segment[] {
  const out: Segment[] = [];
  const blocks = vtt.replace(/\r/g, "").split(/\n\n+/);
  for (const b of blocks) {
    const lines = b.split("\n");
    const idx = lines.findIndex((l) => l.includes("-->"));
    if (idx < 0) continue;
    const [a, z] = lines[idx].split("-->");
    const text = clean(lines.slice(idx + 1).join(" "));
    if (!text) continue;
    out.push({ start: vttTime(a), end: vttTime(z.trim().split(/\s+/)[0]), text });
  }
  // de-duplicate rolling captions (auto captions repeat lines)
  const dedup: Segment[] = [];
  for (const s of out) {
    const prev = dedup[dedup.length - 1];
    if (prev && (prev.text === s.text || s.text.startsWith(prev.text))) {
      prev.text = s.text;
      prev.end = s.end;
    } else if (prev && prev.text.endsWith(s.text)) {
      prev.end = s.end;
    } else dedup.push({ ...s });
  }
  return dedup;
}

export function parseJson3(json: string): Segment[] {
  const data = JSON.parse(json) as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] };
  const out: Segment[] = [];
  for (const e of data.events ?? []) {
    if (!e.segs) continue;
    const text = e.segs.map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = (e.tStartMs ?? 0) / 1000;
    out.push({ start, end: start + (e.dDurationMs ?? 0) / 1000, text });
  }
  return out;
}

export function parseAnyCaption(body: string): Segment[] {
  const t = body.trim();
  if (t.startsWith("{")) {
    try {
      return parseJson3(t);
    } catch {}
  }
  if (t.startsWith("<")) return parseTimedText(t);
  return parseVtt(t);
}

/** Merge very short caption fragments into readable sentences */
export function normalizeSegments(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const text = s.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.text.length < 60 && !/[.!?…]$/.test(prev.text) && s.start - prev.end < 1.5 && (prev.text + text).length < 160) {
      prev.text = `${prev.text} ${text}`;
      prev.end = Math.max(prev.end, s.end);
    } else {
      out.push({ start: s.start, end: Math.max(s.end, s.start), text });
    }
  }
  return out;
}
