/**
 * Landing v4 — redaktionelle Inhalte (Claude-Design „realsync-landing-v4“).
 *
 * H1 bleibt textgleich mit v2 (`LV2_H1_*`), damit SEO, E2E (FE-001) und
 * JSON-LD dieselbe Quelle nutzen. Die Pipeline entspricht den vier
 * Lifecycle-Stufen der Landing (`LV2_LIFECYCLE`).
 */
import { LV2_LIFECYCLE } from '../v2/landing-v2-content';

export { LV2_BRAND as LV4_BRAND, LV2_H1_GOLD as LV4_H1_GOLD } from '../v2/landing-v2-content';

/** H1 in zwei Zeilen gesetzt; zusammen ergibt sich `LV2_H1_SILVER`. */
export const LV4_H1_LINES = ['AI Compliance', 'Operations OS'] as const;

/**
 * Statusleiste. Bewusst kein „operational“: die Leiste ist statisch und an
 * keinen Health-Check gebunden — keine erfundenen Live-Zustände.
 */
export const LV4_STATUS = ['EU Governance Runtime', 'Hosting in Frankfurt'] as const;

export const LV4_PIPELINE = LV2_LIFECYCLE.map((s) => s.name);

export const LV4_SUBLINE = [
  'Runtime governance for regulated AI systems.',
  'Continuous evidence. EU-native by design.',
] as const;

export const LV4_NAV = [
  { label: 'Produkt', href: '#produkt' },
  { label: 'Evidence', href: '#evidence' },
  { label: 'Preise', href: '#preise' },
] as const;
