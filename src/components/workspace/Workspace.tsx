"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PlatformIcon from "@/components/PlatformIcon";
import Player from "./Player";
import BrowserTranscriber from "./BrowserTranscriber";
import type { PublicTranscript } from "@/lib/server/util";
import { fmtTime, langName, toParagraphs, toSrt, toTxt, toVtt, wordCount, type Segment } from "@/lib/format";
import { platformName } from "@/lib/platform";
import { pendingFiles } from "@/lib/client/store";

const STOP = new Set(
  "il lo la i gli le un una uno di da in con su per tra fra e o ma che non è sono ho hai ha abbiamo del della dei delle al alla ai nel nella questo questa come anche più se ci si mi ti vi ne cosa perché quando molto poi così io tu lui lei noi voi loro era essere fare the a an and or but of to in on at for with is are was were be been it this that these those you i we they he she my your our their not do does did have has had so just what which who from as by if then than there here about into out up down can will would could should all very really like get got go going know think one yeah okay ok oh".split(
    " ",
  ),
);

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function safeName(s: string) {
  return s.replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 60) || "trascrizione";
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

export default function Workspace({ initial }: { initial: PublicTranscript }) {
  const router = useRouter();
  const [t, setT] = useState(initial);
  const [view, setView] = useState<string>("orig");
  const [loadingLang, setLoadingLang] = useState<string | null>(null);
  const [langError, setLangError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showTs, setShowTs] = useState(true);
  const [mode, setMode] = useState<"segments" | "paragraphs">("segments");
  const [follow, setFollow] = useState(true);
  const [time, setTime] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Segment[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const seekRef = useRef<(s: number) => void>(() => {});
  const listRef = useRef<HTMLDivElement>(null);
  const onTime = useCallback((s: number) => setTime(s), []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  // local file preview for uploads
  useEffect(() => {
    const f = pendingFiles.get(t.id);
    if (f) {
      const u = URL.createObjectURL(f);
      setLocalSrc(u);
      return () => URL.revokeObjectURL(u);
    }
  }, [t.id]);

  // polling while server works
  useEffect(() => {
    if (!["processing", "transcribing"].includes(t.status)) return;
    const iv = setInterval(async () => {
      const r = await fetch(`/api/transcripts/${t.id}`, { cache: "no-store" });
      if (r.ok) setT((await r.json()) as PublicTranscript);
    }, 1500);
    return () => clearInterval(iv);
  }, [t.status, t.id]);

  // default view: show the auto translation if it exists
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || t.status !== "done") return;
    const keys = Object.keys(t.translations ?? {});
    if (keys.length) {
      setView(keys[0]);
    }
    autoSelected.current = true;
  }, [t.status, t.translations]);

  const src = t.sourceLang?.split("-")[0];
  const segs: Segment[] = view === "orig" ? t.segments : (t.translations?.[view] ?? []);
  const active = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].start <= time + 0.15) idx = i;
      else break;
    }
    return idx;
  }, [segs, time]);

  useEffect(() => {
    if (!follow || active < 0 || !listRef.current || editing) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-i="${active}"]`);
    if (el) {
      const box = listRef.current;
      const top = el.offsetTop - box.offsetTop - box.clientHeight / 3;
      box.scrollTo({ top, behavior: "smooth" });
    }
  }, [active, follow, editing]);

  const matches = useMemo(() => (q ? segs.filter((s) => s.text.toLowerCase().includes(q.toLowerCase())).length : 0), [segs, q]);

  const keywords = useMemo(() => {
    const freq = new Map<string, number>();
    for (const s of t.segments)
      for (const w of s.text.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
        if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue;
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [t.segments]);

  async function selectLang(lang: string) {
    setLangError(null);
    if (lang === "orig" || t.translations?.[lang]?.length) return setView(lang);
    setLoadingLang(lang);
    try {
      const r = await fetch(`/api/transcripts/${t.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: lang }),
      });
      const d = (await r.json()) as { segments?: Segment[]; error?: string };
      if (!r.ok || !d.segments) throw new Error(d.error ?? "Traduzione non riuscita");
      setT((p) => ({ ...p, translations: { ...p.translations, [lang]: d.segments! } }));
      setView(lang);
    } catch (e) {
      setLangError(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoadingLang(null);
    }
  }

  const suffix = view === "orig" ? src ?? "orig" : view;
  const base = `${safeName(t.title)}_${suffix}`;
  function doExport(kind: string) {
    setExportOpen(false);
    if (kind === "txt") download(`${base}.txt`, toTxt(segs, false), "text/plain;charset=utf-8");
    if (kind === "txt-ts") download(`${base}.txt`, toTxt(segs, true), "text/plain;charset=utf-8");
    if (kind === "srt") download(`${base}.srt`, toSrt(segs), "application/x-subrip;charset=utf-8");
    if (kind === "vtt") download(`${base}.vtt`, toVtt(segs), "text/vtt;charset=utf-8");
    if (kind === "json")
      download(`${base}.json`, JSON.stringify({ title: t.title, url: t.url, language: suffix, segments: segs }, null, 2), "application/json");
    if (kind === "doc") {
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const html = `<html><head><meta charset="utf-8"><title>${esc(t.title)}</title></head><body style="font-family:Calibri,Arial"><h1>${esc(t.title)}</h1><p style="color:#666">${esc(t.url ?? "")}</p>${segs
        .map((s) => `<p>${showTs ? `<b style="color:#6d28d9">[${fmtTime(s.start)}]</b> ` : ""}${esc(s.text)}</p>`)
        .join("")}</body></html>`;
      download(`${base}.doc`, html, "application/msword");
    }
    if (kind === "pdf") setTimeout(() => window.print(), 50);
    if (kind !== "pdf") flash("Download avviato");
  }

  async function copyAll() {
    await navigator.clipboard.writeText(toTxt(segs, showTs));
    flash("Testo copiato negli appunti");
  }
  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    flash("Link copiato");
  }
  async function remove() {
    if (!confirm("Eliminare definitivamente questa trascrizione?")) return;
    await fetch(`/api/transcripts/${t.id}`, { method: "DELETE" });
    router.push("/history");
  }
  async function saveEdit() {
    const r = await fetch(`/api/transcripts/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments: draft, sourceLang: t.sourceLang, method: t.method }),
    });
    if (r.ok) {
      setT((await r.json()) as PublicTranscript);
      setEditing(false);
      setView("orig");
      flash("Modifiche salvate");
    }
  }
  async function retry() {
    if (!t.url) return;
    const r = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: t.url }),
    });
    const d = (await r.json()) as { id?: string };
    if (d.id) router.push(`/t/${d.id}`);
  }

  const words = wordCount(t.segments);
  const langTabs: { key: string; label: string }[] = [{ key: "orig", label: `Originale${src ? ` · ${langName(src)}` : ""}` }];
  if (src !== "it") langTabs.push({ key: "it", label: "🇮🇹 Italiano" });
  if (src !== "en") langTabs.push({ key: "en", label: "🇬🇧 English" });

  const methodLabel: Record<string, string> = {
    captions: "Sottotitoli originali",
    "auto-captions": "Sottotitoli automatici",
    "whisper-api": "Whisper AI (server)",
    "whisper-browser": "Whisper AI (browser)",
  };

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="glow -top-20 left-1/3 h-[300px] w-[600px] bg-violet-700/15" />

      {/* Title */}
      <div className="no-print relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/history" className="text-xs text-zinc-500 hover:text-zinc-300">← Le mie trascrizioni</Link>
          <h1 className="font-display mt-2 line-clamp-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
            <span className="flex items-center gap-1.5"><PlatformIcon id={t.platform} size={14} /> {platformName(t.platform)}</span>
            {t.author && <span>di {t.author}</span>}
            {t.duration ? <span>⏱ {fmtTime(t.duration)}</span> : null}
            <span>{new Date(t.createdAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={share} className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-zinc-300 hover:bg-white/5">🔗 Condividi</button>
          <button onClick={remove} className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-zinc-300 hover:border-red-500/40 hover:text-red-300">🗑</button>
        </div>
      </div>

      <div className="relative mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left column */}
        <div className="no-print space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Player
            id={t.id}
            platform={t.platform}
            videoId={t.videoId}
            url={t.url}
            thumbnail={t.thumbnail}
            hasMedia={t.hasMedia}
            localSrc={localSrc}
            onTime={onTime}
            seekRef={seekRef}
          />
          {t.status === "done" && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Parole", words.toLocaleString("it-IT")],
                  ["Lettura", `${Math.max(1, Math.round(words / 220))} min`],
                  ["Segmenti", String(t.segments.length)],
                  ["Lingua", langName(src)],
                ].map(([l, v]) => (
                  <div key={l} className="glass rounded-2xl p-3">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">{l}</p>
                    <p className="mt-1 truncate font-semibold text-white">{v}</p>
                  </div>
                ))}
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Metodo</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300">{methodLabel[t.method ?? ""] ?? t.method}</span>
                </div>
                {keywords.length > 0 && (
                  <>
                    <p className="mt-4 text-xs text-zinc-500">Parole chiave</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {keywords.map(([w, n]) => (
                        <button
                          key={w}
                          onClick={() => setQ(w)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 hover:border-violet-400/40 hover:text-white"
                        >
                          {w} <span className="text-zinc-500">{n}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="min-w-0">
          {(t.status === "processing" || t.status === "transcribing") && <ProcessingCard status={t.status} platform={t.platform} />}

          {t.status === "awaiting_client" && (
            <BrowserTranscriber
              t={t}
              onDone={(n) => setT(n)}
              onLocalFile={(f) => setLocalSrc(URL.createObjectURL(f))}
            />
          )}

          {t.status === "error" && (
            <div className="glass rounded-3xl border-red-500/20 p-6">
              <h3 className="font-display text-xl font-semibold text-red-300">Impossibile trascrivere questo video</h3>
              <p className="mt-2 text-sm text-zinc-400">{t.error}</p>
              <p className="mt-3 text-sm text-zinc-500">
                Il video potrebbe essere privato, protetto da login o rimosso. Prova a scaricarlo e caricare il file direttamente.
              </p>
              <div className="mt-5 flex gap-2">
                {t.url && <button onClick={retry} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold text-white">Riprova</button>}
                <Link href="/#start" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Carica un file</Link>
              </div>
            </div>
          )}

          {t.status === "done" && (
            <div className="glass overflow-hidden rounded-3xl">
              {/* Language tabs */}
              <div className="no-print flex flex-wrap items-center gap-2 border-b border-white/5 p-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-black/30 p-1">
                  {langTabs.map((l) => (
                    <button
                      key={l.key}
                      onClick={() => selectLang(l.key)}
                      disabled={editing}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        view === l.key ? "bg-white/10 text-white shadow" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {loadingLang === l.key ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Traduzione…
                        </span>
                      ) : (
                        l.label
                      )}
                    </button>
                  ))}
                </div>
                <div className="relative ml-auto">
                  <button
                    onClick={() => setExportOpen((o) => !o)}
                    className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  >
                    ⬇ Esporta
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
                      {[
                        ["txt", "📝 Testo (.txt)"],
                        ["txt-ts", "⏱ Testo con timestamp"],
                        ["srt", "🎬 Sottotitoli (.srt)"],
                        ["vtt", "🌐 WebVTT (.vtt)"],
                        ["doc", "📄 Word (.doc)"],
                        ["json", "🧩 JSON"],
                        ["pdf", "🖨 Stampa / PDF"],
                      ].map(([k, l]) => (
                        <button key={k} onClick={() => doExport(k)} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10">
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Toolbar */}
              <div className="no-print flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2.5">
                <div className="relative min-w-[180px] flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">🔎</span>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cerca nella trascrizione…"
                    className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-16 text-sm outline-none focus:border-violet-400/50"
                  />
                  {q && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{matches} risultati</span>}
                </div>
                <Toggle on={showTs} onClick={() => setShowTs((s) => !s)} label="Timestamp" />
                <Toggle on={mode === "paragraphs"} onClick={() => setMode((m) => (m === "segments" ? "paragraphs" : "segments"))} label="Paragrafi" />
                <Toggle on={follow} onClick={() => setFollow((f) => !f)} label="Segui video" />
                <button onClick={copyAll} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5">📋 Copia</button>
                {view === "orig" &&
                  (editing ? (
                    <>
                      <button onClick={saveEdit} className="rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300">✓ Salva</button>
                      <button onClick={() => setEditing(false)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400">Annulla</button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setDraft(t.segments.map((s) => ({ ...s })));
                        setEditing(true);
                        setMode("segments");
                      }}
                      className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      ✏️ Modifica
                    </button>
                  ))}
              </div>

              {langError && <p className="no-print mx-3 mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{langError}</p>}

              {/* Transcript */}
              <div ref={listRef} className="print-area scroll-thin max-h-[70vh] overflow-y-auto p-3 sm:p-4">
                <h2 className="hidden print:block print:text-2xl print:font-bold">{t.title}</h2>
                {editing ? (
                  <div className="space-y-2">
                    {draft.map((s, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="mt-2 w-14 shrink-0 font-mono text-xs text-violet-300">{fmtTime(s.start)}</span>
                        <textarea
                          value={s.text}
                          onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                          rows={Math.max(1, Math.ceil(s.text.length / 80))}
                          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-violet-400/50"
                        />
                      </div>
                    ))}
                  </div>
                ) : mode === "paragraphs" ? (
                  <div className="space-y-5 px-2 py-2 text-[16px] leading-8 text-zinc-200">
                    {toParagraphs(segs).map((p, i) => (
                      <p key={i}>{highlight(p, q)}</p>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {segs.map((s, i) => {
                      const isActive = i === active;
                      return (
                        <button
                          key={i}
                          data-i={i}
                          onClick={() => seekRef.current(s.start)}
                          className={`group flex w-full gap-4 rounded-xl px-3 py-2 text-left transition ${
                            isActive ? "bg-violet-500/15 ring-1 ring-violet-400/30" : "hover:bg-white/[0.04]"
                          }`}
                        >
                          {showTs && (
                            <span className={`mt-0.5 w-14 shrink-0 font-mono text-xs ${isActive ? "text-violet-200" : "text-violet-300/70 group-hover:text-violet-300"}`}>
                              {fmtTime(s.start)}
                            </span>
                          )}
                          <span className={`text-[15px] leading-relaxed ${isActive ? "text-white" : "text-zinc-300"}`}>{highlight(s.text, q)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="no-print fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900/95 px-4 py-2.5 text-sm text-white shadow-2xl">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
        on ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "border-white/10 text-zinc-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function ProcessingCard({ status, platform }: { status: string; platform: string }) {
  const steps =
    status === "transcribing"
      ? ["Link analizzato", "Audio estratto", "Trascrizione AI in corso"]
      : ["Analisi del link", platform === "youtube" ? "Ricerca sottotitoli" : "Estrazione metadati", "Preparazione trascrizione"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 2500);
    return () => clearInterval(iv);
  }, [steps.length]);
  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
        <h3 className="font-display text-xl font-semibold">Stiamo lavorando al tuo video…</h3>
      </div>
      <ol className="mt-6 space-y-3">
        {steps.map((s, idx) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                idx < i ? "bg-emerald-500/20 text-emerald-300" : idx === i ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-zinc-500"
              }`}
            >
              {idx < i ? "✓" : idx + 1}
            </span>
            <span className={idx <= i ? "text-zinc-200" : "text-zinc-500"}>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 space-y-2">
        {[90, 75, 85, 60].map((w, k) => (
          <div key={k} className="shimmer h-4 rounded-md" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
