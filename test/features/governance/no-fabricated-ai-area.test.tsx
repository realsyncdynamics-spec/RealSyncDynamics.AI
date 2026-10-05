/**
 * KI-Bereich ohne erfundene Werte (Auftrag §3: keine UI zeigt „0“, „100 %“,
 * „grün“, „active“ …, wenn die Datenbasis das nicht belegt).
 *
 * - Rahmenwerk-Auswahl: keine fest eingetragenen Erfüllungsgrade (45 %, 28 % …)
 *   und kein statisches „Active“; der Status kommt aus dem Plan.
 * - ISO-42001-Hub: keine Platzhalter-Kontrollpunkte, kein „Konform“, keine
 *   „Gesamtkonformität“, kein „Vor 2 Stunden“ — unzureichende Daten.
 * - Enterprise-AI-OS-Übersicht: als Beispieldaten ausgewiesen.
 * - Die kaputten Ansichten /app/governance/ai-register und …/ai-act-assessment
 *   leiten ins KI-Inventar.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/src/core/billing/useEntitlements', () => ({
  useEntitlements: () => ({
    tier: 'free',
    hasFeature: (key: string) => key === 'governance.dsgvo' || key === 'ai_classification.limited',
    canAccess: () => ({ allowed: false, upgradeUrl: null }),
  }),
}));
vi.mock('@/src/core/billing/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { ComplianceFrameworkSelector } from '@/src/features/governance/dashboard/ComplianceFrameworkSelector';
import { Iso42001ComplianceHub } from '@/src/features/governance/dashboard/Iso42001ComplianceHub';

describe('Rahmenwerk-Auswahl', () => {
  it('zeigt keine Erfüllungsgrade und keinen statischen Status', () => {
    const { container } = render(<MemoryRouter><ComplianceFrameworkSelector /></MemoryRouter>);
    expect(container.textContent).not.toMatch(/\d+\s*%/);
    expect(screen.queryByText(/COMPLETION/i)).toBeNull();
    expect(screen.queryByText(/^Active$/)).toBeNull();
    expect(screen.queryByText(/^In Progress$/)).toBeNull();
  });

  it('Status aus dem Plan: enthalten, nicht enthalten, in Vorbereitung', () => {
    render(<MemoryRouter><ComplianceFrameworkSelector /></MemoryRouter>);
    expect(screen.getAllByText('Im Plan enthalten')).toHaveLength(1); // nur DSGVO im Mock-Plan
    expect(screen.getAllByText('Nicht im Plan').length).toBeGreaterThan(0);
    expect(screen.getByText('In Vorbereitung')).toBeInTheDocument();
  });
});

describe('ISO-42001-Hub', () => {
  it('unzureichende Daten statt Platzhalter-Kennzahlen', () => {
    const { container } = render(<MemoryRouter><Iso42001ComplianceHub /></MemoryRouter>);
    expect(screen.getByTestId('iso42001-insufficient-data')).toHaveTextContent('Unzureichende Daten');
    expect(container.textContent).not.toMatch(/GESAMTKONFORMITÄT|Vor 2 Stunden|Fällig:/i);
    // Kein Upgrade-Versprechen: ISO 42001 hat in keinem Plan Kontrollpunkte.
    expect(container.textContent).not.toMatch(/Verfügbar ab|upgraden/i);
    expect(screen.queryByText(/^Konform$/)).toBeNull();
    expect(container.textContent).not.toMatch(/\d+\s*%/);
  });

  it('Quelltext kennt keine Platzhalter-Kontrollpunkte mehr', () => {
    const src = readFileSync('src/features/governance/dashboard/Iso42001ComplianceHub.tsx', 'utf8');
    expect(src).not.toContain('PLACEHOLDER_CONTROLS');
    expect(src).not.toContain("status: 'compliant'");
  });
});

describe('Enterprise-AI-OS-Übersicht und Weiterleitungen (Quelltext)', () => {
  it('weist die Übersicht als Beispieldaten aus, ohne „Live“-Hinweis', () => {
    const src = readFileSync('src/pages/EnterpriseAiOsDashboard.tsx', 'utf8');
    expect(src).toContain('data-testid="enterprise-demo-notice"');
    expect(src).not.toContain('Live Connector Status');
    // Abgerufene Agentenläufe sind ausdrücklich keine Beispieldaten.
    expect(src).toContain('data-testid="enterprise-runs-fetched"');
  });

  it('leitet die entfernten KI-Ansichten ins KI-Inventar', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('<Route path="/app/governance/ai-register" element={<Navigate to="/app/ai-systems" replace />} />');
    expect(app).toContain('<Route path="/app/governance/ai-act-assessment" element={<Navigate to="/app/ai-systems" replace />} />');
    expect(app).not.toMatch(/AiRegisterView|AiActRiskAssessmentView/);
  });

  it('die Kachel im Intelligence-Dashboard verspricht keinen „AI Act Check“ mehr, sondern führt ins Inventar', () => {
    const view = readFileSync('src/features/dashboard/DashboardView.tsx', 'utf8');
    expect(view).not.toContain("'AI Act Check'");
    expect(view).toContain("{ label: 'KI-Systeme', hint: 'Inventar und Klassifizierung', icon: ShieldCheck, path: '/app/ai-systems' }");
  });
});
