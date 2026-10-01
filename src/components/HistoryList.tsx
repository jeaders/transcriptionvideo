"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PlatformIcon from "./PlatformIcon";
import { fmtTime, langName } from "@/lib/format";
import { PLATFORMS, platformName } from "@/lib/platform";

type Item = {
  id: string;
  title: string;
  platform: string;
  thumbnail: string | null;
  duration: number | null;
  status: string;
  sourceLang: string | null;
  author: string | null;
  createdAt: string;
  words: number;
  langs: string[];
};

const STATUS: Record<string, [string, string]> = {
  done: ["Completata", "bg-emerald-500/15 text-emerald-300"],
  processing: ["In corso", "bg-amber-500/15 text-amber-300"],
  transcribing: ["In corso", "bg-amber-500/15 text-amber-300"],
  awaiting_client: ["Da avviare", "bg-sky-500/15 text-sky-300"],
  error: ["Errore", "bg-red-500/15 text-red-300"],
};

export default function HistoryList() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");

  useEffect(() => {
    const ctrl = new AbortController();
    const tm = setTimeout(() => {
      fetch(`/api/transcripts?limit=200${q ? `&q=${encodeURIComponent(q)}` : ""}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => r.json())
        .then((d: { items: Item[] }) => setItems(d.items))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(tm);
      ctrl.abort();
    };
  }, [q]);

  async function remove(id: string) {
    if (!confirm("Eliminare questa trascrizione?")) return;
    await fetch(`/api/transcripts/${id}`, { method: "DELETE" });
    setItems((it) => it?.filter((x) => x.id !== id) ?? null);
  }

  const shown = (items ?? []).filter((i) => platform === "all" || i.platform === platform);
  const used = new Set((items ?? []).map((i) => i.platform));

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔎  Cerca per titolo, autore o link…"
          className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus:border-violet-400/50"
        />
        <Link href="/#start" className="btn-primary grid h-12 place-items-center rounded-2xl px-6 text-sm font-semibold text-white">
          + Nuova trascrizione
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {["all", ...PLATFORMS.map((p) => p.id), "upload", "web"]
          .filter((p) => p === "all" || used.has(p as never))
          .map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                platform === p ? "border-violet-400/50 bg-violet-500/15 text-white" : "border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              {p !== "all" && <PlatformIcon id={p} size={12} />}
              {p === "all" ? "Tutte" : platformName(p)}
            </button>
          ))}
      </div>

      {items === null ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-64 rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="glass mt-6 rounded-3xl p-12 text-center">
          <p className="text-4xl">🎬</p>
          <p className="mt-3 font-medium">Nessuna trascrizione trovata</p>
          <p className="mt-1 text-sm text-zinc-400">Incolla il link di un video per iniziare.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((i) => {
            const [label, cls] = STATUS[i.status] ?? [i.status, "bg-white/10"];
            return (
              <div key={i.id} className="glass group overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:border-violet-400/30">
                <Link href={`/t/${i.id}`} className="block">
                  <div className="relative aspect-video bg-gradient-to-br from-violet-900/40 via-zinc-900 to-cyan-900/30">
                    {i.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full place-items-center"><PlatformIcon id={i.platform} size={40} /></div>
                    )}
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur ${cls}`}>{label}</span>
                    {i.duration ? (
                      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium">{fmtTime(i.duration)}</span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 font-medium text-white">{i.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><PlatformIcon id={i.platform} size={12} /> {platformName(i.platform)}</span>
                      {i.words > 0 && <span>{Number(i.words).toLocaleString("it-IT")} parole</span>}
                      {i.sourceLang && <span>{langName(i.sourceLang)}</span>}
                      {i.langs?.map((l) => (
                        <span key={l} className="rounded bg-white/5 px-1.5 py-0.5 uppercase text-zinc-300">{l}</span>
                      ))}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center justify-between border-t border-white/5 px-4 py-2.5 text-xs text-zinc-500">
                  <span>{new Date(i.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  <button onClick={() => remove(i.id)} className="rounded-lg px-2 py-1 hover:bg-red-500/10 hover:text-red-300">Elimina</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
