import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLanding } from '../../src/pages/MainLanding';

/**
 * Sichert den **einen** kanonischen Scan-Einstieg ab.
 *
 * Dominik Dark/Gold Hero: Domain-Form → `/audit` (optional `?domain=`).
 */

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
  it('führt Free Audit der Startseite nach /audit', () => {
    landingRendern();

    const form = document.querySelector('#scan') as HTMLFormElement;
    expect(form).toBeTruthy();
    fireEvent.submit(form);
    expect(screen.getByText(AUDIT_PLATZHALTER)).toBeTruthy();
  });

  it('trägt Domain-Query an /audit weiter', () => {
    landingRendern();

    const input = screen.getByLabelText('Ihre Website') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://example.com' } });
    fireEvent.submit(document.querySelector('#scan') as HTMLFormElement);
    expect(screen.getByText(AUDIT_PLATZHALTER)).toBeTruthy();
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
