/**
 * Handoff v2 §5 — die sieben Hauptbereiche der App-Shell.
 *
 * Eine feste Liste, weil der Entwurf genau diese sieben Bereiche als
 * Produktgerüst vorgibt (Discover · Classify · Enforce · Prove). Alle
 * übrigen Module bleiben über `TAB_MODULES` erreichbar — in der Seitenleiste
 * unter „Weitere Module", mobil im Burger-Menü.
 */
import type { HandoffKey } from '../../i18n/handoff';

export type ShellNavId = 'overview' | 'systems' | 'classify' | 'enforce' | 'evidence' | 'reports' | 'billing';

/**
 * Das Schloss eines Hauptbereichs kommt NICHT aus einer eigenen Modul-Liste,
 * sondern aus dem Zugriffsregister (`core/access/featureAccess.ts`) über die
 * Route — also aus genau der Prüfung, die `RouteEntitlementGate` beim Öffnen
 * ausführt, gegen die wirksamen Entitlements des Mandanten
 * (`tenant_entitlements()`, gespiegelt in `PLAN_ENTITLEMENTS`).
 *
 * Vorher hing das Schloss an `moduleId` → `plan.modules`: KI-Systeme und
 * Klassifizierung trugen im Free-Plan ein Schloss (Modul `eu_ai_act`), obwohl
 * Server und Route-Gate das KI-Register (`governance.ai_register`) ab Free
 * freigeben; Enforcement hatte gar kein Schloss, landete im Free-Plan aber auf
 * der Sperrseite (`policy.packs`, ab Starter).
 */
export interface ShellNavItem {
  id: ShellNavId;
  labelKey: HandoffKey;
  route: string;
}

export const SHELL_NAV: readonly ShellNavItem[] = [
  { id: 'overview', labelKey: 'navOverview', route: '/app/dashboard' },
  { id: 'systems', labelKey: 'navSystems', route: '/app/ai-systems' },
  { id: 'classify', labelKey: 'navClassify', route: '/app/ai-systems' },
  { id: 'enforce', labelKey: 'navEnforce', route: '/app/policy-packs' },
  { id: 'evidence', labelKey: 'navEvidence', route: '/app/evidence' },
  { id: 'reports', labelKey: 'navReports', route: '/app/reports' },
  { id: 'billing', labelKey: 'navBilling', route: '/app/billing' },
] as const;

/** Routen, die die Hauptliste schon abdeckt (für „Weitere Module"). */
export const SHELL_NAV_ROUTES: ReadonlySet<string> = new Set([
  ...SHELL_NAV.map((i) => i.route),
  '/app/home',
]);

const DASHBOARD_ALIASES = ['/app', '/app/dashboard', '/app/home', '/app/overview'];

/** Detailseite eines KI-Systems (nicht die Agent-Registry). */
export function isClassifyPath(pathname: string): boolean {
  return /^\/app\/ai-systems\/(?!agents(?:\/|$))[^/]+\/?$/.test(pathname);
}

export function activeShellNav(pathname: string): ShellNavId | null {
  if (DASHBOARD_ALIASES.includes(pathname)) return 'overview';
  if (isClassifyPath(pathname)) return 'classify';
  if (pathname === '/app/ai-systems' || pathname.startsWith('/app/ai-systems/')) return 'systems';
  if (pathname.startsWith('/app/policy-packs')) return 'enforce';
  if (pathname === '/app/evidence' || pathname.startsWith('/app/evidence/')) return 'evidence';
  if (pathname.startsWith('/app/reports')) return 'reports';
  if (pathname.startsWith('/app/billing')) return 'billing';
  return null;
}

/** Titel/Untertitel der Kopfzeile je Bereich. */
export const SHELL_TITLES: Readonly<Record<ShellNavId | 'app', { title: HandoffKey; sub: HandoffKey }>> = {
  overview: { title: 'ttlDashboard', sub: 'subDashboard' },
  systems: { title: 'ttlSystems', sub: 'subSystems' },
  classify: { title: 'ttlClassify', sub: 'subClassify' },
  enforce: { title: 'ttlEnforce', sub: 'subEnforce' },
  evidence: { title: 'ttlEvidence', sub: 'subEvidence' },
  reports: { title: 'ttlReports', sub: 'subReports' },
  billing: { title: 'ttlBilling', sub: 'subBilling' },
  app: { title: 'ttlApp', sub: 'subApp' },
};
