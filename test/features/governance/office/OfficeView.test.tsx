/**
 * Smoke-/Kontrakt-Tests für OfficeView — das Governance-OS Office-Modul.
 * Stellt sicher, dass alle sechs Office-Bereiche gerendert werden und die
 * Plattform-Garantie (versioniert · auditiert · evidence-fähig) sichtbar ist.
 *
 * Strukturell (kein JSDOM-Event-Simulieren) — wir rendern den React-Baum
 * und prüfen den Textinhalt.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { OfficeView } from '../../../../src/features/governance/office/OfficeView';

function renderedText(): string {
  const result = render(<OfficeView />);
  return result.container.textContent ?? '';
}

describe('OfficeView', () => {
  it('rendert alle sechs Office-Bereiche', () => {
    const text = renderedText();
    for (const bereich of [
      'Dokumente',
      'Tabellen',
      'Präsentationen',
      'Meetings',
      'Verträge',
      'Policies',
    ]) {
      expect(text).toContain(bereich);
    }
  });

  it('kommuniziert die Plattform-Garantie', () => {
    const text = renderedText();
    expect(text).toContain('versioniert');
    expect(text).toContain('auditiert');
    expect(text).toContain('evidence-fähig');
  });

  it('zeigt mindestens ein Office-Objekt mit Versionsangabe', () => {
    const text = renderedText();
    expect(text).toMatch(/v\d+\.\d+/);
  });
});
