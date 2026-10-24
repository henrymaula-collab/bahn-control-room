// A handful of lucide outline glyphs (ISC licence), drawn at Bahn's 1.75 stroke.
// Every glyph sits next to a word or is a standard control; none is decoration.

type IconName = "chevron-down" | "chevron-left" | "chevron-right" | "check" | "play" | "pause" | "arrow-right"

const PATHS: Record<IconName, React.ReactNode> = {
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  play: <path d="M6 4.5v15a.75.75 0 0 0 1.14.64l12.2-7.5a.75.75 0 0 0 0-1.28L7.14 3.86A.75.75 0 0 0 6 4.5Z" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const filled = name === "play" || name === "pause"
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
