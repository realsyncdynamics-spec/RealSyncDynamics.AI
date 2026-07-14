import { describe, it, expect } from 'vitest';
import {
  proposeControlStatuses,
  reconcileProposals,
  computeAutoMappings,
  type AssetProfile,
  type ControlRef,
  type CurrentMapping,
} from '../../src/lib/governance/autoMap';

const CONTROLS: ControlRef[] = [
  { framework: 'EU_AI_ACT', control_code: 'Art.9' },
  { framework: 'EU_AI_ACT', control_code: 'Art.14' },
  { framework: 'GDPR', control_code: 'Art.32' },
  { framework: 'GDPR', control_code: 'Art.30' },
  { framework: 'ISO_27001', control_code: 'A.8.24' },
  { framework: 'NIS2', control_code: 'Art.21' },
];

describe('proposeControlStatuses', () => {
  it('setzt EU-AI-Act-Controls bei Hochrisiko-KI auf gap', () => {
    const profile: AssetProfile = { assetType: 'ai_system', aiActClass: 'high', dataTypes: [] };
    const p = proposeControlStatuses(profile, CONTROLS);
    const ai = p.filter((x) => x.framework === 'EU_AI_ACT');
    expect(ai).toHaveLength(2);
    expect(ai.every((x) => x.status === 'gap')).toBe(true);
    expect(ai[0].rationale).toContain('Hochrisiko');
  });

  it('behandelt verbotene KI als gap mit passender Begründung', () => {
    const p = proposeControlStatuses({ assetType: 'ai_system', aiActClass: 'prohibited', dataTypes: [] }, CONTROLS);
    const ai = p.find((x) => x.framework === 'EU_AI_ACT')!;
    expect(ai.status).toBe('gap');
    expect(ai.rationale).toContain('verbotenes');
  });

  it('markiert EU-AI-Act als not_applicable für Nicht-KI-Assets', () => {
    const p = proposeControlStatuses({ assetType: 'website', aiActClass: 'unknown', dataTypes: [] }, CONTROLS);
    const ai = p.filter((x) => x.framework === 'EU_AI_ACT');
    expect(ai).toHaveLength(2);
    expect(ai.every((x) => x.status === 'not_applicable')).toBe(true);
  });

  it('markiert Hochrisiko-Controls für minimal/limited-KI als not_applicable', () => {
    const p = proposeControlStatuses({ assetType: 'model', aiActClass: 'limited', dataTypes: [] }, CONTROLS);
    const ai = p.filter((x) => x.framework === 'EU_AI_ACT');
    expect(ai.every((x) => x.status === 'not_applicable')).toBe(true);
    expect(ai[0].rationale).toContain('limited');
  });

  it('setzt DSGVO-Controls auf gap bei personenbezogenen Datentypen', () => {
    const p = proposeControlStatuses({ assetType: 'website', aiActClass: 'unknown', dataTypes: ['customer_data', 'analytics'] }, CONTROLS);
    const gdpr = p.filter((x) => x.framework === 'GDPR');
    expect(gdpr).toHaveLength(2);
    expect(gdpr.every((x) => x.status === 'gap')).toBe(true);
  });

  it('schlägt keine DSGVO-Controls vor, wenn keine PII-Datentypen vorliegen', () => {
    const p = proposeControlStatuses({ assetType: 'website', aiActClass: 'unknown', dataTypes: ['telemetry'] }, CONTROLS);
    expect(p.filter((x) => x.framework === 'GDPR')).toHaveLength(0);
  });

  it('rät keine Status für ISO/NIS2 (nicht aus Asset-Feldern ableitbar)', () => {
    const p = proposeControlStatuses({ assetType: 'ai_system', aiActClass: 'high', dataTypes: ['customer'] }, CONTROLS);
    expect(p.find((x) => x.framework === 'ISO_27001')).toBeUndefined();
    expect(p.find((x) => x.framework === 'NIS2')).toBeUndefined();
  });

  it('erkennt KI-Assets auch nur über den Asset-Typ (agent)', () => {
    const p = proposeControlStatuses({ assetType: 'agent', aiActClass: 'unknown', dataTypes: [] }, CONTROLS);
    const ai = p.filter((x) => x.framework === 'EU_AI_ACT');
    // agent = KI, aber aiActClass unknown → nicht not_applicable-für-Nicht-KI,
    // sondern „KI mit Risikoklasse unknown" → not_applicable-Hochrisiko.
    expect(ai.every((x) => x.status === 'not_applicable')).toBe(true);
    expect(ai[0].rationale).toContain('unknown');
  });
});

describe('reconcileProposals', () => {
  const proposals = [
    { framework: 'EU_AI_ACT', control_code: 'Art.9', status: 'gap' as const, rationale: 'x' },
    { framework: 'GDPR', control_code: 'Art.32', status: 'gap' as const, rationale: 'y' },
  ];

  it('überschreibt niemals manuell gesetzte Zuordnungen', () => {
    const current: CurrentMapping[] = [
      { framework: 'EU_AI_ACT', control_code: 'Art.9', status: 'implemented', source: 'manual' },
    ];
    const kept = reconcileProposals(proposals, current);
    expect(kept.find((p) => p.control_code === 'Art.9')).toBeUndefined();
    expect(kept.find((p) => p.control_code === 'Art.32')).toBeDefined();
  });

  it('verwirft No-Ops (auto-owned, Status unverändert)', () => {
    const current: CurrentMapping[] = [
      { framework: 'EU_AI_ACT', control_code: 'Art.9', status: 'gap', source: 'auto' },
    ];
    const kept = reconcileProposals(proposals, current);
    expect(kept.find((p) => p.control_code === 'Art.9')).toBeUndefined();
  });

  it('aktualisiert auto-owned Zuordnungen bei echter Änderung', () => {
    const current: CurrentMapping[] = [
      { framework: 'GDPR', control_code: 'Art.32', status: 'not_applicable', source: 'auto' },
    ];
    const kept = reconcileProposals(proposals, current);
    expect(kept.find((p) => p.control_code === 'Art.32')).toBeDefined();
  });

  it('ist idempotent — zweiter Lauf ohne Änderungen liefert nichts', () => {
    const profile: AssetProfile = { assetType: 'ai_system', aiActClass: 'high', dataTypes: ['customer'] };
    const first = computeAutoMappings(profile, CONTROLS, []);
    const applied: CurrentMapping[] = first.map((p) => ({ framework: p.framework, control_code: p.control_code, status: p.status, source: 'auto' }));
    const second = computeAutoMappings(profile, CONTROLS, applied);
    expect(second).toEqual([]);
  });
});
