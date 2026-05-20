/**
 * Kampagne: "Was Ihre Website wirklich tut"
 *
 * Positionierung: RealSync zeigt NICHT was in der Datenschutzerklaerung
 * steht — sondern was die Website und KI-Systeme technisch tatsaechlich tun.
 *
 * Diese Datei ist Single Source of Truth fuer Kampagnen-Metadaten:
 * Ziele, Timeline, Channel-Mix, KPIs. Content-Assets liegen unter
 * src/marketing/content/*. Posting-Pipelines (sobald gebaut) lesen
 * von hier.
 */

import type { CTAKey, Channel } from '../types';

export interface CampaignGoal {
  metric: string;
  target: number;
  horizonDays: number;
  /** Letzter validierter Stand — manuell gepflegt; KEIN Live-Telemetrie-Mock. */
  measuredAt: string | null;
  measured: number | null;
}

export interface ChannelPlan {
  channel: Channel;
  cadence: string;
  primaryCta: CTAKey;
  notes: string;
}

export interface Campaign {
  id: string;
  name: string;
  positioning: string;
  startDate: string;
  durationDays: number;
  primaryCta: CTAKey;
  goals: CampaignGoal[];
  channelMix: ChannelPlan[];
  /** Was wir bewusst NICHT versprechen — schuetzt vor Drift im Copy. */
  guardrails: string[];
}

export const GOVERNANCE_RUNTIME_LAUNCH: Campaign = {
  id: 'governance-runtime-launch-2026',
  name: 'Was Ihre Website wirklich tut',
  positioning:
    'RealSync zeigt nicht, was in Ihrer Datenschutzerklärung steht. ' +
    'RealSync zeigt, was Ihre Website und KI-Systeme technisch tatsächlich tun — ' +
    'mit Rule-ID, Zeitpunkt, Quelle, Hash und Risiko.',
  startDate: '2026-05-19',
  durationDays: 90,
  primaryCta: 'free_audit',
  goals: [
    { metric: '1.000 Free Audits',          target: 1000, horizonDays: 90, measuredAt: null, measured: null },
    { metric: '100 Trial-Aktivierungen',    target: 100,  horizonDays: 90, measuredAt: null, measured: null },
    { metric: '20 zahlende Accounts',       target: 20,   horizonDays: 90, measuredAt: null, measured: null },
    { metric: '3 Agentur-/DSB-Partner',     target: 3,    horizonDays: 90, measuredAt: null, measured: null },
  ],
  channelMix: [
    {
      channel: 'linkedin',
      cadence: 'täglich (5×/Woche)',
      primaryCta: 'free_audit',
      notes: 'Founder-Learnings, echte Findings, AI-Act/DSGVO-Risiken. ' +
             'Maximum 1 Hashtag-Block am Ende, niemals im Body.',
    },
    {
      channel: 'youtube_shorts',
      cadence: '3×/Woche',
      primaryCta: 'free_audit',
      notes: 'Format „Website in 30 Sekunden geprüft". Echter Scan, ' +
             'echtes Finding, klare Conclusion. Keine Stock-Footage.',
    },
    {
      channel: 'cold_email',
      cadence: '20 personalisierte Mails / Woche',
      primaryCta: 'partners',
      notes: 'Ziel: DSBs + Agenturen. Erste Mail liefert Wert (1 Finding ' +
             'aus der Website des Empfängers), erst die 2. Mail enthält den CTA.',
    },
    {
      channel: 'seo_landing',
      cadence: '1 neue Landing-Page / Woche',
      primaryCta: 'free_audit',
      notes: 'Keyword-getriebene Doorways: „AI Act Website Check", ' +
             '„Cookie Banner ohne Reject Button", „DSGVO Audit für Agenturen".',
    },
    {
      channel: 'newsletter',
      cadence: 'wöchentlich (Freitag 10:00)',
      primaryCta: 'free_audit',
      notes: 'Format: 1 Markt-Trigger + 1 echtes Finding der Woche + 1 Fix.',
    },
  ],
  guardrails: [
    'Keine Bußgeld-Drohungen („sonst kostet das X € Bußgeld") — Fear-Sells.',
    'Keine 100 %-Rechtssicherheits-Versprechen — niemand kann das seriös.',
    'Keine „Live"-Behauptungen für Features, die nicht produktiv sind.',
    'Kein Anwalts-Ersatz-Wording — RealSync ergänzt Human Review, ersetzt ihn nicht.',
    'Keine erfundenen Kundenzahlen oder Logos.',
    'Echte Findings nur mit Zustimmung des betroffenen Unternehmens — sonst anonymisiert.',
  ],
};

export const ALL_CAMPAIGNS: Campaign[] = [
  GOVERNANCE_RUNTIME_LAUNCH,
];
