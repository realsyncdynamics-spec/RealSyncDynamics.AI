import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLanding } from '../../src/pages/MainLanding';

/**
 * Sichert den **einen** kanonischen Scan-Einstieg ab.
 *
 * Europe-OS Hero: Primary CTA „Free Audit starten“ → `/audit`.
 * Domain-Capture bleibt auf der AuditLanding-Seite.
 */

const AUDIT_PLATZHALTER = 'AUDIT-SEITE';
const APP_PLATZHALTER = 'APP-DASHBOARD';

function landingRendern() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MainLanding />} />
        <Route path="/audit" element={<div>{AUDIT_PLATZHALTER}</div>} />
        <Route path="/scan" element={<div>ZWEITER-TRICHTER</div>} />
        <Route path="/app" element={<div>{APP_PLATZHALTER}</div>} />
        <Route path="/welcome" element={<div>WELCOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Kanonischer Scan-Einstieg', () => {
  it('führt Free Audit starten der Startseite nach /audit', () => {
    landingRendern();

    const cta = document.querySelector('#scan') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toBe('/audit');
    fireEvent.click(cta);
    expect(screen.getByText(AUDIT_PLATZHALTER)).toBeTruthy();
  });

  it('zeigt Live Dashboard ansehen Richtung /app (Welcome-Gate für Gäste)', () => {
    const quelle = readFileSync('src/pages/MainLanding.tsx', 'utf8');
    expect(quelle).toContain('to="/app"');
    expect(quelle).toContain('HERO_DASHBOARD_CTA_LABEL');
    expect(quelle).toContain('OsEntryLink');
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
