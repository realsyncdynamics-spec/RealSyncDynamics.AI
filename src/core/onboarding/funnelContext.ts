/**
 * Trichter-Kontext über Weiterleitungen hinweg festhalten.
 *
 * ## Das Problem, das diese Datei löst
 *
 * Der Weg vom Scan bis zum Abo führt über mindestens sechs Wechsel:
 *
 * ```
 * /audit → /onboarding/:auditId → /recommendation/:auditId
 *        → /checkout/<planKey> → Anmeldung → Mandant → Stripe → /app
 * ```
 *
 * Findings, Domain, Plan und Modulauswahl reisten bis hierher
 * ausschliesslich im Router-State (`navigate(..., { state })`). Der
 * überlebt keinen Reload, keinen geteilten Link, keine Anmeldung und keine
 * Rückkehr von Stripe. Genau an diesen Stellen bricht der Trichter — nicht
 * weil etwas fehlt, sondern weil der Zusammenhang verloren geht.
 *
 * ## Warum `sessionStorage` und kein neuer Datensatz
 *
 * Bis zur Registrierung existiert kein Mandant, unter dem sich das
 * speichern liesse. Dieselbe Begründung trägt bereits
 * `src/unified-entry/productTrack.ts`; hier gilt sie unverändert. Eine
 * Migration wäre für ein Trichter-Zwischenergebnis der falsche Ort — der
 * kanonische Datensatz bleibt `gdpr_audits`
 * (`docs/product/canonical-funnel-decision.md` §1).
 *
 * Diese Werte sind **keine Berechtigung**. Was der Kunde darf, entscheidet
 * ausschliesslich `hasModule()` / `hasPermission()` gegen das gebuchte Abo.
 * Hier steht nur, was er vorhat und was gemessen wurde.
 */

import {
  isPlanId,
  normalizeModuleSelection,
  type BookableModuleId,
  type PlanId,
  isProductTrack,
  type ProductTrack,
} from '@/shared/pricing';

const KEY = 'rsd.funnel.context';

/** Query-Parameter, über die Audit und Domain zwischen Seiten wandern. */
export const AUDIT_PARAM = 'audit_id';
export const DOMAIN_PARAM = 'domain';

export interface FunnelContext {
  /** `gdpr_audits.id` — die kanonische Kennung des Trichters. */
  auditId: string;
  domain: string;
  recommendedPlan: PlanId | null;
  selectedModules: BookableModuleId[];
  track: ProductTrack | null;
  /** Zeitpunkt der Ablage, damit ein alter Stand erkennbar bleibt. */
  savedAt: number;
}

/**
 * `sessionStorage` ist beim Prerendering, im privaten Modus mancher Browser
 * und bei blockierten Website-Daten nicht benutzbar. Der Trichter läuft
 * dann weiter — nur ohne Erinnerung.
 */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readFunnelContext(): FunnelContext | null {
  const raw = storage()?.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const row = parsed as Record<string, unknown>;
    const auditId = typeof row.auditId === 'string' ? row.auditId : '';
    if (!auditId) return null;
    const plan = typeof row.recommendedPlan === 'string' && isPlanId(row.recommendedPlan)
      ? row.recommendedPlan
      : null;
    const modules = Array.isArray(row.selectedModules)
      ? normalizeModuleSelection(row.selectedModules.filter((v): v is string => typeof v === 'string'))
      : [];
    const track = typeof row.track === 'string' && isProductTrack(row.track) ? row.track : null;
    return {
      auditId,
      domain: typeof row.domain === 'string' ? row.domain : '',
      recommendedPlan: plan,
      selectedModules: modules,
      track,
      savedAt: typeof row.savedAt === 'number' ? row.savedAt : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Kontext ergänzen statt ersetzen.
 *
 * Jede Trichter-Seite kennt nur ihren Teil: `/onboarding` kennt Domain und
 * Audit, `/recommendation` kennt Plan und Module. Ein vollständiges
 * Überschreiben würde deshalb bei jedem Schritt löschen, was der vorige
 * wusste. Ein Wechsel der `auditId` setzt dagegen bewusst neu auf — ein
 * anderer Scan ist ein anderer Vorgang.
 */
export function saveFunnelContext(patch: Partial<FunnelContext> & { auditId: string }): FunnelContext {
  const previous = readFunnelContext();
  const carryOver = previous && previous.auditId === patch.auditId ? previous : null;
  const next: FunnelContext = {
    auditId: patch.auditId,
    domain: patch.domain ?? carryOver?.domain ?? '',
    recommendedPlan: patch.recommendedPlan ?? carryOver?.recommendedPlan ?? null,
    selectedModules: normalizeModuleSelection(patch.selectedModules ?? carryOver?.selectedModules ?? []),
    track: patch.track ?? carryOver?.track ?? null,
    savedAt: Date.now(),
  };
  try {
    storage()?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Speichern ist eine Bequemlichkeit, kein Teil des Ablaufs.
  }
  return next;
}

export function clearFunnelContext(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // s. o.
  }
}

/**
 * Audit und Domain aus der URL lesen, sonst aus der Sitzung.
 *
 * Die URL gewinnt, damit ein geteilter Link reproduzierbar bleibt —
 * dieselbe Regel wie in `productTrack.resolveTrack()`.
 */
export function resolveAuditContext(
  search: URLSearchParams | string,
  fallbackAuditId?: string,
): { auditId: string; domain: string } {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const stored = readFunnelContext();
  const auditId = params.get(AUDIT_PARAM) ?? fallbackAuditId ?? stored?.auditId ?? '';
  const fromUrl = params.get(DOMAIN_PARAM);
  const domain = fromUrl ?? (stored && stored.auditId === auditId ? stored.domain : '') ?? '';
  return { auditId, domain };
}

/**
 * Vorhandene Parameter erhalten und den Audit-Kontext ergänzen.
 *
 * Der wiederkehrende Fehler an dieser Stelle ist, ein Ziel neu
 * zusammenzusetzen und dabei `source`, `plan` oder `pilot` zu verlieren.
 * Deshalb wird die bestehende Abfrage übernommen und nur erweitert.
 */
export function withAuditContext(
  href: string,
  context: { auditId?: string; domain?: string },
): string {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  if (context.auditId) params.set(AUDIT_PARAM, context.auditId);
  if (context.domain) params.set(DOMAIN_PARAM, context.domain);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
