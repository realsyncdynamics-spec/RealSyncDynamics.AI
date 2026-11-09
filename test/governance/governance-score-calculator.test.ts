import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calculateScores,
  coveredFrameworks,
  describeScores,
  type TenantScoreInput,
} from '../../supabase/functions/governance-score-calculator/scoring.ts';

const empty: TenantScoreInput = { iso27001: [], iso42001: [], aiAct: [], dpias: [], nis2: [] };

describe('governance-score-calculator: Score-Logik ohne Ersatzwerte', () => {
  it('ohne Daten: kein Gesamtwert, alle Rahmenwerke null', () => {
    const s = calculateScores(empty);
    expect(s.overall).toBeNull();
    for (const f of Object.values(s.frameworks)) expect(f).toEqual({ score: null, basis: 0 });
    expect(coveredFrameworks(s)).toEqual([]);
  });

  it('kein AI-Act-Default 50 und kein NIS2-Default 100', () => {
    const s = calculateScores({ ...empty, iso27001: [{ status: 'implemented' }, { status: 'planned' }] });
    expect(s.frameworks.ai_act.score).toBeNull();
    expect(s.frameworks.nis2.score).toBeNull();
    // Nur ISO 27001 hat Daten → Gesamtwert = ISO-27001-Wert (Gewichte renormiert).
    expect(s.frameworks.iso27001).toEqual({ score: 50, basis: 2 });
    expect(s.overall).toBe(50);
    expect(coveredFrameworks(s)).toEqual(['iso27001']);
  });

  it('ISO: implemented und optimized zählen, alles andere nicht', () => {
    const s = calculateScores({
      ...empty,
      iso42001: [
        { status: 'implemented' }, { status: 'optimized' },
        { status: 'in_progress' }, { status: 'deferred' },
      ],
    });
    expect(s.frameworks.iso42001.score).toBe(50);
  });

  it('AI Act wertet Freigabestatus, nicht den Risikowert', () => {
    const s = calculateScores({
      ...empty,
      aiAct: [{ approval_status: 'approved' }, { approval_status: 'pending' }, { approval_status: 'rejected' }, { approval_status: 'approved' }],
    });
    expect(s.frameworks.ai_act.score).toBe(50);
  });

  it('DSGVO: Anteil freigegebener DSFAs', () => {
    const s = calculateScores({ ...empty, dpias: [{ status: 'approved' }, { status: 'draft' }, { status: 'in_review' }] });
    expect(s.frameworks.dsgvo).toEqual({ score: 33, basis: 3 });
  });

  it('NIS2: ungeprüfte Fristen zählen nicht', () => {
    const only = calculateScores({ ...empty, nis2: [{ is_compliant_with_deadline: null }] });
    expect(only.frameworks.nis2.score).toBeNull();
    const mixed = calculateScores({
      ...empty,
      nis2: [{ is_compliant_with_deadline: true }, { is_compliant_with_deadline: false }, { is_compliant_with_deadline: null }],
    });
    expect(mixed.frameworks.nis2).toEqual({ score: 50, basis: 2 });
  });

  it('Gesamtwert gewichtet nur Rahmenwerke mit Daten', () => {
    // ISO 27001 = 100 (Gewicht 0.25), DSGVO = 0 (Gewicht 0.20) → 100*0.25/0.45 = 55.6 → 56
    const s = calculateScores({ ...empty, iso27001: [{ status: 'implemented' }], dpias: [{ status: 'draft' }] });
    expect(s.overall).toBe(56);
  });

  it('Beschreibung nennt fehlende Daten offen', () => {
    const text = describeScores(calculateScores({ ...empty, dpias: [{ status: 'approved' }] }));
    expect(text).toContain('DSGVO: 100 % (Basis: 1)');
    expect(text).toContain('NIS2: keine Daten');
  });
});

describe('governance-score-calculator: Schema-Bezug', () => {
  const src = readFileSync('supabase/functions/governance-score-calculator/index.ts', 'utf8');

  it('nutzt keine nicht existierenden Spalten/Tabellen mehr', () => {
    expect(src).not.toMatch(/is_active/);
    expect(src).not.toMatch(/data_processing_records/);
    expect(src).not.toMatch(/compliance_by_framework|findings_count|critical_findings|finalized_at/);
    expect(src).not.toMatch(/created_by:\s*'system'/);
    expect(src).not.toMatch(/onConflict/);
  });

  it('Systembericht ohne Autor und mit festem report_scope', () => {
    expect(src).toMatch(/created_by:\s*null/);
    expect(src).toContain("'system:governance-score-daily'");
  });

  it('Migration lockert created_by auf NULL', () => {
    const sql = readFileSync('supabase/migrations/20261109060000_audit_reports_system_author.sql', 'utf8');
    expect(sql).toMatch(/ALTER COLUMN created_by DROP NOT NULL/);
  });
});
