"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import PlatformIcon from "@/components/PlatformIcon";

type YTPlayer = { getCurrentTime(): number; seekTo(s: number, a: boolean): void; playVideo(): void; destroy(): void };
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<YTNamespace> | null = null;
function loadYT(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT!);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return ytPromise;
}

export type PlayerProps = {
  id: string;
  platform: string;
  videoId: string | null;
  url: string | null;
  thumbnail: string | null;
  hasMedia: boolean;
  localSrc?: string | null;
  onTime: (t: number) => void;
  seekRef: MutableRefObject<(t: number) => void>;
};

export default function Player(p: PlayerProps) {
  const ytRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [loadMedia, setLoadMedia] = useState(Boolean(p.localSrc));
  const [mediaErr, setMediaErr] = useState(false);
  const { onTime, seekRef } = p;

  useEffect(() => {
    if (p.localSrc) setLoadMedia(true);
  }, [p.localSrc]);

  // YouTube
  useEffect(() => {
    if (!p.videoId || !ytRef.current) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const host = document.createElement("div");
    ytRef.current.innerHTML = "";
    ytRef.current.appendChild(host);
    loadYT().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(host, {
        videoId: p.videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      });
      seekRef.current = (t) => {
        try {
          player?.seekTo(t, true);
          player?.playVideo();
        } catch {}
      };
      timer = setInterval(() => {
        try {
          const t = player?.getCurrentTime?.();
          if (typeof t === "number") onTime(t);
        } catch {}
      }, 250);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy();
      } catch {}
    };
  }, [p.videoId, onTime, seekRef]);

  // HTML media
  useEffect(() => {
    if (p.videoId) return;
    seekRef.current = (t) => {
      const m = mediaRef.current;
      if (!m) {
        setLoadMedia(true);
        return;
      }
      m.currentTime = t;
      m.play().catch(() => {});
    };
  }, [p.videoId, seekRef, loadMedia]);

  if (p.videoId) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black [&_iframe]:h-full [&_iframe]:w-full">
        <div ref={ytRef} className="h-full w-full" />
      </div>
    );
  }

  const src = p.localSrc ?? (p.hasMedia ? `/api/media/${p.id}` : null);

  if (loadMedia && src && !mediaErr) {
    return (
      <video
        ref={mediaRef}
        src={src}
        controls
        playsInline
        poster={p.thumbnail ?? undefined}
        onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
        onError={() => setMediaErr(true)}
        className="aspect-video w-full rounded-2xl bg-black object-contain"
      />
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950 via-zinc-900 to-cyan-950">
      {p.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      )}
      <div className="absolute inset-0 grid place-items-center bg-black/30">
        <div className="flex flex-col items-center gap-3 text-center">
          {src && !mediaErr ? (
            <button
              onClick={() => setLoadMedia(true)}
              className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-2xl text-zinc-900 shadow-2xl transition hover:scale-105"
              title="Carica il player"
            >
              ▶
            </button>
          ) : (
            <PlatformIcon id={p.platform} size={44} />
          )}
          {mediaErr && <p className="text-xs text-zinc-300">Impossibile riprodurre il media qui.</p>}
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="rounded-lg bg-black/60 px-3 py-1.5 text-xs text-zinc-200 hover:bg-black/80">
              Apri il video originale ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
