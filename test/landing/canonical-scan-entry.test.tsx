/**
 * Kanonischer Scan-Einstieg — Replit Free Audit → /audit.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLanding } from '../../src/pages/MainLanding';
import { HERO_DASHBOARD_CTA_LABEL, HERO_SCAN_CTA_LONG } from '../../src/components/governance-frontend/hero-content';

const AUDIT_PLATZHALTER = 'AUDIT-SEITE';

function landingRendern() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MainLanding />} />
        <Route path="/audit" element={<div>{AUDIT_PLATZHALTER}</div>} />
        <Route path="/scan" element={<div>ZWEITER-TRICHTER</div>} />
        <Route path="/evidence" element={<div>EVIDENCE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Kanonischer Scan-Einstieg', () => {
  it('führt den Free-Audit-CTA der Startseite nach /audit', () => {
    landingRendern();

    const cta = document.querySelector('#audit-cta') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.tagName).toBe('A');
    fireEvent.click(cta);
    expect(screen.getByText(AUDIT_PLATZHALTER)).toBeTruthy();
  });

  it('zeigt Replit Hero-CTAs', () => {
    landingRendern();
    expect(screen.getAllByText(HERO_SCAN_CTA_LONG).length).toBeGreaterThan(0);
    expect(screen.getAllByText(HERO_DASHBOARD_CTA_LABEL).length).toBeGreaterThan(0);
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
    expect(quelle).toContain("get('domain')");
  });
});
