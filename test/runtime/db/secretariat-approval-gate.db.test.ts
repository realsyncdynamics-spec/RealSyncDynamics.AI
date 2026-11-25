/**
 * KI-Sekretariat — serverseitige Freigabe und Aktivierungsprüfung
 * (Migration 20261125183000_secretariat_bot_approval_gate.sql).
 *
 * ## Warum gegen echtes Postgres
 *
 * Die Sperre steht in einem BEFORE-Trigger, in SECURITY-DEFINER-Funktionen und
 * in Grants. Ob ein direkter PostgREST-Schreibzugriff (`UPDATE bots SET
 * enabled = true`) abgewiesen wird, lässt sich nur gegen die echte Datenbank
 * zeigen, nicht mit einem Mock.
 *
 * ## Matrix
 *
 *   Insert aktiv (auch service_role)              → 42501
 *   direktes Aktivieren ohne Freigabe (Owner)     → 42501
 *   Freigabe durch Editor / fremden Owner         → 42501
 *   Freigabe mit veraltetem Stand                 → 40001
 *   Freigabe durch Owner                          → Hash serverseitig, Bot bleibt aus
 *   Aktivieren danach: Editor → 42501, Owner → OK
 *   Inhaltsänderung bei aktivem Bot               → 42501 (muss pausiert werden)
 *   Inhaltsänderung bei pausiertem Bot            → Freigabe ungültig, auch nach Rücksetzen
 *   Freigaben direkt schreiben (authenticated)    → verweigert
 *   Kennzeichnung entfernen                       → 42501
 *   Laufzeitprüfung bot_runtime_approval_ok       → nur service_role; folgt der Freigabe
 *   Status-RPC                                    → Mitglied ja, fremder Mandant nein
 *   allgemeiner Bot                               → unverändert (Editor darf aktivieren)
 *
 * Fixture-Inserts laufen mit service_role-Claims (Muster bots-quota.db.test.ts).
 * Ohne TEST_DB_URL wird übersprungen; mit REQUIRE_DB_TESTS=1 ist das ein Fehler.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('secretariat approval gate', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;

const FIELDS = {
  businessName: { status: 'known', value: 'Muster GmbH', confidence: 'medium', source: { url: 'https://muster.de/', fetchedAt: 'x', method: 'title', excerpt: '' } },
  phone: { status: 'known', value: '0221 1234567', confidence: 'high', source: { url: 'https://muster.de/', fetchedAt: 'x', method: 'phone-pattern', excerpt: '' } },
  email: { status: 'unknown', value: null, reason: 'keine' },
};
const SECRETARIAT_CONFIG = {
  vertical: 'general',
  secretariat: { version: 'sekretariat-2026.11.1', sourceUrl: 'https://muster.de/', fetchedAt: 'x', fields: FIELDS },
};

d('KI-Sekretariat: serverseitige Freigabe und Aktivierung', () => {
  let ctx: DbCtx;
  let tenantId: string;
  let ownerId: string;
  let editorId: string;
  let foreignOwnerId: string;
  let botId: string;

  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx.client.query<T>(sql, p);

  /** Führt fn mit Claims aus; liefert 'OK' oder den SQLSTATE der Ablehnung. */
  async function codeOf(claims: { sub?: string; role?: string }, fn: () => Promise<unknown>): Promise<string> {
    try {
      await ctx.withClaims(claims, fn);
      return 'OK';
    } catch (e) {
      return (e as PgError).code ?? (e as Error).message;
    }
  }
  const asUser = (sub: string) => ({ sub, role: 'authenticated' });

  async function updatedAt(id = botId): Promise<string> {
    // Als Text: JS-Date verlöre die Mikrosekunden, die RPC vergleicht exakt.
    const { rows } = await q<{ u: string }>(`SELECT updated_at::text AS u FROM public.bots WHERE id = $1`, [id]);
    return rows[0]!.u;
  }
  async function approve(sub: string, activate = false, expected?: string): Promise<string> {
    const at = expected ?? (await updatedAt());
    return codeOf(asUser(sub), () => q(`SELECT * FROM public.approve_secretariat_bot($1, $2::timestamptz, $3)`, [botId, at, activate]));
  }
  async function setEnabled(claims: { sub?: string; role?: string }, enabled: boolean, id = botId): Promise<string> {
    return codeOf(claims, async () => {
      const r = await q(`UPDATE public.bots SET enabled = $2 WHERE id = $1`, [id, enabled]);
      if (r.rowCount !== 1) throw Object.assign(new Error('no row'), { code: 'NOROW' });
    });
  }
  async function activeApprovals(): Promise<number> {
    const { rows } = await q<{ n: number }>(`SELECT count(*)::int AS n FROM public.bot_approvals WHERE bot_id = $1 AND invalidated_at IS NULL`, [botId]);
    return rows[0]!.n;
  }
  async function runtimeOk(id = botId): Promise<boolean | null> {
    return ctx.withClaims(SERVER, async () => {
      const { rows } = await q<{ ok: boolean | null }>(`SELECT public.bot_runtime_approval_ok($1) AS ok`, [id]);
      return rows[0]!.ok;
    });
  }

  beforeEach(async () => {
    ctx = await openDb();
    ({ tenantId, userId: ownerId } = await createTenantWithMember(ctx));
    await q(
      `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active', stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`,
      [tenantId],
    );
    const { rows: e } = await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [`ed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`]);
    editorId = e[0]!.id;
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'editor')`, [tenantId, editorId]);
    ({ userId: foreignOwnerId } = await createTenantWithMember(ctx));
    botId = await ctx.withClaims(SERVER, async () => {
      const { rows } = await q<{ id: string }>(
        `INSERT INTO public.bots (tenant_id, name, persona, greeting, config, enabled)
         VALUES ($1, 'Sekretariat Muster GmbH', 'Persona A', 'Hallo', $2::jsonb, false) RETURNING id`,
        [tenantId, JSON.stringify(SECRETARIAT_CONFIG)],
      );
      return rows[0]!.id;
    });
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('Objekte existieren; Freigaben und Hilfsfunktionen sind für Clients nicht schreib- bzw. aufrufbar', async () => {
    const { rows: t } = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'bots_secretariat_approval_guard' AND tgrelid = 'public.bots'::regclass`,
    );
    expect(t[0]!.n).toBe(1);
    const { rows: g } = await q<{ ins: boolean; upd: boolean; sel: boolean; svc_ins: boolean }>(
      `SELECT has_table_privilege('authenticated', 'public.bot_approvals', 'INSERT') AS ins,
              has_table_privilege('authenticated', 'public.bot_approvals', 'UPDATE') AS upd,
              has_table_privilege('authenticated', 'public.bot_approvals', 'SELECT') AS sel,
              has_table_privilege('service_role', 'public.bot_approvals', 'INSERT') AS svc_ins`,
    );
    expect(g[0]).toEqual({ ins: false, upd: false, sel: true, svc_ins: false });
    const { rows: f } = await q<{ anon_approve: boolean; auth_runtime: boolean; svc_runtime: boolean }>(
      `SELECT has_function_privilege('anon', 'public.approve_secretariat_bot(uuid, timestamptz, boolean)', 'EXECUTE') AS anon_approve,
              has_function_privilege('authenticated', 'public.bot_runtime_approval_ok(uuid)', 'EXECUTE') AS auth_runtime,
              has_function_privilege('service_role', 'public.bot_runtime_approval_ok(uuid)', 'EXECUTE') AS svc_runtime`,
    );
    expect(f[0]).toEqual({ anon_approve: false, auth_runtime: false, svc_runtime: true });
  });

  it('aktiver Insert ist ohne Freigabe unmöglich – auch für service_role', async () => {
    expect(await codeOf(SERVER, () => q(
      `INSERT INTO public.bots (tenant_id, name, config, enabled) VALUES ($1, 'x', $2::jsonb, true)`,
      [tenantId, JSON.stringify(SECRETARIAT_CONFIG)],
    ))).toBe('42501');
  });

  it('direktes Aktivieren ohne Freigabe wird abgewiesen (Owner, Editor, service_role)', async () => {
    expect(await setEnabled(asUser(ownerId), true)).toBe('42501');
    expect(await setEnabled(asUser(editorId), true)).toBe('42501');
    expect(await setEnabled(SERVER, true)).toBe('42501');
    expect(await runtimeOk()).toBe(false);
  });

  it('Freigabe nur durch Owner/Admin des Mandanten und nur für den geprüften Stand', async () => {
    expect(await approve(editorId)).toBe('42501');
    expect(await approve(foreignOwnerId)).toBe('42501');
    expect(await approve(ownerId, false, '2000-01-01T00:00:00Z')).toBe('40001');
    expect(await codeOf({ role: 'anon' }, () => q(`SELECT * FROM public.approve_secretariat_bot($1, now(), false)`, [botId]))).not.toBe('OK');
    expect(await activeApprovals()).toBe(0);
  });

  it('Owner-Freigabe: Hash serverseitig, Bot bleibt aus; Aktivieren danach nur Owner/Admin', async () => {
    expect(await approve(ownerId)).toBe('OK');
    const { rows } = await q<{ subject_sha256: string; approved_by: string; enabled: boolean; expected: string }>(
      `SELECT a.subject_sha256, a.approved_by, b.enabled, public.bot_approval_subject_sha256(b) AS expected
         FROM public.bot_approvals a JOIN public.bots b ON b.id = a.bot_id
        WHERE a.bot_id = $1 AND a.invalidated_at IS NULL`,
      [botId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.subject_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.subject_sha256).toBe(rows[0]!.expected);
    expect(rows[0]!.approved_by).toBe(ownerId);
    expect(rows[0]!.enabled).toBe(false);
    expect(await runtimeOk()).toBe(true);

    expect(await setEnabled(asUser(editorId), true)).toBe('42501');
    expect(await setEnabled(asUser(ownerId), true)).toBe('OK');
    // Pausieren ist immer erlaubt.
    expect(await setEnabled(asUser(editorId), false)).toBe('OK');
  });

  it('p_activate = true aktiviert in einem Schritt', async () => {
    expect(await approve(ownerId, true)).toBe('OK');
    const { rows } = await q<{ enabled: boolean }>(`SELECT enabled FROM public.bots WHERE id = $1`, [botId]);
    expect(rows[0]!.enabled).toBe(true);
  });

  it('Inhaltsänderung: aktiv abgewiesen, pausiert macht sie die Freigabe dauerhaft ungültig', async () => {
    expect(await approve(ownerId, true)).toBe('OK');
    // Aktiv bleiben und Persona ändern → abgewiesen, Freigabe bleibt (Rollback).
    expect(await codeOf(asUser(ownerId), () => q(`UPDATE public.bots SET persona = 'Persona B' WHERE id = $1`, [botId]))).toBe('42501');
    expect(await activeApprovals()).toBe(1);
    // Mit Pause ändern (wie updateDraftPatch) → erlaubt, Freigabe ungültig.
    expect(await codeOf(asUser(editorId), () => q(`UPDATE public.bots SET persona = 'Persona B', enabled = false WHERE id = $1`, [botId]))).toBe('OK');
    expect(await activeApprovals()).toBe(0);
    const { rows } = await q<{ invalidated_reason: string }>(`SELECT invalidated_reason FROM public.bot_approvals WHERE bot_id = $1`, [botId]);
    expect(rows.map((r) => r.invalidated_reason)).toEqual(['content_changed']);
    expect(await runtimeOk()).toBe(false);
    // Zurück auf den freigegebenen Inhalt reicht nicht.
    await ctx.withClaims(asUser(ownerId), () => q(`UPDATE public.bots SET persona = 'Persona A' WHERE id = $1`, [botId]));
    expect(await setEnabled(asUser(ownerId), true)).toBe('42501');
  });

  it('jede sicherheitsrelevante Spalte gehört zum Prüfgegenstand; Name und Beschreibung nicht', async () => {
    const changes: Array<[string, string]> = [
      ['greeting', `greeting = 'Andere Begrüßung'`],
      ['capabilities', `capabilities = '{"appointments": true, "orders": true}'::jsonb`],
      ['channel', `channel = 'whatsapp'`],
      ['config', `config = jsonb_set(config, '{secretariat,fields,phone,value}', '"0999"')`],
      ['vertical', `config = jsonb_set(config, '{vertical}', '"restaurant"')`],
    ];
    for (const [label, set] of changes) {
      expect(await approve(ownerId), label).toBe('OK');
      await ctx.withClaims(asUser(ownerId), () => q(`UPDATE public.bots SET ${set} WHERE id = $1`, [botId]));
      expect(await activeApprovals(), label).toBe(0);
    }
    expect(await approve(ownerId)).toBe('OK');
    await ctx.withClaims(asUser(ownerId), () => q(`UPDATE public.bots SET name = 'Neu', description = 'Neu' WHERE id = $1`, [botId]));
    expect(await activeApprovals()).toBe(1);
    // Veraltete Browser-Freigabe in config.secretariat.approval zählt nicht und invalidiert nicht.
    await ctx.withClaims(asUser(ownerId), () => q(
      `UPDATE public.bots SET config = jsonb_set(config, '{secretariat,approval}', '{"fieldsSha256":"x"}') WHERE id = $1`, [botId],
    ));
    expect(await activeApprovals()).toBe(1);
  });

  it('Freigaben lassen sich nicht direkt schreiben oder fälschen', async () => {
    expect(await codeOf(asUser(ownerId), () => q(
      `INSERT INTO public.bot_approvals (tenant_id, bot_id, subject_sha256, approved_by)
       SELECT b.tenant_id, b.id, public.bot_approval_subject_sha256(b), $2 FROM public.bots b WHERE b.id = $1`,
      [botId, ownerId],
    ))).toBe('42501');
    expect(await approve(ownerId)).toBe('OK');
    expect(await codeOf(asUser(ownerId), () => q(`UPDATE public.bot_approvals SET invalidated_at = NULL WHERE bot_id = $1`, [botId]))).toBe('42501');
    expect(await codeOf(SERVER, () => q(`DELETE FROM public.bot_approvals WHERE bot_id = $1`, [botId]))).toBe('42501');
  });

  it('die Sekretariats-Kennzeichnung lässt sich nicht entfernen', async () => {
    expect(await codeOf(asUser(ownerId), () => q(`UPDATE public.bots SET config = config - 'secretariat' WHERE id = $1`, [botId]))).toBe('42501');
  });

  it('Status-RPC: Mitglieder sehen den Stand, fremde Mandanten nicht', async () => {
    const status = async (sub: string) => ctx.withClaims(asUser(sub), async () => (await q(`SELECT * FROM public.secretariat_bot_approval_status($1)`, [botId])).rows[0]);
    expect(await status(editorId)).toMatchObject({ has_active_approval: false, valid: false, ever_approved: false });
    expect(await approve(ownerId)).toBe('OK');
    expect(await status(editorId)).toMatchObject({ has_active_approval: true, valid: true, ever_approved: true, approved_by: ownerId });
    expect(await codeOf(asUser(foreignOwnerId), () => q(`SELECT * FROM public.secretariat_bot_approval_status($1)`, [botId]))).toBe('42501');
  });

  it('allgemeine Bots bleiben unberührt', async () => {
    const plainId = await ctx.withClaims(SERVER, async () => {
      const { rows } = await q<{ id: string }>(
        `INSERT INTO public.bots (tenant_id, name, config, enabled) VALUES ($1, 'Allgemein', '{"vertical":"general"}'::jsonb, false) RETURNING id`,
        [tenantId],
      );
      return rows[0]!.id;
    });
    expect(await setEnabled(asUser(editorId), true, plainId)).toBe('OK');
    expect(await codeOf(asUser(editorId), () => q(`UPDATE public.bots SET persona = 'frei' WHERE id = $1`, [plainId]))).toBe('OK');
    expect(await runtimeOk(plainId)).toBe(true);
    expect(await runtimeOk('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
