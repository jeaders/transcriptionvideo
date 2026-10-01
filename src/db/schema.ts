import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type Segment = { start: number; end: number; text: string };

export const transcripts = pgTable("transcripts", {
  id: text("id").primaryKey(),
  url: text("url"),
  platform: text("platform").notNull().default("web"),
  title: text("title").notNull().default("Video senza titolo"),
  author: text("author"),
  thumbnail: text("thumbnail"),
  duration: integer("duration"),
  sourceLang: text("source_lang"),
  status: text("status").notNull().default("processing"),
  method: text("method"),
  segments: jsonb("segments").$type<Segment[]>().notNull().default([]),
  translations: jsonb("translations").$type<Record<string, Segment[]>>().notNull().default({}),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  error: text("error"),
  mediaPath: text("media_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Transcript = typeof transcripts.$inferSelect;
