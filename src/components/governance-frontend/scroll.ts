import type { MouseEvent } from 'react';

/** Höhe der fixierten Kopfzeile — wird beim Smooth-Scroll abgezogen. */
export const SCROLL_OFFSET = 88;

/** Liefert das tatsächlich vorhandene Ziel — sonst den Fallback. */
export function resolveHref(href: string, fallback?: string): string {
  if (!href.startsWith('#')) return href;
  if (typeof document === 'undefined') return href;
  return document.querySelector(href) ? href : (fallback ?? href);
}

/**
 * Smooth-Scroll mit Header-Offset für Anker-Links.
 * Externe Links und Routen werden unverändert durchgereicht.
 */
export function handleAnchorClick(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  fallback?: string
) {
  const target = resolveHref(href, fallback);
  if (!target.startsWith('#')) return;

  const el = document.querySelector(target);
  if (!el) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;

  window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
  history.replaceState(null, '', target);
}
