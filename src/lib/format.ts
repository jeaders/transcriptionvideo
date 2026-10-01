export type Segment = { start: number; end: number; text: string };

export function fmtTime(sec: number, withMs = false, sep = "."): string {
  const s = Math.max(0, sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  if (withMs) return `${pad(h)}:${pad(m)}:${pad(ss)}${sep}${pad(ms, 3)}`;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

export function toTxt(segs: Segment[], timestamps: boolean): string {
  if (!timestamps) return toParagraphs(segs).join("\n\n");
  return segs.map((s) => `[${fmtTime(s.start)}] ${s.text}`).join("\n");
}

export function toSrt(segs: Segment[]): string {
  return segs
    .map((s, i) => `${i + 1}\n${fmtTime(s.start, true, ",")} --> ${fmtTime(s.end, true, ",")}\n${s.text}\n`)
    .join("\n");
}

export function toVtt(segs: Segment[]): string {
  return "WEBVTT\n\n" + segs.map((s) => `${fmtTime(s.start, true)} --> ${fmtTime(s.end, true)}\n${s.text}\n`).join("\n");
}

export function toParagraphs(segs: Segment[]): string[] {
  const paras: string[] = [];
  let cur = "";
  let count = 0;
  for (const s of segs) {
    cur += (cur ? " " : "") + s.text.trim();
    count++;
    if ((count >= 6 && /[.!?…]$/.test(s.text.trim())) || cur.length > 700) {
      paras.push(cur);
      cur = "";
      count = 0;
    }
  }
  if (cur) paras.push(cur);
  return paras;
}

export function wordCount(segs: Segment[]): number {
  return segs.reduce((n, s) => n + (s.text.trim() ? s.text.trim().split(/\s+/).length : 0), 0);
}

export const LANG_NAMES: Record<string, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  ar: "العربية",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  hi: "हिन्दी",
};

export function langName(code?: string | null): string {
  if (!code) return "Rilevata automaticamente";
  const base = code.split(/[-_]/)[0].toLowerCase();
  return LANG_NAMES[base] ?? code.toUpperCase();
}
