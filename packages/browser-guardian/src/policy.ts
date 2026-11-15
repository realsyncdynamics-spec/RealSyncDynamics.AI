// Browser-Policy · reine Funktion, kein IO, kein Modell.
//
// Geprüft wird nicht nur der Aktionstyp, sondern
//   Ziel    (Schema, Host, Origin-Klasse, Sperrliste),
//   Daten   (was in URL oder Eingabe steckt),
//   Kontext (Mandant, Sitzung, Kanal, Kill-Switch, bereits gelesene Inhalte),
//   Wirkung (lesen, abfließen, offenlegen, aufnehmen, verändern).
//
// Fail-closed: Unbekanntes, Ungültiges und Unklares läuft nie einfach
// durch. Es gibt kein `log_only` — siehe docs/product/browser-guardian-entwicklungsentwurf.md.

import { classifyOrigin, classifyText, hasFinding, isOriginBlocked, isPublic } from './classify.ts';
import type {
  ActionRequest,
  BrowserAction,
  DataClass,
  DecisionReason,
  Effect,
  GuardianContext,
  GuardianDecision,
  GuardianDecisionKind,
  GuardianPolicy,
  ReasonCode,
  ReviewKind,
  SessionState,
  TargetClass,
} from './types.ts';
import { DATA_CLASS_LABEL_DE, KNOWN_ACTION_TYPES } from './types.ts';

export const ENGINE = 'browser-guardian/v1' as const;
/** Festlegung 4: feste Freigabedauer. Richtlinien dürfen nur verkürzen. */
export const APPROVAL_TTL_SECONDS = 15 * 60;
export const MAX_SESSION_STEPS = 25;
const MAX_QUERY_VALUE = 64;
const MAX_URL_AFTER_TAINT = 512;
const MAX_SELECTOR = 500;
const MAX_TEXT = 2000;
const MAX_URL = 2000;

const SEVERITY: Record<GuardianDecisionKind, number> = { allow: 0, require_approval: 1, deny: 2 };
const REVIEW_RANK: Record<ReviewKind, number> = { none: 0, human_approval: 1, data_protection_review: 2 };

const EFFECTS: Record<BrowserAction['type'], Effect[]> = {
  navigate: ['read', 'egress'],
  extract: ['read', 'disclose'],
  screenshot: ['capture', 'disclose'],
  click: ['mutate', 'egress'],
  select: ['mutate', 'egress'],
  type: ['mutate', 'egress'],
  scroll: ['none'],
  wait: ['none'],
};

// ─── Eingangsprüfung ─────────────────────────────────────────────────────────

const DATA_CLASSES: readonly DataClass[] = ['public', 'internal', 'confidential', 'personal'];

export function policyError(policy: unknown): string | null {
  if (!policy || typeof policy !== 'object') return 'Richtlinie fehlt';
  const p = policy as Partial<GuardianPolicy>;
  if (typeof p.policy_id !== 'string' || p.policy_id.trim() === '') return 'policy_id fehlt';
  if (typeof p.version !== 'string' || p.version.trim() === '') return 'version fehlt';
  if (!Array.isArray(p.origins)) return 'origins fehlt';
  for (const r of p.origins) {
    if (!r || typeof r.origin !== 'string' || !DATA_CLASSES.includes(r.data_class)) return 'ungültige Origin-Regel';
  }
  if (p.blocked_origins !== undefined && !(Array.isArray(p.blocked_origins) && p.blocked_origins.every((o) => typeof o === 'string'))) {
    return 'ungültige Sperrliste';
  }
  return null;
}

type Parsed =
  | { kind: 'ok'; action: BrowserAction }
  | { kind: 'unknown'; type: string }
  | { kind: 'invalid'; type: string; error: string };

function nonEmpty(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

/** Strikt: kein stilles Korrigieren außer Begrenzen von Zahlen. */
export function parseAction(raw: unknown): Parsed {
  if (!raw || typeof raw !== 'object') return { kind: 'invalid', type: 'unknown', error: 'keine Aktion' };
  const a = raw as Record<string, unknown>;
  const type = typeof a.type === 'string' ? a.type : 'unknown';
  if (!(KNOWN_ACTION_TYPES as readonly string[]).includes(type)) return { kind: 'unknown', type };
  const bad = (error: string): Parsed => ({ kind: 'invalid', type, error });
  switch (type) {
    case 'navigate':
      return nonEmpty(a.url, MAX_URL) ? { kind: 'ok', action: { type, url: a.url.trim() } } : bad('url fehlt');
    case 'scroll': {
      if (a.direction !== 'up' && a.direction !== 'down') return bad('direction ungültig');
      const amount = typeof a.amount === 'number' && Number.isFinite(a.amount)
        ? Math.min(Math.max(Math.round(a.amount), 1), 5000) : undefined;
      return { kind: 'ok', action: amount === undefined ? { type, direction: a.direction } : { type, direction: a.direction, amount } };
    }
    case 'click':
      return nonEmpty(a.selector, MAX_SELECTOR) ? { kind: 'ok', action: { type, selector: a.selector } } : bad('selector fehlt');
    case 'type':
      if (!nonEmpty(a.selector, MAX_SELECTOR)) return bad('selector fehlt');
      return typeof a.text === 'string' && a.text.length > 0 && a.text.length <= MAX_TEXT
        ? { kind: 'ok', action: { type, selector: a.selector, text: a.text } } : bad('text ungültig');
    case 'select':
      return nonEmpty(a.selector, MAX_SELECTOR) && nonEmpty(a.value, MAX_SELECTOR)
        ? { kind: 'ok', action: { type, selector: a.selector, value: a.value } } : bad('selector/value fehlt');
    case 'extract':
      if (a.selector === undefined || a.selector === null || a.selector === '') return { kind: 'ok', action: { type } };
      return nonEmpty(a.selector, MAX_SELECTOR) ? { kind: 'ok', action: { type, selector: a.selector } } : bad('selector ungültig');
    case 'wait':
      return typeof a.milliseconds === 'number' && Number.isFinite(a.milliseconds)
        ? { kind: 'ok', action: { type, milliseconds: Math.min(Math.max(Math.round(a.milliseconds), 0), 10_000) } }
        : bad('milliseconds fehlt');
    case 'screenshot':
      return { kind: 'ok', action: { type } };
    default:
      return { kind: 'unknown', type };
  }
}

// ─── Ziel ────────────────────────────────────────────────────────────────────

/** Nur Literale und reservierte Namen; der Executor prüft zusätzlich per DNS. */
export function isPrivateHostLiteral(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (!h.includes('.') && !h.includes(':')) return true; // einteiliger Name ⇒ internes Netz
  if (h === '::' || h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return h.includes(':');
  if (h.startsWith('::ffff:')) {
    const rest = h.slice(7);
    // Der URL-Parser schreibt ::ffff:127.0.0.1 als ::ffff:7f00:1.
    const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (!hex) return isPrivateHostLiteral(rest);
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateHostLiteral(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function originOf(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}

// ─── Entscheidung ────────────────────────────────────────────────────────────

class Collector {
  reasons: DecisionReason[] = [];
  reviews: ReviewKind[] = [];
  add(decision: GuardianDecisionKind, code: ReasonCode, text_de: string, review: ReviewKind = 'none'): void {
    this.reasons.push({ code, decision, text_de });
    if (decision === 'require_approval') this.reviews.push(review === 'none' ? 'human_approval' : review);
  }
  final(): { decision: GuardianDecisionKind; review: ReviewKind } {
    const decision = this.reasons.reduce<GuardianDecisionKind>(
      (acc, r) => (SEVERITY[r.decision] > SEVERITY[acc] ? r.decision : acc),
      this.reasons.length === 0 ? 'deny' : 'allow', // ohne Begründung keine Erlaubnis
    );
    if (decision !== 'require_approval') return { decision, review: 'none' };
    const review = this.reviews.reduce<ReviewKind>((acc, r) => (REVIEW_RANK[r] > REVIEW_RANK[acc] ? r : acc), 'human_approval');
    return { decision, review };
  }
}

function classReason(c: Collector, cls: TargetClass, what: string): void {
  if (isPublic(cls)) {
    c.add('allow', 'ORIGIN_PUBLIC', `${what}: Ziel ist als öffentlich eingestuft.`);
  } else if (cls === 'unclassified') {
    c.add('require_approval', 'ORIGIN_UNCLASSIFIED', `${what}: Ziel ist nicht klassifiziert; nur öffentliche Ziele laufen ohne Freigabe.`);
  } else {
    c.add('require_approval', 'ORIGIN_NOT_PUBLIC',
      `${what}: Ziel ist als ${DATA_CLASS_LABEL_DE[cls]} eingestuft; nur öffentliche Ziele laufen ohne Freigabe.`,
      cls === 'personal' ? 'data_protection_review' : 'human_approval');
  }
}

function evaluateNavigate(c: Collector, policy: GuardianPolicy, session: SessionState, rawUrl: string): { origin: string | null; cls: TargetClass } {
  let url: URL;
  try { url = new URL(rawUrl); } catch {
    c.add('deny', 'URL_SCHEME', 'Adresse ist ungültig.');
    return { origin: null, cls: 'unclassified' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    c.add('deny', 'URL_SCHEME', `Schema ${url.protocol} ist nicht erlaubt; nur http(s).`);
    return { origin: null, cls: 'unclassified' };
  }
  if (url.username || url.password) c.add('deny', 'URL_CREDENTIALS', 'Zugangsdaten in der Adresse sind nicht erlaubt.');
  if (isPrivateHostLiteral(url.hostname)) c.add('deny', 'PRIVATE_NETWORK', 'Interne oder lokale Netzadressen sind gesperrt.');
  if (isOriginBlocked(policy, url.origin)) c.add('deny', 'ORIGIN_BLOCKED', 'Ziel steht auf der Sperrliste des Mandanten.');

  const cls = classifyOrigin(policy, url.origin);
  classReason(c, cls, 'Navigation');

  // Daten in der Adresse fließen an den Zielserver ab (Egress).
  let carried = `${url.pathname} ${url.search} ${url.hash}`;
  try { carried = decodeURIComponent(carried.replace(/\+/g, ' ')); } catch { /* roh prüfen */ }
  const inUrl = classifyText(carried);
  if (inUrl.findings.length > 0) {
    c.add('require_approval', 'URL_CARRIES_SENSITIVE_DATA',
      `Adresse enthält ${inUrl.findings.map((f) => f.kind).join(', ')} und würde an ${url.origin} übertragen.`,
      'data_protection_review');
  }

  if (session.tainted) {
    const currentOrigin = originOf(session.current_url);
    if (currentOrigin !== url.origin) {
      c.add('require_approval', 'SESSION_TAINTED',
        'Die Sitzung enthält bereits nicht-öffentliche Inhalte; ein Wechsel zu einem anderen Ziel braucht eine Freigabe.');
    }
    const longValue = [...url.searchParams.values()].some((v) => v.length > MAX_QUERY_VALUE);
    if (longValue || url.toString().length > MAX_URL_AFTER_TAINT || url.hash.length > MAX_QUERY_VALUE) {
      c.add('require_approval', 'POSSIBLE_ENCODED_EGRESS',
        'Lange Parameter nach dem Lesen nicht-öffentlicher Inhalte können kodierte Daten übertragen.');
    }
  }
  return { origin: url.origin, cls };
}

function requirePage(c: Collector, session: SessionState): boolean {
  if (!session.current_url) {
    c.add('deny', 'NO_PAGE', 'Es ist noch keine Seite geladen.');
    return false;
  }
  return true;
}

export interface EvaluateInput {
  policy: GuardianPolicy;
  context: GuardianContext;
  session: SessionState;
  request: ActionRequest;
}

export function evaluate({ policy, context, session, request }: EvaluateInput): GuardianDecision {
  const c = new Collector();
  const policyId = typeof policy?.policy_id === 'string' ? policy.policy_id : 'invalid';
  const policyVersion = typeof policy?.version === 'string' ? policy.version : 'invalid';
  const parsed = parseAction(request?.action);
  const actionType = parsed.kind === 'ok' ? parsed.action.type : parsed.type;
  const base = {
    action_type: actionType,
    policy_id: policyId,
    policy_version: policyVersion,
    engine: ENGINE,
  };
  const denyOnly = (code: ReasonCode, text: string): GuardianDecision => ({
    ...base,
    decision: 'deny',
    review: 'none',
    reasons: [{ code, decision: 'deny', text_de: text }],
    effects: parsed.kind === 'ok' ? EFFECTS[parsed.action.type] : [],
    target_origin: null,
    target_class: 'unclassified',
  });

  // Reihenfolge: Rahmen vor Inhalt. Jeder Rahmenfehler beendet die Prüfung.
  const pErr = policyError(policy);
  if (pErr) return denyOnly('POLICY_INVALID', `Richtlinie ungültig (${pErr}); nichts wird ausgeführt.`);
  if (!context || !nonEmpty(context.tenant_id, 200) || !nonEmpty(context.session_id, 200) || !nonEmpty(context.actor_id, 200)) {
    return denyOnly('CONTEXT_INVALID', 'Mandant, Sitzung oder Nutzer sind nicht verlässlich bestimmt.');
  }
  if (context.kill_switch !== false) return denyOnly('KILL_SWITCH', 'Der Kill-Switch ist aktiv oder nicht lesbar.');
  if (!session || session.halted) return denyOnly('SESSION_HALTED', 'Sitzung angehalten (Prüfpfad unvollständig); neue Sitzung nötig.');
  const limit = Math.min(policy.max_session_steps ?? MAX_SESSION_STEPS, MAX_SESSION_STEPS);
  if (session.step_count >= limit) return denyOnly('STEP_LIMIT', `Höchstens ${limit} Aktionen je Sitzung.`);
  if (request.channel === 'voice') {
    return denyOnly('VOICE_DISABLED', 'Sprachsteuerung ist gesperrt, bis der Drittlandtransfer rechtlich geklärt ist.');
  }
  if (!['ui', 'cli', 'planner'].includes(request.channel) || !['user', 'planner'].includes(request.source)) {
    return denyOnly('CONTEXT_INVALID', 'Unbekannter Eingangskanal oder unbekannte Herkunft.');
  }
  if (parsed.kind === 'unknown') {
    return denyOnly('UNKNOWN_ACTION', `Unbekannte Aktion „${parsed.type}" — wird nicht ausgeführt (kein log_only).`);
  }
  if (parsed.kind === 'invalid') return denyOnly('INVALID_ACTION', `Aktion ungültig: ${parsed.error}.`);

  const action = parsed.action;
  let targetOrigin = originOf(session.current_url);
  let targetClass: TargetClass = session.current_class;

  switch (action.type) {
    case 'navigate': {
      const t = evaluateNavigate(c, policy, session, action.url);
      targetOrigin = t.origin;
      targetClass = t.cls;
      break;
    }
    case 'extract':
    case 'screenshot': {
      if (!requirePage(c, session)) break;
      const what = action.type === 'extract' ? 'Auslesen' : 'Bildschirmfoto';
      classReason(c, session.current_class, what);
      if (session.tainted) {
        c.add('require_approval', 'SESSION_TAINTED',
          `${what}: Die Sitzung enthält bereits nicht-öffentliche Inhalte oder Eingaben.`,
          'data_protection_review');
      }
      break;
    }
    case 'click':
    case 'select':
    case 'type': {
      if (!requirePage(c, session)) break;
      c.add('require_approval', 'MUTATION_REQUIRES_APPROVAL', 'Verändernde Aktion: braucht die Freigabe eines Menschen.',
        session.current_class === 'personal' ? 'data_protection_review' : 'human_approval');
      if (action.type === 'type') {
        const input = classifyText(action.text);
        if (hasFinding(input, 'secret')) {
          c.add('deny', 'INPUT_SECRET', 'Zugangsdaten oder Schlüssel gibt nur der Mensch selbst ein, nie der Agent.');
        }
        if (hasFinding(input, 'payment_card')) {
          c.add('deny', 'INPUT_PAYMENT_DATA', 'Zahlungsdaten gibt der Agent nicht ein.');
        }
        if (input.data_class === 'personal') {
          c.add('require_approval', 'INPUT_PERSONAL_DATA', 'Eingabe enthält personenbezogene Daten.', 'data_protection_review');
        }
      }
      break;
    }
    case 'scroll':
      if (requirePage(c, session)) c.add('allow', 'NO_EFFECT', 'Scrollen ändert nichts und überträgt nichts.');
      break;
    case 'wait':
      c.add('allow', 'NO_EFFECT', 'Warten ändert nichts und überträgt nichts.');
      break;
  }

  const { decision, review } = c.final();
  return {
    ...base,
    decision,
    review,
    reasons: c.reasons,
    effects: EFFECTS[action.type],
    target_origin: targetOrigin,
    target_class: targetClass,
  };
}

/**
 * Darf ein Inhalt dieser Klasse an ein Sprachmodell gehen (z. B. als Kontext
 * für die nächste Planung)? Nur öffentliche Inhalte, sonst nicht.
 */
export function mayForwardToModel(cls: TargetClass): boolean {
  return cls === 'public';
}
