import { describe, expect, it } from 'vitest';
import { analyzeImpact, exportCss } from '../../../../src/features/governance/dashboard/ui-lab/impact';
import { DASHBOARD_TOKENS } from '../../../../src/features/governance/dashboard/ui-lab/impact-manifest';

describe('dashboard token impact',
  () => {
    it('registers the first three Command Center tokens',
      () => {
        expect(DASHBOARD_TOKENS.map((token) => token.key)).toEqual([
          '--dash-kpi-min-height',
          '--dash-title-size',
          '--dash-title-size-sm',
          '--dash-radius',
        ]);
      });

    it('treats an empty draft as mergeable with no patch',
      () => {
        const report = analyzeImpact({});
        expect(report.mergeable).toBe(true);
        expect(report.changes).toEqual([]);
        expect(exportCss({})).toMatch(/No mergeable changes/);
      });

    it('allows a KPI height inside bounds and lists sister test ids',
      () => {
        const report = analyzeImpact({ '--dash-kpi-min-height': '128px' });
        expect(report.mergeable).toBe(true);
        expect(report.changes[0]?.risk).toBe('medium');
        expect(report.changes[0]?.sisters).toEqual([
          'governance-score',
          'risk-index',
          'evidence-health',
          'audit-readiness',
        ]);
        expect(exportCss({ '--dash-kpi-min-height': '128px' })).toContain('--dash-kpi-min-height: 128px;');
        expect(exportCss({ '--dash-kpi-min-height': '128px' })).toContain('dashboard-tokens.css');
      });

    it('blocks radius drift and unmapped tokens',
      () => {
        const radius = analyzeImpact({ '--dash-radius': '8px' });
        expect(radius.mergeable).toBe(false);
        expect(radius.changes[0]?.risk).toBe('blocked');
        expect(exportCss({ '--dash-radius': '8px' })).toMatch(/No mergeable changes/);

        const unknown = analyzeImpact({ '--landing-hero-size': '72px' });
        expect(unknown.mergeable).toBe(false);
        expect(unknown.changes[0]?.reasons[0]).toMatch(/unmapped/);
      });

    it('blocks values outside the registered range',
      () => {
        const report = analyzeImpact({ '--dash-kpi-min-height': '48px' });
        expect(report.mergeable).toBe(false);
        expect(report.blocked).toEqual(['--dash-kpi-min-height']);
      });
  });
