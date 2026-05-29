/**
 * Structural contract tests for ReportTemplate — the React-PDF
 * compliance-report template.
 *
 * What this proves:
 *   1) ReportTemplate is exported and is a React component.
 *   2) It accepts a ReportPayload and renders without throwing.
 *   3) The Document tree has the right number of pages depending on
 *      finding count (cover + details + methodology).
 *   4) Score / grade / subject label appear in the rendered tree.
 *
 * Why structural-not-PDF-render-tests: @react-pdf/renderer's
 * `renderToBuffer` is heavyweight (~ 1s per render) and produces
 * binary output that's painful to assert on. The React tree the
 * component returns IS the contract; production builds render it
 * via pdf().toBlob() at click-time.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { ReportTemplate } from '../../src/pdf/templates/ReportTemplate';
import { buildReportPayload } from '../../src/lib/governance/reportMapping';
import type { ReportPayload } from '../../src/types/governance/report';
import type { Finding } from '../../src/types/governance/finding';
import type { ScanRun } from '../../src/types/governance/scan-run';

function makeFinding(o: Partial<Finding>): Finding {
  return {
    id:             'f-' + Math.random().toString(36).slice(2, 8),
    tenant_id:      't-1',
    website_id:     'w-1',
    scan_run_id:    's-1',
    category:       'tracker',
    severity:       'medium',
    status:         'open',
    detector:       'gdpr-audit',
    evidence_ref:   null,
    summary:        's',
    raw_payload:    null,
    confidence_score:    1.00,
    evidence_level:      'observed' as const,
    verification_status: 'unverified' as const,
    correlation_id: 'corr-1',
    created_at:     '2026-05-25T15:00:00Z',
    updated_at:     '2026-05-25T15:00:00Z',
    ...o,
  };
}

const SCAN: ScanRun = {
  id:             's-1',
  tenant_id:      't-1',
  website_id:     'w-1',
  detector:       'gdpr-audit',
  status:         'completed',
  started_at:     '2026-05-25T15:00:00Z',
  completed_at:   '2026-05-25T15:00:30Z',
  duration_ms:    30000,
  finding_count:  3,
  severity_max:   'high',
  error_code:     null,
  error_message:  null,
  raw_payload:    null,
  correlation_id: 'corr-1',
  created_at:     '2026-05-25T15:00:00Z',
  updated_at:     '2026-05-25T15:00:30Z',
};

function makePayload(findings: Finding[]): ReportPayload {
  // Use the real mapping to keep tests honest about the score math.
  return buildReportPayload(SCAN, findings);
}

// Count Page components in a React tree by walking children.
// @react-pdf's Page component has displayName 'Page'; ours wrap it
// via PdfPage which directly returns Page. Walk and count.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countPages(element: React.ReactElement): number {
  let count = 0;
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = node as any;
    if (el?.type) {
      const displayName =
        (typeof el.type === 'string' ? el.type : '')
        || el.type.displayName
        || el.type.name
        || '';
      if (displayName === 'Page' || displayName === 'PdfPage') count++;
    }
    const children = el?.props?.children;
    if (Array.isArray(children)) {
      for (const c of children) walk(c);
    } else if (children) {
      walk(children);
    }
  }
  walk(element);
  return count;
}

// Walk tree collecting all Text node string children. Recurses into
// function components by invoking them with their props — the
// components in ReportTemplate are pure (no hooks, no state), so
// direct invocation gives us the rendered subtree to walk further.
function collectText(element: React.ReactElement): string[] {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (node === null || node === undefined || node === false || node === true) return;
    if (typeof node === 'string') { out.push(node); return; }
    if (typeof node === 'number') { out.push(String(node)); return; }
    if (!node || typeof node !== 'object') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = node as any;

    // Custom function component → invoke and walk the result.
    if (typeof el?.type === 'function') {
      try {
        const rendered = el.type(el.props ?? {});
        walk(rendered);
      } catch {
        /* render error — skip silently, test will fail on substance */
      }
      return;
    }

    // Host element / intrinsic → walk children prop.
    const children = el?.props?.children;
    if (Array.isArray(children)) {
      for (const c of children) walk(c);
    } else if (children !== undefined) {
      walk(children);
    }
  }
  walk(element);
  return out;
}

describe('ReportTemplate — structural contract', () => {
  it('exports a function component', () => {
    expect(typeof ReportTemplate).toBe('function');
  });

  it('renders without throwing for an empty-findings scan', () => {
    const payload = makePayload([]);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    expect(tree).toBeDefined();
  });

  it('produces 2 pages when total findings ≤ topN (cover + methodology)', () => {
    // 3 findings, default topN=10 → all 3 fit on the cover; no detail page.
    const payload = makePayload([
      makeFinding({ severity: 'high'   }),
      makeFinding({ severity: 'medium' }),
      makeFinding({ severity: 'low'    }),
    ]);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    expect(countPages(tree)).toBe(2);
  });

  it('produces 3 pages when total findings > topN (cover + details + methodology)', () => {
    // 15 findings, default topN=10 → details page exists for the 5 overflow.
    const findings = Array.from({ length: 15 }, (_, i) =>
      makeFinding({ severity: 'medium', summary: `finding ${i}` })
    );
    const payload = makePayload(findings);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    expect(countPages(tree)).toBe(3);
  });

  it('renders the computed score and grade verbatim', () => {
    // Single critical finding → score 80, grade B.
    const payload = makePayload([makeFinding({ severity: 'critical' })]);
    expect(payload.report.score).toBe(80);
    expect(payload.report.grade).toBe('B');

    const tree = ReportTemplate({ payload }) as React.ReactElement;
    const text = collectText(tree).join(' ');
    expect(text).toContain('80');
    expect(text).toContain('B');
  });

  it('renders the subjectLabel when supplied', () => {
    const payload = makePayload([makeFinding({ severity: 'low' })]);
    const tree = ReportTemplate({ payload, subjectLabel: 'example.com' }) as React.ReactElement;
    const text = collectText(tree).join(' ');
    expect(text).toContain('example.com');
  });

  it('renders the detector name from the scan run', () => {
    const payload = makePayload([]);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    const text = collectText(tree).join(' ');
    expect(text).toContain('gdpr-audit');
  });

  it('renders severity-breakdown pills only for non-zero counts', () => {
    const payload = makePayload([
      makeFinding({ severity: 'high' }),
      makeFinding({ severity: 'high' }),
      makeFinding({ severity: 'low'  }),
    ]);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    const text = collectText(tree).join(' ');
    expect(text).toContain('HOCH');
    expect(text).toContain('NIEDRIG');
    expect(text).not.toContain('KRITISCH');
  });

  it('renders the "Keine Befunde" panel when zero findings', () => {
    const payload = makePayload([]);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    const text = collectText(tree).join(' ');
    expect(text).toContain('Keine Befunde');
  });

  it('includes the methodology / score-formula explanation page', () => {
    const payload = makePayload([makeFinding({ severity: 'medium' })]);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    const text = collectText(tree).join(' ');
    expect(text).toContain('Methodik');
    expect(text).toContain('Reproduzierbarkeit');
  });

  it('stamps the correlation_id on the methodology page', () => {
    const payload = makePayload([makeFinding({ severity: 'low' })]);
    const tree = ReportTemplate({ payload }) as React.ReactElement;
    const text = collectText(tree).join(' ');
    expect(text).toContain('corr-1');
  });
});
