"use client";

import type { Segment } from "@/lib/format";

export type WhisperModel = "tiny" | "base" | "small";
export const MODELS: Record<WhisperModel, { id: string; label: string; size: string }> = {
  tiny: { id: "onnx-community/whisper-tiny", label: "Veloce", size: "~40 MB" },
  base: { id: "onnx-community/whisper-base", label: "Bilanciato", size: "~80 MB" },
  small: { id: "onnx-community/whisper-small", label: "Preciso", size: "~250 MB" },
};

export type Progress =
  | { stage: "download-media"; pct?: number; loaded?: number }
  | { stage: "decode" }
  | { stage: "load-model"; pct: number; file?: string }
  | { stage: "transcribe"; pct: number; device: string; partial: Segment[] };

const WORKER_SRC = `
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
env.allowLocalModels = false;
try { env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/"; } catch {}
let asr = null, key = null;
async function load(model, device) {
  if (asr && key === model + device) return;
  const files = {};
  asr = await pipeline("automatic-speech-recognition", model, {
    device,
    dtype: device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
    progress_callback: (p) => {
      if (p.status === "progress" && p.total) {
        files[p.file] = [p.loaded, p.total];
        let l = 0, t = 0;
        for (const k in files) { l += files[k][0]; t += files[k][1]; }
        self.postMessage({ type: "load", pct: Math.round((l / t) * 100), file: p.file });
      }
    },
  });
  key = model + device;
}
self.onmessage = async (e) => {
  const { audio, model, language, preferGpu } = e.data;
  try {
    let device = "wasm";
    if (preferGpu && self.navigator && self.navigator.gpu) {
      try { const a = await self.navigator.gpu.requestAdapter(); if (a) device = "webgpu"; } catch {}
    }
    try { await load(model, device); }
    catch (err) { if (device === "webgpu") { device = "wasm"; await load(model, device); } else throw err; }
    const SR = 16000, WIN = 30 * SR;
    const total = Math.max(1, Math.ceil(audio.length / WIN));
    const out = [];
    for (let i = 0; i < total; i++) {
      const chunk = audio.subarray(i * WIN, Math.min(audio.length, (i + 1) * WIN));
      const offset = i * 30;
      const chunkLen = chunk.length / SR;
      if (chunkLen < 0.3) break;
      const opts = { return_timestamps: true, task: "transcribe" };
      if (language && language !== "auto") opts.language = language;
      const r = await asr(chunk, opts);
      const parts = r.chunks && r.chunks.length ? r.chunks : [{ timestamp: [0, chunkLen], text: r.text }];
      for (const c of parts) {
        const text = (c.text || "").trim();
        if (!text || /^\\[.*\\]$/.test(text) && text.length < 20 && /music|musica|silence/i.test(text)) continue;
        const s = (c.timestamp && c.timestamp[0] != null ? c.timestamp[0] : 0) + offset;
        const en = (c.timestamp && c.timestamp[1] != null ? c.timestamp[1] : chunkLen) + offset;
        out.push({ start: s, end: Math.max(en, s), text });
      }
      self.postMessage({ type: "progress", pct: Math.round(((i + 1) / total) * 100), device, partial: out });
    }
    self.postMessage({ type: "done", segments: out, device });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err && err.message || err) });
  }
};
`;

let worker: Worker | null = null;
function getWorker(): Worker {
  if (!worker) {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    worker = new Worker(url, { type: "module" });
  }
  return worker;
}

export async function fetchWithProgress(url: string, onPct: (pct?: number, loaded?: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ?? `Download media non riuscito (${res.status})`);
  }
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onPct(total ? Math.round((loaded / total) * 100) : undefined, loaded);
  }
  const buf = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  return buf.buffer;
}

export async function decodeAudio(buf: ArrayBuffer): Promise<{ audio: Float32Array; duration: number }> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    let audio: Float32Array;
    if (decoded.numberOfChannels > 1) {
      const a = decoded.getChannelData(0);
      const b = decoded.getChannelData(1);
      audio = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) audio[i] = (a[i] + b[i]) / 2;
    } else audio = new Float32Array(decoded.getChannelData(0));
    return { audio, duration: decoded.duration };
  } catch {
    throw new Error("Impossibile decodificare l'audio di questo file nel browser");
  } finally {
    ctx.close().catch(() => {});
  }
}

export function transcribeInBrowser(
  audio: Float32Array,
  opts: { model: WhisperModel; language?: string; preferGpu?: boolean },
  onProgress: (p: Progress) => void,
): Promise<{ segments: Segment[]; device: string }> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent) => {
      const d = e.data as { type: string; pct?: number; file?: string; device?: string; partial?: Segment[]; segments?: Segment[]; message?: string };
      if (d.type === "load") onProgress({ stage: "load-model", pct: d.pct ?? 0, file: d.file });
      else if (d.type === "progress") onProgress({ stage: "transcribe", pct: d.pct ?? 0, device: d.device ?? "wasm", partial: d.partial ?? [] });
      else if (d.type === "done") resolve({ segments: d.segments ?? [], device: d.device ?? "wasm" });
      else if (d.type === "error") reject(new Error(d.message));
    };
    w.onerror = (e) => reject(new Error(e.message || "Errore nel worker di trascrizione"));
    w.postMessage({ audio, model: MODELS[opts.model].id, language: opts.language, preferGpu: opts.preferGpu ?? true }, [audio.buffer]);
  });
}

/** Heuristic it/en language guess for browser transcripts */
export function guessLang(text: string): string | undefined {
  const words = text.toLowerCase().split(/[^a-zàèéìòù']+/);
  const it = new Set(["il", "che", "di", "e", "la", "per", "non", "un", "sono", "è", "una", "questo", "anche", "come", "ma", "gli", "della", "perché", "cosa", "molto"]);
  const en = new Set(["the", "and", "is", "to", "of", "you", "that", "it", "in", "this", "what", "with", "are", "for", "was", "have", "not", "but", "so", "just"]);
  let a = 0, b = 0;
  for (const w of words) {
    if (it.has(w)) a++;
    if (en.has(w)) b++;
  }
  if (a + b < 5) return undefined;
  if (a > b * 1.5) return "it";
  if (b > a * 1.5) return "en";
  return undefined;
}
