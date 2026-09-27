import { describe, expect, it } from 'vitest';
import {
  classDistribution,
  classifyAsset,
  classifyPolicy,
  decideVerdict,
  frameworkProgress,
  initialsFromEmail,
  verdictOfAction,
  bucketOfClass,
  tierOf,
  OBLIGATIONS,
} from '@/src/features/governance/handoff/enforcementModel';

describe('enforcementModel', () => {
  it('unbekannter Systemtyp ⇒ vorsichtig C (SSoT)', () => {
    expect(classifyAsset({ id: 'x', metadata: {} }).klasse).toBe('C');
    expect(classifyAsset({ id: 'x', metadata: {} }).source).toBe('fallback');
    expect(classifyPolicy({ condition: {} }).klasse).toBe('C');
  });

  it('Connector-Klasse schlägt metadata.system_type', () => {
    const cls = classifyAsset(
      { id: 'a', metadata: { system_type: 'microsoft365' } },
      [{ source_table: 'governance_assets', source_id: 'a', system_type: 'ai_gateway', enforcement_class: 'A' }],
    );
    expect(cls.klasse).toBe('A');
    expect(cls.source).toBe('connector');
  });

  it('decideVerdict folgt verdictIsHonest', () => {
    expect(decideVerdict('C', 'block').ok).toBe(false);
    expect(decideVerdict('C', 'react').ok).toBe(true);
    expect(decideVerdict('A', 'react').ok).toBe(false);
    expect(decideVerdict('D', 'log_only').ok).toBe(true);
    expect(decideVerdict('D', 'warn').ok).toBe(false);
  });

  it('bildet DB-Aktionen auf Verdikte ab', () => {
    expect(verdictOfAction('log')).toBe('log_only');
    expect(verdictOfAction('require_approval')).toBe('require_approval');
  });

  it('Buckets: A/B anhaltend, C nachgelagert, D Papier', () => {
    expect(bucketOfClass('A')).toBe('blocking');
    expect(bucketOfClass('B')).toBe('blocking');
    expect(bucketOfClass('C')).toBe('observing');
    expect(bucketOfClass('D')).toBe('paper');
  });

  it('classDistribution zählt ohne Lücken', () => {
    expect(classDistribution(['A', 'C', 'C'])).toEqual({ A: 1, B: 0, C: 2, D: 0 });
  });

  it('frameworkProgress lässt Rahmenwerke ohne Mappings weg und ignoriert not_applicable', () => {
    const out = frameworkProgress(
      [
        { framework: 'GDPR', status: 'implemented' },
        { framework: 'GDPR', status: 'gap' },
        { framework: 'GDPR', status: 'not_applicable' },
      ],
      ['GDPR', 'EU_AI_ACT', 'ISO_42001'],
    );
    expect(out).toEqual([{ framework: 'GDPR', implemented: 1, total: 2, percent: 50 }]);
  });

  it('tierOf und Pflichten folgen dem Entwurf', () => {
    expect(tierOf('prohibited')).toBe('unacceptable');
    expect(tierOf('unknown')).toBeNull();
    expect(OBLIGATIONS.high.map((o) => o.article)).toEqual(['Art. 9', 'Art. 11', 'Art. 14', 'Art. 49']);
    expect(OBLIGATIONS.limited.map((o) => o.article)).toEqual(['Art. 50', 'Art. 4']);
    expect(OBLIGATIONS.minimal.map((o) => o.article)).toEqual(['Art. 4', 'Art. 95']);
    expect(OBLIGATIONS.unacceptable.map((o) => o.article)).toEqual(['Art. 5']);
  });

  it('Initialen aus echter E-Mail, nichts erfunden', () => {
    expect(initialsFromEmail('dominik.steiner@example.com')).toBe('DS');
    expect(initialsFromEmail('ops@example.com')).toBe('OP');
    expect(initialsFromEmail(null)).toBeNull();
    expect(initialsFromEmail('')).toBeNull();
  });
});
