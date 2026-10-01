import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import Workspace from "@/components/workspace/Workspace";
import { publicTranscript } from "@/lib/server/util";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [t] = await db.select({ title: transcripts.title }).from(transcripts).where(eq(transcripts.id, id));
  return { title: t ? `${t.title} — Trascrizione | Trascrivo` : "Trascrizione | Trascrivo" };
}

export default async function TranscriptPage({ params }: Props) {
  const { id } = await params;
  const [t] = await db.select().from(transcripts).where(eq(transcripts.id, id));
  if (!t) notFound();
  return <Workspace key={t.id} initial={publicTranscript(t)} />;
}
