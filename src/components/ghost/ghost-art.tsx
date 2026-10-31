import { useId } from "react";

/**
 * Original ghost silhouette (Design §7): pale, translucent, slightly asymmetric, soft irregular hem,
 * restrained face, violet rim light. Pure SVG so it never fails to load and doubles as the static fallback.
 */
export function GhostArt({ size = 120, eyesShift = 0, className, blink = 1 }: { size?: number; eyesShift?: number; className?: string; blink?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size * 1.17} viewBox="0 0 120 140" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="#f2eefc" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#d9d1f2" stopOpacity="0.75" />
          <stop offset="1" stopColor="#b9a5ff" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* body: wider on the left, hem irregular */}
      <path
        d="M58 9C32 9 19 29 19 54v57c0 7 4 11 9 7 4-4 8-5 12 1 3 5 8 7 12 1 4-6 9-7 13 0 4 6 10 6 14-1 3-5 8-6 12 0 4 5 9 3 9-4V53C100 29 86 9 58 9Z"
        fill={`url(#body-${id})`}
        stroke="#b9a5ff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {/* uneven arm stub */}
      <path d="M100 74c7 2 11 8 9 13-1 3-5 3-9 0" fill="none" stroke="#b9a5ff" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
      {/* face */}
      <g fill="#1d1a2b" className="ghost-eyes">
        <ellipse cx={44 + eyesShift} cy="52" rx="4.2" ry={5.4 * blink} />
        <ellipse cx={70 + eyesShift} cy="54" rx="3.6" ry={4.8 * blink} />
      </g>
      <path d="M52 71c4 3 10 3 14 0" fill="none" stroke="#1d1a2b" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}
