import { randomBytes } from "node:crypto";
import type { Transcript } from "@/db/schema";

export function newId(): string {
  return randomBytes(6).toString("base64url");
}

export function publicTranscript(t: Transcript) {
  const { mediaPath: _m, meta, ...rest } = t;
  void _m;
  return {
    ...rest,
    videoId: (meta?.videoId as string | undefined) ?? null,
    hasMedia: t.platform !== "upload" || Boolean(t.mediaPath),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export type PublicTranscript = ReturnType<typeof publicTranscript>;
