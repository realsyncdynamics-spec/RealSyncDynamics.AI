/**
 * Presence Layer Scope 1 — Mandantentrennung und Schranken (DB-Integration)
 *
 * Migration: supabase/migrations/20260906120000_presence_layer_scope1.sql
 *
 * WARUM DIESE DATEI EXISTIERT
 *
 * Die drei neuen Tabellen führen Stammdaten eines Betriebs, die Zuordnung
 * Hostname → Mandant und den Auftragsverarbeitungsvertrag. Dass RLS
 * eingeschaltet ist, sagt für sich genommen nichts: Eine Tabelle mit RLS und
 * einer zu weiten Policy ist genauso offen wie eine ohne. Geprüft wird
 * deshalb nicht der Schalter, sondern die Wirkung — Mandant B liest nichts
 * von Mandant A.
 *
 * Die zweite Hälfte prüft die Schranken, die in der Migration als CHECK
 * stehen. Sie sind dort, weil Anwendungscode sie umgehen kann und
 * service_role RLS ohnehin umgeht: Ein CHECK gilt für jede Rolle, auch für
 * den Server. Für Zusagen mit Rechtsfolge (DSGVO Art. 5 Abs. 2, Art. 6) ist
 * das der Unterschied zwischen einer Regel und einer Absichtserklärung.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  openDb,
  requireDbOrFail,
  type DbCtx,
} from './db-helpers';

// Wirft, wenn REQUIRE_DB_TESTS=1 gesetzt ist und die Datenbank fehlt — sonst
// waere diese Datei in CI still uebersprungen und beliebig gruen.
const d = requireDbOrFail('presence-layer-rls') ? describe : describe.skip;

/** Eindeutige DNS-Bezeichnung — presence_sites.slug ist global unique. */
function uniqueSlug(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

d('Presence Layer Scope 1 — RLS und Schranken (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  // ── Fixtures laufen als Superuser und umgehen RLS bewusst: Was geprüft
  //    werden soll, ist das LESEN unter Mandantenrechten, nicht das Anlegen.

  async function seedProfile(c: DbCtx, tenantId: string, name: string) {
    await c.client.query(
      `INSERT INTO public.business_profiles (tenant_id, business_name, phone)
       VALUES ($1, $2, '+49 40 000000')`,
      [tenantId, name],
    );
  }

  async function seedSite(c: DbCtx, tenantId: string, slug: string) {
    await c.client.query(
      `INSERT INTO public.presence_sites (tenant_id, template_id, slug)
       VALUES ($1, 'handwerk-basis', $2)`,
      [tenantId, slug],
    );
  }

  async function seedDpa(c: DbCtx, tenantId: string) {
    await c.client.query(
      `INSERT INTO public.data_processing_agreements (tenant_id, version)
       VALUES ($1, 'v1.0')`,
      [tenantId],
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 1. Mandantentrennung — der Kern
  // ══════════════════════════════════════════════════════════════════

  it('business_profiles: B sieht die Stammdaten von A nicht', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'bp-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'bp-B' });
    await seedProfile(ctx!, A.tenantId, 'Dachdeckerei A');
    await seedProfile(ctx!, B.tenantId, 'Elektro B');

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query(
        `SELECT business_name, tenant_id FROM public.business_profiles`,
      );
      expect(r.rows.some((x) => x.business_name === 'Dachdeckerei A')).toBe(false);
      expect(r.rows.some((x) => x.business_name === 'Elektro B')).toBe(true);
      expect(r.rows.every((x) => x.tenant_id === B.tenantId)).toBe(true);
    });
  });

  it('presence_sites: B sieht die Sites von A nicht', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ps-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ps-B' });
    const slugA = uniqueSlug('site-a');
    await seedSite(ctx!, A.tenantId, slugA);
    await seedSite(ctx!, B.tenantId, uniqueSlug('site-b'));

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query(`SELECT slug, tenant_id FROM public.presence_sites`);
      expect(r.rows.some((x) => x.slug === slugA)).toBe(false);
      expect(r.rows.every((x) => x.tenant_id === B.tenantId)).toBe(true);
    });
  });

  it('data_processing_agreements: B sieht den AVV von A nicht', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'dpa-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'dpa-B' });
    await seedDpa(ctx!, A.tenantId);
    await seedDpa(ctx!, B.tenantId);

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query(
        `SELECT tenant_id FROM public.data_processing_agreements`,
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]!.tenant_id).toBe(B.tenantId);
    });
  });

  it('gezielter Zugriff auf eine fremde id liefert 0 Zeilen, keinen Fehler', async () => {
    // Wichtiger Unterschied: RLS filtert, sie verweigert nicht. Wer auf eine
    // Fehlermeldung prüft, prüft das Falsche — und würde eine zu weite Policy
    // nicht bemerken.
    const A = await createTenantWithMember(ctx!, { tenantName: 'gz-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'gz-B' });
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.business_profiles (tenant_id, business_name)
       VALUES ($1, 'Geheim A') RETURNING id`,
      [A.tenantId],
    );
    const fremdeId = rows[0]!.id;

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query(
        `SELECT * FROM public.business_profiles WHERE id = $1`, [fremdeId],
      );
      expect(r.rows).toHaveLength(0);
    });
  });

  it('B kann keine Zeile unter der tenant_id von A anlegen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ins-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ins-B' });

    await expect(
      ctx!.withClaims({ sub: B.userId }, async () => {
        await ctx!.client.query(
          `INSERT INTO public.presence_sites (tenant_id, template_id, slug)
           VALUES ($1, 'handwerk-basis', $2)`,
          [A.tenantId, uniqueSlug('untergeschoben')],
        );
      }),
    ).rejects.toThrow(/row-level security/i);
  });

  it('B kann eine Zeile von A nicht ändern und nicht löschen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'upd-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'upd-B' });
    await seedProfile(ctx!, A.tenantId, 'Original A');

    await ctx!.withClaims({ sub: B.userId }, async () => {
      // UPDATE/DELETE ohne Trefferrecht sind kein Fehler — sie treffen nichts.
      const u = await ctx!.client.query(
        `UPDATE public.business_profiles SET business_name = 'gekapert' WHERE tenant_id = $1`,
        [A.tenantId],
      );
      expect(u.rowCount).toBe(0);
      const del = await ctx!.client.query(
        `DELETE FROM public.business_profiles WHERE tenant_id = $1`, [A.tenantId],
      );
      expect(del.rowCount).toBe(0);
    });

    const nachher = await ctx!.client.query(
      `SELECT business_name FROM public.business_profiles WHERE tenant_id = $1`,
      [A.tenantId],
    );
    expect(nachher.rows[0]!.business_name).toBe('Original A');
  });

  it('der AVV kennt keine DELETE-Policy — auch der Eigentümer löscht ihn nicht', async () => {
    // DSGVO Art. 5 Abs. 2: Der Nachweis muss erhalten bleiben. Rücknahme
    // läuft über status = 'withdrawn'. Gäbe es eine DELETE-Policy, könnte
    // ein Mandant seinen eigenen Prüfpfad bereinigen.
    const A = await createTenantWithMember(ctx!, { tenantName: 'del-A' });
    await seedDpa(ctx!, A.tenantId);

    await ctx!.withClaims({ sub: A.userId }, async () => {
      const del = await ctx!.client.query(
        `DELETE FROM public.data_processing_agreements WHERE tenant_id = $1`,
        [A.tenantId],
      );
      expect(del.rowCount).toBe(0);
    });
  });

  it('service_role sieht mandantenübergreifend — der dokumentierte Server-Pfad', async () => {
    // Kein Befund, sondern die Bestätigung dessen, was die Migration in
    // Abschnitt 9 zusagt: RLS fängt service_role NICHT ab. Deshalb muss jede
    // Edge Function ihren tenant_id-Filter selbst setzen. Dieser Test hält
    // die Tatsache fest, damit niemand sich auf das Gegenteil verlässt.
    const A = await createTenantWithMember(ctx!, { tenantName: 'sr-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'sr-B' });
    await seedProfile(ctx!, A.tenantId, 'SR Betrieb A');
    await seedProfile(ctx!, B.tenantId, 'SR Betrieb B');

    await ctx!.withClaims({ sub: A.userId, role: 'service_role' }, async () => {
      const r = await ctx!.client.query(
        `SELECT business_name FROM public.business_profiles
         WHERE tenant_id IN ($1, $2)`, [A.tenantId, B.tenantId],
      );
      expect(r.rows).toHaveLength(2);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 2. Schranken — gelten für jede Rolle, service_role eingeschlossen
  // ══════════════════════════════════════════════════════════════════

  it('ein Ereignis mit Kanal ohne Rechtsgrundlage entsteht nicht', async () => {
    // DSGVO Art. 6 Abs. 1 — die Zusage des Auftrags, umgesetzt an den
    // Presence-Kanälen statt spaltenweit (Begründung: Migration Abschnitt 7).
    const A = await createTenantWithMember(ctx!, { tenantName: 'lb-A' });

    await expect(
      ctx!.client.query(
        `INSERT INTO public.ai_runtime_events (tenant_id, event_type, channel)
         VALUES ($1, 'prompt_sent', 'website_assistant')`,
        [A.tenantId],
      ),
    ).rejects.toThrow(/ai_runtime_events_channel_needs_legal_basis/);
  });

  it('mit Rechtsgrundlage entsteht dasselbe Ereignis', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'lb-ok' });
    const r = await ctx!.client.query(
      `INSERT INTO public.ai_runtime_events
         (tenant_id, event_type, channel, legal_basis, data_categories)
       VALUES ($1, 'prompt_sent', 'website_assistant', 'consent', ARRAY['kontaktdaten'])
       RETURNING legal_basis, data_categories`,
      [A.tenantId],
    );
    expect(r.rows[0]!.legal_basis).toBe('consent');
    expect(r.rows[0]!.data_categories).toEqual(['kontaktdaten']);
  });

  it('eine erfundene Rechtsgrundlage wird abgewiesen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'lb-bad' });
    await expect(
      ctx!.client.query(
        `INSERT INTO public.ai_runtime_events (tenant_id, event_type, channel, legal_basis)
         VALUES ($1, 'prompt_sent', 'website_assistant', 'weil_wir_es_koennen')`,
        [A.tenantId],
      ),
    ).rejects.toThrow(/ai_runtime_events_legal_basis_check/);
  });

  it('der Bestands-Gateway-Pfad ohne Kanal bleibt unangetastet', async () => {
    // telemetry-ai-event schreibt ohne legal_basis. Bräche das hier, wäre ein
    // öffentlicher Contract gebrochen (CLAUDE.md §12).
    const A = await createTenantWithMember(ctx!, { tenantName: 'gw' });
    const r = await ctx!.client.query(
      `INSERT INTO public.ai_runtime_events (tenant_id, event_type, vendor, model)
       VALUES ($1, 'prompt_sent', 'anthropic', 'claude') RETURNING id`,
      [A.tenantId],
    );
    expect(r.rows).toHaveLength(1);
  });

  it('ein angenommener AVV ohne Zeitpunkt und Person wird abgewiesen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'dpa-proof' });
    await expect(
      ctx!.client.query(
        `INSERT INTO public.data_processing_agreements (tenant_id, version, status)
         VALUES ($1, 'v1.0', 'accepted')`,
        [A.tenantId],
      ),
    ).rejects.toThrow(/dpa_accepted_needs_proof/);
  });

  it('mit Zeitpunkt und Person wird derselbe AVV angenommen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'dpa-ok' });
    const r = await ctx!.client.query(
      `INSERT INTO public.data_processing_agreements
         (tenant_id, version, status, accepted_at, accepted_by)
       VALUES ($1, 'v1.0', 'accepted', now(), $2) RETURNING status`,
      [A.tenantId, A.userId],
    );
    expect(r.rows[0]!.status).toBe('accepted');
  });

  it('höchstens ein gültiger AVV je Mandant', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'dpa-uniq' });
    await seedDpa(ctx!, A.tenantId);
    await expect(seedDpa(ctx!, A.tenantId)).rejects.toThrow(/dpa_one_active_per_tenant/);
  });

  it('eine veröffentlichte Site ohne Zeitpunkt wird abgewiesen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'pub' });
    await expect(
      ctx!.client.query(
        `INSERT INTO public.presence_sites (tenant_id, template_id, slug, status)
         VALUES ($1, 'handwerk-basis', $2, 'published')`,
        [A.tenantId, uniqueSlug('ohne-zeit')],
      ),
    ).rejects.toThrow(/presence_sites_published_needs_timestamp/);
  });

  it('ein Slug, der kein Hostname sein kann, wird abgewiesen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'slug' });
    await expect(
      ctx!.client.query(
        `INSERT INTO public.presence_sites (tenant_id, template_id, slug)
         VALUES ($1, 'handwerk-basis', 'Müller & Söhne GmbH')`,
        [A.tenantId],
      ),
    ).rejects.toThrow(/presence_sites_slug_format_check/);
  });

  it('zwei Mandanten können sich denselben Hostnamen nicht teilen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'coll-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'coll-B' });
    const slug = uniqueSlug('umkaempft');
    await seedSite(ctx!, A.tenantId, slug);
    await expect(seedSite(ctx!, B.tenantId, slug)).rejects.toThrow(/presence_sites_slug_unique/);
  });

  it('ai_systems nimmt keine Zeile ohne Mandant mehr an', async () => {
    await expect(
      ctx!.client.query(`INSERT INTO public.ai_systems (name) VALUES ('herrenlos')`),
    ).rejects.toThrow(/tenant_id/);
  });

  it('evidence_items nimmt eine halbe Quellenangabe nicht an', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ev' });
    await expect(
      ctx!.client.query(
        `INSERT INTO public.evidence_items (tenant_id, title, source_type)
         VALUES ($1, 'Nachweis', 'presence_site')`,
        [A.tenantId],
      ),
    ).rejects.toThrow(/evidence_items_source_pairing_check/);
  });
});
