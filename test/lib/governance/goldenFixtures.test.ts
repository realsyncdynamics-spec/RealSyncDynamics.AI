/**
 * Regression-Tests für die Finding → Report-Pipeline anhand fixer,
 * versionierter Site-Fixtures.
 *
 * Die Fixtures in `test/fixtures/governance-sites/` bilden synthetische
 * Detector-Outputs ab; dieser Test fährt sie durch `buildReportPayload`
 * und vergleicht das Ergebnis mit den im Fixture deklarierten
 * `expected`-Werten. Bricht eine Änderung an Scoring, Severity-Rang,
 * Status-Filtern oder Evidence-Dedup das Verhalten, schlägt hier
 * exakt fest, welcher Aspekt sich verändert hat.
 *
 * Kein Scanner-Aufruf. Kein Netzwerk. Kein DB.
 */
import { describe, it, expect } from 'vitest';
import { ALL_FIXTURES } from '../../fixtures/governance-sites';
import { buildReportPayload } from '../../../src/lib/governance/reportMapping';

describe('Golden fixtures → buildReportPayload', () => {
  for (const fx of ALL_FIXTURES) {
    describe(fx.name, () => {
      const payload = buildReportPayload(fx.scanRun, fx.findings, { topN: 50 });
      const report  = payload.report;

      it('produces the expected score and grade', () => {
        expect(report.score).toBe(fx.expected.score);
        expect(report.grade).toBe(fx.expected.grade);
      });

      it('counts findings totals correctly', () => {
        expect(report.total_findings).toBe(fx.expected.totalFindings);
        expect(payload.all_findings).toHaveLength(fx.expected.totalFindings);
      });

      it('produces the expected severity breakdown', () => {
        expect(report.severity_breakdown).toEqual(fx.expected.severityBreakdown);
      });

      it('produces the expected status breakdown', () => {
        expect(report.status_breakdown).toEqual(fx.expected.statusBreakdown);
      });

      it('caps top_findings count at the fixture expectation', () => {
        expect(report.top_findings).toHaveLength(fx.expected.topFindingsCount);
      });

      it('deduplicates the evidence catalog as expected', () => {
        expect(payload.evidence_catalog).toHaveLength(fx.expected.evidenceCatalogSize);
        const totalSupports = payload.evidence_catalog
          .reduce((sum, e) => sum + e.supports.length, 0);
        const findingsWithEvidence = fx.findings.filter((f) => f.evidence_ref).length;
        expect(totalSupports).toBe(findingsWithEvidence);
      });

      it('sorts top_findings by severity descending', () => {
        const ranks = report.top_findings.map((f) => {
          const order = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const;
          return order[f.severity];
        });
        for (let i = 1; i < ranks.length; i += 1) {
          expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
        }
      });

      it('preserves scan_run identity in the report header', () => {
        expect(report.scan_run_id).toBe(fx.scanRun.id);
        expect(report.tenant_id).toBe(fx.scanRun.tenant_id);
        expect(report.detector).toBe(fx.scanRun.detector);
      });
    });
  }

  it('covers exactly three named fixtures', () => {
    const names = ALL_FIXTURES.map((f) => f.name).sort();
    expect(names).toEqual(['clean-site', 'edge-case-site', 'gdpr-risk-site']);
  });
});
