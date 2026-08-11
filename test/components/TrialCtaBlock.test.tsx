/**
 * Vertragstest für den Conversion-Punkt auf dem Audit-Report.
 *
 * Drei Dinge sind hier vertragsrelevant und dürfen nicht unbemerkt driften:
 *   1) Der Primär-CTA-Text — er ist die Zusage an den Nutzer.
 *   2) Das Ziel `/login?intent=pilot&audit_id=…&domain=…` — ohne diese
 *      Parameter löst `Welcome.tsx` die Pilot-Aktivierung nie aus.
 *   3) Der sessionStorage-Eintrag `rsd_pending_audit` — Rückfallweg, falls ein
 *      OAuth-Provider die Query verkürzt.
 *
 * Früher zeigte der CTA nach `/pricing?plan=starter&audit_id=…`, wo `audit_id`
 * von keiner einzigen Datei ausgelesen wurde — der Audit-Kontext ging verloren.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { TrialCtaBlock } from '../../src/pages/AuditLanding';

const REPORT = {
  audit_id: '11111111-2222-4333-8444-555555555555',
  domain: 'www.example.com',
  score: 62,
  severity: 'high' as const,
  issues: [
    { id: 'i1', severity: 'critical' as const, title: 'Tracking ohne Consent', detail: '…' },
    { id: 'i2', severity: 'high' as const, title: 'Kein Impressum', detail: '…' },
  ],
  fetched: true,
  fetched_status: 200,
  fetch_error: null,
};

/** Zeigt die aktuelle Route, damit die Navigation prüfbar wird. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderCta() {
  return render(
    <MemoryRouter initialEntries={['/audit']}>
      <Routes>
        <Route path="/audit" element={<TrialCtaBlock report={REPORT} />} />
        <Route path="/login" element={<LocationProbe />} />
        <Route path="/pricing" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('TrialCtaBlock', () => {
  it('trägt exakt die zugesagte CTA-Beschriftung', () => {
    renderCta();
    expect(
      screen.getByRole('button', { name: /^Governance-Runtime 14 Tage kostenlos aktivieren$/ }),
    ).toBeInTheDocument();
    // Die alte, planbezogene Beschriftung darf nicht zurückkehren.
    expect(screen.queryByText(/Starter 14 Tage kostenlos aktivieren/)).toBeNull();
  });

  it('kennzeichnet den Pilot, nicht einen Starter-Trial', () => {
    renderCta();
    expect(screen.getByText('14 Tage kostenlos · Governance-Runtime-Pilot')).toBeInTheDocument();
  });

  it('navigiert nach /login mit vollständigem Pilot-Kontext', async () => {
    renderCta();

    fireEvent.click(screen.getByRole('button', { name: /Governance-Runtime 14 Tage kostenlos aktivieren/ }),
    );

    const target = screen.getByTestId('location').textContent ?? '';
    expect(target.startsWith('/login')).toBe(true);

    const params = new URLSearchParams(target.split('?')[1]);
    expect(params.get('intent')).toBe('pilot');
    expect(params.get('audit_id')).toBe(REPORT.audit_id);
    expect(params.get('domain')).toBe(REPORT.domain);
    expect(params.get('source')).toBe('audit_cta');
  });

  it('führt nicht mehr nach /pricing', async () => {
    renderCta();
    fireEvent.click(screen.getByRole('button', { name: /Governance-Runtime 14 Tage kostenlos aktivieren/ }),
    );
    expect(screen.getByTestId('location').textContent).not.toContain('/pricing');
  });

  it('legt den Rückfall-Eintrag in sessionStorage ab', async () => {
    renderCta();

    fireEvent.click(screen.getByRole('button', { name: /Governance-Runtime 14 Tage kostenlos aktivieren/ }),
    );

    const raw = sessionStorage.getItem('rsd_pending_audit');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string);
    expect(stored.audit_id).toBe(REPORT.audit_id);
    expect(stored.domain).toBe(REPORT.domain);
    // Ohne angehakte Checkbox darf keine Einwilligung protokolliert werden.
    expect(stored.analytics_consent).toBe(false);
  });

  it('übernimmt die Analyse-Einwilligung nur, wenn sie gesetzt wurde', async () => {
    renderCta();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Governance-Runtime 14 Tage kostenlos aktivieren/ }),
    );

    const stored = JSON.parse(sessionStorage.getItem('rsd_pending_audit') as string);
    expect(stored.analytics_consent).toBe(true);
  });

  it('führt auch den sekundären CTA in den Pilot-Pfad', async () => {
    renderCta();

    fireEvent.click(screen.getByRole('button', { name: /Monitoring für diese Domain starten/ }),
    );

    expect(screen.getByTestId('location').textContent).toContain('intent=pilot');
  });
});
