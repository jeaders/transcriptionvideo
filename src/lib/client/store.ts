"use client";

import type { WhisperModel } from "./whisper";

export type Prefs = { language: string; target: string; model: WhisperModel; gpu: boolean };

export const DEFAULT_PREFS: Prefs = { language: "auto", target: "it", model: "base", gpu: true };

/** Files selected on the home page, kept in memory across client navigation */
export const pendingFiles = new Map<string, File>();
/** IDs that should auto-start browser transcription once */
export const autoStart = new Set<string>();

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem("trascrivo:prefs") ?? "{}") as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem("trascrivo:prefs", JSON.stringify(p));
  } catch {}
}
