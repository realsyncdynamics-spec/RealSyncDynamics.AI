#!/usr/bin/env node
// Environment-Gate vor jedem `supabase db push` (Entscheidung E6).
//
// Ein Push darf nur laufen, wenn das Ziel eindeutig feststeht: Das
// GitHub-Environment (z. B. `production`) nennt per Variable die erwartete
// Projekt-Ref, das Deploy-Secret und der tatsächlich verlinkte Stand
// (`supabase/.temp/project-ref`) müssen genau diese Ref tragen. Fehlt
// irgendein Teil oder widerspricht er, bricht das Gate ab (fail-closed).
//
//   verify  → prüft Ziel, Exit 1 bei jedem Befund
//   redact  → filtert stdin → stdout und ersetzt Zugangsdaten durch ***
//
// Ausgaben nennen Projekt-Refs nur maskiert (letzte vier Zeichen), Passwörter
// und Tokens nie.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENVIRONMENTS = ['production', 'staging'];

/** Supabase-Projekt-Refs sind 20 Kleinbuchstaben. */
export const PROJECT_REF_RE = /^[a-z]{20}$/;

export const DEFAULT_LINKED_REF_FILE = 'supabase/.temp/project-ref';

export function maskRef(ref) {
  const value = (ref ?? '').trim();
  if (!value) return '(leer)';
  if (value.length <= 4) return '***';
  return `***${value.slice(-4)}`;
}

/**
 * Reine Prüfung ohne Seiteneffekte. Reihenfolge = Priorität des Befunds.
 * @returns {{ ok: true, environment: string, ref: string } | { ok: false, code: string, message: string }}
 */
export function verifyDbTarget({ environment, expectedRef, targetRef, linkedRef, gitRef }) {
  const env = (environment ?? '').trim();
  const expected = (expectedRef ?? '').trim();
  const target = (targetRef ?? '').trim();
  const linked = (linkedRef ?? '').trim();

  const fail = (code, message) => ({ ok: false, code, message });

  if (!env) {
    return fail('ENV_MISSING', 'DEPLOY_ENVIRONMENT ist nicht gesetzt — Ziel-Environment unbekannt.');
  }
  if (!ENVIRONMENTS.includes(env)) {
    return fail('ENV_UNKNOWN', `DEPLOY_ENVIRONMENT „${env}“ ist nicht zugelassen (${ENVIRONMENTS.join(', ')}).`);
  }
  if (!expected) {
    return fail(
      'EXPECTED_REF_MISSING',
      `Für Environment „${env}“ ist keine erwartete Projekt-Ref hinterlegt (Variable SUPABASE_EXPECTED_PROJECT_REF).`,
    );
  }
  if (!PROJECT_REF_RE.test(expected)) {
    return fail('EXPECTED_REF_INVALID', `Erwartete Projekt-Ref ${maskRef(expected)} hat kein gültiges Format.`);
  }
  if (!target) {
    return fail('TARGET_REF_MISSING', 'Deploy-Ziel (SUPABASE_PROJECT_ID) ist leer.');
  }
  if (target !== expected) {
    return fail(
      'TARGET_REF_MISMATCH',
      `Deploy-Ziel ${maskRef(target)} passt nicht zum Environment „${env}“ (erwartet ${maskRef(expected)}).`,
    );
  }
  if (!linked) {
    return fail('LINKED_REF_MISSING', 'Kein verlinktes Projekt gefunden — `supabase link` fehlt oder schlug fehl.');
  }
  if (linked !== expected) {
    return fail(
      'LINKED_REF_MISMATCH',
      `Verlinktes Projekt ${maskRef(linked)} passt nicht zum Environment „${env}“ (erwartet ${maskRef(expected)}).`,
    );
  }
  if (env === 'production' && (gitRef ?? '').trim() !== 'refs/heads/main') {
    return fail('PRODUCTION_NOT_MAIN', 'Production-Push ist nur vom Stand refs/heads/main erlaubt.');
  }
  return { ok: true, environment: env, ref: expected };
}

const URI_CREDENTIALS_RE = /\b(postgres(?:ql)?):\/\/[^\s:@/]+:[^\s@/]+@/gi;
const SUPABASE_TOKEN_RE = /\bsbp_[A-Za-z0-9]{8,}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const PASSWORD_PARAM_RE = /\b(password|passwd|pwd)=[^\s&;]+/gi;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ersetzt bekannte Secret-Werte und typische Zugangsdaten-Muster durch ***. */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? '');
  const known = secrets
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length >= 4)
    // Längere zuerst, damit ein Teilstring nicht die Hälfte stehen lässt.
    .sort((a, b) => b.length - a.length);
  for (const secret of known) {
    out = out.replace(new RegExp(escapeRegExp(secret), 'g'), '***');
  }
  return out
    .replace(URI_CREDENTIALS_RE, '$1://***:***@')
    .replace(SUPABASE_TOKEN_RE, 'sbp_***')
    .replace(JWT_RE, '***')
    .replace(PASSWORD_PARAM_RE, '$1=***');
}

function readLinkedRef(path) {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}

function envSecrets(env) {
  return [env.SUPABASE_DB_PASSWORD, env.SUPABASE_ACCESS_TOKEN, env.SUPABASE_SERVICE_ROLE_KEY];
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {{ log: (msg: string) => unknown, error: (msg: string) => unknown }} [log]
 */
export function runVerify(env = process.env, log = console) {
  const result = verifyDbTarget({
    environment: env.DEPLOY_ENVIRONMENT,
    expectedRef: env.SUPABASE_EXPECTED_PROJECT_REF,
    targetRef: env.SUPABASE_PROJECT_ID,
    linkedRef: readLinkedRef(env.SUPABASE_LINKED_REF_FILE || DEFAULT_LINKED_REF_FILE),
    gitRef: env.GITHUB_REF,
  });
  if (!result.ok) {
    log.error(`::error title=DB-Ziel nicht verifiziert (${result.code})::${result.message}`);
    log.error('db push abgebrochen (fail-closed). Runbook: docs/runbooks/db-push-environment-gate.md');
    return 1;
  }
  log.log(`DB-Ziel verifiziert: Environment „${result.environment}“, Projekt ${maskRef(result.ref)}.`);
  return 0;
}

async function runRedact(env = process.env) {
  const secrets = envSecrets(env);
  let buffer = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    buffer += chunk;
    const lastNewline = buffer.lastIndexOf('\n');
    if (lastNewline >= 0) {
      process.stdout.write(redactSecrets(buffer.slice(0, lastNewline + 1), secrets));
      buffer = buffer.slice(lastNewline + 1);
    }
  }
  if (buffer) process.stdout.write(redactSecrets(buffer, secrets));
  return 0;
}

const isMain = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const mode = process.argv[2];
  if (mode === 'verify') {
    process.exit(runVerify());
  } else if (mode === 'redact') {
    runRedact().then((code) => process.exit(code));
  } else {
    console.error('Usage: node scripts/ci/verify-db-target.mjs <verify|redact>');
    process.exit(2);
  }
}
