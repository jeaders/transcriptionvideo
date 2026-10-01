import type { Metadata } from "next";
import HistoryList from "@/components/HistoryList";

export const metadata: Metadata = { title: "Le mie trascrizioni | Trascrivo" };

export default function HistoryPage() {
  return (
    <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="glow -top-20 left-1/4 h-[300px] w-[600px] bg-violet-700/15" />
      <div className="relative">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Le mie trascrizioni</h1>
        <p className="mt-2 text-zinc-400">Cerca, riapri, esporta o elimina tutte le trascrizioni create.</p>
        <HistoryList />
      </div>
    </div>
  );
}
