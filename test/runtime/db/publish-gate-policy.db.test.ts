/**
 * P2-3 — Publish Gate als Enforcement-Punkt (DB-Integration)
 *
 * Der wichtigste Test dieser Datei ist der letzte: **Ein Ausfall des PDP
 * lässt sich nicht als Konformität in die Datenbank schreiben.**
 *
 * Der Kern leitet das bereits ab. Aber `siteos_publish_evaluations` ist mit
 * `service_role` beschreibbar, und die Ableitung steht in TypeScript — ein
 * künftiger Schreibpfad könnte sie umgehen, ohne dass es auffiele. Dieselbe
 * Überlegung, aus der `publishable` eine generierte Spalte ist: Was die
 * Zusage trägt, gehört dorthin, wo kein Schreibpfad vorbeikommt.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

// Faellt laut aus, wenn CI die Datenbank erwartet, sie aber fehlt — statt
// still nichts zu pruefen.
const d = requireDbOrFail('P2-3 / Publish Gate — Richtlinien-Prüfpfad') ? describe : describe.skip;

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

/** Bewertung mit ansonsten makellosem Zustand — nur die Policy-Felder variieren. */
async function insertEvaluation(
  ctx: DbCtx,
  tenantId: string,
  policy: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  const base: Record<string, unknown> = {
    tenant_id: tenantId,
    artifact_sha256: HASH_A,
    blueprint_sha256: HASH_B,
    status: 'passed',
    evidence_complete: true,
    backend_preservation: 'preserve_all',
    policy_compliant: true,
    human_approval_required: false,
    ...policy,
    ...overrides,
  };
  const cols = Object.keys(base);
  const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
  const r = await ctx.client.query(
    `INSERT INTO public.siteos_publish_evaluations (${cols.join(', ')})
     VALUES (${ph}) RETURNING id, publishable, policy_engine_status, policy_decision`,
    Object.values(base),
  );
  return r.rows[0];
}

/**
 * Führt ein absichtlich scheiterndes INSERT aus, ohne die Testtransaktion
 * mitzureißen.
 *
 * Ohne SAVEPOINT bricht der erste Constraint-Verstoß die Transaktion ab, und
 * jede folgende Anweisung scheitert mit „current transaction is aborted" —
 * also an der Umgebung statt an der Sache. Dieselbe Vorkehrung wie in
 * `withClaims` in `db-helpers.ts`, und aus demselben Grund.
 */
async function rejects(ctx: DbCtx, run: () => Promise<unknown>): Promise<string> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await ctx.client.query(`SAVEPOINT ${sp}`);
  try {
    await run();
  } catch (e) {
    await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    return (e as Error).message;
  }
  await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
  throw new Error('erwartete Ablehnung blieb aus — die Bedingung greift nicht');
}

d('P2-3 / Prüfpfad der Richtlinien-Entscheidung (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('hält die Entscheidung des PDP fest', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvaluation(ctx!, tenantId, {
      policy_engine_status: 'evaluated',
      policy_decision: 'allow',
      policy_matched_ids: JSON.stringify([]),
      policy_snapshot_version: 'v-1',
    });

    expect(row.policy_engine_status).toBe('evaluated');
    expect(row.policy_decision).toBe('allow');
    expect(row.publishable).toBe(true);
  });

  it('eine Sperre durch eine Richtlinie ist nicht veröffentlichbar', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvaluation(
      ctx!,
      tenantId,
      { policy_engine_status: 'evaluated', policy_decision: 'block' },
      { status: 'blocked', policy_compliant: false },
    );
    expect(row.publishable).toBe(false);
  });

  it('Bestandszeilen ohne Policy-Angabe bleiben gültig (additiv)', async () => {
    // NULL heisst wahrheitsgemäss „damals wurde keine Richtlinie
    // ausgewertet" — nicht „ausgewertet und nichts gefunden".
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvaluation(ctx!, tenantId, {});
    expect(row.policy_engine_status).toBeNull();
    expect(row.publishable).toBe(true);
  });

  it('weist erfundene Werte ab', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    expect(
      await rejects(ctx!, () => insertEvaluation(ctx!, tenantId, { policy_engine_status: 'maybe' })),
    ).toMatch(/policy_engine_status_valid/);

    expect(
      await rejects(ctx!, () =>
        insertEvaluation(ctx!, tenantId, { policy_engine_status: 'evaluated', policy_decision: 'ja_bitte' }),
      ),
    ).toMatch(/policy_decision_valid/);
  });

  it('ein Ausfall des PDP kann nicht als konform gespeichert werden (§7 G3)', async () => {
    // Der Angriff: Der PDP war nicht erreichbar, aber der Schreibpfad
    // behauptet trotzdem Konformität — und `publishable` würde true.
    const { tenantId } = await createTenantWithMember(ctx!);

    expect(
      await rejects(ctx!, () =>
        insertEvaluation(ctx!, tenantId, { policy_engine_status: 'unavailable' }, { policy_compliant: true }),
      ),
    ).toMatch(/policy_unavailable_blocks/);

    // Mit ehrlichem `policy_compliant = false` geht es durch — und sperrt.
    const row = await insertEvaluation(
      ctx!,
      tenantId,
      { policy_engine_status: 'unavailable' },
      { status: 'blocked', policy_compliant: false },
    );
    expect(row.publishable).toBe(false);
  });
});
