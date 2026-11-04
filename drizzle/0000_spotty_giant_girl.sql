CREATE TABLE "transcripts" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text,
	"platform" text DEFAULT 'web' NOT NULL,
	"title" text DEFAULT 'Video senza titolo' NOT NULL,
	"author" text,
	"thumbnail" text,
	"duration" integer,
	"source_lang" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"method" text,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"translations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"media_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
