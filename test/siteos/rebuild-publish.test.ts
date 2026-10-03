// Rebuild-Workflow — PUBLISH, AUTOMATE, GOVERN.
//
// Festgehalten wird:
//   • Der Backend-Vergleich stellt Verluste fest, statt Erhalt zu behaupten:
//     ein CMS-Formularziel gilt erst als erhalten, wenn ein eigenes Ziel
//     eingetragen ist; Strecken auf der alten Domain gelten als verloren.
//   • Ein bewusster Verzicht sperrt nicht mehr, steht aber im Gate.
//   • Ungeprüfte Bereiche verlangen eine Freigabe statt einer stillen Zusage.
//   • Begleitdateien (Weiterleitungen, Header, Sitemap) liegen im Hash.
//   • Der ZIP-Export ist gültig und bytegleich reproduzierbar.
//   • Nächste Schritte behaupten keine Verbindung, die die Registratur nicht kennt.

import { describe, expect, it } from 'vitest';
import {
  STATIC_SITE_CSP,
  analyzeBlueprint,
  buildDeploymentArtifact,
  buildPublishChecklist,
  buildSiteFiles,
  compareBackend,
  crc32,
  createZip,
  evaluatePublishGate,
  planNextSteps,
  redirectsForBlueprint,
  renderSite,
  type BackendState,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';
import { rebuildCase } from './rebuild-helpers';

function withForm(bp: SiteBlueprint, target: string): SiteBlueprint {
  return { ...bp, pages: bp.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.kind === 'contact-form' ? { ...b, content: { ...b.content, target } } : b)) })) };
}

function withLegalTexts(bp: SiteBlueprint): SiteBlueprint {
  const text = 'Angaben gemäß § 5 DDG: Musterfirma GmbH, Musterstraße 1, 04109 Leipzig. Vertreten durch die Geschäftsführung.';
  return { ...bp, pages: bp.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.kind === 'legal-text' ? { ...b, content: { ...b.content, body: text } } : b)) })) };
}

function gate(blueprint: SiteBlueprint, backend: BackendState) {
  return evaluatePublishGate({
    blueprint,
    findings: analyzeBlueprint(blueprint),
    artifactSha256: 'a'.repeat(64),
    evidence: { snapshotWritten: true, custodyLinked: true },
    backend,
    approval: { grantedForArtifactSha256: null, grantedBy: null, reason: null },
    policyEngine: { engine: 'not_enforcing', reason: 'Test' },
    evaluationId: '00000000-0000-4000-8000-000000000000',
    evaluatedAt: '2026-09-29T12:00:00.000Z',
  });
}

describe('PUBLISH — Backend-Vergleich', () => {
  it('ein CMS-Formularziel ist erst mit eigenem Ziel erhalten', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const before = compareBackend(snapshot, builds[0].blueprint);
    const form = before.items.find((i) => i.kind === 'form-target');
    expect(form?.status).toBe('lost');
    expect(before.comparison.lostFormTargets.length).toBeGreaterThan(0);

    const after = compareBackend(snapshot, withForm(builds[0].blueprint, 'mailto:anfrage@mueller-haustechnik.example'));
    expect(after.items.find((i) => i.key === form?.key)?.status).toBe('preserved');
    expect(after.comparison.lostFormTargets).toEqual([]);
  });

  it('ein relativer Pfad ist kein Formularziel', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const report = compareBackend(snapshot, withForm(builds[0].blueprint, '/api/anfrage'));
    expect(report.comparison.lostFormTargets.length).toBeGreaterThan(0);
  });

  it('eine Buchungsstrecke beim Anbieter bleibt erhalten, wenn der Neubau dorthin verlinkt', async () => {
    const { snapshot, builds } = await rebuildCase('steuer');
    const report = compareBackend(snapshot, builds[0].blueprint);
    expect(report.items.find((i) => i.kind === 'booking')?.status).toBe('preserved');
    expect(report.comparison.lostBookingPaths).toEqual([]);
  });

  it('Tracking entfällt als Hinweis — keine verlorene Einwilligungskategorie', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const report = compareBackend(snapshot, builds[0].blueprint);
    expect(report.items.find((i) => i.kind === 'tracking')?.status).toBe('info');
    expect(report.comparison.lostConsentCategories).toEqual([]);
  });

  it('eingebettete Formular- und Chat-Dienste gelten als verloren, bis sie ersetzt oder bewusst aufgegeben sind', async () => {
    const { snapshot, builds } = await rebuildCase('saas');
    const report = compareBackend(snapshot, builds[0].blueprint);
    const labels = report.items.filter((i) => i.status === 'lost').map((i) => i.label);
    expect(labels.some((l) => l.startsWith('Formulardienst'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Chat'))).toBe(true);
  });

  it('ein bewusster Verzicht sperrt nicht mehr, steht aber im Gate', async () => {
    const { snapshot, builds } = await rebuildCase('steuer');
    const blueprint = withLegalTexts(withForm(builds[0].blueprint, 'https://forms.berger-steuer.example/anfrage'));
    const newsletter = compareBackend(snapshot, blueprint).items.find((i) => i.label === 'Newsletter-Anmeldung');
    expect(newsletter?.status).toBe('lost');

    const waived = compareBackend(snapshot, blueprint, [{ key: newsletter!.key, reason: 'Newsletter wird eingestellt, Verteiler ist gekündigt.', by: 'u-1', at: '2026-09-29T12:00:00.000Z' }]);
    expect(waived.items.find((i) => i.key === newsletter!.key)?.status).toBe('waived');
    expect(waived.comparison.lostFormTargets).toEqual([]);
    expect(waived.comparison.waived?.[0]).toMatch(/Newsletter wird eingestellt/);

    const evaluation = gate(blueprint, { kind: 'transformation', comparison: waived.comparison });
    expect(evaluation.backend_preservation).toBe('preserve_all');
    expect(evaluation.warnings.join(' ')).toMatch(/Bewusst entfallen/);
  });

  it('nicht gelesene Seiten verlangen eine Freigabe statt einer stillen Zusage', async () => {
    const { snapshot, builds } = await rebuildCase('steuer');
    const blueprint = withLegalTexts(withForm(builds[0].blueprint, 'https://forms.berger-steuer.example/anfrage'));
    const newsletterKey = compareBackend(snapshot, blueprint).items.find((i) => i.label === 'Newsletter-Anmeldung')!.key;
    const report = compareBackend(snapshot, blueprint, [{ key: newsletterKey, reason: 'Newsletter wird eingestellt.', by: 'u', at: '2026-09-29T12:00:00.000Z' }]);
    expect(report.comparison.unverified?.[0]).toMatch(/laut Sitemap 14/);

    const pending = gate(blueprint, { kind: 'transformation', comparison: report.comparison });
    expect(pending.status).toBe('pending');
    expect(pending.human_approval_required).toBe(true);
    expect(pending.blockers.join(' ')).toMatch(/Backend-Vergleich unvollständig/);
  });

  it('ohne Formularziel und Rechtstexte bleibt die Transformation gesperrt', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const evaluation = gate(builds[0].blueprint, { kind: 'transformation', comparison: compareBackend(snapshot, builds[0].blueprint).comparison });
    expect(evaluation.status).toBe('blocked');
    expect(evaluation.publishable).toBe(false);
  });
});

describe('PUBLISH — Bündel und Begleitdateien', () => {
  it('Begleitdateien: Sitemap nur mit Zieldomain, Weiterleitungen nur auf vorhandene Seiten', async () => {
    const { builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const withoutBase = buildSiteFiles(bp, { redirects: [{ from: '/alt', to: '/kontakt' }] });
    expect(withoutBase.map((f) => f.path)).toEqual(['/robots.txt', '/_redirects', '/_headers']);
    expect(withoutBase[0].content).not.toContain('Sitemap:');

    const files = buildSiteFiles(bp, {
      baseUrl: 'https://www.mueller-haustechnik.example/pfad?x=1',
      redirects: [
        { from: '/alt', to: '/kontakt' },
        { from: '/weg', to: '/gibt-es-nicht' },
        { from: '/boese', to: 'https://fremd.example/' },
        { from: '/kontakt', to: '/leistungen' },
        { from: '/alt', to: '/leistungen' },
      ],
    });
    const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));
    expect(byPath['/robots.txt']).toContain('Sitemap: https://www.mueller-haustechnik.example/sitemap.xml');
    expect(byPath['/sitemap.xml']).toContain('<loc>https://www.mueller-haustechnik.example/kontakt</loc>');
    expect(byPath['/_redirects']).toBe('/alt /kontakt 301\n');
    expect(byPath['/_headers']).toContain(`Content-Security-Policy: ${STATIC_SITE_CSP}`);
    expect(STATIC_SITE_CSP).toContain("script-src 'none'");
  });

  it('liegen im Artefakt-Hash — ohne Anforderung bleibt das Bündel wie bisher', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const plain = await buildDeploymentArtifact(bp, { presentation: 'showcase' });
    expect(plain.files.every((f) => f.path.endsWith('.html'))).toBe(true);
    const full = await buildDeploymentArtifact(bp, { presentation: 'showcase', baseUrl: 'https://neu.example', siteFiles: { redirects: redirectsForBlueprint(snapshot, bp) } });
    expect(full.files.map((f) => f.path)).toEqual(expect.arrayContaining(['/robots.txt', '/sitemap.xml', '/_headers']));
    expect(full.artifactSha256).not.toBe(plain.artifactSha256);
    const again = await buildDeploymentArtifact(bp, { presentation: 'showcase', baseUrl: 'https://neu.example', siteFiles: { redirects: redirectsForBlueprint(snapshot, bp) } });
    expect(again.artifactSha256).toBe(full.artifactSha256);
  });

  it('ZIP: gültige Struktur, korrekte Prüfsummen, bytegleich reproduzierbar', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const entries = [
      { path: '/index.html', data: new TextEncoder().encode('<!doctype html><title>Ä</title>') },
      { path: '/kontakt/index.html', data: new TextEncoder().encode('kontakt') },
    ];
    const zip = createZip(entries);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2);
    expect(view.getUint32(14, true)).toBe(crc32(entries[0].data));
    const name = new TextDecoder().decode(zip.slice(30, 30 + view.getUint16(26, true)));
    expect(name).toBe('index.html');
    expect(createZip(entries)).toEqual(zip);
  });

  it('Rechtstexte: eingesetzter Wortlaut wird escaped ausgeliefert', async () => {
    const { builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const withBody: SiteBlueprint = { ...bp, pages: bp.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.kind === 'legal-text' ? { ...b, content: { ...b.content, body: 'Zeile <script>alert(1)</script>\nzweite Zeile\n\nNeuer Absatz' } } : b)) })) };
    const html = renderSite(withBody, { presentation: 'showcase' }).find((p) => p.path === '/impressum')?.html ?? '';
    expect(html).toContain('<p>Zeile &lt;script&gt;alert(1)&lt;/script&gt;<br>zweite Zeile</p>');
    expect(html).toContain('<p>Neuer Absatz</p>');
    expect(html).not.toContain('<!-- legal:content -->');
  });
});

describe('PUBLISH — Checkliste', () => {
  it('sperrt ohne Formularziel und Rechtstexte und wird mit beidem frei', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const open = await buildDeploymentArtifact(builds[0].blueprint, { presentation: 'showcase', baseUrl: 'https://neu.example' });
    const first = buildPublishChecklist({ blueprint: builds[0].blueprint, files: open.files, baseUrl: 'https://neu.example', sourceHost: snapshot.host, redirects: [] });
    expect(first.items.find((i) => i.key === 'form.target')?.status).toBe('blocker');
    expect(first.items.find((i) => i.key === 'legal.texts')?.status).toBe('blocker');
    expect(first.items.find((i) => i.key === 'form.hint')?.detail).toMatch(/CMS-Formular-Plugin/);
    expect(first.items.find((i) => i.key === 'seo.h1')?.status).toBe('ok');
    expect(first.items.find((i) => i.key === 'perf.external')?.status).toBe('ok');

    const ready = withLegalTexts(withForm(builds[0].blueprint, 'mailto:anfrage@mueller-haustechnik.example'));
    const done = await buildDeploymentArtifact(ready, { presentation: 'showcase', baseUrl: 'https://neu.example' });
    const second = buildPublishChecklist({ blueprint: ready, files: done.files, baseUrl: 'https://neu.example', sourceHost: snapshot.host, redirects: [] });
    expect(second.blockers).toBe(0);
    expect(second.items.find((i) => i.key === 'form.target')?.detail).toMatch(/anfrage@mueller-haustechnik\.example/);
  });

  it('nennt Bilder, die noch auf der alten Website liegen', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const confirmed: SiteBlueprint = {
      ...bp,
      pages: bp.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.kind === 'hero' && p.path === '/' ? { ...b, content: { ...b.content, media: { kind: 'image', src: 'https://www.mueller-haustechnik.example/bilder/bad.jpg', alt: 'Badsanierung', ratio: '4:3', rightsConfirmed: true } } } : b)) })),
    };
    const artifact = await buildDeploymentArtifact(confirmed, { presentation: 'showcase' });
    const list = buildPublishChecklist({ blueprint: confirmed, files: artifact.files, baseUrl: null, sourceHost: snapshot.host, redirects: [] });
    const external = list.items.find((i) => i.key === 'perf.external');
    expect(external?.status).toBe('todo');
    expect(external?.detail).toMatch(/selbst hosten/);
    // Der Transparenz-Block sagt dasselbe — und nicht „keine externen Inhalte".
    const home = renderSite(confirmed, { presentation: 'showcase' })[0].html;
    expect(home).toContain('Bilder werden von www.mueller-haustechnik.example geladen.');
    expect(home).not.toContain('lädt beim Aufruf keine Inhalte externer Anbieter');
  });
});

describe('AUTOMATE / GOVERN — nächste Schritte', () => {
  it('behauptet keine Verbindung, die die Registratur nicht kennt', async () => {
    const { snapshot, builds } = await rebuildCase('saas');
    const steps = planNextSteps({ blueprint: builds[0].blueprint, snapshot, connectors: [] });
    expect(steps).toHaveLength(10);
    for (const step of steps) {
      expect(step.requiresApproval).toBe(true);
      expect(step.connection === 'included' || step.connection === 'not-connected').toBe(true);
      expect(step.connectedSystem).toBeNull();
    }
    // Das weggefallene Chat-Widget macht den Chatbot dringlich.
    expect(steps.find((s) => s.key === 'chatbot')?.relevance).toBe('high');
    expect(steps.find((s) => s.key === 'chatbot')?.evidence.length).toBeGreaterThan(0);
  });

  it('liest den Stand je System — Stripe nur, wenn der Eintrag Stripe heißt', async () => {
    const { snapshot, builds } = await rebuildCase('steuer');
    const steps = planNextSteps({
      blueprint: builds[0].blueprint,
      snapshot,
      connectors: [
        { systemType: 'crm', status: 'connected', displayName: 'HubSpot' },
        { systemType: 'custom_api', status: 'connected', displayName: 'Interne Schnittstelle' },
        { systemType: 'messaging', status: 'pending', displayName: 'Postfach' },
      ],
    });
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s]));
    expect(byKey.crm.connection).toBe('connected');
    expect(byKey.crm.connectedSystem).toBe('HubSpot');
    expect(byKey.stripe.connection).toBe('not-connected');
    expect(byKey.email.connection).toBe('pending');
    expect(byKey.booking.relevance).toBe('high');
  });
});
