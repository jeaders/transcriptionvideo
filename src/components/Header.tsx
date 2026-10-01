import Link from "next/link";
import Logo from "./Logo";

export default function Header() {
  return (
    <header className="no-print sticky top-0 z-50 border-b border-white/5 bg-[#07070c]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-semibold tracking-tight">Trascrivo</span>
          <span className="hidden rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 sm:inline">
            AI
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <Link href="/#piattaforme" className="transition hover:text-white">Piattaforme</Link>
          <Link href="/#funzionalita" className="transition hover:text-white">Funzionalità</Link>
          <Link href="/#come-funziona" className="transition hover:text-white">Come funziona</Link>
          <Link href="/#faq" className="transition hover:text-white">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/history"
            className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
          >
            Le mie trascrizioni
          </Link>
          <Link href="/#start" className="btn-primary hidden rounded-xl px-4 py-2 text-sm font-semibold text-white sm:inline-block">
            Inizia gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
