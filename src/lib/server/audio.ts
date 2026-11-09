import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { timeout: 600_000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).split("\n").filter(Boolean).pop() || "ffmpeg fallito"));
      else resolve();
    });
  });
}

function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/**
 * Converte l'audio in 16 kHz mono (formato nativo di Whisper) per ridurre la dimensione
 * e migliorare la precisione. Se il risultato supera 24 MB, abbassa il bitrate;
 * se ancora troppo grande, spezza in chunk di ~10 minuti con offset temporali.
 */
export async function prepareAudio(inputPath: string): Promise<{ file: string; offset: number }[]> {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const out16 = path.join(dir, `${base}.norm.mp3`);

  // 1) normalizzazione 16k mono, 64 kbps
  await runFfmpeg(["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "64k", out16]);
  let target = out16;
  let bitrate = 64;

  if (fileSize(target) > 24 * 1024 * 1024) {
    const out32 = path.join(dir, `${base}.norm32.mp3`);
    await runFfmpeg(["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", out32]);
    target = out32;
    bitrate = 32;
    try {
      fs.unlinkSync(out16);
    } catch {}
  }

  if (fileSize(target) <= 24 * 1024 * 1024) {
    // pulizia del file originale per risparmiare spazio
    try {
      if (path.resolve(target) !== path.resolve(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    return [{ file: target, offset: 0 }];
  }

  // 2) chunking: spezza in segmenti di 600s
  const chunksDir = path.join(dir, `${base}_chunks`);
  fs.mkdirSync(chunksDir, { recursive: true });
  await runFfmpeg([
    "-y",
    "-i",
    target,
    "-f",
    "segment",
    "-segment_time",
    "600",
    "-c",
    "copy",
    path.join(chunksDir, "chunk_%03d.mp3"),
  ]);
  try {
    fs.unlinkSync(target);
  } catch {}

  const files = fs
    .readdirSync(chunksDir)
    .filter((f) => f.endsWith(".mp3"))
    .sort()
    .map((f) => path.join(chunksDir, f));

  const out: { file: string; offset: number }[] = [];
  let off = 0;
  for (const f of files) {
    out.push({ file: f, offset: off });
    // durata approssimata: dimensione / bitrate (fallback 600s se ultimo)
    off += 600;
  }
  // ricalcola offset precisi usando ffprobe se disponibile
  try {
    const { execFileSync } = await import("node:child_process");
    const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
    let acc = 0;
    const precise: { file: string; offset: number }[] = [];
    for (const c of out) {
      precise.push({ file: c.file, offset: acc });
      try {
        const o = execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", c.file], { encoding: "utf8" });
        acc += parseFloat(o.trim()) || 600;
      } catch {
        acc += 600;
      }
    }
    return precise;
  } catch {
    return out;
  }
}