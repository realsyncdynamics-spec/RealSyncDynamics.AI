/**
 * WP11 — Ein Kunden-Dashboard plus Router-Guards (Masterplan M2, M7, M8).
 *
 * Prüft:
 *   1. Konkurrierende Kunden-Dashboards leiten per <Navigate to="/app/dashboard" replace /> um.
 *   2. EnterpriseAiOsDashboard / MOCK_DASHBOARD_DATA sind nicht mehr am Router.
 *   3. /admin/* und interne /dashboard/* Routen hängen hinter <SuperAdminRoute>.
 *   4. SuperAdminRoute leitet Nicht-Admins auf /app/dashboard und Unangemeldete
 *      auf /welcome?next=... um; Super-Admins sehen den geschützten Inhalt.
 *   5. Compliance-Ampel im Command Center zeigt die drei echten Zähler
 *      (KI-Systeme erfasst, Klassifiziert, Nachweise vorhanden) sowie ehrliche
 *      Leer- und Fehlerzustände ohne erfundene Zahlen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const authState = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  isAuthenticated: false,
  isLoading: false,
  isSuperAdmin: false,
  profileError: null as { message: string } | null,
}));

vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
  }),
}));

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: authState.profileError ? null : { is_super_admin: authState.isSuperAdmin },
                error: authState.profileError,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unerwartete Tabelle: ${table}`);
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { SuperAdminRoute, checkSuperAdmin } from '../../src/features/admin/SuperAdminRoute';
import { ComplianceAmpel } from '../../src/features/governance/dashboard/OsControlStrip';
import { complianceAmpelFrom } from '../../src/features/governance/dashboard/osControlStripData';
import type { CockpitData } from '../../src/features/governance/cockpit/cockpitData';

const ROOT = resolve(__dirname, '../..');
const APP = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const UNIFIED_ENTRY = readFileSync(resolve(ROOT, 'src/unified-entry/index.ts'), 'utf8');

function routeLine(path: string): string {
  const line = APP.split('\n').find((text) => text.includes(`path="${path}"`));
  expect(line, `Route ${path} nicht in src/App.tsx gefunden`).toBeDefined();
  return line ?? '';
}

beforeEach(() => {
  authState.user = null;
  authState.isAuthenticated = false;
  authState.isLoading = false;
  authState.isSuperAdmin = false;
  authState.profileError = null;
});

describe('WP11 — Kunden-Dashboards leiten auf /app/dashboard um', () => {
  it.each([
    '/dashboard/enterprise-ai-os',
    '/app/mein-geschaeft',
    '/app/simple',
    '/app/intelligence',
    '/app/cockpit',
    '/app/governance',
    '/app/governance/start',
    '/dashboard',
    '/assistant',
    '/command-center',
    '/ai-command-center',
    '/app/overview',
    '/app/home',
  ])('%s leitet per <Navigate to="/app/dashboard" replace /> um', (path) => {
    expect(routeLine(path)).toContain('<Navigate to="/app/dashboard" replace />');
  });

  it('rendert EnterpriseAiOsDashboard und MOCK_DASHBOARD_DATA nicht mehr', () => {
    expect(APP).not.toContain('EnterpriseAiOsDashboard');
    expect(UNIFIED_ENTRY).not.toContain('MOCK_DASHBOARD_DATA');
  });

  it('lässt die Druckansicht /app/cockpit/brief und /app/beispiel bestehen', () => {
    expect(routeLine('/app/cockpit/brief')).toContain('CeoBriefPrintView');
    expect(routeLine('/app/beispiel')).toContain('SampleWorkspacePage');
  });
});

describe('WP11 — Router-Guards für /admin/* und interne /dashboard/* Routen', () => {
  it.each([
    '/admin',
    '/admin/analytics',
    '/admin/leads',
    '/admin/beta-feedback',
    '/admin/system',
    '/admin/social',
    '/admin/customers',
    '/admin/billing',
    '/admin/compliance',
    '/admin/onboarding',
    '/admin/rebuilds',
    '/dashboard/business',
    '/dashboard/audit',
    '/dashboard/agents',
    '/dashboard/enterprise-ai-os/discovery',
    '/business',
  ])('%s ist mit <SuperAdminRoute> geschützt', (path) => {
    expect(routeLine(path)).toContain('<SuperAdminRoute>');
  });

  it('leitet nicht angemeldete Besucher auf /welcome?next=... um', () => {
    authState.isAuthenticated = false;
    authState.user = null;

    render(
      <MemoryRouter initialEntries={['/admin/customers']}>
        <Routes>
          <Route
            path="/admin/customers"
            element={
              <SuperAdminRoute>
                <div data-testid="admin-secret">Geheimer Admin-Bereich</div>
              </SuperAdminRoute>
            }
          />
          <Route path="/welcome" element={<div data-testid="welcome-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-secret')).toBeNull();
  });

  it('leitet angemeldete Nicht-Admins auf /app/dashboard um', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-normal', email: 'user@example.com' };
    authState.isSuperAdmin = false;

    render(
      <MemoryRouter initialEntries={['/admin/system']}>
        <Routes>
          <Route
            path="/admin/system"
            element={
              <SuperAdminRoute>
                <div data-testid="admin-secret">Geheimer Admin-Bereich</div>
              </SuperAdminRoute>
            }
          />
          <Route path="/app/dashboard" element={<div data-testid="canonical-dashboard">Kunden-Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('canonical-dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-secret')).toBeNull();
  });

  it('lässt Super-Admins den geschützten Bereich rendern', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-admin', email: 'admin@example.com' };
    authState.isSuperAdmin = true;

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <SuperAdminRoute>
                <div data-testid="admin-secret">Geheimer Admin-Bereich</div>
              </SuperAdminRoute>
            }
          />
          <Route path="/app/dashboard" element={<div data-testid="canonical-dashboard">Kunden-Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-secret')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('canonical-dashboard')).toBeNull();
  });

  it('checkSuperAdmin gibt bei Datenbankfehler false zurück', async () => {
    authState.profileError = { message: 'RLS denied' };
    await expect(checkSuperAdmin('user-1')).resolves.toBe(false);
  });
});

describe('WP11 — Compliance-Ampel im Command Center', () => {
  function buildCockpit(overrides: Partial<CockpitData> = {}): CockpitData {
    return {
      partialFailures: [],
      scoreBasis: { aiSystems: 3, controlMappings: 2 },
      classifiedAiSystems: 3,
      evidenceHealth: {
        percent: 80,
        hashedCount: 5,
        totalCount: 5,
        newEvidence24h: 1,
        failedScans: 0,
        level: 'high',
        label: 'hoch',
      },
      riskIndex: {
        score: 20,
        assetCount: 3,
        highRiskAssets: 1,
        avgAssetRisk: 20,
        newRisks24h: 0,
        level: 'low',
        label: 'niedrig',
      },
      ...overrides,
    } as unknown as CockpitData;
  }

  it('zeigt drei echte Zähler und grüne Ampel, wenn alle Systeme klassifiziert und Nachweise vorhanden sind', () => {
    const model = complianceAmpelFrom(
      {
        aiSystems: { kind: 'value', value: 3 },
        tenantAgents: { kind: 'value', value: { configured: true, count: 1, declaredNone: false } },
        pendingApprovals: { kind: 'value', value: 0 },
      },
      buildCockpit(),
      false,
      null,
    );

    expect(model.status).toBe('green');
    render(
      <MemoryRouter>
        <ComplianceAmpel model={model} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('compliance-ampel')).toHaveAttribute('data-ampel-status', 'green');
    expect(screen.getByTestId('ampel-counter-captured')).toHaveTextContent('3');
    expect(screen.getByTestId('ampel-counter-captured')).toHaveTextContent('Systeme erfasst');
    expect(screen.getByTestId('ampel-counter-classified')).toHaveTextContent('3');
    expect(screen.getByTestId('ampel-counter-classified')).toHaveTextContent('klassifiziert');
    expect(screen.getByTestId('ampel-counter-evidence')).toHaveTextContent('5');
    expect(screen.getByTestId('ampel-counter-evidence')).toHaveTextContent('Nachweise vorhanden');
  });

  it('zeigt ehrlichen Empty State mit Handlungsaufruf, wenn noch keine Daten vorliegen', () => {
    const model = complianceAmpelFrom(
      {
        aiSystems: { kind: 'value', value: 0 },
        tenantAgents: { kind: 'value', value: { configured: false, count: 0, declaredNone: false } },
        pendingApprovals: { kind: 'value', value: 0 },
      },
      buildCockpit({
        scoreBasis: { aiSystems: 0, controlMappings: 0 },
        classifiedAiSystems: 0,
        evidenceHealth: {
          percent: null,
          hashedCount: 0,
          totalCount: 0,
          newEvidence24h: 0,
          failedScans: 0,
          level: 'low',
          label: 'keine',
        },
      }),
      false,
      null,
    );

    expect(model.status).toBe('empty');
    render(
      <MemoryRouter>
        <ComplianceAmpel model={model} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('compliance-ampel')).toHaveAttribute('data-ampel-status', 'empty');
    expect(screen.getByTestId('ampel-counter-captured')).toHaveTextContent('Noch kein KI-System erfasst');
    expect(screen.getByTestId('ampel-counter-classified')).toHaveTextContent('Noch kein KI-System klassifiziert');
    expect(screen.getByTestId('ampel-counter-evidence')).toHaveTextContent('Noch keine Nachweise vorhanden');
  });

  it('zeigt bei fehlender Quelle den Fehlerzustand statt einer erfundenen 0', () => {
    const model = complianceAmpelFrom(
      {
        aiSystems: { kind: 'error', message: 'RLS denied' },
        tenantAgents: { kind: 'value', value: { configured: false, count: 0, declaredNone: false } },
        pendingApprovals: { kind: 'value', value: 0 },
      },
      buildCockpit({ partialFailures: ['assets: timeout'] }),
      false,
      null,
    );

    expect(model.status).toBe('insufficient_data');
    render(
      <MemoryRouter>
        <ComplianceAmpel model={model} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('compliance-ampel')).toHaveAttribute('data-ampel-status', 'insufficient_data');
    expect(screen.getByTestId('ampel-counter-captured')).toHaveTextContent('Quelle nicht lesbar — keine Aussage möglich.');
    expect(screen.getByTestId('ampel-counter-classified')).toHaveTextContent('Quelle nicht lesbar — keine Aussage möglich.');
    expect(screen.getByTestId('ampel-counter-evidence')).toHaveTextContent('5');
  });
});
