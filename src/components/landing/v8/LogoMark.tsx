import { useId } from 'react';

/**
 * Flaches Zeichen zum 3D-Logo: zwei verkettete Titanringe. Oben liegt der
 * linke Ring vorn, unten der rechte — wie im 3D-Modell. Für Kopfzeile und
 * als Ersatz, wenn WebGL fehlt.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const ti = `lv8-ti-${id}`;
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={ti} gradientUnits="userSpaceOnUse" x1="8" y1="14" x2="56" y2="50">
          <stop offset="0" stopColor="#f6f7f9" />
          <stop offset=".55" stopColor="#b6bbc3" />
          <stop offset="1" stopColor="#5d636c" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="32" r="14" fill="none" stroke={`url(#${ti})`} strokeWidth="4" />
      <circle cx="24" cy="32" r="14" fill="none" stroke={`url(#${ti})`} strokeWidth="4" />
      <path d="M35.21 45.16 A14 14 0 0 1 29.28 41" fill="none" stroke="var(--lv8-obsidian, #050608)" strokeWidth="8" />
      <path d="M36.4 45.5 A14 14 0 0 1 28.4 39.8" fill="none" stroke={`url(#${ti})`} strokeWidth="4" />
    </svg>
  );
}
