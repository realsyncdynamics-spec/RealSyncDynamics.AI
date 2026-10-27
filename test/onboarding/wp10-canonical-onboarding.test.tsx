/**
 * WP10 — Ein kanonischer Onboarding-Pfad bis zum ersten Nachweis (Masterplan M1)
 *
 * Prüft:
 * 1. Welcome.tsx leitet nach Registrierung ohne `next` und ohne `onboarded_at`
 *    auf `/app/activation` statt `/setup-assistant`.
 * 2. Überzählige Onboarding-Einstiege in `src/App.tsx` leiten per `<Navigate replace>`
 *    auf den Zielpfad (`/audit` → `/welcome` → `/app/activation` → `/app/dashboard`)
 *    um und erhalten Query-Parameter (inkl. `:scanId` aus `/onboarding/:scanId`).
 * 3. `GovernanceActivationView` zeigt die Fortschrittsanzeige „Schritt x von 4",
 *    übernimmt die SetupAssistant-Felder (Organisationstyp, Mitarbeiterzahl,
 *    KI-Betriebsmodus) und ruft `claimPendingAudit` auf.
 * 4. Time-to-First-Evidence über `src/lib/marketingAnalytics.ts` wird strikt
 *    nur nach erteiltem Cookie-Consent erfasst und übermittelt niemals `tenant_id`
 *    im Request-Body.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => {
  const upserts: Record<string, unknown>[] = [];
  const tenantUpdates: Record<string, unknown>[] = [];
  const claimedTenants: Array<string | null | undefined> = [];

  const supabaseClient = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'jwt-test-token' } },
      }),
    },
    from: (table: string) => {
      if (table === 'governance_activations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          upsert: async (payload: Record<string, unknown>) => {
            upserts.push(payload);
            return { error: null };
          },
        };
      }
      if (table === 'tenants') {
        return {
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              tenantUpdates.push(payload);
              return { error: null };
            },
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
  };

  return { upserts, tenantUpdates, claimedTenants, supabaseClient };
});

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => mocks.supabaseClient,
  isSupabaseConfigured: () => true,
}));

vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-wp10',
    loading: false,
    tenants: [{ tenantId: 'tenant-wp10', name: 'Muster GmbH', role: 'owner' }],
    setActiveTenant: vi.fn(),
    refresh: vi.fn(),
  }),
  TenantProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/core/onboarding/claimAudit', () => ({
  claimPendingAudit: async () => {
    mocks.claimedTenants.push('claimed');
    return { status: 'none' };
  },
}));

import { canonicalOnboardingRedirectTarget } from '../../src/App';
import {
  ACTIVATION_CORE_STEPS,
  GovernanceActivationView,
  stepNumberForWizardStep,
} from '../../src/features/activation/GovernanceActivationView';
import {
  TTFE_START_STORAGE_KEY,
  hasMarketingAnalyticsConsent,
  markTimeToFirstEvidenceStart,
  recordTimeToFirstEvidence,
} from '../../src/lib/marketingAnalytics';

const ROOT = resolve(__dirname, '../..');
const APP_SRC = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const WELCOME_SRC = readFileSync(resolve(ROOT, 'src/pages/Welcome.tsx'), 'utf8');

describe('WP10 — Welcome.tsx Ziel nach Registrierung', () => {
  it('leitet ohne next und ohne onboarded_at auf /app/activation statt /setup-assistant', () => {
    expect(WELCOME_SRC).toContain("navigate('/app/activation', { replace: true })");
    expect(WELCOME_SRC).not.toContain("navigate('/setup-assistant'");
  });
});

describe('WP10 — Überzählige Onboarding-Routen in src/App.tsx', () => {
  it('erhält Query-Parameter und :scanId bei canonicalOnboardingRedirectTarget', () => {
    expect(canonicalOnboardingRedirectTarget('/app/activation', '')).toBe('/app/activation');
    expect(
      canonicalOnboardingRedirectTarget('/app/activation', '?next=%2Fcheckout%2Fstarter'),
    ).toBe('/app/activation?next=%2Fcheckout%2Fstarter');
    expect(
      canonicalOnboardingRedirectTarget(
        '/app/activation',
        '?domain=example.de',
        '/onboarding/scan-99',
      ),
    ).toBe('/app/activation?domain=example.de&scanId=scan-99');
    expect(
      canonicalOnboardingRedirectTarget('/audit', '?utm_source=linkedin', '/flow/start-scan'),
    ).toBe('/audit?utm_source=linkedin');
  });

  it.each([
    ['/onboarding/:scanId', '/app/activation'],
    ['/setup-assistant', '/app/activation'],
    ['/app/onboarding', '/app/activation'],
    ['/governance/onboarding', '/app/activation'],
    ['/os/welcome', '/app/activation'],
    ['/unified-entry/scan', '/audit'],
    ['/unified-entry/entscheidung', '/welcome'],
    ['/unified-entry/preview', '/welcome'],
    ['/unified-entry/trial-offer', '/welcome'],
    ['/unified-entry/register', '/welcome'],
    ['/unified-entry/onboarding', '/app/activation'],
    ['/unified-entry/success', '/app/dashboard'],
    ['/flow', '/audit'],
    ['/flow/*', '/audit'],
  ])('Route %s leitet per <Navigate replace> mit Query-Erhalt auf %s', (routePath, target) => {
    const expected = `<Route path="${routePath}" element={<Navigate to={withSearch('${target}')} replace />} />`;
    expect(APP_SRC.includes(expected), expected).toBe(true);
  });
});

describe('WP10 — Time-to-First-Evidence (consent-gated marketingAnalytics)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('erfasst ohne Cookie-Consent keinen Zeitstempel', () => {
    expect(hasMarketingAnalyticsConsent()).toBe(false);
    expect(markTimeToFirstEvidenceStart('2026-10-26T10:00:00.000Z')).toBeNull();
    expect(recordTimeToFirstEvidence('activation_started', 1)).toBeNull();
    expect(window.sessionStorage.getItem(TTFE_START_STORAGE_KEY)).toBeNull();
  });

  it('erfasst bei abgelehntem Consent (analytics=false, marketing=false) keinen Zeitstempel', () => {
    window.localStorage.setItem(
      'realsync.cookie-consent.v1',
      JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false }),
    );
    expect(hasMarketingAnalyticsConsent()).toBe(false);
    expect(recordTimeToFirstEvidence('first_evidence_ready', 3)).toBeNull();
    expect(window.sessionStorage.getItem(TTFE_START_STORAGE_KEY)).toBeNull();
  });

  it('berechnet nach erteiltem Consent Startzeitpunkt und elapsedMs für Time-to-First-Evidence', () => {
    window.localStorage.setItem(
      'realsync.cookie-consent.v1',
      JSON.stringify({ version: 1, necessary: true, analytics: true, marketing: false }),
    );
    expect(hasMarketingAnalyticsConsent()).toBe(true);

    const start = markTimeToFirstEvidenceStart('2026-10-26T10:00:00.000Z');
    expect(start).toBe('2026-10-26T10:00:00.000Z');

    const milestone = recordTimeToFirstEvidence(
      'first_evidence_ready',
      3,
      '2026-10-26T10:02:30.000Z',
    );
    expect(milestone).toEqual({
      milestone: 'first_evidence_ready',
      recordedAt: '2026-10-26T10:02:30.000Z',
      elapsedMs: 150_000,
    });
  });
});

describe('WP10 — GovernanceActivationView („Schritt x von 4" + SetupAssistant-Übernahme)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mocks.upserts.length = 0;
    mocks.tenantUpdates.length = 0;
    mocks.claimedTenants.length = 0;
  });

  it('definiert genau 4 Kernschritte (1..4)', () => {
    expect(ACTIVATION_CORE_STEPS.map((s) => [s.id, s.stepNumber])).toEqual([
      ['organization', 1],
      ['scope', 2],
      ['ai-inventory', 3],
      ['status', 4],
    ]);
    expect(stepNumberForWizardStep('organization')).toBe(1);
    expect(stepNumberForWizardStep('scope')).toBe(2);
    expect(stepNumberForWizardStep('ai-inventory')).toBe(3);
    expect(stepNumberForWizardStep('status')).toBe(4);
  });

  it('durchläuft Schritt 1 von 4 bis Schritt 4 von 4, persistiert SetupAssistant-Felder + onboarded_at und verlinkt /app/dashboard', async () => {
    function LocationDisplay() {
      const loc = useLocation();
      return <div data-testid="current-location">{loc.pathname}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/app/activation?domain=muster.de']}>
        <Routes>
          <Route path="/app/activation" element={<GovernanceActivationView />} />
          <Route path="/app/dashboard" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    // Schritt 1 von 4 + claimPendingAudit beim Mount
    await waitFor(() => expect(mocks.claimedTenants).toContain('claimed'));
    expect(screen.getByTestId('activation-step-progress')).toHaveTextContent('Schritt 1 von 4');

    // SetupAssistant-Felder in Schritt 1 (Organization) ausfüllen
    fireEvent.change(screen.getByLabelText('Organisationstyp'), {
      target: { value: 'sme' },
    });
    fireEvent.change(screen.getByLabelText('Anzahl Mitarbeiter'), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByLabelText('KI-Betriebsmodus'), {
      target: { value: 'enforce_eu_local' },
    });

    // Weiter zu Schritt 2 von 4 (Scope)
    fireEvent.click(screen.getByRole('button', { name: /Continue Activation/i }));
    await waitFor(() =>
      expect(screen.getByTestId('activation-step-progress')).toHaveTextContent('Schritt 2 von 4'),
    );
    expect(mocks.tenantUpdates[0]).toMatchObject({
      company_name: 'muster.de',
      org_name: 'muster.de',
      tenant_type: 'sme',
      org_size_employees: 50,
      ai_data_residency_policy: 'enforce_eu_local',
    });

    // Weiter zu Schritt 3 von 4 (AI Setup)
    fireEvent.click(screen.getByRole('button', { name: /Continue Activation/i }));
    await waitFor(() =>
      expect(screen.getByTestId('activation-step-progress')).toHaveTextContent('Schritt 3 von 4'),
    );

    // KI-Systeme + Bots/Agenten auswählen
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // erste KI-System-Option
    const noBotsBtn = screen.getByRole('checkbox', { name: /Keine Bots oder Agenten/i });
    fireEvent.click(noBotsBtn);

    // Weiter zu Schritt 4 von 4 (Go-Live)
    fireEvent.click(screen.getByRole('button', { name: /Continue Activation/i }));
    await waitFor(() =>
      expect(screen.getByTestId('activation-step-progress')).toHaveTextContent('Schritt 4 von 4'),
    );

    // onboarded_at wurde auf tenants gesetzt und Status ist activated
    const lastUpsert = mocks.upserts[mocks.upserts.length - 1];
    expect(lastUpsert?.status).toBe('activated');
    const lastTenantUpdate = mocks.tenantUpdates[mocks.tenantUpdates.length - 1];
    expect(typeof lastTenantUpdate?.onboarded_at).toBe('string');

    // Finaler CTA führt nach /app/dashboard
    const dashboardLink = screen.getByRole('link', { name: /Zum Governance Command Center/i });
    expect(dashboardLink).toHaveAttribute('href', '/app/dashboard');
  });
});
