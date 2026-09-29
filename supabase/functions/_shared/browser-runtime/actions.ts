// Governed Browser Runtime — Aktionsschema, Klassifikation, Redaktion.
// Rein und importfrei bis auf sha256/canonicalJson (vitest-importierbar).
//
// Jede Aktion kommt als untrusted Input (Client ODER Planner-Modell) und wird
// hier auf ein festes Schema reduziert. Was nicht passt, wird abgewiesen —
// nie „repariert" und ausgeführt.

import { canonicalJson } from '../evidence-hash.ts';
import { sha256Hex } from '../hash.ts';

export type BrowserAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'submit'; selector: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'extract'; selector?: string }
  | { type: 'read_text'; selector?: string }
  | { type: 'read_dom'; selector?: string }
  | { type: 'screenshot' }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'download'; selector: string }
  | { type: 'upload'; selector: string; file_ref: string };

export type BrowserActionType = BrowserAction['type'];

export const BROWSER_ACTION_TYPES: readonly BrowserActionType[] = [
  'navigate', 'scroll', 'click', 'type', 'select', 'submit', 'wait',
  'extract', 'read_text', 'read_dom', 'screenshot', 'back', 'forward', 'reload',
  'download', 'upload',
];

/** Verändern Zustand auf der Zielseite — brauchen immer eine menschliche Freigabe. */
export const MUTATING_ACTIONS: ReadonlySet<BrowserActionType> = new Set([
  'click', 'type', 'select', 'submit', 'upload',
]);

/** Holen Inhalte in den Executor — freigabepflichtig, aber keine Formular-Mutation. */
export const SIDE_EFFECT_ACTIONS: ReadonlySet<BrowserActionType> = new Set(['download']);

export const READ_ONLY_ACTIONS: ReadonlySet<BrowserActionType> = new Set([
  'navigate', 'scroll', 'wait', 'extract', 'read_text', 'read_dom', 'screenshot',
  'back', 'forward', 'reload',
]);

export const LIMITS = {
  selectorChars: 1_000,
  textChars: 10_000,
  valueChars: 1_000,
  urlChars: 2_048,
  waitMs: 5_000,
  scrollPx: 5_000,
  fileRefChars: 500,
} as const;

export type ParseResult =
  | { ok: true; action: BrowserAction }
  | { ok: false; code: 'VALIDATION_FAILED' | 'ACTION_NOT_SUPPORTED'; message: string };

function bad(message: string): ParseResult {
  return { ok: false, code: 'VALIDATION_FAILED', message };
}

function selectorOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (s.length === 0 || s.length > LIMITS.selectorChars) return null;
  // Kein javascript:-/Skript-Selektor: Playwright-Selektoren dürfen nichts ausführen.
  if (/^\s*(javascript|js)\s*[:=]/i.test(s)) return null;
  return s;
}

function optionalSelector(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  return selectorOf(value);
}

/** Schema-Prüfung einer einzelnen Aktion (untrusted Input). */
export function parseBrowserAction(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('action must be an object');
  const a = raw as Record<string, unknown>;
  const type = a.type;
  if (typeof type !== 'string' || !(BROWSER_ACTION_TYPES as readonly string[]).includes(type)) {
    return { ok: false, code: 'ACTION_NOT_SUPPORTED', message: `unsupported action: ${String(type).slice(0, 40)}` };
  }

  switch (type as BrowserActionType) {
    case 'navigate': {
      if (typeof a.url !== 'string' || a.url.trim().length === 0 || a.url.length > LIMITS.urlChars) {
        return bad('navigate.url must be 1..2048 chars');
      }
      return { ok: true, action: { type: 'navigate', url: a.url.trim() } };
    }
    case 'scroll': {
      if (a.direction !== 'up' && a.direction !== 'down') return bad('scroll.direction must be up|down');
      if (a.amount === undefined || a.amount === null) return { ok: true, action: { type: 'scroll', direction: a.direction } };
      if (typeof a.amount !== 'number' || !Number.isFinite(a.amount)) return bad('scroll.amount must be a number');
      const amount = Math.min(Math.max(Math.round(a.amount), 1), LIMITS.scrollPx);
      return { ok: true, action: { type: 'scroll', direction: a.direction, amount } };
    }
    case 'click':
    case 'submit':
    case 'download': {
      const selector = selectorOf(a.selector);
      if (!selector) return bad(`${type}.selector must be 1..${LIMITS.selectorChars} chars`);
      return { ok: true, action: { type, selector } as BrowserAction };
    }
    case 'type': {
      const selector = selectorOf(a.selector);
      if (!selector) return bad('type.selector must be 1..1000 chars');
      if (typeof a.text !== 'string' || a.text.length === 0 || a.text.length > LIMITS.textChars) {
        return bad(`type.text must be 1..${LIMITS.textChars} chars`);
      }
      return { ok: true, action: { type: 'type', selector, text: a.text } };
    }
    case 'select': {
      const selector = selectorOf(a.selector);
      if (!selector) return bad('select.selector must be 1..1000 chars');
      if (typeof a.value !== 'string' || a.value.length === 0 || a.value.length > LIMITS.valueChars) {
        return bad(`select.value must be 1..${LIMITS.valueChars} chars`);
      }
      return { ok: true, action: { type: 'select', selector, value: a.value } };
    }
    case 'wait': {
      if (typeof a.milliseconds !== 'number' || !Number.isFinite(a.milliseconds)) return bad('wait.milliseconds must be a number');
      return { ok: true, action: { type: 'wait', milliseconds: Math.min(Math.max(Math.round(a.milliseconds), 0), LIMITS.waitMs) } };
    }
    case 'extract':
    case 'read_text':
    case 'read_dom': {
      const selector = optionalSelector(a.selector);
      if (selector === null) return bad(`${type}.selector must be ≤ ${LIMITS.selectorChars} chars`);
      return { ok: true, action: (selector ? { type, selector } : { type }) as BrowserAction };
    }
    case 'screenshot':
    case 'back':
    case 'forward':
    case 'reload':
      return { ok: true, action: { type } as BrowserAction };
    case 'upload': {
      const selector = selectorOf(a.selector);
      if (!selector) return bad('upload.selector must be 1..1000 chars');
      if (typeof a.file_ref !== 'string' || a.file_ref.length === 0 || a.file_ref.length > LIMITS.fileRefChars) {
        return bad('upload.file_ref must be 1..500 chars');
      }
      return { ok: true, action: { type: 'upload', selector, file_ref: a.file_ref } };
    }
  }
  return { ok: false, code: 'ACTION_NOT_SUPPORTED', message: 'unsupported action' };
}

export function actionClass(type: BrowserActionType): 'mutation' | 'side_effect' | 'read_only' {
  if (MUTATING_ACTIONS.has(type)) return 'mutation';
  if (SIDE_EFFECT_ACTIONS.has(type)) return 'side_effect';
  return 'read_only';
}

/**
 * Anzeige-/Log-Form: eingegebener Text wird nie gespeichert oder angezeigt
 * (kann ein Passwort sein), nur seine Länge. Auswahlwerte bleiben sichtbar,
 * damit Freigebende wissen, was ausgewählt wird.
 */
export function redactAction(action: BrowserAction): Record<string, unknown> {
  if (action.type === 'type') {
    return { type: 'type', selector: action.selector, text: `[redacted:${action.text.length} chars]` };
  }
  if (action.type === 'upload') {
    return { type: 'upload', selector: action.selector, file_ref: '[redacted]' };
  }
  return { ...action };
}

/** Ziel einer Aktion für Log/Evidence (URL oder Selektor). */
export function actionTarget(action: BrowserAction): string | null {
  switch (action.type) {
    case 'navigate': return action.url;
    case 'click':
    case 'type':
    case 'select':
    case 'submit':
    case 'download':
    case 'upload':
      return action.selector;
    case 'extract':
    case 'read_text':
    case 'read_dom':
      return action.selector ?? null;
    default:
      return null;
  }
}

/**
 * Bindung einer Freigabe an Mandant, Session, Seite und die UNREDIGIERTE
 * Aktion. Liegt nur in browser_approval_bindings (service_role).
 */
export async function approvalFingerprint(input: {
  tenantId: string;
  browserSessionId: string;
  executorSessionId: string;
  pageUrl: string | null;
  action: BrowserAction;
}): Promise<string> {
  const digest = await sha256Hex(canonicalJson({
    v: 2,
    tenant_id: input.tenantId,
    browser_session_id: input.browserSessionId,
    executor_session_id: input.executorSessionId,
    page_url: input.pageUrl,
    action: input.action,
  }));
  return `browser:v2:${digest}`;
}

/** Nicht-sensitive Kurzbeschreibung für governance_approvals.requested_action. */
export function requestedActionLabel(action: BrowserAction): string {
  const target = actionTarget(action);
  return `browser:${action.type}${target ? `:${target.slice(0, 200)}` : ''}`;
}
