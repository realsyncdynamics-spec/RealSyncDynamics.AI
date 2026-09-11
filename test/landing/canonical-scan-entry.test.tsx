import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLanding } from '../../src/pages/MainLanding';

/**
 * Sichert den **einen** kanonischen Scan-Einstieg ab.
 *
 * Vorgeschichte: Es gab drei Wege in dieselbe Prüfung — `/audit`,
 * `/unified-entry/scan` und kurzzeitig `/scan` mit eigenem Datensatz. Der
 * Entscheid vom 2026-08-23 hat `/audit` zum kanonischen Einstieg erklärt
 * (docs/product/canonical-funnel-decision.md).
 *
 * Hero-Primary CTA: „Free Audit starten“ → `/audit`.
 */

const AUDIT_PLATZHALTER = 'AUDIT-SEITE';

function landingRendern() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MainLanding />} />
        <Route path="/audit" element={<div>{AUDIT_PLATZHALTER}</div>} />
        <Route path="/scan" element={<div>ZWEITER-TRICHTER</div>} />
        <Route path="/welcome" element={<div>WELCOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Kanonischer Scan-Einstieg', () => {
  it('führt den Hero-Primary-CTA der Startseite nach /audit', () => {
    landingRendern();

    fireEvent.click(screen.getByRole('link', { name: /free audit starten/i }));

    expect(screen.getByText(AUDIT_PLATZHALTER)).toBeTruthy();
  });

  it('bindet den Primary-CTA hart an /audit', () => {
    const quelle = readFileSync('src/pages/MainLanding.tsx', 'utf8');
    expect(quelle).toContain('to="/audit"');
    expect(quelle).toContain('Free Audit starten');
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
