"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PlatformIcon from "./PlatformIcon";
import { detectPlatform, platformName } from "@/lib/platform";
import { autoStart, DEFAULT_PREFS, loadPrefs, pendingFiles, savePrefs, type Prefs } from "@/lib/client/store";
import { MODELS, type WhisperModel } from "@/lib/client/whisper";

const SPOKEN = [
  ["auto", "Rileva automaticamente"],
  ["it", "Italiano"],
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
];

export default function TranscribeForm() {
  const router = useRouter();
  const [tab, setTab] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [serverWhisper, setServerWhisper] = useState(false);
  const [showOpts, setShowOpts] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { serverWhisper: boolean }) => setServerWhisper(d.serverWhisper))
      .catch(() => {});
  }, []);

  const upd = (p: Partial<Prefs>) => {
    const n = { ...prefs, ...p };
    setPrefs(n);
    savePrefs(n);
  };

  const platform = url.trim() ? detectPlatform(/^https?:\/\//.test(url.trim()) ? url.trim() : `https://${url.trim()}`) : null;

  async function submitLink() {
    if (!url.trim()) return setError("Incolla il link di un video");
    const r = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, language: prefs.language, target: prefs.target }),
    });
    const d = (await r.json()) as { id?: string; error?: string };
    if (!r.ok || !d.id) throw new Error(d.error ?? "Errore");
    autoStart.add(d.id);
    router.push(`/t/${d.id}`);
  }

  async function submitFile() {
    if (!file) return setError("Seleziona un file audio o video");
    if (serverWhisper && file.size <= 25 * 1024 * 1024) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("language", prefs.language);
      fd.append("target", prefs.target);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = (await r.json()) as { id?: string; error?: string };
      if (r.ok && d.id) return router.push(`/t/${d.id}`);
    }
    const r = await fetch("/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name }),
    });
    const d = (await r.json()) as { id?: string; error?: string };
    if (!r.ok || !d.id) throw new Error(d.error ?? "Errore");
    pendingFiles.set(d.id, file);
    autoStart.add(d.id);
    router.push(`/t/${d.id}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "link") await submitLink();
      else await submitFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
      setBusy(false);
    }
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setUrl(t.trim());
    } catch {}
  }

  const selectCls =
    "w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/60";

  return (
    <form onSubmit={onSubmit} className="glass relative rounded-3xl p-2 shadow-2xl shadow-indigo-950/50">
      <div className="flex gap-1 p-1">
        {(["link", "file"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            {t === "link" ? "🔗  Link video" : "📁  Carica file"}
          </button>
        ))}
      </div>

      <div className="p-2">
        {tab === "link" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                {platform ? <PlatformIcon id={platform} size={20} /> : <PlatformIcon id="web" size={20} />}
              </div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Incolla un link: YouTube, TikTok, Instagram, Facebook, X, Twitch…"
                className="h-14 w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-24 text-[15px] text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/10"
              />
              <button
                type="button"
                onClick={paste}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
              >
                Incolla
              </button>
            </div>
            <button
              disabled={busy}
              className="btn-primary h-14 rounded-2xl px-7 text-[15px] font-semibold text-white transition disabled:opacity-60"
            >
              {busy ? <Spinner label="Avvio…" /> : "Trascrivi ora →"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
                drag ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-black/30 hover:border-white/20"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div>
                  <p className="font-medium text-white">{file.name}</p>
                  <p className="mt-1 text-xs text-zinc-400">{(file.size / 1024 / 1024).toFixed(1)} MB · clicca per cambiare</p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl">⬆️</p>
                  <p className="mt-2 font-medium text-white">Trascina qui un file audio o video</p>
                  <p className="mt-1 text-xs text-zinc-400">MP4, MOV, MP3, M4A, WAV, WEBM · elaborato in modo privato</p>
                </div>
              )}
            </div>
            <button
              disabled={busy}
              className="btn-primary h-13 rounded-2xl px-7 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-60"
            >
              {busy ? <Spinner label="Caricamento…" /> : "Trascrivi file →"}
            </button>
          </div>
        )}

        {platform && tab === "link" && (
          <p className="mt-2 px-1 text-xs text-zinc-400">
            Piattaforma rilevata: <span className="font-medium text-zinc-200">{platformName(platform)}</span>
          </p>
        )}
        {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <button
          type="button"
          onClick={() => setShowOpts((s) => !s)}
          className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-zinc-400 hover:text-white"
        >
          ⚙️ Opzioni avanzate <span className={`transition ${showOpts ? "rotate-180" : ""}`}>▾</span>
          <span className="text-zinc-500">
            · {SPOKEN.find((s) => s[0] === prefs.language)?.[1]} → {prefs.target === "it" ? "Italiano" : prefs.target === "en" ? "English" : "nessuna traduzione"}
          </span>
        </button>

        {showOpts && (
          <div className="mt-3 grid gap-3 rounded-2xl border border-white/5 bg-black/20 p-3 sm:grid-cols-3">
            <label className="text-xs text-zinc-400">
              Lingua parlata nel video
              <select className={`${selectCls} mt-1.5`} value={prefs.language} onChange={(e) => upd({ language: e.target.value })}>
                {SPOKEN.map(([v, l]) => (
                  <option key={v} value={v} className="bg-zinc-900">{l}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Traduci automaticamente in
              <select className={`${selectCls} mt-1.5`} value={prefs.target} onChange={(e) => upd({ target: e.target.value })}>
                <option value="it" className="bg-zinc-900">🇮🇹 Italiano</option>
                <option value="en" className="bg-zinc-900">🇬🇧 English</option>
                <option value="none" className="bg-zinc-900">Nessuna traduzione</option>
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Modello AI {serverWhisper ? "(fallback browser)" : "(nel browser)"}
              <select className={`${selectCls} mt-1.5`} value={prefs.model} onChange={(e) => upd({ model: e.target.value as WhisperModel })}>
                {(Object.keys(MODELS) as WhisperModel[]).map((m) => (
                  <option key={m} value={m} className="bg-zinc-900">
                    Whisper {m} — {MODELS[m].label} ({MODELS[m].size})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400 sm:col-span-3">
              <input type="checkbox" checked={prefs.gpu} onChange={(e) => upd({ gpu: e.target.checked })} className="accent-violet-500" />
              Usa l&apos;accelerazione GPU (WebGPU) quando disponibile
            </label>
          </div>
        )}
      </div>
    </form>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      {label}
    </span>
  );
}
