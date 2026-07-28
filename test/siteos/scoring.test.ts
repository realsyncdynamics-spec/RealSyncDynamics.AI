import { describe, it, expect } from 'vitest';
import {
  applyRemediations,
  agentForDimension,
  analyzeBlueprint,
  computeDimensionScores,
  computeScores,
  CRITICAL_RISK_SURCHARGE,
  DIMENSION_PENALTY,
  HEALTH_WEIGHTS,
  isDeployable,
  maxSeverity,
  parseBrief,
  planAgentTasks,
  synthesizeBlueprint,
  type Dimension,
  type RuntimeFinding,
  type Severity,
} from '../../packages/siteos-core/src/index';

function finding(dimension: Dimension, severity: Severity, code = `${dimension}.test`): RuntimeFinding {
  return { code, dimension, severity, title: 't', reference: 'r', remediation: 'm', locator: null };
}

describe('Gewichtung', () => {
  it('summiert die Health-Gewichte auf 1', () => {
    const sum = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('computeDimensionScores', () => {
  it('lässt befundfreie Dimensionen bei 100', () => {
    const scores = computeDimensionScores([]);
    for (const value of Object.values(scores)) expect(value).toBe(100);
  });

  it('zieht je Befund den Schwere-Abzug ab', () => {
    const scores = computeDimensionScores([finding('seo', 'medium')]);
    expect(scores.seo).toBe(100 - DIMENSION_PENALTY.medium);
    expect(scores.gdpr).toBe(100);
  });

  it('kappt bei 0 statt negativ zu werden', () => {
    const many = Array.from({ length: 10 }, (_, i) => finding('gdpr', 'critical', `gdpr.c${i}`));
    expect(computeDimensionScores(many).gdpr).toBe(0);
  });
});

describe('computeScores', () => {
  it('liefert ohne Befunde ein makelloses Bild', () => {
    const scores = computeScores([]);
    expect(scores.health).toBe(100);
    expect(scores.compliance).toBe(100);
    expect(scores.risk).toBe(0);
    expect(scores.aiRisk).toBe(0);
    expect(scores.severityMax).toBeNull();
  });

  it('schlägt bei einem kritischen Befund auf das Risiko auf', () => {
    // Ohne den Aufschlag ginge ein einzelner kritischer Verstoß im
    // gewichteten Mittel unter — genau das soll er nicht.
    const critical = computeScores([finding('gdpr', 'critical')]);
    const withoutSurcharge = 100 - critical.health;
    expect(critical.risk).toBeCloseTo(withoutSurcharge + CRITICAL_RISK_SURCHARGE, 5);
  });

  it('leitet den Compliance-Score nur aus den regulatorischen Dimensionen ab', () => {
    // Ein reiner Performance-Befund darf die Compliance nicht senken.
    expect(computeScores([finding('performance', 'critical')]).compliance).toBe(100);
    expect(computeScores([finding('gdpr', 'high')]).compliance).toBeLessThan(100);
  });

  it('speist das KI-Risiko aus Transparenz und Inhaltsreife', () => {
    expect(computeScores([finding('eu-ai-act', 'high')]).aiRisk).toBeGreaterThan(0);
    expect(computeScores([finding('content', 'low')]).aiRisk).toBeGreaterThan(0);
    expect(computeScores([finding('seo', 'critical')]).aiRisk).toBe(0);
  });

  it('zählt die Befunde und hält die höchste Schwere fest', () => {
    const scores = computeScores([finding('seo', 'low'), finding('gdpr', 'high'), finding('security', 'medium')]);
    expect(scores.findingCount).toBe(3);
    expect(scores.severityMax).toBe('high');
  });
});

describe('maxSeverity', () => {
  it('liefert null ohne Befunde', () => {
    expect(maxSeverity([])).toBeNull();
  });

  it('gewichtet critical über high', () => {
    expect(maxSeverity([finding('seo', 'high'), finding('gdpr', 'critical')])).toBe('critical');
  });
});

describe('isDeployable', () => {
  it('blockiert bei einem kritischen Befund', () => {
    expect(isDeployable(computeScores([finding('gdpr', 'critical')]))).toBe(false);
  });

  it('blockiert bei zu geringer Compliance', () => {
    const weak = computeScores([
      finding('gdpr', 'high', 'a'), finding('gdpr', 'high', 'b'),
      finding('tdddg', 'high', 'c'), finding('tdddg', 'high', 'd'),
      finding('eu-ai-act', 'high', 'e'), finding('eu-ai-act', 'high', 'f'),
    ]);
    expect(weak.compliance).toBeLessThan(70);
    expect(isDeployable(weak)).toBe(false);
  });

  it('lässt eine Site mit kleineren Befunden durch', () => {
    expect(isDeployable(computeScores([finding('seo', 'low')]))).toBe(true);
  });
});

describe('planAgentTasks', () => {
  it('ordnet jede Dimension ihrem Agenten zu', () => {
    expect(agentForDimension('gdpr')).toBe('compliance');
    expect(agentForDimension('seo')).toBe('seo');
    expect(agentForDimension('security')).toBe('security');
  });

  it('bündelt Befunde je Agent', () => {
    const tasks = planAgentTasks([
      finding('gdpr', 'high', 'gdpr.a'),
      finding('tdddg', 'critical', 'tdddg.b'),
      finding('seo', 'low', 'seo.c'),
    ]);

    const compliance = tasks.find((t) => t.agent === 'compliance')!;
    expect(compliance.findingCodes).toEqual(['gdpr.a', 'tdddg.b']);
    expect(compliance.severityMax).toBe('critical');
    expect(compliance.requiresApproval).toBe(true);
  });

  it('sortiert nach Schwere, dann stabil nach Agent', () => {
    const tasks = planAgentTasks([finding('seo', 'low'), finding('gdpr', 'critical')]);
    expect(tasks.map((t) => t.agent)).toEqual(['compliance', 'seo']);
  });

  it('dedupliziert wiederholte Befund-Codes', () => {
    const tasks = planAgentTasks([finding('seo', 'low', 'seo.x'), finding('seo', 'low', 'seo.x')]);
    expect(tasks[0].findingCodes).toEqual(['seo.x']);
  });
});

describe('applyRemediations', () => {
  function blueprintWithout(path: string) {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
    return { ...bp, pages: bp.pages.filter((p) => p.path !== path) };
  }

  it('ergänzt eine fehlende Pflichtseite und behebt damit den Befund', () => {
    const bp = blueprintWithout('/impressum');
    const result = applyRemediations(bp, analyzeBlueprint(bp));

    expect(result.applied).toContain('gdpr.missing-impressum');
    expect(result.blueprint.pages.map((p) => p.path)).toContain('/impressum');
    expect(analyzeBlueprint(result.blueprint).map((f) => f.code)).not.toContain('gdpr.missing-impressum');
  });

  it('lässt den Eingabe-Blueprint unverändert', () => {
    const bp = blueprintWithout('/datenschutz');
    const before = JSON.stringify(bp);
    applyRemediations(bp, analyzeBlueprint(bp));
    expect(JSON.stringify(bp)).toBe(before);
  });

  it('setzt einen fehlenden Datenschutz-Link am Formular', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
    const page = bp.pages.find((p) => p.blocks.some((b) => b.kind === 'contact-form'))!;
    const form = page.blocks.find((b) => b.kind === 'contact-form')!;
    delete (form.content as Record<string, unknown>).privacyHref;

    const result = applyRemediations(bp, analyzeBlueprint(bp));
    expect(result.applied).toContain('gdpr.form-without-privacy-link');

    const fixed = result.blueprint.pages.find((p) => p.path === page.path)!.blocks.find((b) => b.id === form.id)!;
    expect(fixed.content.privacyHref).toBe('/datenschutz');
  });

  it('erfindet keinen Alternativtext, sondern meldet ihn als offen', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
    const hero = bp.pages[0].blocks.find((b) => b.kind === 'hero')!;
    (hero.content as { media: { alt: string } }).media.alt = '';

    const result = applyRemediations(bp, analyzeBlueprint(bp));
    expect(result.applied).not.toContain('accessibility.media-without-alt');
    expect(result.skipped.map((s) => s.code)).toContain('accessibility.media-without-alt');
  });

  it('meldet ohne behebbare Befunde changed=false', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
    expect(applyRemediations(bp, analyzeBlueprint(bp)).changed).toBe(false);
  });

  it('hebt den Health-Score, wenn Befunde behoben wurden', () => {
    const bp = blueprintWithout('/impressum');
    const before = computeScores(analyzeBlueprint(bp)).health;
    const after = computeScores(analyzeBlueprint(applyRemediations(bp, analyzeBlueprint(bp)).blueprint)).health;
    expect(after).toBeGreaterThan(before);
  });
});
