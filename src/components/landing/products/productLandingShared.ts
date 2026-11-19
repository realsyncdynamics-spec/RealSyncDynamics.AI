/**
 * Gemeinsame Grundlage der vier Produkt-Landingpages (Entwurf, Stand 19.11.2026).
 *
 * Website-Architektur laut Owner (19.11.2026): eine Unternehmensstartseite auf
 * `/` plus vier eigenständige Produktseiten unter der bestehenden Domain.
 * Gebaut ist bisher nur `/ki-bots` (erster Entwurf, noindex). Die übrigen
 * Einträge zeigen bis zu ihrer eigenen Seite auf die vorhandenen Funktionsrouten;
 * `plannedPath` ist nur die geplante Marketing-Adresse und wird nicht verlinkt.
 *
 * Quellen wie auf der Startseite v3:
 *   - Status  → src/product/implementation-status.ts (über registryStatus)
 *   - Preise  → shared/pricing.ts (über planCards / config/pricing.ts)
 *   - Rechtliches, Firma, Steuerhinweis → landingV3Data.ts
 */
import { tierById } from '../../../config/pricing';
import type { ChannelId } from '@/shared/pricing';
import { STATUS_TEXT, registryStatus } from '../v3/landingV3Data';

export interface ProductPage {
  key: 'ki-bots' | 'app-builder' | 'governance-os' | 'claude-code-optimizer';
  name: string;
  /** Geplante Marketing-Adresse. */
  plannedPath: string;
  /** Heute verlinktes Ziel: eigene Landingpage, falls gebaut, sonst die Funktionsroute. */
  href: string;
  /** true, sobald die Landingpage unter `plannedPath` existiert. */
  built: boolean;
}

export const PRODUCT_PAGES: readonly ProductPage[] = [
  { key: 'ki-bots', name: 'KI-Bots & Voice-Agenten', plannedPath: '/ki-bots', href: '/ki-bots', built: true },
  { key: 'app-builder', name: 'App Builder', plannedPath: '/app-builder', href: '/build', built: false },
  { key: 'governance-os', name: 'Governance OS', plannedPath: '/governance-os', href: '/governance-runtime', built: false },
  {
    key: 'claude-code-optimizer',
    name: 'Claude Code Optimizer',
    plannedPath: '/claude-code-optimizer',
    href: '/claude-code-optimizer',
    built: false,
  },
];

/** Statuslabel aus der Registry; `null`, wenn es keinen Eintrag gibt (dann kein Badge). */
export function statusLabel(registryId: string): string | null {
  const s = registryStatus(registryId);
  return s ? STATUS_TEXT[s] : null;
}

const CHANNEL_LABEL: Record<ChannelId, string> = {
  website: 'Website-Chat',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  slack: 'Slack',
  teams: 'Teams',
  email: 'E-Mail',
  voice: 'Telefon',
};

/**
 * Kanäle eines Tarifs aus `shared/pricing.ts`. Telefon trägt den Registry-Status
 * von `voice-telephony`, solange die Telefonie nicht live ist.
 */
export function planChannels(planId: 'starter' | 'growth' | 'agency' | 'enterprise'): string[] {
  const plan = tierById(planId)?.plan;
  if (!plan) return [];
  const telephony = registryStatus('voice-telephony');
  return plan.channels.map((c) =>
    c === 'voice' && telephony && telephony !== 'live'
      ? `${CHANNEL_LABEL.voice} (${STATUS_TEXT[telephony]})`
      : CHANNEL_LABEL[c],
  );
}
