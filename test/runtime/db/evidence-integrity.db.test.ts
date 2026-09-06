/**
 * P1-6 — Evidence-Härtung (DB-Integration)
 *
 * Prüft, was die Migration 20260901090000 zusagt:
 *   1. ai_evidence_events ist append-only (UPDATE immer, DELETE ohne
 *      erklärte Absicht)
 *   2. der Aufbewahrungspfad ist der einzige, der löschen darf — und er
 *      schreibt den Nachweis, bevor er löscht
 *   3. der Verifier erkennt eine nachträglich veränderte Zeile
 *   4. Anker sind unveränderlich, ausser dem einmaligen Export-Vermerk
 *
 * Punkt 3 ist der wichtigste: Ein Verifier, der Manipulation nicht
 * bemerkt, ist gefährlicher als keiner — er erzeugt falsche Sicherheit.
 * Deshalb wird hier bewusst am Trigger vorbei geschrieben (ALTER TABLE
 * ... DISABLE TRIGGER), um den Angriff nachzustellen, den der Anker
 * erkennbar machen soll.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

async function insertEvidence(
  ctx: DbCtx,
  tenantId: string,
  summary = 'Testnachweis',
  createdAt?: string,
): Promise<{ id: string; chain_index: string }> {
  const r = await ctx.client.query(
    `INSERT INTO public.ai_evidence_events
       (tenant_id, event_type, event_summary, risk_level, evidence${createdAt ? ', created_at' : ''})
     VALUES ($1, 'test:evidence', $2, 'low', '{}'::jsonb${createdAt ? ', $3::timestamptz' : ''})
     RETURNING id, chain_index`,
    createdAt ? [tenantId, summary, createdAt] : [tenantId, summary],
  );
  return r.rows[0];
}

d('P1-6 / ai_evidence_events append-only (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('UPDATE wird immer abgewiesen — eine Korrektur ist ein neuer Eintrag', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvidence(ctx!, tenantId);

    await expect(
      ctx!.client.query(
        `UPDATE public.ai_evidence_events SET event_summary='manipuliert' WHERE id=$1`,
        [row.id],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('DELETE ohne erklärte Absicht wird abgewiesen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvidence(ctx!, tenantId);

    await expect(
      ctx!.client.query(`DELETE FROM public.ai_evidence_events WHERE id=$1`, [row.id]),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('die Hash-Kette verkettet fortlaufend', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await insertEvidence(ctx!, tenantId, 'erster');
    await insertEvidence(ctx!, tenantId, 'zweiter');

    const r = await ctx!.client.query(
      `SELECT chain_index, prev_hash, event_hash FROM public.ai_evidence_events
       WHERE tenant_id=$1 ORDER BY chain_index`,
      [tenantId],
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].prev_hash).toBeNull();
    expect(r.rows[1].prev_hash).toEqual(r.rows[0].event_hash);
  });
});

d('P1-6 / Aufbewahrungslöschung (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('ohne hinterlegte Frist wird nichts gelöscht', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await insertEvidence(ctx!, tenantId, 'alt', '2000-01-01T00:00:00Z');

    const r = await ctx!.client.query(
      `SELECT * FROM public.ai_evidence_purge_expired($1::uuid, false)`, [tenantId],
    );
    expect(Number(r.rows[0].purged_count)).toBe(0);

    const left = await ctx!.client.query(
      `SELECT count(*)::int AS n FROM public.ai_evidence_events WHERE tenant_id=$1`, [tenantId],
    );
    expect(left.rows[0].n).toBe(1);
  });

  it('Trockenlauf zählt, löscht aber nicht', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await insertEvidence(ctx!, tenantId, 'alt', '2000-01-01T00:00:00Z');
    await ctx!.client.query(
      `INSERT INTO public.ai_evidence_retention (tenant_id, retention_days, hard_delete_after_days)
       VALUES ($1, 30, 90)`, [tenantId],
    );

    const dry = await ctx!.client.query(
      `SELECT * FROM public.ai_evidence_purge_expired($1::uuid, true)`, [tenantId],
    );
    expect(Number(dry.rows[0].purged_count)).toBe(1);

    const left = await ctx!.client.query(
      `SELECT count(*)::int AS n FROM public.ai_evidence_events WHERE tenant_id=$1`, [tenantId],
    );
    expect(left.rows[0].n).toBe(1);
  });

  it('löscht abgelaufene Einträge und hinterlässt den Nachweis', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await insertEvidence(ctx!, tenantId, 'alt', '2000-01-01T00:00:00Z');
    await insertEvidence(ctx!, tenantId, 'frisch');
    await ctx!.client.query(
      `INSERT INTO public.ai_evidence_retention (tenant_id, retention_days, hard_delete_after_days)
       VALUES ($1, 30, 90)`, [tenantId],
    );

    const r = await ctx!.client.query(
      `SELECT * FROM public.ai_evidence_purge_expired($1::uuid, false)`, [tenantId],
    );
    expect(Number(r.rows[0].purged_count)).toBe(1);

    // Der frische Eintrag und der Löschnachweis bleiben — der alte ist weg.
    const rest = await ctx!.client.query(
      `SELECT event_type, event_summary FROM public.ai_evidence_events
       WHERE tenant_id=$1 ORDER BY chain_index`, [tenantId],
    );
    const types = rest.rows.map((x: { event_type: string }) => x.event_type);
    expect(types).toContain('evidence:retention_purge');
    const summaries = rest.rows.map((x: { event_summary: string }) => x.event_summary);
    expect(summaries).not.toContain('alt');
    expect(summaries).toContain('frisch');
  });

  it('verweigert mandantenübergreifendes Löschen', async () => {
    await expect(
      ctx!.client.query(`SELECT * FROM public.ai_evidence_purge_expired(NULL, false)`),
    ).rejects.toThrow(/tenant_id is required/);
  });
});

d('P1-6 / Verifier erkennt Manipulation (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('meldet eine unversehrte Kette als in Ordnung', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await insertEvidence(ctx!, tenantId, 'a');
    await insertEvidence(ctx!, tenantId, 'b');

    const rows = await ctx!.withClaims({ sub: userId }, async () =>
      ctx!.client.query(
        `SELECT * FROM public.ai_evidence_verify_chain($1::uuid)`, [tenantId],
      ),
    );
    expect(rows.rows).toHaveLength(2);
    for (const r of rows.rows) expect(r.hash_ok).toBe(true);
    // Der erste Eintrag hat keinen Vorgänger; ab dem zweiten muss die
    // Verkettung stimmen.
    expect(rows.rows[1].link_ok).toBe(true);
  });

  it('erkennt eine Zeile, deren Hash nicht zu ihrem Inhalt passt', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await insertEvidence(ctx!, tenantId, 'unverändert');

    // Manipulation nachstellen, ohne den Trigger abzuschalten: Der
    // Ketten-Trigger rechnet nur, wenn event_hash NULL ist (Migration
    // 20260510). Ein direkt gesetzter, falscher Hash entspricht damit
    // genau dem Zustand nach einer Manipulation am Schutz vorbei — und
    // der Verifier muss ihn finden. Genau dafür existiert er.
    const bogus = await ctx!.client.query(
      `INSERT INTO public.ai_evidence_events
         (tenant_id, event_type, event_summary, risk_level, evidence,
          prev_hash, event_hash, chain_index)
       SELECT $1, 'test:evidence', 'manipuliert', 'low', '{}'::jsonb,
              e.event_hash, decode(repeat('ff',32),'hex'), e.chain_index + 1
       FROM public.ai_evidence_events e
       WHERE e.tenant_id = $1 ORDER BY e.chain_index DESC LIMIT 1
       RETURNING id`,
      [tenantId],
    );
    const targetId = bogus.rows[0].id;

    const rows = await ctx!.withClaims({ sub: userId }, async () =>
      ctx!.client.query(
        `SELECT * FROM public.ai_evidence_verify_chain($1::uuid)`, [tenantId],
      ),
    );
    const broken = rows.rows.filter((r: { hash_ok: boolean }) => r.hash_ok === false);
    expect(broken).toHaveLength(1);
    expect(broken[0].event_id).toBe(targetId);
  });
});

d('P1-6 / Anker sind unveränderlich (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function anchor(tenantId: string): Promise<string> {
    const r = await ctx!.client.query(
      `INSERT INTO public.evidence_anchors (tenant_id, chain_index, chain_hash, event_count)
       VALUES ($1, 1, decode(repeat('ab',32),'hex'), 1) RETURNING id`,
      [tenantId],
    );
    return r.rows[0].id;
  }

  it('DELETE wird abgewiesen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const id = await anchor(tenantId);
    await expect(
      ctx!.client.query(`DELETE FROM public.evidence_anchors WHERE id=$1`, [id]),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('Ändern des Kettenzustands wird abgewiesen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const id = await anchor(tenantId);
    await expect(
      ctx!.client.query(
        `UPDATE public.evidence_anchors SET chain_index=99 WHERE id=$1`, [id],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('der Export-Vermerk ist genau einmal erlaubt', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const id = await anchor(tenantId);

    await ctx!.client.query(
      `UPDATE public.evidence_anchors SET exported_at=now(), export_note='Ablage' WHERE id=$1`,
      [id],
    );

    // Ein zweites Mal nicht — sonst liesse sich die Export-Historie umschreiben.
    await expect(
      ctx!.client.query(
        `UPDATE public.evidence_anchors SET export_note='anders' WHERE id=$1`, [id],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
