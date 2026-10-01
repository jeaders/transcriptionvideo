import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: "Trascrivo — Trascrizione video AI in italiano e inglese",
  description:
    "Trascrivi e traduci in italiano e inglese qualsiasi video: YouTube, TikTok, Instagram, Facebook, X, Twitch e altro. Esporta in TXT, SRT, VTT, Word.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="min-h-screen bg-[#07070c] font-sans text-zinc-100 antialiased selection:bg-violet-500/40">
        <Header />
        <main className="relative">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
