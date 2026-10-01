import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BIN_DIR = path.join(os.tmpdir(), "vt-bin");
const LOCAL_BIN = path.join(BIN_DIR, "yt-dlp");
export const MEDIA_DIR = path.join(os.tmpdir(), "vt-media");

let binPromise: Promise<string> | null = null;

function which(cmd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("sh", ["-c", `command -v ${cmd}`], (err, stdout) => resolve(err ? null : stdout.trim() || null));
  });
}

async function download(): Promise<string> {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const res = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux", { redirect: "follow" });
  if (!res.ok) throw new Error(`Impossibile scaricare yt-dlp (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = LOCAL_BIN + ".part";
  fs.writeFileSync(tmp, buf);
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, LOCAL_BIN);
  return LOCAL_BIN;
}

export function getYtDlp(): Promise<string> {
  if (!binPromise) {
    binPromise = (async () => {
      if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) return process.env.YTDLP_PATH;
      if (fs.existsSync(LOCAL_BIN)) return LOCAL_BIN;
      const sys = await which("yt-dlp");
      if (sys) return sys;
      return download();
    })().catch((e) => {
      binPromise = null;
      throw e;
    });
  }
  return binPromise;
}

function run(args: string[], timeoutMs = 180_000): Promise<string> {
  return getYtDlp().then(
    (bin) =>
      new Promise((resolve, reject) => {
        const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
          p.kill("SIGKILL");
          reject(new Error("Timeout durante l'estrazione del video"));
        }, timeoutMs);
        p.stdout.on("data", (d) => (out += d));
        p.stderr.on("data", (d) => (err += d));
        p.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        p.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) resolve(out);
          else {
            const line = err.split("\n").reverse().find((l) => l.includes("ERROR")) ?? err.trim().split("\n").pop() ?? "";
            reject(new Error(line.replace(/^ERROR:\s*/, "").slice(0, 400) || `yt-dlp exit ${code}`));
          }
        });
      }),
  );
}

export type SubTrack = { ext: string; url: string; name?: string };
export type YtInfo = {
  id?: string;
  title?: string;
  fulltitle?: string;
  description?: string;
  uploader?: string;
  channel?: string;
  creator?: string;
  thumbnail?: string;
  duration?: number;
  language?: string;
  subtitles?: Record<string, SubTrack[]>;
  automatic_captions?: Record<string, SubTrack[]>;
  _type?: string;
  entries?: YtInfo[];
};

export async function getInfo(url: string): Promise<YtInfo> {
  const out = await run(["-J", "--no-warnings", "--no-playlist", "--playlist-items", "1", url], 120_000);
  let info = JSON.parse(out) as YtInfo;
  if (info._type === "playlist" && info.entries?.length) info = info.entries[0];
  return info;
}

/** Downloads audio (or smallest video with audio) and returns local path */
export async function downloadAudio(url: string, id: string, maxMb = 0): Promise<string> {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const existing = fs.readdirSync(MEDIA_DIR).find((f) => f.startsWith(id + ".") && !f.endsWith(".part"));
  if (existing) return path.join(MEDIA_DIR, existing);
  const size = maxMb ? `[filesize<${maxMb}M]` : "";
  const format = [
    `bestaudio[ext=m4a]${size}`,
    `bestaudio[ext=mp3]${size}`,
    `bestaudio${size}`,
    `worst[acodec!=none][vcodec!=none]`,
    `best[height<=480]`,
    `best`,
  ].join("/");
  await run(["--no-warnings", "--no-playlist", "-f", format, "-o", path.join(MEDIA_DIR, `${id}.%(ext)s`), url], 600_000);
  const file = fs.readdirSync(MEDIA_DIR).find((f) => f.startsWith(id + ".") && !f.endsWith(".part"));
  if (!file) throw new Error("Download dell'audio non riuscito");
  return path.join(MEDIA_DIR, file);
}
