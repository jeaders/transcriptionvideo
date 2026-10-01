import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { transcripts, type Transcript } from "@/db/schema";
import Workspace from "@/components/workspace/Workspace";
import { publicTranscript } from "@/lib/server/util";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const [t] = await db.select({ title: transcripts.title }).from(transcripts).where(eq(transcripts.id, id));
    return { title: t ? `${t.title} — Trascrizione | Trascrivo` : "Trascrizione | Trascrivo" };
  } catch {
    return { title: "Trascrizione | Trascrivo" };
  }
}

export default async function TranscriptPage({ params }: Props) {
  let t: Transcript | undefined;
  try {
    const { id } = await params;
    [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  } catch {}
  if (!t) {
    notFound();
  }
  return <Workspace key={t.id} initial={publicTranscript(t)} />;
}
