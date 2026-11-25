/**
 * Vertrag am Quelltext: serverseitige Freigabe für Sekretariats-Bots.
 * Ergänzt den DB-Test (test/runtime/db/secretariat-approval-gate.db.test.ts),
 * der nur mit TEST_DB_URL läuft. Dieser Test läuft im normalen Unit-Job.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sql = readFileSync(join(ROOT, 'supabase/migrations/20261125183000_secretariat_bot_approval_gate.sql'), 'utf8');
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const bots = readFileSync(join(ROOT, 'supabase/functions/_shared/bots.ts'), 'utf8');
const ui = readFileSync(join(ROOT, 'src/features/secretariat/SecretariatCard.tsx'), 'utf8');
const lib = readFileSync(join(ROOT, 'src/features/secretariat/secretariatBot.ts'), 'utf8');

function fnBody(name: string): string {
  const start = code.indexOf(`FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const end = code.indexOf('$$;', start);
  return code.slice(start, end);
}

describe('Migration 20261125183000 – Freigabe-Gate', () => {
  it('ist additiv: kein DROP TABLE/COLUMN, kein DELETE/TRUNCATE, keine Änderung bestehender Policies auf bots', () => {
    expect(code).not.toMatch(/DROP\s+(TABLE|COLUMN|FUNCTION)/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
    expect(code).not.toMatch(/POLICY[^;]*ON\s+public\.bots\b/i);
    expect(code).not.toMatch(/ALTER\s+TABLE\s+public\.bots\b/i);
  });

  it('Trigger auf INSERT und UPDATE, nur für Sekretariats-Bots', () => {
    expect(code).toMatch(/CREATE TRIGGER bots_secretariat_approval_guard\s+BEFORE INSERT OR UPDATE ON public\.bots/);
    const body = fnBody('bots_secretariat_approval_guard');
    expect(body).toMatch(/NEW\.config \? 'secretariat'/);
    expect(body).toMatch(/IF NOT v_is_secretariat THEN\s+RETURN NEW;/);
    expect(body).toMatch(/NEW\.enabled AND NOT public\.bot_has_valid_approval\(NEW\)/);
    expect(body).toMatch(/invalidated_reason = 'content_changed'/);
    expect(body).toMatch(/is_tenant_owner_or_admin\(NEW\.tenant_id\)/);
  });

  it('alle SECURITY-DEFINER-Funktionen setzen einen leeren search_path und sind für anon gesperrt', () => {
    // Kopf jeder Funktion: von CREATE OR REPLACE FUNCTION bis AS $$.
    const heads = code.split('CREATE OR REPLACE FUNCTION public.').slice(1).map((h) => h.slice(0, h.indexOf('AS $$')));
    const definers = heads.filter((h) => /SECURITY DEFINER/.test(h)).map((h) => h.slice(0, h.indexOf('(')));
    for (const h of heads.filter((x) => /SECURITY DEFINER/.test(x))) expect(h).toMatch(/SET search_path = ''/);
    expect(definers.sort()).toEqual([
      'approve_secretariat_bot', 'bot_has_valid_approval', 'bot_runtime_approval_ok',
      'bots_secretariat_approval_guard', 'secretariat_bot_approval_status',
    ]);
    for (const fn of definers) {
      expect(code, fn).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon`));
    }
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION public\.bot_runtime_approval_ok\(UUID\) TO service_role;/);
    expect(code).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.bot_runtime_approval_ok\(UUID\) TO authenticated/);
  });

  it('Freigaben sind für Clients und service_role nicht direkt schreibbar', () => {
    expect(code).toMatch(/REVOKE ALL ON public\.bot_approvals FROM PUBLIC, anon, authenticated, service_role;/);
    expect(code).toMatch(/GRANT SELECT ON public\.bot_approvals TO authenticated;/);
    expect(code).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*bot_approvals/i);
  });

  it('Freigabe-RPC: Nutzer und Rolle aus der Sitzung, Hash serverseitig, Stand geprüft', () => {
    const body = fnBody('approve_secretariat_bot');
    const signature = body.slice(0, body.indexOf(')'));
    expect(signature).not.toMatch(/p_tenant|p_user|p_role|p_hash|p_sha/i);
    expect(body).toMatch(/v_uid\s+UUID := auth\.uid\(\)/);
    expect(body).toMatch(/is_tenant_owner_or_admin\(v_bot\.tenant_id\)/);
    expect(body).toMatch(/v_bot\.updated_at IS DISTINCT FROM p_expected_updated_at/);
    expect(body).toMatch(/v_hash := public\.bot_approval_subject_sha256\(v_bot\)/);
    expect(body).toMatch(/FOR UPDATE/);
  });

  it('Prüfgegenstand umfasst Persona, Begrüßung, Kanal, Fähigkeiten und Konfiguration ohne Alt-Freigabe', () => {
    const body = fnBody('bot_approval_subject');
    for (const key of ['persona', 'greeting', 'channel', 'capabilities', 'tenant_id']) {
      expect(body, key).toMatch(new RegExp(`'${key}',\\s+p_bot\\.${key}`));
    }
    expect(body).toMatch(/'config',\s+p_bot\.config #- '\{secretariat,approval\}'/);
  });
});

describe('Laufzeit und Oberfläche', () => {
  it('resolveBot prüft Sekretariats-Bots serverseitig und fail-closed', () => {
    const fn = bots.slice(bots.indexOf('export async function resolveBot('), bots.indexOf('export async function findExistingConversationId'));
    expect(fn).toMatch(/isSecretariatConfig\(row\.config\)/);
    expect(fn).toMatch(/rpc\('bot_runtime_approval_ok', \{ p_bot_id: row\.id \}\)/);
    expect(fn).toMatch(/approved !== true\) throw new BotError\('bot is not approved', 'FORBIDDEN', 403\)/);
    expect(fn).toMatch(/'APPROVAL_CHECK_FAILED', 503/);
  });

  it('die Oberfläche schreibt weder Freigabe noch Hash und aktiviert nicht selbst', () => {
    expect(ui).not.toMatch(/approvalPatch|fieldsSha256|canonicalHash/);
    expect(ui).toMatch(/approveSecretariatBot\(approvalRequest\(/);
    expect(lib).not.toMatch(/canonicalHash|fieldsSha256/);
    expect(lib).toMatch(/export const SECRETARIAT_ACTIVATION_LOCKED = true;/);
  });
});
