/**
 * Presence Layer Scope 1 — Site-Erstellung und Hostname-Auflösung (DB-Integration)
 *
 * Migration: supabase/migrations/20260906130000_presence_router_and_site_creation.sql
 *
 * WARUM DIESE PRÜFUNGEN AN DER DATENBANK HÄNGEN UND NICHT AM ANWENDUNGSCODE
 *
 * Beide Zusagen dieses Teils — „beim Anlegen entsteht automatisch ein
 * Governance-Eintrag" und „ohne angenommenen AVV geht nichts online" — sind
 * als Trigger umgesetzt. Der Grund ist `service_role`: Sie umgeht RLS, aber
 * keinen Trigger. Eine Prüfung im Anwendungscode griffe nur dort, wo jemand
 * daran gedacht hat, sie aufzurufen; diese Tests weisen deshalb ausdrücklich
 * nach, dass die Schranke auch für den Server-Pfad gilt.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  openDb,
  requireDbOrFail,
  type DbCtx,
} from './db-helpers';

const d = requireDbOrFail('presence-site-creation') ? describe : describe.skip;

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

d('Presence Scope 1 — Site-Erstellung, Publish-Schranke, Auflösung (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function createSite(
    c: DbCtx, tenantId: string, slug: string, extra: Record<string, string> = {},
  ) {
    const cols = ['tenant_id', 'template_id', 'slug', ...Object.keys(extra)];
    const vals = [tenantId, 'handwerk-basis', slug, ...Object.values(extra)];
    const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await c.client.query(
      `INSERT INTO public.presence_sites (${cols.join(', ')}) VALUES (${ph})
       RETURNING id, slug, status, ai_system_id, tenant_id`,
      vals,
    );
    return rows[0]!;
  }

  // ══════════════════════════════════════════════════════════════════
  // Aufgabe 4 — was beim Anlegen automatisch entsteht
  // ══════════════════════════════════════════════════════════════════

  it('eine neue Site registriert ihr KI-System selbst', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'boot-ai' });
    const slug = uniqueSlug('dachdecker');
    const site = await createSite(ctx!, A.tenantId, slug);

    expect(site.ai_system_id).not.toBeNull();

    const r = await ctx!.client.query(
      `SELECT name, system_type, discovered_via, status, tenant_id, purpose
       FROM public.ai_systems WHERE id = $1`, [site.ai_system_id],
    );
    expect(r.rows).toHaveLength(1);
    const sys = r.rows[0]!;
    expect(sys.discovered_via).toBe('presence_onboarding');
    expect(sys.system_type).toBe('website_assistant');
    expect(sys.tenant_id).toBe(A.tenantId);
    // Der Name trägt den Slug — drei Zeilen namens "Website Assistant"
    // helfen im Bestand niemandem.
    expect(sys.name).toBe(`Website Assistant — ${slug}`);
    // 'draft', nicht 'active': Der Assistent läuft noch nicht. Ihn als aktiv
    // zu führen wäre eine Behauptung über den Betriebszustand.
    expect(sys.status).toBe('draft');
  });

  it('eine neue Site legt den AVV als pending an', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'boot-dpa' });
    await createSite(ctx!, A.tenantId, uniqueSlug('elektro'));

    const r = await ctx!.client.query(
      `SELECT status, version, accepted_at FROM public.data_processing_agreements
       WHERE tenant_id = $1`, [A.tenantId],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.status).toBe('pending');
    expect(r.rows[0]!.accepted_at).toBeNull();
  });

  it('die zweite Site wirft einen angenommenen AVV nicht auf pending zurück', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'boot-zwei' });
    await createSite(ctx!, A.tenantId, uniqueSlug('erste'));
    await ctx!.client.query(
      `UPDATE public.data_processing_agreements
       SET status='accepted', accepted_at=now(), accepted_by=$2 WHERE tenant_id=$1`,
      [A.tenantId, A.userId],
    );

    await createSite(ctx!, A.tenantId, uniqueSlug('zweite'));

    const r = await ctx!.client.query(
      `SELECT status FROM public.data_processing_agreements WHERE tenant_id=$1`,
      [A.tenantId],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.status).toBe('accepted');
  });

  it('jede Site bekommt ihr eigenes KI-System', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'boot-je-site' });
    const s1 = await createSite(ctx!, A.tenantId, uniqueSlug('a'));
    const s2 = await createSite(ctx!, A.tenantId, uniqueSlug('b'));
    expect(s1.ai_system_id).not.toBe(s2.ai_system_id);
  });

  // ══════════════════════════════════════════════════════════════════
  // Aufgabe 4 — die Publish-Schranke
  // ══════════════════════════════════════════════════════════════════

  it('mit pending AVV lässt sich nicht veröffentlichen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'pub-pending' });
    const site = await createSite(ctx!, A.tenantId, uniqueSlug('gesperrt'));

    await expect(
      ctx!.client.query(
        `UPDATE public.presence_sites SET status='published', published_at=now()
         WHERE id=$1`, [site.id],
      ),
    ).rejects.toThrow(/dpa_not_accepted/);
  });

  it('eine Site kann auch nicht direkt als published angelegt werden', async () => {
    // Der Umweg über INSERT wäre die naheliegende Umgehung einer reinen
    // UPDATE-Prüfung. Der bootstrap-Trigger legt den AVV pending an, der
    // guard-Trigger sieht ihn — deshalb greift die Schranke auch hier.
    const A = await createTenantWithMember(ctx!, { tenantName: 'pub-insert' });
    await expect(
      createSite(ctx!, A.tenantId, uniqueSlug('sofort'), {
        status: 'published',
      }),
    ).rejects.toThrow(/dpa_not_accepted|published_needs_timestamp/);
  });

  it('mit angenommenem AVV lässt sich veröffentlichen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'pub-ok' });
    const site = await createSite(ctx!, A.tenantId, uniqueSlug('frei'));
    await ctx!.client.query(
      `UPDATE public.data_processing_agreements
       SET status='accepted', accepted_at=now(), accepted_by=$2 WHERE tenant_id=$1`,
      [A.tenantId, A.userId],
    );

    const r = await ctx!.client.query(
      `UPDATE public.presence_sites SET status='published', published_at=now()
       WHERE id=$1 RETURNING status`, [site.id],
    );
    expect(r.rows[0]!.status).toBe('published');
  });

  it('die Schranke gilt auch für service_role — RLS umgehen hilft nicht', async () => {
    // Der eigentliche Grund, aus dem das ein Trigger ist und keine
    // Anwendungsprüfung.
    const A = await createTenantWithMember(ctx!, { tenantName: 'pub-sr' });
    const site = await createSite(ctx!, A.tenantId, uniqueSlug('serverpfad'));

    await expect(
      ctx!.withClaims({ sub: A.userId, role: 'service_role' }, async () => {
        await ctx!.client.query(
          `UPDATE public.presence_sites SET status='published', published_at=now()
           WHERE id=$1`, [site.id],
        );
      }),
    ).rejects.toThrow(/dpa_not_accepted/);
  });

  it('presence_publish_blockers nennt den Grund und schweigt, wenn keiner besteht', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'blockers' });
    await createSite(ctx!, A.tenantId, uniqueSlug('gruende'));

    const vorher = await ctx!.client.query(
      `SELECT public.presence_publish_blockers($1) AS b`, [A.tenantId],
    );
    expect(vorher.rows[0]!.b).toEqual(['dpa_not_accepted']);

    await ctx!.client.query(
      `UPDATE public.data_processing_agreements
       SET status='accepted', accepted_at=now(), accepted_by=$2 WHERE tenant_id=$1`,
      [A.tenantId, A.userId],
    );
    const nachher = await ctx!.client.query(
      `SELECT public.presence_publish_blockers($1) AS b`, [A.tenantId],
    );
    expect(nachher.rows[0]!.b).toEqual([]);
  });

  // ══════════════════════════════════════════════════════════════════
  // Aufgabe 3 — die Auflösung, auf der der Router steht
  // ══════════════════════════════════════════════════════════════════

  async function publishedSite(c: DbCtx, tenantId: string, userId: string, slug: string) {
    const site = await createSite(c, tenantId, slug);
    await c.client.query(
      `UPDATE public.data_processing_agreements
       SET status='accepted', accepted_at=now(), accepted_by=$2 WHERE tenant_id=$1`,
      [tenantId, userId],
    );
    await c.client.query(
      `UPDATE public.presence_sites SET status='published', published_at=now() WHERE id=$1`,
      [site.id],
    );
    return site;
  }

  it('löst {slug}.realsync.app auf', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'res-slug' });
    const slug = uniqueSlug('malerbetrieb');
    await publishedSite(ctx!, A.tenantId, A.userId, slug);

    const r = await ctx!.client.query(
      `SELECT public.presence_resolve_host($1) AS s`, [`${slug}.realsync.app`],
    );
    expect(r.rows[0]!.s).not.toBeNull();
    expect(r.rows[0]!.s.tenant_id).toBe(A.tenantId);
    expect(r.rows[0]!.s.template_id).toBe('handwerk-basis');
  });

  it('löst eine Custom Domain auf', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'res-domain' });
    const site = await publishedSite(ctx!, A.tenantId, A.userId, uniqueSlug('cd'));
    const domain = `${uniqueSlug('kunde')}.de`;
    await ctx!.client.query(
      `UPDATE public.presence_sites SET custom_domain=$2 WHERE id=$1`, [site.id, domain],
    );

    const r = await ctx!.client.query(
      `SELECT public.presence_resolve_host($1) AS s`, [domain],
    );
    expect(r.rows[0]!.s?.tenant_id).toBe(A.tenantId);
  });

  it('normalisiert Grossschreibung, Port und Schlusspunkt', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'res-norm' });
    const slug = uniqueSlug('norm');
    await publishedSite(ctx!, A.tenantId, A.userId, slug);

    for (const variante of [
      `${slug.toUpperCase()}.RealSync.App`,
      `${slug}.realsync.app:443`,
      `${slug}.realsync.app.`,
    ]) {
      const r = await ctx!.client.query(
        `SELECT public.presence_resolve_host($1) AS s`, [variante],
      );
      expect(r.rows[0]!.s?.slug, `Variante ${variante}`).toBe(slug);
    }
  });

  it('ein Entwurf ist über den Router nicht erreichbar', async () => {
    // Kein Nebeneffekt, sondern die Zusage: Eine unveröffentlichte Site
    // existiert für ihren Mandanten, nicht für das Netz.
    const A = await createTenantWithMember(ctx!, { tenantName: 'res-draft' });
    const slug = uniqueSlug('entwurf');
    await createSite(ctx!, A.tenantId, slug);

    const r = await ctx!.client.query(
      `SELECT public.presence_resolve_host($1) AS s`, [`${slug}.realsync.app`],
    );
    expect(r.rows[0]!.s).toBeNull();
  });

  it('eine tiefere Subdomain löst nicht auf', async () => {
    // `angriff.opfer.realsync.app` darf nicht auf `opfer` auflösen — sonst
    // bedient ein beliebiger Host die Seite eines fremden Mandanten.
    const A = await createTenantWithMember(ctx!, { tenantName: 'res-tief' });
    const slug = uniqueSlug('opfer');
    await publishedSite(ctx!, A.tenantId, A.userId, slug);

    const r = await ctx!.client.query(
      `SELECT public.presence_resolve_host($1) AS s`, [`fremd.${slug}.realsync.app`],
    );
    expect(r.rows[0]!.s).toBeNull();
  });

  it('unbekannter Host und leere Eingabe ergeben NULL, keinen Fehler', async () => {
    for (const h of ['gibtsnicht.realsync.app', 'irgendwas.de', '', null]) {
      const r = await ctx!.client.query(
        `SELECT public.presence_resolve_host($1) AS s`, [h],
      );
      expect(r.rows[0]!.s, `Host ${JSON.stringify(h)}`).toBeNull();
    }
  });

  it('die Auflösung gibt weder Bereitstellungskennungen noch owner_name heraus', async () => {
    // DSGVO Art. 5 Abs. 1 lit. c. Der anon-Schlüssel ist öffentlich — was
    // diese Funktion herausgibt, ist damit öffentlich.
    const A = await createTenantWithMember(ctx!, { tenantName: 'res-minimal' });
    const slug = uniqueSlug('sparsam');
    const site = await publishedSite(ctx!, A.tenantId, A.userId, slug);
    await ctx!.client.query(
      `UPDATE public.presence_sites
       SET cloudflare_project='cf-geheim', deployment_id='dep-geheim' WHERE id=$1`,
      [site.id],
    );
    await ctx!.client.query(
      `INSERT INTO public.business_profiles (tenant_id, business_name, owner_name, phone)
       VALUES ($1, 'Malerbetrieb Nord', 'Dominik Privatname', '+49 40 1')`,
      [A.tenantId],
    );

    const r = await ctx!.client.query(
      `SELECT public.presence_resolve_host($1)::text AS s`, [`${slug}.realsync.app`],
    );
    const roh = r.rows[0]!.s as string;
    expect(roh).toContain('Malerbetrieb Nord');
    expect(roh).not.toContain('Dominik Privatname');
    expect(roh).not.toContain('cf-geheim');
    expect(roh).not.toContain('dep-geheim');
  });

  it('anon darf auflösen, aber presence_sites nicht lesen', async () => {
    // Der Kern der Lesepfad-Entscheidung: eine Auskunft, keine Tabelle.
    //
    // Bewusst NICHT über withClaims(): Der Helfer setzt jede Rolle ausser
    // 'service_role' auf 'authenticated'. Ein Test, der `{role:'anon'}`
    // übergibt, prüft dort also authenticated — und wäre grün, ohne über
    // anon irgendetwas auszusagen. Deshalb hier SET LOCAL ROLE von Hand,
    // in einem eigenen Savepoint.
    const A = await createTenantWithMember(ctx!, { tenantName: 'res-anon' });
    const slug = uniqueSlug('anonpfad');
    await publishedSite(ctx!, A.tenantId, A.userId, slug);

    await ctx!.client.query('SAVEPOINT sp_anon');
    await ctx!.client.query(`SET LOCAL ROLE anon`);

    // Gegenprobe, dass die Rolle wirklich gewechselt hat — sonst prüfte der
    // Rest dieses Tests wieder nur postgres.
    const wer = await ctx!.client.query(`SELECT current_user AS u`);
    expect(wer.rows[0]!.u).toBe('anon');

    const auskunft = await ctx!.client.query(
      `SELECT public.presence_resolve_host($1) AS s`, [`${slug}.realsync.app`],
    );
    expect(auskunft.rows[0]!.s?.slug).toBe(slug);

    // Und zwar auf ZWEI Ebenen. Der erste Lauf dieses Tests fiel hier um:
    // `anon` konnte die Tabelle lesen (0 Zeilen dank RLS, aber lesen). Die
    // Rechte kamen aus den Default-Privileges, nicht aus der Migration —
    // siehe 20260906130000 §7. Seitdem ist das Tabellenrecht ausdrücklich
    // zurückgenommen, und dieser Test bewacht genau das: Es muss am RECHT
    // scheitern, nicht erst an der Policy. Ein Test auf „0 Zeilen" wäre
    // grün geblieben, während zwischen dem öffentlichen Schlüssel und den
    // Auftragsverarbeitungsverträgen nur eine Schicht steht.
    let tabelleGesperrt = false;
    try {
      await ctx!.client.query(`SELECT * FROM public.presence_sites`);
    } catch (err) {
      tabelleGesperrt = /permission denied/i.test(String(err));
      await ctx!.client.query('ROLLBACK TO SAVEPOINT sp_anon');
    }
    await ctx!.client.query(`RESET ROLE`);
    expect(tabelleGesperrt).toBe(true);

    // Gegenprobe für die beiden anderen Tabellen — der AVV ist der
    // empfindlichste der drei.
    for (const tabelle of ['business_profiles', 'data_processing_agreements']) {
      await ctx!.client.query('SAVEPOINT sp_anon2');
      await ctx!.client.query(`SET LOCAL ROLE anon`);
      let gesperrt = false;
      try {
        await ctx!.client.query(`SELECT * FROM public.${tabelle}`);
      } catch (err) {
        gesperrt = /permission denied/i.test(String(err));
        await ctx!.client.query('ROLLBACK TO SAVEPOINT sp_anon2');
      }
      await ctx!.client.query(`RESET ROLE`);
      expect(gesperrt, `anon darf ${tabelle} nicht lesen`).toBe(true);
    }
  });
});
