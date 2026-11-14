/**
 * Zielarchitektur der Plattform (Owner, 13.11.2026).
 *
 * Struktur aus der Skizze. Jede Karte zeigt auf eine bestehende Route.
 * Der Badge kommt aus `implementation-status.ts`: live bleibt Live,
 * preview wird Demo, coming-soon oder ein fehlender Eintrag wird geplant.
 * Es entsteht kein neues Backend und keine neue Route.
 */
import type { AppAreaId } from '../../app/areas';
import { getImplementation, type ImplementationStatus } from '../../product/implementation-status';

export type PlatformBadge = 'live' | 'demo' | 'geplant';

export interface PlatformLink {
  label: string;
  href: string;
}

export interface PlatformModule {
  id: string;
  title: string;
  summary: string;
  /** Öffentliche, bereits vorhandene Route. */
  href: string;
  /** Bereich der App-Hülle aus dem Register #2205. */
  areaId: AppAreaId;
  /** Eintrag in implementation-status.ts. Fehlt er, ist die Fläche geplant. */
  ssotId?: string;
}

export const PLATFORM_TITLE = 'RealSync Dynamics AI';

/** Einheitlicher Einstieg. Checkout hat keine Indexroute; die bestehende Tür ist /pricing. */
export const PLATFORM_ENTRY: readonly PlatformLink[] = [
  { label: 'Landingpage', href: '/' },
  { label: 'Login', href: '/login' },
  { label: 'Onboarding', href: '/welcome' },
  { label: 'Checkout', href: '/pricing' },
];

export const PLATFORM_MODULES: readonly PlatformModule[] = [
  {
    id: 'governance-os',
    title: 'Governance OS',
    summary: 'Compliance, Policies, Evidence',
    href: '/governance-runtime',
    areaId: 'governance',
    ssotId: 'governance-runtime-core',
  },
  {
    id: 'agent-studio',
    title: 'AI Agent Studio',
    summary: 'Voice, Chat, WhatsApp',
    href: '/chatbot/start',
    areaId: 'agent-studio',
    ssotId: 'channel-bots',
  },
  {
    id: 'creative-studio',
    title: 'AI Creative Studio',
    summary: 'Grok Bild- und Videogenerierung',
    href: '/app/ai-systems',
    areaId: 'ai-studio',
  },
  {
    id: 'builder',
    title: 'Website & App Builder',
    summary: 'Websites, Apps, Publishing',
    href: '/build',
    areaId: 'website-builder',
    ssotId: 'web-builder',
  },
  {
    id: 'operations',
    title: 'AI Operations',
    summary: 'Bots, Workflows, Monitoring',
    href: '/automations',
    areaId: 'automationen',
    ssotId: 'automation-n8n',
  },
  {
    id: 'command-center',
    title: 'Command Center',
    summary: 'Projekte, Kosten, Freigaben',
    href: '/app/dashboard',
    areaId: 'dashboard',
    ssotId: 'command-center',
  },
];

export const PLATFORM_BASIS_TITLE = 'Gemeinsame technische Basis';

export const PLATFORM_STACK = [
  'GitHub',
  'React/Vite',
  'Supabase',
  'Cloudflare',
  'AI Gateway',
  'Stripe',
] as const;

export const PLATFORM_CONTROLS = [
  'Mandantentrennung',
  'Berechtigungen',
  'Budgetkontrolle',
  'Prüfpfad',
] as const;

export function platformBadge(status: ImplementationStatus | undefined): PlatformBadge {
  if (status === 'live') return 'live';
  if (status === 'preview') return 'demo';
  return 'geplant';
}

export function moduleBadge(module: PlatformModule): PlatformBadge {
  if (!module.ssotId) return 'geplant';
  return platformBadge(getImplementation(module.ssotId)?.status);
}

export function badgeLabel(badge: PlatformBadge): string {
  if (badge === 'live') return 'Live';
  if (badge === 'demo') return 'Demo';
  return 'geplant';
}
