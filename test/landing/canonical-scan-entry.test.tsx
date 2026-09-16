/**
 * Sichert den **einen** kanonischen Scan-Einstieg ab.
 *
 * Governance-OS Preview-Hero: CTA `#audit-cta` → `/audit`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLanding } from '../../src/pages/MainLanding';

const AUDIT_PLATZHALTER = 'AUDIT-SEITE';

function landingRendern() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MainLanding />} />
        <Route path="/audit" element={<div>{AUDIT_PLATZHALTER}</div>} />
        <Route path="/scan" element={<div>ZWEITER-TRICHTER</div>} />
        <Route path="/app" element={<div>APP-DASHBOARD</div>} />
        <Route path="/welcome" element={<div>WELCOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Kanonischer Scan-Einstieg', () => {
  it('führt den Governance-Scan der Startseite nach /audit', () => {
    landingRendern();

    const cta = document.querySelector('#audit-cta') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.tagName).toBe('A');
    fireEvent.click(cta);
    expect(screen.getByText(AUDIT_PLATZHALTER)).toBeTruthy();
  });

  it('nutzt auf der Startseite keinen zweiten Formular-Trichter mehr', () => {
    landingRendern();

    expect(screen.queryByLabelText(/Ihre Website/i)).toBeNull();
    expect(document.querySelector('#audit-cta')?.tagName).toBe('A');
  });

  it('zeigt den Governance-OS-CTA auf der Startseite', () => {
    landingRendern();
    expect(screen.getAllByText(/Explore the Governance OS/i).length).toBeGreaterThan(0);
  });

  it('zeigt keinen Verweis mehr auf den zurückgezogenen Trichter /scan', () => {
    const quelle = readFileSync('src/pages/MainLanding.tsx', 'utf8');
    expect(quelle).not.toContain('to="/scan"');
    expect(quelle).not.toContain("'/scan'");
  });

  it('hält /scan als Umleitung auf /audit, statt die Adresse fallenzulassen', () => {
    const quelle = readFileSync('src/App.tsx', 'utf8');
    expect(quelle).toMatch(/path="\/scan"\s+element=\{<Navigate to="\/audit" replace \/>\}/);
  });

  it('belegt das Audit-Formular aus ?domain= vor', () => {
    const quelle = readFileSync('src/pages/AuditLanding.tsx', 'utf8');
    expect(quelle).toMatch(/domain/);
  });
});
