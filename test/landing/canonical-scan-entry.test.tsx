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
 * (docs/product/canonical-funnel-decision.md), die Umstellung des
 * Landing-CTA ist in CLAUDE.md §10 freigegeben und protokolliert.
 *
 * Ohne diesen Test fiele genau das beim nächsten Refactor still um: Ein
 * CTA, der wieder auf einen zweiten Trichter zeigt, sieht im Diff harmlos
 * aus und kostet den halben Funnel.
 */

const AUDIT_PLATZHALTER = 'AUDIT-SEITE';

function landingRendern() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MainLanding />} />
        <Route path="/audit" element={<div>{AUDIT_PLATZHALTER}</div>} />
        <Route path="/scan" element={<div>ZWEITER-TRICHTER</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Kanonischer Scan-Einstieg', () => {
  it('führt das Scan-Formular der Startseite nach /audit', () => {
    landingRendern();

    const feld = screen.getAllByPlaceholderText(/domain|website|ihre-website/i)[0];
    fireEvent.change(feld, { target: { value: 'beispiel.de' } });
    fireEvent.submit(feld.closest('form') as HTMLFormElement);

    expect(screen.getByText(AUDIT_PLATZHALTER)).toBeTruthy();
  });

  it('nimmt die eingegebene Domain als Abfrageparameter mit', () => {
    // Ohne die Übergabe müsste der Besucher die Adresse ein zweites Mal
    // tippen — der Trichter bräche an seiner engsten Stelle.
    const quelle = readFileSync('src/pages/MainLanding.tsx', 'utf8');
    expect(quelle).toContain('/audit?domain=${encodeURIComponent(value)}');
  });

  it('zeigt keinen Verweis mehr auf den zurückgezogenen Trichter /scan', () => {
    // Absichtlich gegen die Quelle geprüft und nicht gegen das Rendering:
    // Der Kopfbereich der Startseite ist eine einzige lange Zeile, und ein
    // wieder eingeschleuster `to="/scan"` soll auffallen, egal ob die
    // Schaltfläche im Test sichtbar ist.
    const quelle = readFileSync('src/pages/MainLanding.tsx', 'utf8');
    expect(quelle).not.toContain('to="/scan"');
    expect(quelle).not.toContain("'/scan'");
  });

  it('hält /scan als Umleitung auf /audit, statt die Adresse fallenzulassen', () => {
    // Der öffentliche Route-Vertrag darf nicht brechen (CLAUDE.md §12):
    // Umleitungen sind erlaubt, ersatzloses Entfernen nicht. Wer den Link
    // geteilt oder gebookmarkt hat, landet weiterhin im Trichter.
    const quelle = readFileSync('src/App.tsx', 'utf8');
    expect(quelle).toMatch(/path="\/scan"\s+element=\{<Navigate to="\/audit" replace \/>\}/);
  });

  it('belegt das Audit-Formular aus ?domain= vor', () => {
    const quelle = readFileSync('src/pages/AuditLanding.tsx', 'utf8');
    expect(quelle).toContain("get('domain')");
  });
});
