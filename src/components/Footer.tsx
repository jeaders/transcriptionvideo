import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="no-print border-t border-white/5 bg-black/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-display text-lg font-semibold">Trascrivo</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
            Trascrizioni video con intelligenza artificiale, in italiano e in inglese. Da qualsiasi piattaforma, in pochi secondi.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Prodotto</h4>
          <ul className="mt-4 space-y-2 text-sm text-zinc-400">
            <li><Link href="/#start" className="hover:text-white">Trascrivi un video</Link></li>
            <li><Link href="/history" className="hover:text-white">Cronologia</Link></li>
            <li><Link href="/#funzionalita" className="hover:text-white">Funzionalità</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Supporto</h4>
          <ul className="mt-4 space-y-2 text-sm text-zinc-400">
            <li><Link href="/#faq" className="hover:text-white">Domande frequenti</Link></li>
            <li><Link href="/#come-funziona" className="hover:text-white">Come funziona</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Trascrivo. Usa il servizio nel rispetto del diritto d&apos;autore e dei termini delle piattaforme.
      </div>
    </footer>
  );
}
