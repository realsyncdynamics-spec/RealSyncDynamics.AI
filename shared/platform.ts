/**
 * Zielarchitektur der Experience-Ebene — ohne Preise.
 *
 * Preise, Limits und Entitlements stehen ausschließlich in `shared/pricing.ts`.
 * Diese Datei beschreibt CREATE / OPERATE / GOVERN / WORKSTORE für Landing,
 * Pricing-Erklärung und Claude-Code-Folgearbeitsstände.
 *
 * Keine Runtime-Imports. Läuft in Browser, Node, Vitest und Deno.
 */

export const PLATFORM_POSITIONING = 'AI Governance + AI Application OS';

export const PLATFORM_TAGLINE =
  'Bauen, betreiben und gouvernieren auf derselben Runtime.';

export const PLATFORM_FLOW = [
  'CREATE',
  'DEPLOY',
  'OPERATE',
  'GOVERN',
  'PROVE',
] as const;

export type PlatformLayerId = 'create' | 'operate' | 'govern' | 'workstore';

export interface PlatformLayer {
  id: PlatformLayerId;
  label: string;
  headline: string;
  summary: string;
  items: string[];
  status: 'live' | 'building';
}

export const PLATFORM_LAYERS: PlatformLayer[] = [
  {
    id: 'create',
    label: 'CREATE',
    headline: 'Website, App, Design',
    summary:
      'Landingpage- und Web-App-Builder plus Bild-/Design-System. Governance bleibt Fundament — das Frontend ist optional.',
    items: [
      'Landing Page Builder (SiteOS)',
      'Web App Builder',
      'Design- und Image-Engine',
      'Preview → Test → Deploy hinter dem Publish-Gate',
    ],
    status: 'building',
  },
  {
    id: 'operate',
    label: 'OPERATE',
    headline: 'Kanäle und Automationen',
    summary:
      'Website-Chat, WhatsApp, Telefon und Workflows. Schalter Aus / Test / Live — Live nur mit Checkliste und Art. 50.',
    items: [
      'Website-Chat',
      'WhatsApp Business',
      'Telefon-Bot',
      'Workflows und Agents',
    ],
    status: 'live',
  },
  {
    id: 'govern',
    label: 'GOVERN',
    headline: 'Policy, Risiko, Nachweis',
    summary:
      'Die bestehende Control Plane. Discover → Assess → Govern → Enforce → Evidence → Audit.',
    items: [
      'Policy Engine',
      'Risk Register',
      'Evidence Vault (Hash-Chain)',
      'Audit-Export',
    ],
    status: 'live',
  },
  {
    id: 'workstore',
    label: 'WORKSTORE',
    headline: 'Governante Systeme, kein nacktes Template',
    summary:
      'Ein Klick installiert Agent, Wissen, Kanal, Policy, Evidence und Analytics gemeinsam.',
    items: [
      'Industry Packs',
      'Agents',
      'Automations',
      'Governance Packs',
    ],
    status: 'building',
  },
];

export const INFRA_TARGET = {
  edge: 'Cloudflare (DNS, WAF, CDN, Workers, R2)',
  data: 'Supabase EU (Postgres, Auth/RLS, Edge Functions)',
  rule: 'Keine Parallel-Vault, kein zweiter Orchestrator, Service-Role nur in Edge Functions.',
} as const;

/** Wer teurer wird — Texte, Beträge kommen aus pricing.ts in der UI. */
export const PRICE_ESCALATION_TRIGGERS = [
  { id: 'whatsapp', label: 'WhatsApp live', planHint: 'starter-addon-or-growth' },
  { id: 'voice', label: 'Telefon-Bot', planHint: 'growth-plus-usage' },
  { id: 'domain', label: 'Zweite Domain oder zweites Haus', planHint: 'growth-or-addon' },
  { id: 'usage', label: 'Antwort-Packs, Minuten, Meta-Takte', planHint: 'usage' },
  { id: 'agency', label: 'Mehrere Mandanten unter einem Login', planHint: 'agency-legacy-or-enterprise' },
] as const;
