/**
 * P2-3 / P2-5 — Quellen des Shadow-Protokolls (DB-Integration)
 *
 * Der Beobachtungsbetrieb ist die Vorstufe zur Durchsetzung: Aus
 * `pdp_shadow_log` soll später ablesbar sein, was `enforce` bewirkt hätte.
 * Ein Kanal, dessen Zeilen die CHECK-Bedingung abweist, liefert dafür
 * nichts — und weil der Insert im Hintergrund läuft, fällt das niemandem
 * auf.
 *
 * Genau das war der Zustand vor dieser Migration: Der Publish Gate schrieb
 * unter `siteos_publish`, das die Bedingung gar nicht kannte.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('P2-3/P2-5 / Shadow-Protokoll-Quellen') ? describe : describe.skip;

async function insertShadow(ctx: DbCtx, tenantId: string, source: string) {
  const r = await ctx.client.query(
    `INSERT INTO public.pdp_shadow_log (tenant_id, source, legacy_status, v2_status, diverged, snapshot_version)
     VALUES ($1, $2, NULL, 'allow', false, 'v-test') RETURNING id, source`,
    [tenantId, source],
  );
  return r.rows[0];
}

d('P2-3/P2-5 / Shadow-Protokoll-Quellen (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('nimmt die drei Alt-Pfade weiterhin an (additiv)', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    for (const s of ['telemetry-ai-event', 'governance-ingest', 'ai-gateway']) {
      expect((await insertShadow(ctx!, tenantId, s)).source).toBe(s);
    }
  });

  it('nimmt den Publish-Kanal an — vorher wurde er abgewiesen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    expect((await insertShadow(ctx!, tenantId, 'siteos_publish')).source).toBe('siteos_publish');
  });

  it('nimmt alle drei Bot-Kanäle einzeln an', async () => {
    // Getrennt gefuehrt, weil „wo weicht v2 ab?" je Kanal beantwortet werden
    // muss: Ein Sprachkanal traegt andere Signale als ein Web-Chat.
    const { tenantId } = await createTenantWithMember(ctx!);
    for (const s of ['bot-chat', 'bot-whatsapp', 'bot-voice']) {
      expect((await insertShadow(ctx!, tenantId, s)).source).toBe(s);
    }
  });

  it('weist eine erfundene Quelle weiter ab', async () => {
    // Die Bedingung wurde erweitert, nicht aufgehoben. Ein Tippfehler im
    // Schreibpfad soll auffallen, nicht still im Protokoll landen.
    const { tenantId } = await createTenantWithMember(ctx!);
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await ctx!.client.query(`SAVEPOINT ${sp}`);
    let message = '';
    try {
      await insertShadow(ctx!, tenantId, 'bot-telepathie');
    } catch (e) {
      message = (e as Error).message;
    }
    await ctx!.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    expect(message).toMatch(/pdp_shadow_log_source_check/);
  });
});
