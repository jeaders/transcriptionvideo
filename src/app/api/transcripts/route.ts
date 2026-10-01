import { desc, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import { newId } from "@/lib/server/util";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);
  const rows = await db
    .select({
      id: transcripts.id,
      title: transcripts.title,
      platform: transcripts.platform,
      thumbnail: transcripts.thumbnail,
      duration: transcripts.duration,
      status: transcripts.status,
      sourceLang: transcripts.sourceLang,
      author: transcripts.author,
      url: transcripts.url,
      createdAt: transcripts.createdAt,
      words: sql<number>`coalesce((select sum(array_length(regexp_split_to_array(trim(e->>'text'), '\\s+'), 1)) from jsonb_array_elements(${transcripts.segments}) e), 0)`,
      langs: sql<string[]>`array(select jsonb_object_keys(${transcripts.translations}))`,
    })
    .from(transcripts)
    .where(q ? or(ilike(transcripts.title, `%${q}%`), ilike(transcripts.url, `%${q}%`), ilike(transcripts.author, `%${q}%`)) : undefined)
    .orderBy(desc(transcripts.createdAt))
    .limit(limit);
  return NextResponse.json({ items: rows });
}

/** Create a record for a local file upload that will be transcribed in the browser */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: string; duration?: number };
  const id = newId();
  await db.insert(transcripts).values({
    id,
    platform: "upload",
    title: (body.title || "File caricato").slice(0, 300),
    duration: body.duration ? Math.round(body.duration) : null,
    status: "awaiting_client",
  });
  return NextResponse.json({ id });
}
