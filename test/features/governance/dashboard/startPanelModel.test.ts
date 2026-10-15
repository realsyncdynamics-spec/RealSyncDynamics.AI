import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  computeAccountNotice,
  computeStartPanel,
} from '../../../../src/features/governance/dashboard/startPanelModel';

const APP = readFileSync('src/App.tsx', 'utf8');
const COMMAND = readFileSync('src/features/governance/dashboard/CommandCenterDashboard.tsx', 'utf8');
const PANEL = readFileSync('src/features/governance/dashboard/CustomerStartPanel.tsx', 'utf8');

const EMPTY = { websiteCount: 0, scanCount: 0, aiSystemCount: 0, activationStatus: 'none' as const };

describe('Kunden-Startansicht — genau ein nächster Schritt', () => {
  it('neuer Kunde: Website-Scan zuerst, KI-System als Zweitaktion', () => {
    const m = computeStartPanel(EMPTY);
    expect(m.primary?.stepId).toBe('website');
    expect(m.primary?.href).toBe('/app/websites');
    expect(m.secondary).toEqual({ label: 'KI-System erfassen', href: '/app/onboarding' });
    expect(m.maturity).toBe('Einrichtung läuft');
    expect(m.doneCount).toBe(1); // nur „Konto eingerichtet“
    expect(m.complete).toBe(false);
  });

  it('Domain hinterlegt, kein Scan: „Scan jetzt starten“', () => {
    const m = computeStartPanel({ ...EMPTY, websiteCount: 1 });
    expect(m.primary?.stepId).toBe('scan');
    expect(m.primary?.cta).toBe('Scan jetzt starten');
  });

  it('nach dem Scan: KI-System erfassen, ohne doppelte Zweitaktion', () => {
    const m = computeStartPanel({ ...EMPTY, websiteCount: 1, scanCount: 2 });
    expect(m.primary?.stepId).toBe('ai-system');
    expect(m.secondary).toBeNull();
  });

  it('alles erledigt: eingerichtet, Hauptaktion = Risiken prüfen', () => {
    const m = computeStartPanel({ websiteCount: 1, scanCount: 1, aiSystemCount: 3, activationStatus: 'activated' });
    expect(m.complete).toBe(true);
    expect(m.maturity).toBe('Eingerichtet');
    expect(m.primary?.stepId).toBe('review');
    expect(m.primary?.href).toBe('/app/risks');
  });

  it('erfindet keine Empfehlung, solange Vorgänger unbekannt sind', () => {
    const m = computeStartPanel({ websiteCount: null, scanCount: null, aiSystemCount: null, activationStatus: null });
    expect(m.primary).toBeNull();
    expect(m.pending).toBe(true);
    expect(m.steps.filter((s) => s.state === 'unknown').map((s) => s.id)).toEqual([
      'website',
      'scan',
      'ai-system',
      'activation',
    ]);
    // Website bekannt-leer reicht für eine ehrliche Empfehlung.
    expect(computeStartPanel({ ...EMPTY, scanCount: null, aiSystemCount: null }).primary?.stepId).toBe('website');
  });

  it('alle Ziele sind registrierte Routen', () => {
    const m = computeStartPanel(EMPTY);
    const paths = new Set([
      ...m.steps.map((s) => s.href),
      '/app/scans',
      '/app/ai-systems',
      '/app/risks',
      '/app/evidence',
      '/app/policy-packs',
      '/app/reports',
      '/app/voice',
      '/app/billing',
      '/app/modules',
    ]);
    for (const p of paths) expect(APP, p).toContain(`path="${p}"`);
  });
});

describe('Testphase und Zahlung — eine Zeile statt zwei Banner', () => {
  const beta = { active: true, endsLabel: '31. Januar 2027' };

  it('Beta: keine Zahlungsaufforderung', () => {
    const n = computeAccountNotice({ daysRemaining: 109, endingSoon: false }, beta);
    expect(n?.text).toContain('noch 109 Tage');
    expect(n?.text).toContain('keine Zahlungsdaten nötig');
    expect(n?.link).toBeNull();
    expect(n?.tone).toBe('neutral');
  });

  it('ohne Beta: Zahlungsdaten-Link, Hervorhebung erst kurz vor Ende', () => {
    const off = { active: false, endsLabel: '' };
    expect(computeAccountNotice({ daysRemaining: 20, endingSoon: false }, off)?.tone).toBe('neutral');
    const soon = computeAccountNotice({ daysRemaining: 2, endingSoon: true }, off);
    expect(soon?.tone).toBe('attention');
    expect(soon?.link?.href).toBe('/billing/usage');
    expect(computeAccountNotice(null, off)).toBeNull();
  });

  it('abgelaufen: kostenloser Zugang + Pakete', () => {
    const n = computeAccountNotice({ daysRemaining: 0, endingSoon: true }, beta);
    expect(n?.link?.href).toBe('/pricing?source=trial-expired');
  });
});

describe('Dashboard-Verdrahtung', () => {
  it('Startansicht oben, bestehendes Cockpit in der Detailansicht', () => {
    expect(COMMAND).toContain('<CustomerStartPanel');
    expect(COMMAND).not.toContain('<TrialBanner');
    expect(COMMAND.indexOf('<CustomerStartPanel')).toBeLessThan(COMMAND.indexOf('<HandoffOverview'));
    expect(COMMAND).toContain('dashboard-details');
    expect(COMMAND).toContain('open={!activeTenantId || startModel.complete}');
  });

  it('Startansicht hat genau eine Hauptaktion', () => {
    expect(PANEL.match(/data-testid="start-primary-cta"/g)).toHaveLength(1);
  });
});
