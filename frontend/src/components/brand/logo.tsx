/**
 * ShikshaSetu mark — a bridge arc connecting two sides (setu = "bridge" in
 * Hindi), with a small voice/sound accent underneath, since the product's
 * whole point is live spoken translation across languages. Redrawn as a
 * plain vector (not a flattened photo/AI-art PNG) so it's crisp at every
 * size, from a 24px sidebar icon up to a hero wallpaper watermark.
 */

import { useId } from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

/** The full badge: gradient rounded-square tile + white mark. Use this
 * wherever the logo stands alone (sidebar, header, login branding, favicon). */
export function Logo({ size = 40, className }: LogoProps) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ShikshaSetu"
    >
      <defs>
        <linearGradient id={gradientId} x1="10" y1="0" x2="190" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0A56A9" />
          <stop offset="0.62" stopColor="#0F7A8F" />
          <stop offset="1" stopColor="#15A363" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="46" fill={`url(#${gradientId})`} />
      <path
        d="M 38 130 Q 100 56 162 130"
        stroke="#fff"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <circle cx="38" cy="130" r="12" fill="#fff" />
      <circle cx="162" cy="130" r="12" fill="#fff" />
      <g fill="#fff">
        <rect x="91" y="141" width="7" height="17" rx="3.5" />
        <rect x="103" y="131" width="7" height="37" rx="3.5" />
        <rect x="115" y="141" width="7" height="17" rx="3.5" />
      </g>
    </svg>
  );
}

/** Line-only mark, no badge/background — for placing directly on a colored
 * surface (e.g. a low-opacity watermark on the login wallpaper) where a
 * second background tile would look like a sticker instead of blending in. */
export function LogoMark({ size = 200, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 186"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M 38 130 Q 100 56 162 130"
        stroke="currentColor"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <circle cx="38" cy="130" r="12" fill="currentColor" />
      <circle cx="162" cy="130" r="12" fill="currentColor" />
      <g fill="currentColor">
        <rect x="91" y="141" width="7" height="17" rx="3.5" />
        <rect x="103" y="131" width="7" height="37" rx="3.5" />
        <rect x="115" y="141" width="7" height="17" rx="3.5" />
      </g>
    </svg>
  );
}
