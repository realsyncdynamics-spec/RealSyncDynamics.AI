import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { SeverityBadge, SEVERITY_LABELS } from '../../../src/components/brand';

describe('brand SeverityBadge', () => {
  it.each([
    ['hoch', 'Hoch'],
    ['mittel', 'Mittel'],
    ['niedrig', 'Niedrig'],
  ] as const)('rendert %s mit deutschem Standard-Label', (sev, text) => {
    render(<SeverityBadge severity={sev} />);
    const el = screen.getByText(text);
    expect(el).toHaveAttribute('data-severity', sev);
    expect(el.className).toContain(`cc-severity--${sev}`);
    expect(el.className).toContain('cc-severity');
  });

  it('nutzt englische Labels mit lang="en"', () => {
    render(<SeverityBadge severity="hoch" lang="en" />);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(SEVERITY_LABELS.en).toEqual({ hoch: 'High', mittel: 'Medium', niedrig: 'Low' });
  });

  it('eigenes Label und className gewinnen', () => {
    render(<SeverityBadge severity="niedrig" label="gering" className="x-extra" />);
    const el = screen.getByText('gering');
    expect(el.className).toContain('x-extra');
  });

  it('command-center.css definiert alle Severity-Klassen auf --brand-* ohne Landing-Import', () => {
    const css = readFileSync('src/styles/command-center.css', 'utf8');
    for (const cls of ['.cc-tile', '.cc-panel', '.cc-framework-bar', '.cc-finding', '.cc-intent-chip', '.cc-severity--hoch', '.cc-severity--mittel', '.cc-severity--niedrig']) {
      expect(css).toContain(cls);
    }
    expect(css).toContain('var(--brand-');
    expect(css).not.toMatch(/@import[^;]*landing-v4/);
    expect(readFileSync('src/main.tsx', 'utf8')).toContain("import './styles/command-center.css'");
  });
});
