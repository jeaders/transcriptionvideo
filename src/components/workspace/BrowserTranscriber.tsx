"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicTranscript } from "@/lib/server/util";
import { fmtTime, type Segment } from "@/lib/format";
import { autoStart, loadPrefs, pendingFiles, savePrefs, type Prefs } from "@/lib/client/store";
import { decodeAudio, fetchWithProgress, guessLang, MODELS, transcribeInBrowser, type Progress, type WhisperModel } from "@/lib/client/whisper";

export default function BrowserTranscriber({
  t,
  onDone,
  onLocalFile,
}: {
  t: PublicTranscript;
  onDone: (t: PublicTranscript) => void;
  onLocalFile: (f: File) => void;
}) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const started = useRef(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    const f = pendingFiles.get(t.id);
    if (f) setFile(f);
  }, [t.id]);

  const start = useCallback(
    async (fileOverride?: File) => {
      if (!prefs) return;
      setRunning(true);
      setError(null);
      try {
        const src = fileOverride ?? file;
        let buf: ArrayBuffer;
        if (src) {
          setProgress({ stage: "download-media", pct: 100 });
          buf = await src.arrayBuffer();
        } else if (t.platform === "upload") {
          throw new Error("Seleziona di nuovo il file da trascrivere");
        } else {
          setProgress({ stage: "download-media" });
          buf = await fetchWithProgress(`/api/media/${t.id}`, (pct, loaded) => setProgress({ stage: "download-media", pct, loaded }));
        }
        setProgress({ stage: "decode" });
        const { audio } = await decodeAudio(buf);
        const hint = prefs.language !== "auto" ? prefs.language : t.sourceLang ?? undefined;
        const res = await transcribeInBrowser(audio, { model: prefs.model, language: hint, preferGpu: prefs.gpu }, setProgress);
        if (!res.segments.length) throw new Error("Nessun parlato rilevato nel video");
        const lang = hint ?? guessLang(res.segments.map((s) => s.text).join(" "));
        const r = await fetch(`/api/transcripts/${t.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: res.segments, sourceLang: lang, method: "whisper-browser", target: prefs.target }),
        });
        if (!r.ok) throw new Error("Salvataggio non riuscito");
        onDone((await r.json()) as PublicTranscript);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore durante la trascrizione");
        setRunning(false);
      }
    },
    [prefs, file, t.id, t.platform, t.sourceLang, onDone],
  );

  useEffect(() => {
    if (!prefs || started.current) return;
    if (autoStart.has(t.id) && (t.platform !== "upload" || file)) {
      started.current = true;
      autoStart.delete(t.id);
      start();
    }
  }, [prefs, t.id, t.platform, file, start]);

  const upd = (p: Partial<Prefs>) => {
    if (!prefs) return;
    const n = { ...prefs, ...p };
    setPrefs(n);
    savePrefs(n);
  };

  const partial: Segment[] = progress?.stage === "transcribe" ? progress.partial : [];
  const steps = [
    { key: "download-media", label: t.platform === "upload" ? "Lettura file" : "Estrazione audio" },
    { key: "decode", label: "Decodifica" },
    { key: "load-model", label: "Caricamento AI" },
    { key: "transcribe", label: "Trascrizione" },
  ];
  const curIdx = progress ? steps.findIndex((s) => s.key === progress.stage) : -1;
  const pct =
    progress?.stage === "transcribe" || progress?.stage === "load-model"
      ? progress.pct
      : progress?.stage === "download-media"
        ? progress.pct
        : undefined;

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 text-2xl">🧠</div>
        <div>
          <h3 className="font-display text-xl font-semibold">Trascrizione AI nel tuo browser</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Questo video non ha sottotitoli. Lo trascriviamo con Whisper direttamente sul tuo dispositivo: gratis, privato e senza limiti.
          </p>
        </div>
      </div>

      {!running && prefs && (
        <div className="mt-6 space-y-4">
          {t.platform === "upload" && (
            <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/10 p-5 text-center text-sm text-zinc-300 hover:border-white/20">
              <input
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    pendingFiles.set(t.id, f);
                    onLocalFile(f);
                  }
                }}
              />
              {file ? `📄 ${file.name}` : "Seleziona il file audio/video da trascrivere"}
            </label>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(MODELS) as WhisperModel[]).map((m) => (
              <button
                key={m}
                onClick={() => upd({ model: m })}
                className={`rounded-2xl border p-3 text-left transition ${
                  prefs.model === m ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 hover:border-white/20"
                }`}
              >
                <p className="text-sm font-semibold text-white">{MODELS[m].label}</p>
                <p className="text-xs text-zinc-400">Whisper {m} · {MODELS[m].size}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select
              value={prefs.language}
              onChange={(e) => upd({ language: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            >
              <option value="auto" className="bg-zinc-900">Lingua: automatica</option>
              <option value="it" className="bg-zinc-900">Lingua: Italiano</option>
              <option value="en" className="bg-zinc-900">Lingua: English</option>
              <option value="es" className="bg-zinc-900">Lingua: Español</option>
              <option value="fr" className="bg-zinc-900">Lingua: Français</option>
              <option value="de" className="bg-zinc-900">Lingua: Deutsch</option>
            </select>
            <label className="flex items-center gap-2 text-zinc-400">
              <input type="checkbox" checked={prefs.gpu} onChange={(e) => upd({ gpu: e.target.checked })} className="accent-violet-500" /> WebGPU
            </label>
            <button
              onClick={() => start()}
              disabled={t.platform === "upload" && !file}
              className="btn-primary ml-auto rounded-xl px-5 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              Avvia trascrizione
            </button>
          </div>
          <p className="text-xs text-zinc-500">Il modello viene scaricato una sola volta e memorizzato nella cache del browser.</p>
        </div>
      )}

      {running && (
        <div className="mt-6">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((s, i) => (
              <div key={s.key} className="text-center">
                <div className={`h-1.5 rounded-full ${i < curIdx ? "bg-emerald-400" : i === curIdx ? "bg-violet-400 animate-pulse" : "bg-white/10"}`} />
                <p className={`mt-2 text-[11px] ${i <= curIdx ? "text-zinc-200" : "text-zinc-500"}`}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between text-sm">
            <span className="text-zinc-300">
              {progress?.stage === "download-media" &&
                (progress.loaded ? `Download audio… ${(progress.loaded / 1024 / 1024).toFixed(1)} MB` : "Estrazione dell'audio dal video… (può richiedere qualche secondo)")}
              {progress?.stage === "decode" && "Decodifica dell'audio…"}
              {progress?.stage === "load-model" && "Download del modello AI…"}
              {progress?.stage === "transcribe" && `Trascrizione in corso · ${progress.device === "webgpu" ? "GPU" : "CPU"}`}
            </span>
            {pct !== undefined && <span className="font-mono text-violet-300">{pct}%</span>}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all ${pct === undefined ? "shimmer w-full" : ""}`}
              style={pct !== undefined ? { width: `${pct}%` } : undefined}
            />
          </div>
          {partial.length > 0 && (
            <div className="scroll-thin mt-5 max-h-64 space-y-1.5 overflow-y-auto rounded-2xl bg-black/30 p-4 text-sm">
              {partial.slice(-30).map((s, i) => (
                <p key={i} className="text-zinc-300">
                  <span className="mr-2 font-mono text-xs text-violet-300">{fmtTime(s.start)}</span>
                  {s.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          {!running && (
            <button onClick={() => start()} className="ml-3 underline">
              Riprova
            </button>
          )}
        </div>
      )}
    </div>
  );
}
