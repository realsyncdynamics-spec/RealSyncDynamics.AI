import { describe, expect, it } from 'vitest';
import {
  applyComponentOperations,
  assessImport,
  assessPublishReadiness,
  canonicalHash,
  chooseDirections,
  createWorkflow,
  directionToBlueprint,
  editSelected,
  evaluateReadiness,
  generateDirections,
  importSite,
  parseRevisionIntents,
  previewHtml,
  proposeAutomations,
  recordApproval,
  renderRebuildPreview,
  reviseSelected,
  runDiscoverAssessRebuild,
  selectDirection,
  selectedDirection,
  summarizeGovernance,
  analyzeBlueprint,
  analyzeObservation,
  contrastRatio,
  type RebuildWorkflowState,
} from '../../packages/siteos-core/src/index';

/**
 * AI Rebuild Workflow — Kern.
 *
 * Was hier verteidigt wird:
 *   • Kein Befund ohne Beleg, keine Zahl ohne Quelle.
 *   • Was die Quelle nicht hergibt, bleibt null/unknown/Platzhalter.
 *   • Derselbe Import ergibt denselben Hash.
 *   • Eine Revision ändert nur, was benannt ist, und sagt, was sie tat.
 *   • Kein GO ohne Reife, kein GO für einen fremden Hash.
 */

const FIXTURE = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Elektro Müller GmbH | Elektroinstallation in Kassel</title>
<meta name="description" content="Elektro Müller: Elektroinstallation, Smart Home und Photovoltaik in Kassel. Meisterbetrieb seit 1998.">
<meta property="og:title" content="Elektro Müller – Ihr Elektriker in Kassel"><meta property="og:image" content="/img/team.jpg">
<meta name="theme-color" content="#0B3D91">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600&family=Open+Sans&display=swap">
<style>:root{--brand:#0B3D91;--accent:#F59E0B} body{font-family:'Open Sans',sans-serif} h1{font-family:Montserrat,sans-serif;color:#0B3D91} .btn-primary{background:#F59E0B}</style>
<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head>
<body><header><a href="/"><img src="/img/logo.svg" alt="Elektro Müller Logo" class="logo"></a>
<nav><a href="/">Start</a><a href="/leistungen">Leistungen</a><a href="/photovoltaik">Photovoltaik</a><a href="/smart-home">Smart Home</a><a href="/kontakt">Kontakt</a></nav></header>
<main><section><h1>Herzlich willkommen bei Elektro Müller</h1>
<p>Wir sind Ihr kompetenter, zuverlässiger und professioneller Partner für Elektroinstallation, Smart Home und Photovoltaik in Kassel.</p>
<a class="btn btn-primary" href="/kontakt">Mehr erfahren</a><a class="btn btn-outline" href="tel:+495611234567">0561 123 45 67</a></section>
<h2>Elektroinstallation</h2><p>Von der Neuinstallation bis zur Sanierung planen wir Ihre Elektrik nach DIN-VDE.</p>
<h2>Photovoltaik</h2><p>Photovoltaik vom Meisterbetrieb: Planung, Montage und Anmeldung aus einer Hand.</p>
<h2>Was kostet eine Photovoltaikanlage?</h2><p>Eine Anlage kostet ab 8.000 € – Festpreisangebot nach Besichtigung.</p>
<p>Meisterbetrieb seit 1998 · Mitglied der Elektro-Innung Kassel · 4,9 von 5 Sternen bei Google (128 Bewertungen)</p>
<p>Das sagen unsere Kunden: „Schnell, sauber, fair – die Anlage läuft seit zwei Jahren ohne Probleme."</p>
<section id="kontakt"><form action="/kontakt/senden" method="post"><label for="n">Name</label><input id="n" name="name" type="text" required>
<label for="e">E-Mail</label><input id="e" name="email" type="email" required><label for="m">Nachricht</label><textarea id="m" name="message"></textarea>
<button type="submit">Absenden</button></form><a href="mailto:info@elektro-mueller.de">info@elektro-mueller.de</a></section>
<img src="/img/pv1.jpg" width="1200" height="800"><img src="/img/pv3.jpg"></main>
<footer><a href="/impressum">Impressum</a> <a href="/datenschutz">Datenschutz</a><iframe src="https://www.google.com/maps/embed?pb=abc"></iframe></footer></body></html>`;

const EMPTY = '<!doctype html><html><head><title>x</title></head><body><p>Hallo</p></body></html>';

const INPUT = { sourceUrl: 'https://www.elektro-mueller.de/', html: FIXTURE, fetchedAt: '2026-09-29T10:00:00.000Z', statusCode: 200, contentType: 'text/html' };

async function build(): Promise<RebuildWorkflowState> {
  return runDiscoverAssessRebuild(createWorkflow(INPUT.sourceUrl), INPUT);
}

describe('rebuild — DISCOVER', () => {
  it('extrahiert Marke, Positionierung, Formular, Trust und Drittanbieter mit Belegen', async () => {
    const imp = await importSite(INPUT);
    expect(imp.brand.name).toBe('Elektro Müller');
    expect(imp.brand.colors).toEqual(['#0B3D91', '#F59E0B']);
    expect(imp.brand.fonts).toEqual(['Montserrat', 'Open Sans']);
    expect(imp.brand.logo?.alt).toBe('Elektro Müller Logo');
    expect(imp.positioning.industry).toBe('handwerk');
    expect(imp.positioning.locality).toBe('Kassel');
    expect(imp.positioning.conversionGoal).toBe('contact');
    // Die Begrüßung ist kein Angebot — og:title tritt an ihre Stelle (roh, belegt;
    // die Marke streicht erst die Richtung heraus).
    expect(imp.positioning.offer).toBe('Elektro Müller – Ihr Elektriker in Kassel');
    expect(imp.positioning.audience).toBeNull();
    expect(imp.forms[0]).toMatchObject({ purpose: 'contact', action: 'https://www.elektro-mueller.de/kontakt/senden', method: 'post', hasConsentHint: false });
    expect(imp.trust.map((t) => t.kind)).toEqual(expect.arrayContaining(['years', 'membership', 'rating', 'reference']));
    expect(imp.thirdPartyHosts).toEqual(['fonts.googleapis.com', 'www.google.com', 'www.googletagmanager.com']);
    expect(imp.ctas.some((c) => c.kind === 'tel')).toBe(true);
    // Jeder Beleg trägt Quelle, Auszug, Zeitpunkt und Hash.
    for (const e of imp.evidence) {
      expect(e.source).toBe(INPUT.sourceUrl);
      expect(e.excerpt.length).toBeGreaterThan(0);
      expect(e.observedAt).toBe(INPUT.fetchedAt);
      expect(e.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.ref.length).toBeGreaterThan(0);
    }
  });

  it('rät nichts: leere Quelle ⇒ null / unknown', async () => {
    const imp = await importSite({ sourceUrl: 'https://leer.example/', html: EMPTY, fetchedAt: INPUT.fetchedAt });
    expect(imp.h1).toBeNull();
    expect(imp.description).toBeNull();
    expect(imp.positioning.industry).toBeNull();
    expect(imp.positioning.locality).toBeNull();
    expect(imp.positioning.audience).toBeNull();
    expect(imp.positioning.conversionGoal).toBe('unknown');
    expect(imp.brand.colors).toEqual([]);
    expect(imp.forms).toEqual([]);
    expect(imp.trust).toEqual([]);
  });
});

describe('rebuild — ASSESS', () => {
  it('bewertet acht Kriterien und hängt an jeden Befund mindestens einen Beleg', async () => {
    const imp = await importSite(INPUT);
    const a = await assessImport(imp);
    expect(a.criteria.map((c) => c.criterion)).toHaveLength(8);
    expect(a.findings.map((f) => f.code)).toEqual(expect.arrayContaining(['hero.vague-headline', 'cta.generic-labels', 'conversion.form-without-consent', 'seo.missing-canonical']));
    for (const f of a.findings) {
      expect(f.evidenceIds.length).toBeGreaterThan(0);
      for (const id of f.evidenceIds) expect(a.evidence.some((e) => e.id === id)).toBe(true);
    }
    expect(a.overall).toBeGreaterThan(0);
    expect(a.overall).toBeLessThanOrEqual(100);
    expect(a.criteria.find((c) => c.criterion === 'trust-signals')?.score).toBe(100);
  });

  it('meldet fehlenden Viewport und fehlende CTAs als kritisch', async () => {
    const imp = await importSite({ sourceUrl: 'https://leer.example/', html: EMPTY, fetchedAt: INPUT.fetchedAt });
    const a = await assessImport(imp);
    const codes = a.findings.map((f) => f.code);
    expect(codes).toContain('mobile.no-viewport');
    expect(codes).toContain('cta.none');
    expect(codes).toContain('hero.missing-h1');
    expect(codes).toContain('trust.none');
  });
});

describe('rebuild — REBUILD', () => {
  it('wählt Richtungen je Branche und baut Copy nur aus der Quelle', async () => {
    const state = await build();
    expect(chooseDirections(state.import!)).toEqual(['local-trust', 'conversion-focus', 'clean-enterprise']);
    expect(state.directions.map((d) => d.key)).toEqual(['local-trust', 'conversion-focus', 'clean-enterprise']);
    for (const d of state.directions) {
      const hero = d.components.find((c) => c.kind === 'hero')!;
      expect(hero.text.headline).toContain('Ihr Elektriker in Kassel');
      expect(hero.text.headline).not.toMatch(/Kassel.*Kassel/);
      expect(d.seo.title.length).toBeLessThanOrEqual(60);
      expect(d.seo.description.length).toBeLessThanOrEqual(155);
      expect(d.leadFlow.formTarget).toBe('https://www.elektro-mueller.de/kontakt/senden');
      expect(d.leadFlow.consentNote).toMatch(/Art\. 6/);
      // Markenfarbe übernommen, mit Kontrast geprüft.
      expect(d.designSystem.colors.primary).toBe('#0B3D91');
      expect(d.designSystem.colors.origin).toBe('brand');
      expect(contrastRatio(d.designSystem.colors.primaryForeground, d.designSystem.colors.primary)!).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(d.designSystem.colors.accent, d.designSystem.colors.background)!).toBeGreaterThanOrEqual(4.5);
      expect(d.designSystem.typography.origin).toBe('brand');
      expect(d.designSystem.mode).toBe('light');
      // Kategorien der Navigation sind keine Leistungen.
      const benefits = d.components.find((c) => c.kind === 'benefits')!;
      expect(benefits.items.map((i) => i.title)).not.toContain('Leistungen');
      expect(benefits.items.map((i) => i.title)).toContain('Photovoltaik');
    }
  });

  it('erfindet nichts: ohne Belege bleiben Trust, Referenz und Preise Platzhalter', async () => {
    const imp = await importSite({ sourceUrl: 'https://leer.example/', html: EMPTY, fetchedAt: INPUT.fetchedAt });
    const [d] = generateDirections(imp, null);
    const byKind = (k: string) => d.components.find((c) => c.kind === k)!;
    expect(byKind('trust-bar').placeholder).toBe(true);
    expect(byKind('case-study').placeholder).toBe(true);
    expect(byKind('pricing').placeholder).toBe(true);
    expect(d.proof[0].placeholder).toBe(true);
    expect(d.designSystem.colors.origin).toBe('fallback');
    const html = renderRebuildPreview(d, { brandName: 'Leer' });
    expect(html).toContain('Platzhalter');
    expect(html).not.toMatch(/\d+\s*(?:Kunden|Bewertungen|Jahre)/);
  });

  it('ist deterministisch', async () => {
    const [a, b] = await Promise.all([build(), build()]);
    expect(await canonicalHash(a.directions)).toBe(await canonicalHash(b.directions));
    expect(a.import!.htmlSha256).toBe(b.import!.htmlSha256);
  });

  it('rendert eine Vorschau ohne Drittanbieter, mit genau einer H1 und Pflichtlinks', async () => {
    const state = await build();
    const html = previewHtml(state, state.directions[0]);
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<html lang="de">/);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('href="/impressum"');
    expect(html).toContain('href="/datenschutz"');
    expect(html).not.toMatch(/<(?:script|link)[^>]+(?:src|href)="https?:\/\/(?!www\.elektro-mueller\.de)/);
    // Der Live-Analysator sieht keine DSGVO-/TDDDG-Befunde in der Vorschau.
    const findings = analyzeObservation({ url: 'https://preview.example/', observedAt: INPUT.fetchedAt, statusCode: 200, headers: {}, html, cookiesBeforeConsent: [], thirdPartyHosts: [], ttfbMs: 100, transferBytes: html.length }, { expectsAiDisclosure: false, expectedLang: 'de' });
    expect(findings.filter((f) => f.dimension === 'gdpr' || f.dimension === 'tdddg')).toEqual([]);
  });
});

describe('rebuild — REFINE', () => {
  it('erkennt die benannten Absichten', () => {
    expect(parseRevisionIntents('seriöser')).toEqual(['more-serious']);
    expect(parseRevisionIntents('mehr Vertrauen')).toEqual(['more-trust']);
    expect(parseRevisionIntents('weniger Startup, mehr Mittelstand')).toEqual(['less-startup-more-mittelstand']);
    expect(parseRevisionIntents('mehr lokal')).toEqual(['more-local']);
    expect(parseRevisionIntents('CTA stärker')).toEqual(['stronger-cta']);
    expect(parseRevisionIntents('Hero kürzer')).toEqual(['shorter-hero']);
    expect(parseRevisionIntents('mehr wie Premium-Beratung')).toEqual(['premium-advisory']);
    expect(parseRevisionIntents('für Handwerker')).toEqual(['for-handwerk']);
    expect(parseRevisionIntents('für Steuerberater')).toEqual(['for-steuerberater']);
    expect(parseRevisionIntents('für KI-Governance')).toEqual(['for-ki-governance']);
    expect(parseRevisionIntents('bitte hellblau #0EA5E9')).toEqual(['accent-color']);
    expect(parseRevisionIntents('irgendwas')).toEqual([]);
  });

  it('ändert gezielt und meldet, was passiert ist — und was nicht', async () => {
    let state = selectDirection(await build(), 'conversion-focus');
    const before = selectedDirection(state)!;

    const serious = reviseSelected(state, 'seriöser', '2026-09-29T10:01:00.000Z');
    state = serious.state;
    expect(serious.record.understood).toBe(true);
    expect(serious.record.changes.map((c) => c.code)).toContain('design.serious');
    const after = selectedDirection(state)!;
    expect(after.designSystem.radius.md).toBeLessThanOrEqual(6);
    expect(after.designSystem.cards.shadow).toBe('none');
    // Struktur unangetastet.
    expect(after.components.map((c) => c.kind)).toEqual(before.components.map((c) => c.kind));

    const trust = reviseSelected(state, 'mehr Vertrauen', '2026-09-29T10:02:00.000Z');
    state = trust.state;
    expect(selectedDirection(state)!.components[1].kind).toBe('trust-bar');

    const shorter = reviseSelected(state, 'Hero kürzer', '2026-09-29T10:03:00.000Z');
    state = shorter.state;
    const hero = selectedDirection(state)!.components.find((c) => c.kind === 'hero')!;
    expect(hero.text.headline!.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(hero.variant).toBe('centered');

    const red = reviseSelected(state, 'nimm #ff0000 als Akzent', '2026-09-29T10:04:00.000Z');
    expect(red.record.understood).toBe(false);
    expect(red.record.refusals[0]).toMatch(/4\.5:1/);

    const nonsense = reviseSelected(state, 'blabla', '2026-09-29T10:05:00.000Z');
    expect(nonsense.record.understood).toBe(false);
    expect(nonsense.record.refusals).toEqual([]);
  });

  it('Editor-Operationen: prüft gegen den Katalog, lehnt Unbekanntes ab, hält den Hero sichtbar', async () => {
    const state = selectDirection(await build(), 'clean-enterprise');
    const d = selectedDirection(state)!;
    const hero = d.components.find((c) => c.kind === 'hero')!;
    const lead = d.components.find((c) => c.kind === 'lead-form')!;
    const result = applyComponentOperations(d, [
      { op: 'set-text', id: hero.id, field: 'headline', value: 'Neu' },
      { op: 'set-variant', id: hero.id, variant: 'nope' },
      { op: 'set-visible', id: hero.id, visible: false },
      { op: 'set-form-target', id: lead.id, formTarget: 'javascript:alert(1)' },
      { op: 'set-form-target', id: lead.id, formTarget: 'mailto:anfrage@beispiel.de' },
      { op: 'move', id: lead.id, to: 1 },
    ]);
    expect(result.direction.components.find((c) => c.kind === 'hero')!.text.headline).toBe('Neu');
    expect(result.rejected).toHaveLength(3);
    expect(result.direction.components[1].kind).toBe('lead-form');
    expect(result.direction.leadFlow.formTarget).toBe('mailto:anfrage@beispiel.de');
    expect(result.direction.leadFlow.requiresConfiguration).toBe(false);
  });
});

describe('rebuild — PUBLISH / AUTOMATE / GOVERN', () => {
  it('blockt Platzhalter und fehlendes Gate, bindet das GO an den Hash', async () => {
    let state = selectDirection(await build(), 'local-trust');
    state = await evaluateReadiness(state, '2026-09-29T11:00:00.000Z');
    expect(state.readiness!.ready).toBe(false);
    expect(state.readiness!.checks.find((c) => c.code === 'governance.gate')!.status).toBe('unknown');
    expect(state.readiness!.checks.find((c) => c.code === 'form.target')!.status).toBe('pass');

    // Platzhalter ausblenden, Gate „pending" (Freigabe nötig) ⇒ reif.
    const d = selectedDirection(state)!;
    const hide = d.components.filter((c) => c.visible && c.placeholder).map((c) => ({ op: 'set-visible' as const, id: c.id, visible: false }));
    state = editSelected(state, hide, '2026-09-29T11:01:00.000Z').state;
    // Eine wirksame Änderung verfällt die Reifeprüfung; ohne Änderung bleibt sie.
    if (hide.length > 0) expect(state.readiness).toBeNull();
    const pendingGate = { status: 'pending' as const, evidence_complete: true, backend_preservation: 'preserve_all' as const, policy_compliant: true, human_approval_required: true, publishable: false, evaluated_at: 'x', evaluation_id: 'e1', artifact_sha256: 'y', blockers: [], warnings: [] };
    state = await evaluateReadiness(state, '2026-09-29T11:02:00.000Z', pendingGate);
    expect(state.readiness!.ready).toBe(true);
    expect(state.readiness!.checks.find((c) => c.code === 'content.placeholders')!.status).toBe('pass');

    const wrong = recordApproval(state, 'user-1', 'deadbeef', '2026-09-29T11:03:00.000Z');
    expect(wrong.refused).toMatch(/anderen Stand/);
    expect(wrong.state.approval.approved).toBe(false);

    const ok = recordApproval(state, 'user-1', state.readiness!.artifactSha256, '2026-09-29T11:03:00.000Z');
    expect(ok.refused).toBeNull();
    expect(ok.state.approval).toMatchObject({ approved: true, approvedBy: 'user-1', artifactSha256: state.readiness!.artifactSha256 });
    expect(ok.state.stage).toBe('automate');

    // Jede weitere Änderung verfällt die Freigabe.
    const changed = editSelected(ok.state, [{ op: 'set-text', id: d.components[0].id, field: 'headline', value: 'Anders' }], '2026-09-29T11:04:00.000Z').state;
    expect(changed.approval.approved).toBe(false);
  });

  it('schlägt nächste Schritte nur mit Belegen und Freigabepflicht vor, ohne verbundene Integrationen', async () => {
    let state = selectDirection(await build(), 'conversion-focus');
    state = proposeAutomations(state);
    expect(state.suggestions.map((s) => s.key)).toEqual(expect.arrayContaining(['lead-automation', 'booking', 'chatbot', 'dsgvo-ai-act-check', 'governance-scan', 'local-ai', 'crm-email-stripe', 'form-to-workflow']));
    for (const s of state.suggestions) {
      expect(s.requiresApproval).toBe(true);
      expect(s.status).toBe('proposed');
      expect(['none', 'requires-setup']).toContain(s.connection);
    }
    state = await summarizeGovernance(state);
    expect(state.governance!.tenantAuthority).toBe('server');
    expect(state.governance!.evidenceCount).toBe(state.import!.evidence.length);
    expect(state.governance!.pendingApprovals[0]).toBe('Veröffentlichung (GO)');
    expect(state.governance!.hashes.import).toBe(state.import!.htmlSha256);
  });

  it('übersetzt die Richtung in einen Blueprint, den Analyse und Gate verstehen', async () => {
    const state = selectDirection(await build(), 'clean-enterprise');
    const bp = directionToBlueprint(selectedDirection(state)!, state.import!);
    expect(bp.origin.source).toBe('import');
    expect(bp.origin.model).toBeNull();
    expect(bp.industry).toBe('handwerk');
    expect(bp.theme.accent).toBe('#0B3D91');
    const kinds = bp.pages[0].blocks.map((b) => b.kind);
    expect(kinds[0]).toBe('navigation');
    expect(kinds[kinds.length - 1]).toBe('footer');
    expect(kinds).toContain('contact-form');
    expect(bp.compliance.legalBases).toContain('Art. 6 Abs. 1 lit. b DSGVO');
    expect(analyzeBlueprint(bp).filter((f) => f.severity === 'critical')).toEqual([]);
    // Platzhalter landen nicht im Blueprint.
    expect(JSON.stringify(bp)).not.toContain('Platzhalter');
    const readiness = assessPublishReadiness({ direction: selectedDirection(state)!, previewHtml: previewHtml(state), artifactSha256: 'a'.repeat(64), evaluatedAt: 'x' });
    expect(readiness.approvalRequired).toBe(true);
    expect(readiness.deployPaths.map((p) => p.status)).toEqual(['available', 'requires-setup', 'coming-soon']);
  });
});
