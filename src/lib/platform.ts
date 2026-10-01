export type PlatformId =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "x"
  | "twitch"
  | "vimeo"
  | "reddit"
  | "dailymotion"
  | "linkedin"
  | "upload"
  | "web";

export const PLATFORMS: { id: PlatformId; name: string; color: string }[] = [
  { id: "youtube", name: "YouTube", color: "#FF0033" },
  { id: "tiktok", name: "TikTok", color: "#25F4EE" },
  { id: "instagram", name: "Instagram", color: "#E1306C" },
  { id: "facebook", name: "Facebook", color: "#1877F2" },
  { id: "x", name: "X / Twitter", color: "#FFFFFF" },
  { id: "twitch", name: "Twitch", color: "#9146FF" },
  { id: "vimeo", name: "Vimeo", color: "#1AB7EA" },
  { id: "reddit", name: "Reddit", color: "#FF4500" },
  { id: "dailymotion", name: "Dailymotion", color: "#0066DC" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
];

export function platformName(id: string): string {
  if (id === "upload") return "File caricato";
  if (id === "web") return "Web";
  return PLATFORMS.find((p) => p.id === id)?.name ?? id;
}

export function platformColor(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.color ?? "#8b5cf6";
}

export function detectPlatform(raw: string): PlatformId {
  let host = "";
  try {
    host = new URL(raw).hostname.replace(/^www\.|^m\./, "").toLowerCase();
  } catch {
    return "web";
  }
  if (/(^|\.)youtube\.com$|^youtu\.be$|youtube-nocookie\.com$/.test(host)) return "youtube";
  if (/tiktok\.com$/.test(host)) return "tiktok";
  if (/instagram\.com$/.test(host)) return "instagram";
  if (/facebook\.com$|fb\.watch$|fb\.com$/.test(host)) return "facebook";
  if (/(^|\.)x\.com$|twitter\.com$/.test(host)) return "x";
  if (/twitch\.tv$/.test(host)) return "twitch";
  if (/vimeo\.com$/.test(host)) return "vimeo";
  if (/reddit\.com$|redd\.it$/.test(host)) return "reddit";
  if (/dailymotion\.com$|dai\.ly$/.test(host)) return "dailymotion";
  if (/linkedin\.com$/.test(host)) return "linkedin";
  return "web";
}

export function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{11})/);
    if (m) return m[2];
  } catch {}
  return null;
}
