// Fingerprint einer freigabepflichtigen Browser-Aktion (governance_approvals.requested_action).
//
// v1 (bis PR A): sha256(JSON.stringify({session_id, actions})).
//   Lücke G2: Eine Freigabe für "click #senden" band weder den Empfänger
//   (Formularziel) noch den Inhalt, der tatsächlich gesendet wird.
//
// v2: bindet zusätzlich das Ziel der verändernden Aktion:
//   target = { origin, method, values_hash }
//   - origin:      http(s)-Origin, an den die Aktion wirkt (Formular-action bzw. Seite)
//   - method:      HTTP-Methode des Formulars (GET/POST/…), ohne Formular "NONE"
//   - values_hash: sha256 über die kanonischen Formularwerte zum Freigabezeitpunkt
//   fingerprint = "browser:v2:" + sha256_hex(utf8(RFC8785_JCS({session_id, actions, target})))
//
// Ändert sich Empfänger, Methode oder Inhalt, ändert sich der Fingerprint ⇒
// reserve_browser_execution liefert 'mismatch' ⇒ neue Freigabe nötig.
// v1-Freigaben werden nicht migriert; sie passen nicht mehr und laufen aus.
//
// Der Server prüft hier nur die ANGABE des Clients. Dass Ziel und Inhalt beim
// Ausführen tatsächlich so im DOM stehen, muss der Executor unmittelbar vor der
// Aktion prüfen (expected_target). Der Desktop-Executor (RealSync Browser OS)
// tut das; für den Playwright-Dienst ist es nicht belegt.
//
// Keine Deno-Imports: vitest-importierbar.

import { canonicalJson } from './evidence-hash.ts';
import { sha256Hex } from './hash.ts';

export const FINGERPRINT_VERSION = 'browser:v2';
export const MAX_TARGET_FIELDS = 50;
export const MAX_FIELD_NAME = 100;
export const MAX_FIELD_VALUE = 2000;
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'NONE']);

export interface BrowserTargetInput {
  origin: string;
  method: string;
  values: Record<string, string>;
}

export interface NormalizedTarget {
  origin: string;
  method: string;
  values: Record<string, string>;
  values_hash: string;
}

export type TargetResult = { ok: true; target: NormalizedTarget } | { ok: false; error: string };

/** Ziel einer verändernden Aktion streng prüfen und normalisieren. */
export async function normalizeTarget(raw: unknown): Promise<TargetResult> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'target must be an object' };
  const t = raw as Record<string, unknown>;

  if (typeof t.origin !== 'string') return { ok: false, error: 'target.origin required' };
  let origin: string;
  try {
    const u = new URL(t.origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'target.origin must be http(s)' };
    // Nur ein reiner Origin ist zulässig – kein Pfad, keine Query, kein Fragment, keine Zugangsdaten.
    if (u.pathname !== '/' || u.search || u.hash || u.username || u.password || /[?#]/.test(t.origin)) {
      return { ok: false, error: 'target.origin must be a bare origin' };
    }
    origin = u.origin; // normalisiert (Kleinschreibung, Standardport entfernt)
  } catch {
    return { ok: false, error: 'target.origin invalid' };
  }

  const method = typeof t.method === 'string' ? t.method.toUpperCase() : '';
  if (!METHODS.has(method)) return { ok: false, error: 'target.method invalid' };

  const rawValues = t.values ?? {};
  if (!rawValues || typeof rawValues !== 'object' || Array.isArray(rawValues)) return { ok: false, error: 'target.values must be an object' };
  const entries = Object.entries(rawValues as Record<string, unknown>);
  if (entries.length > MAX_TARGET_FIELDS) return { ok: false, error: `target.values: at most ${MAX_TARGET_FIELDS} fields` };
  const values: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (!k || k.length > MAX_FIELD_NAME) return { ok: false, error: 'target.values: invalid field name' };
    if (typeof v !== 'string' || v.length > MAX_FIELD_VALUE) return { ok: false, error: `target.values.${k} must be a string ≤ ${MAX_FIELD_VALUE}` };
    values[k] = v;
  }
  if (method === 'NONE' && entries.length > 0) return { ok: false, error: 'target.values must be empty when method is NONE' };

  const values_hash = await sha256Hex(canonicalJson(values));
  return { ok: true, target: { origin, method, values, values_hash } };
}

/** Fingerprint v2. Für reine Lese-Anfragen ist target null. */
export async function browserFingerprint(sessionId: string, actions: unknown[], target: NormalizedTarget | null): Promise<string> {
  const bound = target ? { origin: target.origin, method: target.method, values_hash: target.values_hash } : null;
  const digest = await sha256Hex(canonicalJson({ session_id: sessionId, actions, target: bound }));
  return `${FINGERPRINT_VERSION}:${digest}`;
}

/** Für Event-Payload und Evidence: keine Klartextwerte, nur Feldnamen, Längen und Hash. */
export function targetSummary(target: NormalizedTarget | null): Record<string, unknown> | null {
  if (!target) return null;
  return {
    origin: target.origin,
    method: target.method,
    fields: Object.keys(target.values).sort().map((name) => ({ name, length: target.values[name].length })),
    values_hash: target.values_hash,
  };
}
