/**
 * Öffentliche Plan-Texte für `/pricing` in DE/EN.
 *
 * Preise bleiben in `shared/pricing.ts` (SSoT). Hier nur Anzeige-Copy für
 * Tagline, CTA und die ersten Bullet-Punkte der Preiskarten — damit Nav und
 * Planbeschreibungen nach Sprachwechsel dieselbe Sprache haben.
 */
import type { Lang } from './handoff';

export type PricingPlanCopyId = 'free' | 'starter' | 'growth' | 'agency' | 'enterprise';

export type PricingPlanCopy = {
  tagline: string;
  ctaLabel: string;
  bullets: readonly string[];
};

const DE: Record<PricingPlanCopyId, PricingPlanCopy> = {
  free: {
    tagline: 'Sehen Sie in 90 Sekunden, wo Ihre Governance-Lücken liegen.',
    ctaLabel: 'Kostenlosen Audit starten',
    bullets: [
      'Runtime-Scan einer Domain mit Governance Score 0–100',
      'Top-3-Risiken mit Paragraphenbezug',
      'Kompakter PDF-Bericht',
      'Prüfpfad einsehbar (kein Export)',
      'DSGVO-Basisprüfung',
    ],
  },
  starter: {
    tagline: 'Ein nachweisbares Governance-Fundament, das jeden Prüfer überzeugt.',
    ctaLabel: '14 Tage kostenlos testen',
    bullets: [
      'Vollständiger DSGVO-Scan mit Paragraphenbezug',
      'Evidence Vault mit Hash-Chain-Verifizierung',
      'Audit-Export als PDF und JSON',
      'Lückenloser Prüfpfad über alle Läufe',
      'Policy Packs: DSGVO und EU AI Act',
    ],
  },
  growth: {
    tagline: 'KI-Governance, die sich selbst überwacht — statt einmal im Jahr geprüft zu werden.',
    ctaLabel: '14 Tage kostenlos testen',
    bullets: [
      'Alles aus Starter',
      'Evidence Vault mit Versionierung',
      'Erweiterter Evidence-Zugriff mit C2PA-Export',
      'Signierter Herkunftsnachweis',
      'Bis zu 12 Audit-Berichte pro Monat',
    ],
  },
  agency: {
    tagline: 'Für Agenturen und mehrere Kunden.',
    ctaLabel: 'Agency starten',
    bullets: [
      'Alles aus Growth',
      'Evidence Vault Advanced: unveränderliche Snapshots, Retention, Legal Hold',
      'Herkunftsnachweis mit Ed25519-Signatur und Chain-of-Custody',
      'White-Label-Berichte mit eigenem Logo',
      'Policy Packs: DSGVO, EU AI Act, ISO 27001, NIS2 (live); TISAX Roadmap',
    ],
  },
  enterprise: {
    tagline: 'Konzernweite Governance über aktive Policy Packs plus Framework-Roadmap — mit SLA und SSO.',
    ctaLabel: 'Enterprise anfragen',
    bullets: [
      'Alles aus Agency',
      'Audit Center Pro mit 200 Berichten pro Monat',
      'Evidence Vault Enterprise mit 200 GB Nachweisspeicher',
      'Policy Packs live: DSGVO, EU AI Act, ISO 27001, NIS2; TISAX/DORA Roadmap / auf Anfrage',
      'Erweiterte Analysen und Risk Scoring',
    ],
  },
};

const EN: Record<PricingPlanCopyId, PricingPlanCopy> = {
  free: {
    tagline: 'See where your governance gaps are in 90 seconds.',
    ctaLabel: 'Start free audit',
    bullets: [
      'Runtime scan of one domain with Governance Score 0–100',
      'Top-3 risks with legal references',
      'Compact PDF report',
      'Prüfpfad visible (no export)',
      'GDPR baseline check',
    ],
  },
  starter: {
    tagline: 'A verifiable governance foundation that stands up to any review.',
    ctaLabel: 'Start 14-day free trial',
    bullets: [
      'Full GDPR scan with legal references',
      'Evidence Vault with hash-chain verification',
      'Audit export as PDF and JSON',
      'Complete Prüfpfad across all runs',
      'Policy packs: GDPR and EU AI Act',
    ],
  },
  growth: {
    tagline: 'AI governance that monitors itself — instead of being reviewed once a year.',
    ctaLabel: 'Start 14-day free trial',
    bullets: [
      'Everything in Starter',
      'Evidence Vault with versioning',
      'Extended evidence access with C2PA export',
      'Signed Herkunftsnachweis',
      'Up to 12 audit reports per month',
    ],
  },
  agency: {
    tagline: 'For agencies and multiple clients.',
    ctaLabel: 'Start Agency',
    bullets: [
      'Everything in Growth',
      'Evidence Vault Advanced: immutable snapshots, retention, legal hold',
      'Herkunftsnachweis with Ed25519 signature and chain of custody',
      'White-label reports with your logo',
      'Policy packs: GDPR, EU AI Act, ISO 27001, NIS2 (live); TISAX roadmap',
    ],
  },
  enterprise: {
    tagline: 'Enterprise-wide governance via live policy packs plus framework roadmap — with SLA and SSO.',
    ctaLabel: 'Enterprise inquiry',
    bullets: [
      'Everything in Agency',
      'Audit Center Pro with 200 reports per month',
      'Evidence Vault Enterprise with 200 GB evidence storage',
      'Policy packs live: GDPR, EU AI Act, ISO 27001, NIS2; TISAX/DORA roadmap / on request',
      'Advanced analytics and risk scoring',
    ],
  },
};

const BY_LANG: Record<Lang, Record<PricingPlanCopyId, PricingPlanCopy>> = {
  de: DE,
  en: EN,
};

export function pricingPlanCopy(lang: Lang, id: string): PricingPlanCopy | null {
  if (id !== 'free' && id !== 'starter' && id !== 'growth' && id !== 'agency' && id !== 'enterprise') {
    return null;
  }
  return BY_LANG[lang][id];
}
