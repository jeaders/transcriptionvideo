import { platformColor } from "@/lib/platform";

export default function PlatformIcon({ id, size = 20 }: { id: string; size?: number }) {
  const c = platformColor(id);
  const p = { width: size, height: size, viewBox: "0 0 24 24" };
  switch (id) {
    case "youtube":
      return (
        <svg {...p}><rect x="1.5" y="5" width="21" height="14" rx="4" fill={c} /><path d="M10 9l5 3-5 3z" fill="white" /></svg>
      );
    case "tiktok":
      return (
        <svg {...p} fill="none" strokeWidth="2.4" strokeLinecap="round">
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" stroke="#FE2C55" transform="translate(1 1)" />
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.5 2.5 4.5 5 4.8" stroke={c} />
        </svg>
      );
    case "instagram":
      return (
        <svg {...p} fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill={c} /></svg>
      );
    case "facebook":
      return (
        <svg {...p}><circle cx="12" cy="12" r="10" fill={c} /><path d="M13.2 20v-6h2l.3-2.4h-2.3v-1.5c0-.7.2-1.2 1.2-1.2h1.2V6.8c-.6-.1-1.3-.1-1.9-.1-1.8 0-3 1.1-3 3.1v1.8h-2V14h2v6z" fill="white" /></svg>
      );
    case "x":
      return (
        <svg {...p} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l16 16M20 4L4 20" /></svg>
      );
    case "twitch":
      return (
        <svg {...p}><path d="M4 3h17v11l-5 5h-4l-3 3H7v-3H3V6z" fill={c} /><path d="M11 7v5M16 7v5" stroke="white" strokeWidth="2" /></svg>
      );
    case "vimeo":
      return (
        <svg {...p} fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8c2-1.5 3-2 4-1s2 9 3.5 9S17 9 18 7s-2-3-4 0" /></svg>
      );
    case "reddit":
      return (
        <svg {...p}><circle cx="12" cy="13" r="8" fill={c} /><circle cx="9" cy="13" r="1.3" fill="white" /><circle cx="15" cy="13" r="1.3" fill="white" /><path d="M9 16.5c1.8 1 4.2 1 6 0" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
      );
    case "dailymotion":
      return (
        <svg {...p}><rect x="2" y="2" width="20" height="20" rx="5" fill={c} /><path d="M15 6v12h-3.5a4 4 0 1 1 0-8H15" stroke="white" strokeWidth="2" fill="none" /></svg>
      );
    case "linkedin":
      return (
        <svg {...p}><rect x="2" y="2" width="20" height="20" rx="4" fill={c} /><path d="M7 10v7M7 7v.01M11 17v-7M11 13c0-2 1.5-3 3-3s2.5 1 2.5 3v4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
      );
    case "upload":
      return (
        <svg {...p} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M10 13l2-2 2 2M12 11v6" /></svg>
      );
    default:
      return (
        <svg {...p} fill="none" stroke="#a78bfa" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></svg>
      );
  }
}
