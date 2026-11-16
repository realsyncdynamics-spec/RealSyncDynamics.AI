/**
 * workspace_signing_secrets / workspace_request_nonces — echtes Postgres (TEST_DB_URL).
 * Prüft: kein Client-Zugriff, Auflösung des Signatur-Geheimnisses aus Vault,
 * Replay-Schutz je Schlüssel, Zeitfenster gegen die Datenbankuhr, Anfragelimit.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('workspace-request-signing') ? describe : describe.skip;
const SECRET = 'workspace-db-test-secret-0123456789abcdef';

d('workspace request signing · Vault-Geheimnis, Nonce, Limit', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; kA: string; kB: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);
  const rnd = () => Math.random().toString(36).slice(2, 12).padEnd(10, '0');

  /** Führt fn mit Client-Rechten aus und rollt danach zurück (auch nach Fehlern). */
  async function asRole<T>(role: 'authenticated' | 'anon', sub: string | null, fn: () => Promise<T>): Promise<T> {
    const sp = `sp_${rnd()}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role })]);
      await q(`SET LOCAL ROLE ${role}`);
      return await fn();
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }
  /** Erwartet einen Fehler, ohne die Testtransaktion zu verlieren. */
  async function expectError(sql: string, params: unknown[], pattern: RegExp) {
    const sp = `sp_${rnd()}`;
    await q(`SAVEPOINT ${sp}`);
    await expect(q(sql, params)).rejects.toThrow(pattern);
    await q(`ROLLBACK TO SAVEPOINT ${sp}`);
  }
  const claim = (key: string, nonce: string, signedAt = 'now()', extra = '') =>
    q<{ ok: boolean }>(`SELECT public.claim_workspace_request($1, $2, ${signedAt}${extra}) AS ok`, [key, nonce]);
  const secretOf = (key: string) =>
    q<{ s: string | null }>(`SELECT public.workspace_signing_secret($1) AS s`, [key]);
  async function configure(key: string, tenant: string, secret: string | null): Promise<string> {
    const name = `workspace_signing_${rnd()}`;
    if (secret !== null) await q(`SELECT vault.create_secret($1, $2)`, [secret, name]);
    await q(
      `INSERT INTO public.workspace_signing_secrets(ingest_key_id, tenant_id, vault_secret_name) VALUES ($1,$2,$3)`,
      [key, tenant, name],
    );
    return name;
  }

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const key = async (t: string) =>
      (await q<{ id: string }>(
        `INSERT INTO public.governance_ingest_keys(tenant_id, name, key_hash, key_prefix, allowed_sources)
         VALUES ($1, 'ws', $2, 'rsd_gov_', ARRAY['google_workspace']) RETURNING id`,
        [t, Math.random().toString(16).slice(2).padEnd(64, '0')],
      )).rows[0]!.id;
    ids.tA = await tenant(`wsig-A-${Date.now()}`);
    ids.tB = await tenant(`wsig-B-${Date.now()}`);
    ids.uA = (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
      `wsig_${Date.now()}_${rnd()}@example.com`,
    ])).rows[0]!.id;
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner')`, [ids.tA, ids.uA]);
    ids.kA = await key(ids.tA);
    ids.kB = await key(ids.tB);
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('RLS ist erzwungen, es gibt keine Policy', async () => {
    const r = await q<{ relname: string; rls: boolean; forced: boolean; policies: string }>(
      `SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
              (SELECT count(*)::text FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('workspace_signing_secrets','workspace_request_nonces')
        ORDER BY c.relname`);
    expect(r.rows).toEqual([
      { relname: 'workspace_request_nonces', rls: true, forced: true, policies: '0' },
      { relname: 'workspace_signing_secrets', rls: true, forced: true, policies: '0' },
    ]);
  });

  it('Clients (auch Owner des Mandanten) kommen weder an Tabellen noch an Funktionen', async () => {
    await configure(ids.kA, ids.tA, SECRET);
    for (const role of ['authenticated', 'anon'] as const) {
      const sub = role === 'authenticated' ? ids.uA : null;
      await expect(asRole(role, sub, () => q(`SELECT * FROM public.workspace_signing_secrets`)))
        .rejects.toThrow(/permission denied/i);
      await expect(asRole(role, sub, () => q(`SELECT * FROM public.workspace_request_nonces`)))
        .rejects.toThrow(/permission denied/i);
      await expect(asRole(role, sub, () => secretOf(ids.kA))).rejects.toThrow(/permission denied/i);
      await expect(asRole(role, sub, () => claim(ids.kA, 'nonce-client-00000001'))).rejects.toThrow(/permission denied/i);
    }
  });

  it('service_role darf beide Funktionen ausführen', async () => {
    await configure(ids.kA, ids.tA, SECRET);
    const out = await ctx!.withClaims({ role: 'service_role' }, async () => ({
      secret: (await secretOf(ids.kA)).rows[0]!.s,
      claimed: (await claim(ids.kA, 'nonce-service-0000001')).rows[0]!.ok,
    }));
    expect(out).toEqual({ secret: SECRET, claimed: true });
  });

  it('liefert das Geheimnis nur für den eingerichteten, gültigen Schlüssel', async () => {
    expect((await secretOf(ids.kA)).rows[0]!.s).toBeNull(); // nicht eingerichtet
    await configure(ids.kA, ids.tA, SECRET);
    expect((await secretOf(ids.kA)).rows[0]!.s).toBe(SECRET);
    expect((await secretOf(ids.kB)).rows[0]!.s).toBeNull(); // anderer Schlüssel
    await q(`UPDATE public.governance_ingest_keys SET revoked_at = now() WHERE id = $1`, [ids.kA]);
    expect((await secretOf(ids.kA)).rows[0]!.s).toBeNull(); // widerrufen
  });

  it('liefert nichts, wenn Schlüssel und Eintrag verschiedenen Mandanten gehören', async () => {
    await configure(ids.kA, ids.tB, SECRET);
    expect((await secretOf(ids.kA)).rows[0]!.s).toBeNull();
  });

  it('meldet ein fehlendes oder zu kurzes Vault-Secret als Fehler, nicht als „nicht eingerichtet“', async () => {
    await configure(ids.kA, ids.tA, null);
    await expectError(`SELECT public.workspace_signing_secret($1)`, [ids.kA], /workspace_signing_misconfigured/);
    await configure(ids.kB, ids.tB, 'zu-kurz');
    await expectError(`SELECT public.workspace_signing_secret($1)`, [ids.kB], /workspace_signing_misconfigured/);
  });

  it('eine Nonce gilt je Schlüssel genau einmal', async () => {
    expect((await claim(ids.kA, 'nonce-replay-00000001')).rows[0]!.ok).toBe(true);
    expect((await claim(ids.kA, 'nonce-replay-00000001')).rows[0]!.ok).toBe(false);
    expect((await claim(ids.kA, 'nonce-replay-00000002')).rows[0]!.ok).toBe(true);
    // dieselbe Nonce bei einem anderen Schlüssel ist kein Replay
    expect((await claim(ids.kB, 'nonce-replay-00000001')).rows[0]!.ok).toBe(true);
    const n = await q<{ n: string }>(`SELECT count(*)::text n FROM public.workspace_request_nonces WHERE ingest_key_id = $1`, [ids.kA]);
    expect(n.rows[0]!.n).toBe('2');
  });

  it('lehnt Zeitstempel außerhalb des Fensters ab und verbraucht dabei keine Nonce', async () => {
    await expectError(`SELECT public.claim_workspace_request($1, $2, now() - interval '6 minutes')`,
      [ids.kA, 'nonce-skew-0000000001'], /workspace_timestamp_skew/);
    await expectError(`SELECT public.claim_workspace_request($1, $2, now() + interval '6 minutes')`,
      [ids.kA, 'nonce-skew-0000000002'], /workspace_timestamp_skew/);
    expect((await claim(ids.kA, 'nonce-skew-0000000001', `now() - interval '4 minutes'`)).rows[0]!.ok).toBe(true);
  });

  it('lehnt unsinnige Parameter und ungültige Nonces ab', async () => {
    await expectError(`SELECT public.claim_workspace_request($1, $2, NULL)`, [ids.kA, 'nonce-param-000000001'], /workspace_claim_invalid/);
    await expectError(`SELECT public.claim_workspace_request($1, $2, now(), interval '1 hour')`, [ids.kA, 'nonce-param-000000002'], /workspace_claim_invalid/);
    await expectError(`SELECT public.claim_workspace_request($1, $2, now(), interval '5 minutes', 0)`, [ids.kA, 'nonce-param-000000003'], /workspace_claim_invalid/);
    await expectError(`SELECT public.claim_workspace_request($1, $2, now())`, [ids.kA, 'kurz'], /check constraint|violates/i);
  });

  it('begrenzt signierte Requests je Schlüssel und Minute, andere Schlüssel bleiben frei', async () => {
    const limit = `, interval '5 minutes', 3`;
    for (let i = 0; i < 3; i++) {
      expect((await claim(ids.kA, `nonce-limit-000000000${i}`, 'now()', limit)).rows[0]!.ok).toBe(true);
    }
    await expectError(`SELECT public.claim_workspace_request($1, $2, now(), interval '5 minutes', 3)`,
      [ids.kA, 'nonce-limit-0000000009'], /workspace_rate_limited/);
    expect((await claim(ids.kB, 'nonce-limit-0000000009', 'now()', limit)).rows[0]!.ok).toBe(true);
    // nach Ablauf der Minute ist wieder Platz
    await q(`UPDATE public.workspace_request_nonces SET seen_at = now() - interval '2 minutes' WHERE ingest_key_id = $1`, [ids.kA]);
    expect((await claim(ids.kA, 'nonce-limit-0000000009', 'now()', limit)).rows[0]!.ok).toBe(true);
  });

  it('nimmt das Limit aus governance_ingest_keys.rate_limit_per_minute', async () => {
    await q(`UPDATE public.governance_ingest_keys SET rate_limit_per_minute = 2 WHERE id = $1`, [ids.kA]);
    expect((await claim(ids.kA, 'nonce-keylimit-000001')).rows[0]!.ok).toBe(true);
    expect((await claim(ids.kA, 'nonce-keylimit-000002')).rows[0]!.ok).toBe(true);
    await expectError(`SELECT public.claim_workspace_request($1, $2, now())`, [ids.kA, 'nonce-keylimit-000003'], /workspace_rate_limited/);
  });

  it('lehnt widerrufene und unbekannte Schlüssel ab', async () => {
    await q(`UPDATE public.governance_ingest_keys SET revoked_at = now() WHERE id = $1`, [ids.kA]);
    await expectError(`SELECT public.claim_workspace_request($1, $2, now())`, [ids.kA, 'nonce-revoked-0000001'], /workspace_key_invalid/);
    await expectError(`SELECT public.claim_workspace_request($1, $2, now())`,
      ['00000000-0000-4000-8000-00000000dead', 'nonce-revoked-0000002'], /workspace_key_invalid/);
  });

  it('räumt Nonces auf, die älter als eine Stunde sind', async () => {
    await claim(ids.kA, 'nonce-old-00000000001');
    await q(`UPDATE public.workspace_request_nonces SET seen_at = now() - interval '2 hours' WHERE ingest_key_id = $1`, [ids.kA]);
    await claim(ids.kA, 'nonce-old-00000000002');
    const r = await q<{ nonce: string }>(`SELECT nonce FROM public.workspace_request_nonces WHERE ingest_key_id = $1`, [ids.kA]);
    expect(r.rows).toEqual([{ nonce: 'nonce-old-00000000002' }]);
  });

  it('löscht Geheimnis-Eintrag und Nonces mit dem Schlüssel', async () => {
    await configure(ids.kA, ids.tA, SECRET);
    await claim(ids.kA, 'nonce-cascade-0000001');
    await q(`DELETE FROM public.governance_ingest_keys WHERE id = $1`, [ids.kA]);
    const r = await q<{ n: string }>(
      `SELECT ((SELECT count(*) FROM public.workspace_signing_secrets WHERE ingest_key_id = $1)
             + (SELECT count(*) FROM public.workspace_request_nonces WHERE ingest_key_id = $1))::text AS n`, [ids.kA]);
    expect(r.rows[0]!.n).toBe('0');
  });
});
