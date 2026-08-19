import { describe, it, expect } from 'vitest';
import {
  buildDeploymentArtifact,
  derivePublishable,
  evaluatePublishGate,
  evaluateTransparency,
  parseBrief,
  preparePublish,
  renderPage,
  renderSite,
  synthesizeBlueprint,
  type PublishGateInput,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

const AT = '2026-08-19T10:00:00.000Z';

function generated(): SiteBlueprint {
  return synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'claude-opus-4' });
}

function manual(): SiteBlueprint {
  return synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { source: 'manual' });
}

/** Freigabefähige Ausgangslage — jeder Test verschlechtert genau ein Feld. */
function passingInput(): PublishGateInput {
  return {
    evidenceComplete: true,
    backendPreservation: 'preserve_all',
    humanApprovalRequired: false,
    evaluatedAt: AT,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Art. 50 Abs. 2 — maschinenlesbare Kennzeichnung im Renderer
// ─────────────────────────────────────────────────────────────────────

describe('Renderer — Kennzeichnung generierter Inhalte', () => {
  it('zeichnet generierte Blöcke am Wurzelelement aus', () => {
    const bp = generated();
    const html = renderPage(bp, bp.pages[0]);
    expect(html).toContain('data-ai-generated="true"');
  });

  it('setzt den Dokument-Marker inklusive Modell', () => {
    const bp = generated();
    const html = renderPage(bp, bp.pages[0]);
    expect(html).toContain('<meta name="ai-generated" content="true">');
    expect(html).toContain('<meta name="ai-generated-model" content="claude-opus-4">');
  });

  it('markiert nichts, wenn die Site nicht generativ erzeugt wurde', () => {
    const bp = manual();
    const html = renderPage(bp, bp.pages[0]);
    expect(html).not.toContain('data-ai-generated');
    expect(html).not.toContain('name="ai-generated"');
  });

  it('markiert nur generierte Blöcke, nicht die redaktionellen', () => {
    const bp = generated();
    const page = bp.pages[0];
    const html = renderPage(bp, page);

    // Der Hinweisblock selbst stammt vom Builder, nicht vom Modell — er
    // darf sich nicht als generierter Inhalt ausgeben.
    const disclosure = page.blocks.find((b) => b.kind === 'ai-disclosure');
    expect(disclosure?.aiGenerated).toBe(false);
    const at = html.indexOf(`id="${disclosure!.id}"`);
    expect(html.slice(at, at + 120)).not.toContain('data-ai-generated');

    // Nicht jeder Block landet im HTML: leere Bewertungslisten werden
    // bewusst weggelassen (§ 5 UWG). Geprüft wird, was ausgeliefert wird.
    const rendered = page.blocks.filter((b) => b.aiGenerated && html.includes(`id="${b.id}"`));
    expect(rendered.length).toBeGreaterThan(0);
    for (const block of rendered) {
      const pos = html.indexOf(`id="${block.id}"`);
      expect(html.slice(pos, pos + 120)).toContain('data-ai-generated="true"');
    }
  });

  it('verwechselt Formularfeld-IDs nicht mit der Block-ID', () => {
    const bp = generated();
    const page = bp.pages.find((p) => p.blocks.some((b) => b.kind === 'contact-form'));
    expect(page).toBeDefined();
    const html = renderPage(bp, page!);
    const form = page!.blocks.find((b) => b.kind === 'contact-form')!;
    // Genau ein Marker je Block, nicht einer je Eingabefeld.
    const markersInBlock = html.split(`id="${form.id}`).filter((part) => part.startsWith('" data-ai-generated'));
    expect(markersInBlock.length).toBe(form.aiGenerated ? 1 : 0);
  });

  it('bleibt deterministisch — gleicher Blueprint, gleiches HTML', () => {
    const bp = generated();
    expect(renderSite(bp).map((p) => p.html)).toEqual(renderSite(bp).map((p) => p.html));
  });
});

// ─────────────────────────────────────────────────────────────────────
// Ableitungsregel (target-architecture §7)
// ─────────────────────────────────────────────────────────────────────

describe('derivePublishable', () => {
  const base = {
    status: 'passed' as const,
    evidence_complete: true,
    backend_preservation: 'preserve_all' as const,
    policy_compliant: true,
    human_approval_required: false,
    evaluated_at: AT,
    evaluation_id: 'x',
    artifact_sha256: 'y',
    violations: [],
  };

  it('gibt frei, wenn alle fünf Bedingungen erfüllt sind', () => {
    expect(derivePublishable(base)).toBe(true);
  });

  it('blockiert bei jedem einzelnen fehlenden Kriterium', () => {
    expect(derivePublishable({ ...base, status: 'pending' })).toBe(false);
    expect(derivePublishable({ ...base, status: 'blocked' })).toBe(false);
    expect(derivePublishable({ ...base, evidence_complete: false })).toBe(false);
    expect(derivePublishable({ ...base, backend_preservation: 'changed' })).toBe(false);
    expect(derivePublishable({ ...base, backend_preservation: 'unknown' })).toBe(false);
    expect(derivePublishable({ ...base, policy_compliant: false })).toBe(false);
    expect(derivePublishable({ ...base, human_approval_required: true })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Transparenzprüfung
// ─────────────────────────────────────────────────────────────────────

describe('evaluateTransparency', () => {
  it('lässt eine vollständig gekennzeichnete Site durch', async () => {
    const bp = generated();
    const result = evaluateTransparency(bp, await buildDeploymentArtifact(bp));
    expect(result.violations).toEqual([]);
    expect(result.compliant).toBe(true);
  });

  it('blockiert, wenn der Hinweisblock aus dem Blueprint entfernt wurde', () => {
    const bp = generated();
    bp.pages = bp.pages.map((p) => ({ ...p, blocks: p.blocks.filter((b) => b.kind !== 'ai-disclosure') }));
    const result = evaluateTransparency(bp);
    expect(result.compliant).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain('transparency.missing-disclosure-block');
  });

  it('blockiert einen generierten Blueprint ohne dokumentiertes Modell', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'));
    expect(bp.origin.model).toBeNull();
    const codes = evaluateTransparency(bp).violations.map((v) => v.code);
    expect(codes).toContain('transparency.undocumented-model');
  });

  it('blockiert, wenn der Hinweis im Artefakt fehlt, obwohl der Blueprint ihn zusagt', async () => {
    const bp = generated();
    const artifact = await buildDeploymentArtifact(bp);
    // Zusage im Blueprint, Auslieferung ohne Hinweis — genau der Fall, den
    // eine reine Blueprint-Prüfung nicht sieht.
    artifact.files = artifact.files.map((f) => ({ ...f, content: f.content.replace(/data-ai-disclosure/g, '') }));
    const codes = evaluateTransparency(bp, artifact).violations.map((v) => v.code);
    expect(codes).toContain('transparency.disclosure-not-delivered');
  });

  it('blockiert, wenn die maschinenlesbare Kennzeichnung im Artefakt fehlt', async () => {
    const bp = generated();
    const artifact = await buildDeploymentArtifact(bp);
    artifact.files = artifact.files.map((f) => ({ ...f, content: f.content.replace(/ data-ai-generated="true"/g, '') }));
    const codes = evaluateTransparency(bp, artifact).violations.map((v) => v.code);
    expect(codes).toContain('transparency.marking-not-delivered');
  });

  it('greift nicht bei einer Site ohne generierte Inhalte', async () => {
    const bp = manual();
    expect(evaluateTransparency(bp, await buildDeploymentArtifact(bp)).compliant).toBe(true);
  });

  it('nennt den betroffenen Seitenpfad', () => {
    const bp = generated();
    bp.pages = bp.pages.map((p, i) => (i === 0 ? { ...p, blocks: p.blocks.filter((b) => b.kind !== 'ai-disclosure') } : p));
    const violation = evaluateTransparency(bp).violations.find((v) => v.code === 'transparency.missing-disclosure-block');
    expect(violation?.locator).toBe(bp.pages[0].path);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Gate
// ─────────────────────────────────────────────────────────────────────

describe('evaluatePublishGate', () => {
  it('gibt eine saubere Site mit vollständigem Kontext frei', async () => {
    const bp = generated();
    const contract = await evaluatePublishGate(bp, await buildDeploymentArtifact(bp), passingInput());
    expect(contract.status).toBe('passed');
    expect(contract.policy_compliant).toBe(true);
    expect(contract.publishable).toBe(true);
  });

  it('ist fail-closed: ohne Angabe zur Backend-Erhaltung keine Freigabe', async () => {
    const bp = generated();
    const contract = await evaluatePublishGate(bp, await buildDeploymentArtifact(bp), {
      evidenceComplete: true,
      humanApprovalRequired: false,
      evaluatedAt: AT,
    });
    expect(contract.backend_preservation).toBe('unknown');
    expect(contract.publishable).toBe(false);
  });

  it('blockiert bei Transparenzverstoß, auch wenn alles andere passt', async () => {
    const bp = generated();
    bp.pages = bp.pages.map((p) => ({ ...p, blocks: p.blocks.filter((b) => b.kind !== 'ai-disclosure') }));
    const contract = await evaluatePublishGate(bp, await buildDeploymentArtifact(bp), passingInput());
    expect(contract.status).toBe('blocked');
    expect(contract.publishable).toBe(false);
    expect(contract.violations.length).toBeGreaterThan(0);
  });

  it('wartet auf eine ausstehende menschliche Freigabe statt zu blockieren', async () => {
    const bp = generated();
    const contract = await evaluatePublishGate(bp, await buildDeploymentArtifact(bp), {
      ...passingInput(),
      humanApprovalRequired: true,
    });
    expect(contract.status).toBe('pending');
    expect(contract.publishable).toBe(false);
  });

  it('bindet die Bewertung an genau einen Artefakt-Hash (G6)', async () => {
    const bp = generated();
    const artifact = await buildDeploymentArtifact(bp);
    const first = await evaluatePublishGate(bp, artifact, passingInput());

    // Nicht `title`: die Startseite rendert `seo.defaultTitle`, eine
    // Änderung an `page.title` bliebe dort wirkungslos.
    bp.pages[0].description = 'Anderer Beschreibungstext für dieselbe Seite.';
    const changed = await buildDeploymentArtifact(bp);
    const second = await evaluatePublishGate(bp, changed, passingInput());

    expect(second.artifact_sha256).not.toBe(first.artifact_sha256);
    expect(second.evaluation_id).not.toBe(first.evaluation_id);
  });

  it('liefert für denselben Stand dieselbe evaluation_id', async () => {
    const bp = generated();
    const artifact = await buildDeploymentArtifact(bp);
    const a = await evaluatePublishGate(bp, artifact, passingInput());
    const b = await evaluatePublishGate(bp, artifact, passingInput());
    expect(a.evaluation_id).toBe(b.evaluation_id);
  });

  it('führt die Begründung mit, damit das Frontend sie nicht ableiten muss (G2)', async () => {
    const bp = generated();
    bp.pages = bp.pages.map((p) => ({ ...p, blocks: p.blocks.filter((b) => b.kind !== 'ai-disclosure') }));
    const contract = await evaluatePublishGate(bp, await buildDeploymentArtifact(bp), passingInput());
    expect(contract.violations[0].reference).toContain('Art. 50');
    expect(contract.violations[0].message).not.toBe('');
  });
});

describe('preparePublish', () => {
  it('liefert Artefakt und Bewertung in einem Schritt', async () => {
    const { artifact, contract } = await preparePublish(generated(), passingInput());
    expect(artifact.files.length).toBeGreaterThan(0);
    expect(contract.artifact_sha256).toBe(artifact.artifactSha256);
    expect(contract.publishable).toBe(true);
  });

  it('reicht Render-Optionen an das Artefakt durch', async () => {
    const { artifact } = await preparePublish(generated(), passingInput(), { baseUrl: 'https://praxis.de' });
    expect(artifact.files[0].content).toContain('https://praxis.de');
  });
});
