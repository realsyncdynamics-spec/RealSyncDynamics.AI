/**
 * KI-Sekretariat — Freigabe-Gate, Vertrag am Quelltext.
 *
 * Die Durchsetzung prüft test/runtime/db/secretariat-server-gate.db.test.ts
 * gegen echtes Postgres. Hier stehen Eigenschaften, die ein späterer Edit
 * leicht übersieht und die ohne Datenbank prüfbar sind:
 *
 *  1. Jede SECURITY-DEFINER-Funktion setzt `search_path = ''`.
 *  2. Jede Funktion entzieht PUBLIC und anon die Ausführung; Trigger- und
 *     Hash-Funktion zusätzlich authenticated.
 *  3. Kein Eingriff in die Bot-Policies (#2178) und in `bots_enforce_quota`;
 *     rein additiv.
 *  4. Die Freigabe-Tabelle hat keine Schreib-Policy und keine Schreibrechte.
 *  5. Der Mandant kommt nie aus Parametern; der Client-Hash wird nie
 *     gespeichert.
 *  6. Genau eine Hash-Implementierung (SQL): Die Runtime fragt nur die RPC.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = (p: string) => resolve(__dirname, '../..', p);
const MIGRATION = readFileSync(root('supabase/migrations/20261125180000_secretariat_server_gate.sql'), 'utf8');
const BOTS_TS = readFileSync(root('supabase/functions/_shared/bots.ts'), 'utf8');

/** SQL ohne Zeilenkommentare — Kommentare dürfen Namen nennen, Anweisungen nicht. */
const SQL = MIGRATION.replace(/--[^\n]*/g, '');

interface Fn { name: string; head: string; body: string }

function funktionen(sql: string): Fn[] {
  const out: Fn[] = [];
  const re = /CREATE OR REPLACE FUNCTION public\.(\w+)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const start = m.index;
    const a = sql.indexOf('$function$', start);
    const b = sql.indexOf('$function$', a + 10);
    out.push({ name: m[1]!, head: sql.slice(start, a), body: sql.slice(a + 10, b) });
  }
  return out;
}

const FNS = funktionen(SQL);
const byName = (n: string) => {
  const f = FNS.find((x) => x.name === n);
  expect(f, `${n} fehlt`).toBeDefined();
  return f!;
};

describe('Migration 20261125180000 — Funktionen', () => {
  it('legt genau die fünf Gate-Funktionen an', () => {
    expect(FNS.map((f) => f.name).sort()).toEqual([
      'approve_secretariat_bot',
      'bots_secretariat_gate',
      'secretariat_bot_approvals_append_only',
      'secretariat_bot_content_sha256',
      'secretariat_bot_gate_status',
    ]);
  });

  it("jede Funktion setzt search_path = '' (SECURITY DEFINER nie ohne)", () => {
    for (const f of FNS) {
      expect(f.head, `${f.name}: search_path`).toMatch(/SET search_path = ''/);
      expect(f.head, `${f.name}: kein abweichender search_path`).not.toMatch(/SET search_path TO/);
    }
    const definer = FNS.filter((f) => /SECURITY DEFINER/.test(f.head)).map((f) => f.name).sort();
    expect(definer).toEqual([
      'approve_secretariat_bot',
      'bots_secretariat_gate',
      'secretariat_bot_approvals_append_only',
      'secretariat_bot_gate_status',
    ]);
  });

  it('REVOKE für PUBLIC und anon an jeder Funktion; Trigger und Hash auch für authenticated', () => {
    const revokes = SQL.match(/REVOKE ALL ON FUNCTION public\.\w+\([^)]*\)\s+FROM [^;]+;/g) ?? [];
    const zeile = (n: string) => revokes.find((r) => r.includes(`public.${n}(`)) ?? '';
    for (const f of FNS) {
      expect(zeile(f.name), `${f.name}: REVOKE`).toMatch(/FROM PUBLIC, anon/);
    }
    for (const n of ['bots_secretariat_gate', 'secretariat_bot_content_sha256', 'secretariat_bot_approvals_append_only']) {
      expect(zeile(n), `${n}: authenticated`).toMatch(/FROM PUBLIC, anon, authenticated/);
    }
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.approve_secretariat_bot\(uuid, text, boolean\) TO authenticated;/);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.secretariat_bot_gate_status\(uuid\) TO authenticated, service_role;/);
    expect(SQL).not.toMatch(/GRANT [^;]*TO [^;]*\banon\b/);
  });

  it('Freigabe-RPC: Mandant nie aus Parametern, Client-Hash nie gespeichert', () => {
    const f = byName('approve_secretariat_bot');
    expect(f.head.replace(/\s+/g, ' ')).toContain(
      'approve_secretariat_bot( p_bot_id uuid, p_content_sha256 text, p_activate boolean DEFAULT false )');
    expect(f.head).not.toMatch(/p_tenant/);
    expect(f.body).toMatch(/v_uid\s+uuid := auth\.uid\(\)/);
    expect(f.body).toContain('public.is_tenant_owner_or_admin(v_tenant)');
    expect(f.body).toContain('FOR UPDATE');
    // p_content_sha256 nur im Vergleich, die gespeicherte Zeile trägt v_hash.
    const vorkommen = f.body.match(/p_content_sha256/g) ?? [];
    expect(vorkommen.length).toBe(2);
    expect(f.body).toMatch(/VALUES \(v_bot\.id, v_bot\.tenant_id, v_hash, v_uid\)/);
  });

  it('42501 bei fehlender Anmeldung, unbekanntem Bot und fehlender Rolle — eine Meldung', () => {
    const f = byName('approve_secretariat_bot');
    const meldungen = f.body.match(/RAISE EXCEPTION '([^']+)' USING ERRCODE = '42501'/g) ?? [];
    expect(meldungen.length).toBe(3);
    expect(new Set(meldungen).size).toBe(1);
  });

  it('Gate-Trigger gilt für jede Rolle; service_role nur bei der Rollenprüfung ausgenommen', () => {
    const f = byName('bots_secretariat_gate');
    expect(f.body.match(/service_role/g)?.length).toBe(1);
    expect(f.body).toContain('NEW.enabled := false');
    expect(SQL).toMatch(/CREATE TRIGGER bots_secretariat_gate\s+BEFORE INSERT OR UPDATE ON public\.bots/);
  });
});

describe('Migration 20261125180000 — Abgrenzung', () => {
  it('kein Eingriff in Bot-Policies oder bots_enforce_quota', () => {
    expect(SQL).not.toMatch(/(CREATE|DROP|ALTER) POLICY[^;]*ON public\.bots\b/);
    expect(SQL).not.toMatch(/bots_enforce_quota/);
    expect(SQL).not.toMatch(/ALTER TABLE public\.bots\b/);
  });

  it('rein additiv: nichts wird gelöscht', () => {
    expect(SQL).not.toMatch(/DROP (TABLE|FUNCTION|SCHEMA|COLUMN|INDEX)/);
    expect(SQL).not.toMatch(/\bTRUNCATE\b/);
    expect(SQL).not.toMatch(/\bDELETE FROM\b/);
    const drops = SQL.match(/DROP (TRIGGER|POLICY) IF EXISTS \w+ ON public\.\w+/g) ?? [];
    expect(drops.sort()).toEqual([
      'DROP POLICY IF EXISTS secretariat_bot_approvals_select_member ON public.secretariat_bot_approvals',
      'DROP TRIGGER IF EXISTS bots_secretariat_gate ON public.bots',
      'DROP TRIGGER IF EXISTS secretariat_bot_approvals_append_only ON public.secretariat_bot_approvals',
    ]);
  });

  it('Freigabe-Tabelle: RLS an, nur SELECT-Policy, keine Schreibrechte', () => {
    expect(SQL).toContain('ALTER TABLE public.secretariat_bot_approvals ENABLE ROW LEVEL SECURITY;');
    expect(SQL).toContain('REVOKE ALL ON public.secretariat_bot_approvals FROM PUBLIC, anon, authenticated, service_role;');
    expect(SQL).toContain('GRANT SELECT ON public.secretariat_bot_approvals TO authenticated, service_role;');
    const policies = SQL.match(/CREATE POLICY \w+ ON public\.secretariat_bot_approvals\s+FOR \w+/g) ?? [];
    expect(policies).toEqual(['CREATE POLICY secretariat_bot_approvals_select_member ON public.secretariat_bot_approvals\n  FOR SELECT']);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*secretariat_bot_approvals/);
  });

  it('Prüfpfad nutzt die bestehende Tabelle governance_admin_log, ohne Kontaktdaten', () => {
    expect(SQL).not.toMatch(/CREATE TABLE[^;]*audit/i);
    const inserts = SQL.match(/INSERT INTO public\.governance_admin_log[\s\S]*?\);/g) ?? [];
    expect(inserts.length).toBe(3);
    for (const i of inserts) expect(i).toMatch(/auth\.uid\(\)|v_uid/);
    for (const i of inserts) expect(i, 'actor_email bleibt leer').toMatch(/, NULL, 'secretariat\./);
  });
});

describe('Runtime — resolveBot fragt nur die Datenbank', () => {
  it('ruft secretariat_bot_gate_status und lehnt fail-closed ab', () => {
    expect(BOTS_TS).toContain(`admin.rpc('secretariat_bot_gate_status', { p_bot_id: row.id })`);
    expect(BOTS_TS).toContain(`new BotError('secretariat not approved', 'FORBIDDEN', 403)`);
    expect(BOTS_TS).toContain('status.approved === true');
  });

  it('keine zweite Hash-Implementierung in TypeScript', () => {
    expect(BOTS_TS).not.toMatch(/sha-?256|crypto\.subtle|canonicalHash|createHash/i);
  });
});
