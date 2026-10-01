export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
        <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
      </svg>
    </span>
  );
}
