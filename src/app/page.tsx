import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import TranscribeForm from "@/components/TranscribeForm";
import PlatformIcon from "@/components/PlatformIcon";
import { PLATFORMS, platformName } from "@/lib/platform";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "⚡", title: "Trascrizione in secondi", text: "Usa i sottotitoli nativi quando esistono e l'AI Whisper quando mancano. Risultati immediati anche su video lunghi." },
  { icon: "🇮🇹", title: "Italiano & English", text: "Traduci l'intera trascrizione in italiano o inglese con un clic, mantenendo i timestamp sincronizzati." },
  { icon: "🌍", title: "Oltre 1000 siti", text: "YouTube, TikTok, Instagram, Facebook, X, Twitch, Vimeo, Reddit e centinaia di altre piattaforme video." },
  { icon: "🎯", title: "Timestamp cliccabili", text: "Clicca su una frase per saltare al punto esatto del video. Il testo scorre in sincronia con la riproduzione." },
  { icon: "📦", title: "Export professionale", text: "Scarica in TXT, SRT, VTT, Word (.doc), JSON o stampa in PDF. Pronto per sottotitoli, blog e montaggio." },
  { icon: "🔒", title: "Privacy by design", text: "I file caricati possono essere trascritti interamente nel tuo browser: l'audio non lascia mai il tuo dispositivo." },
  { icon: "🔎", title: "Ricerca nel testo", text: "Trova parole chiave all'istante con evidenziazione e contatore dei risultati." },
  { icon: "🗂️", title: "Cronologia & condivisione", text: "Tutte le trascrizioni salvate, ricercabili e condivisibili con un link pubblico." },
];

const FAQ = [
  ["Quali piattaforme sono supportate?", "Praticamente tutte: YouTube (anche Shorts e live), TikTok, Instagram Reels, Facebook, X/Twitter, Twitch (VOD e clip), Vimeo, Reddit, Dailymotion, LinkedIn e oltre mille siti. Puoi anche caricare file audio/video dal tuo computer."],
  ["Come funziona la trascrizione?", "Prima cerchiamo i sottotitoli originali del video (il metodo più veloce e preciso). Se non esistono, estraiamo l'audio e lo trascriviamo con Whisper, il modello di riconoscimento vocale di OpenAI, sul server o direttamente nel tuo browser."],
  ["Posso tradurre in italiano un video in inglese (e viceversa)?", "Sì. Ogni trascrizione può essere tradotta in italiano o in inglese mantenendo i timestamp, e puoi passare dall'originale alla traduzione in qualsiasi momento."],
  ["In quali formati posso esportare?", "TXT (con o senza timestamp), SRT e VTT per i sottotitoli, documento Word, JSON per sviluppatori e PDF tramite stampa."],
  ["Quanto è precisa la trascrizione?", "Con i sottotitoli originali la precisione è massima. Con l'AI si supera normalmente il 90–95% su audio chiaro; puoi scegliere il modello 'Preciso' per risultati migliori."],
  ["È gratuito?", "Sì, puoi trascrivere senza registrazione. La trascrizione nel browser non ha limiti di utilizzo."],
];

export default async function HomePage() {
  const recent = await db
    .select({
      id: transcripts.id,
      title: transcripts.title,
      platform: transcripts.platform,
      thumbnail: transcripts.thumbnail,
      duration: transcripts.duration,
      createdAt: transcripts.createdAt,
    })
    .from(transcripts)
    .where(eq(transcripts.status, "done"))
    .orderBy(desc(transcripts.createdAt))
    .limit(6);

  return (
    <div className="overflow-hidden">
      {/* HERO */}
      <section id="start" className="relative">
        <div className="bg-grid absolute inset-0" />
        <div className="glow -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 bg-violet-600/25" />
        <div className="glow top-40 -right-40 h-[400px] w-[400px] bg-cyan-500/15" />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Nuovo · Whisper AI direttamente nel browser
          </div>
          <h1 className="font-display mt-6 text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[1.02] tracking-tight">
            Trascrivi qualsiasi video
            <br />
            <span className="text-gradient">in italiano e in inglese</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Incolla un link da YouTube, TikTok, Instagram, Facebook, X o Twitch e ottieni in pochi secondi una trascrizione
            precisa, con timestamp, traduzione ed export in SRT, VTT, Word.
          </p>
          <div className="mx-auto mt-10 max-w-3xl text-left">
            <TranscribeForm />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span>✓ Nessuna registrazione</span>
            <span>✓ 99+ lingue riconosciute</span>
            <span>✓ Export SRT / VTT / Word</span>
            <span>✓ Traduzione IT ⇄ EN</span>
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section id="piattaforme" className="relative border-y border-white/5 bg-white/[0.015] py-10">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Funziona con tutte le piattaforme</p>
        <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4">
          {PLATFORMS.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
              <PlatformIcon id={p.id} size={18} />
              {p.name}
            </div>
          ))}
          <div className="rounded-full border border-dashed border-white/10 px-4 py-2 text-sm text-zinc-500">+1000 siti</div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-16 sm:px-6 md:grid-cols-4">
        {[
          ["1000+", "piattaforme supportate"],
          ["99", "lingue riconosciute"],
          ["~95%", "precisione AI"],
          ["6", "formati di export"],
        ].map(([n, l]) => (
          <div key={l} className="glass rounded-2xl p-6 text-center">
            <div className="font-display text-gradient text-4xl font-semibold">{n}</div>
            <div className="mt-1 text-sm text-zinc-400">{l}</div>
          </div>
        ))}
      </section>

      {/* FEATURES */}
      <section id="funzionalita" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-violet-400">Funzionalità</p>
          <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight">Tutto ciò che serve a creator, giornalisti e aziende</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass group rounded-2xl p-6 transition hover:-translate-y-1 hover:border-violet-400/30">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-xl">{f.icon}</div>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS + MOCK */}
      <section id="come-funziona" className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-cyan-400">Come funziona</p>
          <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight">Dal link al testo in 3 passaggi</h2>
          <ol className="mt-10 space-y-8">
            {[
              ["Incolla il link", "Copia l'URL del video da qualsiasi piattaforma e incollalo nel campo in alto. Oppure carica un file."],
              ["L'AI trascrive", "Recuperiamo i sottotitoli o trascriviamo l'audio con Whisper, riconoscendo automaticamente la lingua."],
              ["Traduci ed esporta", "Passa da italiano a inglese, cerca nel testo, modifica ed esporta in SRT, VTT, TXT o Word."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-5">
                <span className="font-display grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-gradient">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-white">{t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative">
          <div className="glow inset-10 bg-indigo-600/20" />
          <div className="glass floaty relative rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlatformIcon id="youtube" />
                <span className="text-sm font-medium">Intervista esclusiva — Ep. 12</span>
              </div>
              <div className="flex gap-1 rounded-lg bg-black/40 p-1 text-[11px]">
                <span className="rounded-md px-2 py-1 text-zinc-400">Originale</span>
                <span className="rounded-md bg-white/10 px-2 py-1 text-white">🇮🇹 Italiano</span>
                <span className="rounded-md px-2 py-1 text-zinc-400">🇬🇧 English</span>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["0:00", "Benvenuti a tutti, oggi parliamo di intelligenza artificiale.", false],
                ["0:07", "È una tecnologia che sta cambiando il modo in cui lavoriamo.", true],
                ["0:15", "Vediamo insieme tre esempi concreti e molto pratici.", false],
                ["0:22", "Il primo riguarda la trascrizione automatica dei video.", false],
              ].map(([t, x, active]) => (
                <div key={t as string} className={`flex gap-3 rounded-xl p-2.5 ${active ? "bg-violet-500/15 ring-1 ring-violet-400/30" : ""}`}>
                  <span className="font-mono text-xs text-violet-300">{t}</span>
                  <span className={active ? "text-white" : "text-zinc-400"}>{x}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              {["SRT", "VTT", "TXT", "DOC"].map((f) => (
                <span key={f} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">⬇ {f}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RECENT */}
      {recent.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold">Trascrizioni recenti</h2>
            <Link href="/history" className="text-sm text-violet-300 hover:text-violet-200">Vedi tutte →</Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <Link key={r.id} href={`/t/${r.id}`} className="glass group flex gap-4 rounded-2xl p-3 transition hover:border-violet-400/30">
                <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-violet-900/40 to-cyan-900/30">
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="grid h-full place-items-center"><PlatformIcon id={r.platform} size={28} /></div>
                  )}
                  {r.duration ? (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 text-[10px] font-medium">{fmtTime(r.duration)}</span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-white">{r.title}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                    <PlatformIcon id={r.platform} size={12} /> {platformName(r.platform)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-center text-4xl font-semibold tracking-tight">Domande frequenti</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="glass group rounded-2xl p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-white">
                {q}
                <span className="text-xl text-zinc-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/30 via-indigo-600/20 to-cyan-500/20 p-10 text-center sm:p-14">
          <div className="bg-grid absolute inset-0 opacity-50" />
          <h2 className="font-display relative text-3xl font-semibold sm:text-4xl">Pronto a trasformare i video in testo?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-zinc-300">Gratis, senza registrazione. Incolla un link e guarda la magia.</p>
          <Link href="#start" className="relative mt-8 inline-block rounded-2xl bg-white px-7 py-3.5 font-semibold text-zinc-900 transition hover:bg-zinc-200">
            Inizia a trascrivere
          </Link>
        </div>
      </section>
    </div>
  );
}
