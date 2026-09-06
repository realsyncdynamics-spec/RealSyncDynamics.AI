// Browser Agent X07 — von der Beobachtung zum Befund.
//
// Modell: Artifact „Organisationsmodell …" v0.2, §02 und §03.
// Entscheid: ADR 0011 D1.
//
// Diese Datei enthält ausschließlich reine Funktionen: keine Netzwerkaufrufe,
// kein Supabase-Client, kein Deno-spezifisches API. Damit ist sie aus Vitest
// importierbar (Muster: `_shared/findings.ts`) und die Abbildungsregeln sind
// prüfbar, ohne einen Browser zu starten.
//
// ── Was hier NICHT entschieden wird ─────────────────────────────────────────
//
// Ob ein Befund ohne Freigabe deployt werden darf. Die Autonomiegrenze aus
// ADR 0011 D1 (`severity ∈ {info, warn} AND category ∉ {compliance, security}`)
// ist eine serverseitige Prüfung der Policy Engine. Ein Agent, der sie selbst
// auswertet, ist kein Gate, sondern eine Selbstauskunft. Deshalb trägt kein
// Befund hier ein Autonomie-Feld — nur `severity` und `category`, aus denen
// die Policy Engine ihre Entscheidung ableitet.

export type FindingCode =
  | 'js.console-error'
  | 'js.page-error'
  | 'net.request-failed'
  | 'ui.element-not-visible'
  | 'ui.horizontal-overflow'
  | 'ui.viewport-load-error'
  | 'perf.slow-load';

/** Wertebereich von `agent_tickets.severity` (20260904010500). */
export type Severity = 'info' | 'warn' | 'critical';

/** Wertebereich von `agent_tickets.category` (20260904010500). */
export type Category =
  | 'ui_bug' | 'performance' | 'a11y' | 'security' | 'compliance' | 'customer_feedback';

export interface Finding {
  code: FindingCode;
  severity: Severity;
  category: Category;
  title: string;
  evidence: Record<string, unknown>;
}

export interface ConsoleEntry { level: 'error' | 'warning'; text: string; url: string | null; line: number | null }
export interface FailedRequest { url: string; method: string; failure: string | null; status: number | null }
export interface SelectorObservation {
  selector: string; found: boolean; visible: boolean; within_viewport: boolean; right: number | null;
}
export interface ViewportObservation {
  label: string; width: number; height: number;
  document_scroll_width: number; horizontal_overflow: boolean;
  selectors: SelectorObservation[]; load_error?: string;
}
export interface ObserveResult {
  ok: true;
  meta: {
    url: string; final_url: string | null; http_status: number | null;
    duration_ms: number; observer_version: string; observed_at: string;
  };
  console_errors: ConsoleEntry[];
  console_warnings: ConsoleEntry[];
  page_errors: string[];
  failed_requests: FailedRequest[];
  timings: { response_start_ms: number; dom_content_loaded_ms: number; load_ms: number } | null;
  viewports: ViewportObservation[];
}

export interface Thresholds {
  /** Ab dieser Ladezeit entsteht ein `perf.slow-load`-Befund. */
  slowLoadMs: number;
}

// 4000 ms ist kein gemessener Wert, sondern eine bewusst grobe Grenze: Sie
// erzeugt `info`, nie eine Eskalation, und dient dem Beobachten, nicht dem
// Durchsetzen. Ein belastbarer Schwellenwert bräuchte eine Baseline über die
// Zeit — die gibt es noch nicht (siehe README).
export const DEFAULT_THRESHOLDS: Thresholds = { slowLoadMs: 4_000 };

/** Route auf einen für `ticket_code` tauglichen Bezeichner reduzieren. */
function slugRoute(route: string): string {
  const s = route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return s.length > 0 ? s.slice(0, 40) : 'root';
}

/**
 * Stabiler Ticket-Code je (Route, Befundart).
 *
 * `agent_tickets.ticket_code` ist UNIQUE. Ein deterministischer Code macht den
 * Lauf idempotent: Derselbe Befund an derselben Route erzeugt bei jedem Lauf
 * denselben Code und damit kein zweites Ticket. Ein Zeitstempel im Code würde
 * das Gegenteil bewirken — bei stündlichem Cron 24 Tickets pro Tag für einen
 * einzigen Fehler.
 */
export function ticketCode(route: string, code: FindingCode): string {
  return `${routePrefix(route)}${SEGMENT}${code}`;
}

/**
 * Trennzeichen zwischen den Segmenten eines Ticket-Codes.
 *
 * Bewusst ein Doppelpunkt und kein Bindestrich: `slugRoute` ersetzt jedes
 * Nicht-alphanumerische durch einen Bindestrich, der taugt also nicht als
 * Grenze. Mit Bindestrich wäre `X07-audit-` ein Präfix von
 * `X07-audit-extra-js-console-error` gewesen — die Verifikation hätte Tickets
 * der Route `/audit-extra` beim Beobachten von `/audit` geschlossen. Der
 * Doppelpunkt kann in einem Slug nicht vorkommen; damit ist die Grenze
 * eindeutig statt nur unwahrscheinlich.
 */
const SEGMENT = ':';

/**
 * Präfix aller Ticket-Codes einer Route.
 *
 * Existiert, damit die Zuordnung „gehört dieses Ticket zu dieser Route?" nicht
 * durch Zerlegen eines Codes geraten werden muss.
 */
export function routePrefix(route: string): string {
  return `X07${SEGMENT}${slugRoute(route)}`;
}

/** True, wenn `code` ein Ticket-Code genau dieser Route ist. */
export function isTicketOfRoute(ticketCodeValue: string, route: string): boolean {
  return ticketCodeValue.startsWith(`${routePrefix(route)}${SEGMENT}`);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Leitet aus einer Beobachtung die Befunde ab.
 *
 * Bewusst keine Aggregation über Routen hinweg: Jede Route ist ein eigener
 * Gegenstand, und ein Ticket, das drei Seiten zugleich betrifft, ist keinem
 * Team zuweisbar.
 */
export function deriveFindings(
  route: string,
  obs: ObserveResult,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Finding[] {
  const findings: Finding[] = [];

  // ── Unbehandelte Ausnahmen: die Seite ist kaputt, nicht nur laut ──────────
  if (obs.page_errors.length > 0) {
    findings.push({
      code: 'js.page-error',
      severity: 'critical',
      category: 'ui_bug',
      title: `${route}: ${obs.page_errors.length} unbehandelte ${plural(obs.page_errors.length, 'JavaScript-Ausnahme', 'JavaScript-Ausnahmen')}`,
      evidence: { route, errors: obs.page_errors },
    });
  }

  if (obs.console_errors.length > 0) {
    findings.push({
      code: 'js.console-error',
      severity: 'warn',
      category: 'ui_bug',
      title: `${route}: ${obs.console_errors.length} ${plural(obs.console_errors.length, 'JavaScript-Fehler', 'JavaScript-Fehler')} in der Browser-Konsole`,
      evidence: { route, entries: obs.console_errors },
    });
  }

  // `console_warnings` erzeugt bewusst keinen Befund: Warnungen sind auf
  // fremden wie eigenen Seiten Dauerrauschen (veraltete APIs, Drittanbieter),
  // und ein Ticket, das immer offen ist, wird nicht gelesen. Sie stehen der
  // Auswertung im Rohergebnis trotzdem zur Verfügung.

  if (obs.failed_requests.length > 0) {
    findings.push({
      code: 'net.request-failed',
      severity: 'warn',
      category: 'ui_bug',
      title: `${route}: ${obs.failed_requests.length} ${plural(obs.failed_requests.length, 'Anfrage schlug', 'Anfragen schlugen')} fehl`,
      evidence: { route, requests: obs.failed_requests },
    });
  }

  // ── Sichtbarkeit je Breite ───────────────────────────────────────────────
  const notVisible: Array<{ viewport: string; width: number; selector: string; reason: string }> = [];
  const overflowing: Array<{ viewport: string; width: number; scroll_width: number }> = [];
  const loadErrors: Array<{ viewport: string; width: number; error: string }> = [];

  for (const vp of obs.viewports) {
    if (vp.load_error) {
      loadErrors.push({ viewport: vp.label, width: vp.width, error: vp.load_error });
      continue;
    }
    if (vp.horizontal_overflow) {
      overflowing.push({ viewport: vp.label, width: vp.width, scroll_width: vp.document_scroll_width });
    }
    for (const sel of vp.selectors) {
      if (!sel.found) {
        notVisible.push({ viewport: vp.label, width: vp.width, selector: sel.selector, reason: 'nicht im DOM' });
      } else if (!sel.visible) {
        notVisible.push({ viewport: vp.label, width: vp.width, selector: sel.selector, reason: 'nicht sichtbar' });
      } else if (!sel.within_viewport) {
        notVisible.push({ viewport: vp.label, width: vp.width, selector: sel.selector, reason: 'ausserhalb des Viewports' });
      }
    }
  }

  if (loadErrors.length > 0) {
    findings.push({
      code: 'ui.viewport-load-error',
      severity: 'critical',
      category: 'ui_bug',
      title: `${route}: Seite lädt bei ${loadErrors.map((l) => `${l.width}px`).join(', ')} nicht`,
      evidence: { route, viewports: loadErrors },
    });
  }

  if (notVisible.length > 0) {
    const widths = Array.from(new Set(notVisible.map((n) => `${n.width}px`))).join(', ');
    findings.push({
      code: 'ui.element-not-visible',
      severity: 'warn',
      category: 'ui_bug',
      title: `${route}: erwartetes Element bei ${widths} nicht sichtbar`,
      evidence: { route, elements: notVisible },
    });
  }

  if (overflowing.length > 0) {
    const widths = overflowing.map((o) => `${o.width}px`).join(', ');
    findings.push({
      code: 'ui.horizontal-overflow',
      severity: 'warn',
      category: 'ui_bug',
      title: `${route}: Seite scrollt bei ${widths} horizontal`,
      evidence: { route, viewports: overflowing },
    });
  }

  // ── Ladezeit ─────────────────────────────────────────────────────────────
  if (obs.timings && obs.timings.load_ms > thresholds.slowLoadMs) {
    findings.push({
      code: 'perf.slow-load',
      severity: 'info',
      category: 'performance',
      title: `${route}: Ladezeit ${obs.timings.load_ms} ms über der Beobachtungsgrenze von ${thresholds.slowLoadMs} ms`,
      evidence: { route, timings: obs.timings, threshold_ms: thresholds.slowLoadMs },
    });
  }

  return findings;
}
