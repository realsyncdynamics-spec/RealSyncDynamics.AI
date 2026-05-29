/**
 * Severity-Farbpalette — eine Quelle, von ScanDetailView, ScansListView,
 * AuditResultView und allen weiteren Finding-Surfaces geteilt.
 *
 * Strategie nach Tonality-Review:
 *   CRITICAL → rot   (einziger Voll-Alarm)
 *   HIGH     → orange
 *   MEDIUM   → gelb
 *   LOW      → titanium-neutral
 *   INFO     → blau-grau
 *
 * Vorher: alles in der oberen Hälfte war rot/amber/sky — visuell wirkte
 * jeder Befund wie Panik. Diese Palette skaliert: CRITICAL bleibt
 * unverwechselbar rot, die übrigen sind deutlich unterscheidbar, aber
 * niemand fühlt sich angeschrien.
 *
 * Tailwind-Klassen, nicht Hex — die Plattform nutzt ausschließlich
 * `bg-*-500/10`, `border-*-500/40`, `text-*-200` Patterns.
 */
import type { FindingSeverity } from '../../types/governance/finding';

export interface SeverityPalette {
  /** Vollständige Pill-Klasse (border + bg + text). */
  pill:    string;
  /** Nur die Text-Klasse (für Inline-Counter, freistehende Numerik). */
  text:    string;
  /** Akzent-Border alleine (z. B. Card-Linke-Kante). */
  border:  string;
  /** Deutsches Label (lowercase, für Pill-Render). */
  label:   string;
}

export const SEVERITY_PALETTE: Record<FindingSeverity, SeverityPalette> = {
  critical: {
    pill:   'border-rose-500/40 bg-rose-500/10 text-rose-200',
    text:   'text-rose-300',
    border: 'border-rose-500/40',
    label:  'kritisch',
  },
  high: {
    pill:   'border-orange-500/40 bg-orange-500/10 text-orange-200',
    text:   'text-orange-300',
    border: 'border-orange-500/40',
    label:  'hoch',
  },
  medium: {
    pill:   'border-amber-500/40 bg-amber-500/10 text-amber-200',
    text:   'text-amber-300',
    border: 'border-amber-500/40',
    label:  'mittel',
  },
  low: {
    pill:   'border-titanium-700 bg-titanium-800/30 text-titanium-300',
    text:   'text-titanium-300',
    border: 'border-titanium-700',
    label:  'niedrig',
  },
  info: {
    pill:   'border-sky-500/30 bg-sky-500/10 text-sky-200',
    text:   'text-sky-300',
    border: 'border-sky-500/30',
    label:  'hinweis',
  },
};

/** Convenience: Pill-Klasse pro Severity. */
export function severityPillClass(s: FindingSeverity): string {
  return SEVERITY_PALETTE[s].pill;
}

/** Convenience: deutsches Label pro Severity. */
export function severityLabel(s: FindingSeverity): string {
  return SEVERITY_PALETTE[s].label;
}
