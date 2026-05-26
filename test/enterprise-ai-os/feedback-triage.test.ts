import { describe, it, expect } from 'vitest';
import { computeTriage } from '../../src/lib/enterprise-ai-os/feedback-triage';

describe('feedback-triage', () => {
  it('mapt severity=critical auf p0 mit Score 100', () => {
    const r = computeTriage({ type: 'bug', severity: 'critical' });
    expect(r.priority).toBe('p0');
    expect(r.triage_score).toBe(100);
  });

  it('mapt severity=low auf p3', () => {
    const r = computeTriage({ type: 'improvement', severity: 'low' });
    expect(r.priority).toBe('p3');
    expect(r.triage_score).toBe(25);
  });

  it('security_issue erhält security-Tag und +15 Score', () => {
    const r = computeTriage({ type: 'security_issue', severity: 'medium' });
    expect(r.tags).toContain('security');
    expect(r.triage_score).toBe(65);
    expect(r.priority).toBe('p1');
  });

  it('Bug mit Reproduktions-Schritten bekommt +10 und reproducible-Tag', () => {
    const r = computeTriage({
      type: 'bug',
      severity: 'medium',
      steps_to_reproduce: '1. Login\n2. Klick auf X\n3. Fehler erscheint',
      screenshot_url: 'https://example.com/shot.png',
    });
    expect(r.tags).toContain('reproducible');
    expect(r.tags).not.toContain('needs-screenshot');
    // 50 + 10 (steps) + 5 (screenshot) = 65 → p1
    expect(r.triage_score).toBe(65);
    expect(r.priority).toBe('p1');
  });

  it('Bug ohne Screenshot bekommt needs-screenshot-Tag', () => {
    const r = computeTriage({ type: 'bug', severity: 'medium' });
    expect(r.tags).toContain('needs-screenshot');
  });

  it('Compliance-Modul (ai-act/dsgvo/governance) gibt +10 und compliance-Tag', () => {
    const r = computeTriage({
      type: 'bug',
      severity: 'medium',
      module: 'AI Act Classifier',
    });
    expect(r.tags).toContain('compliance');
    expect(r.triage_score).toBe(60);
  });

  it('Compliance erkennt page_url-Treffer (Governance)', () => {
    const r = computeTriage({
      type: 'ux_feedback',
      severity: 'low',
      page_url: 'https://realsyncdynamics.ai/governance/runtime',
    });
    expect(r.tags).toContain('compliance');
    expect(r.tags).toContain('ux');
  });

  it('Score wird bei 100 geklemmt', () => {
    const r = computeTriage({
      type: 'security_issue',
      severity: 'critical',
      steps_to_reproduce: 'Trivial reproduzierbar',
      screenshot_url: 'https://example.com/poc.png',
      module: 'dsgvo',
    });
    expect(r.triage_score).toBe(100);
    expect(r.priority).toBe('p0');
  });

  it('feature_request bekommt product-input-Tag', () => {
    const r = computeTriage({ type: 'feature_request', severity: 'low' });
    expect(r.tags).toContain('product-input');
  });
});
