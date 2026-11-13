/**
 * Governance-Arbeitsbereich im Command Center (/app/dashboard).
 *
 * Die Arbeitslisten des früheren GovernanceDashboardView (Assets, Policies,
 * Ereignisse) leben jetzt im einen Kunden-Dashboard (WP11). Geprüft wird:
 *   1. das Command Center mountet den Arbeitsbereich in der Detailansicht;
 *   2. keine Demo-Daten, keine Upgrade-Kacheln im Live-Dashboard;
 *   3. Mutationsfehler ({ ok: false }) werden sichtbar statt verschluckt;
 *   4. die alte, an keiner Route hängende Ansicht ist entfernt.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mutationError } from '../../../../src/features/governance/dashboard/governanceWorkbenchModel';

const COMMAND = readFileSync('src/features/governance/dashboard/CommandCenterDashboard.tsx', 'utf8');
const WORKBENCH = readFileSync('src/features/governance/dashboard/GovernanceWorkbench.tsx', 'utf8');
const APP = readFileSync('src/App.tsx', 'utf8');

describe('Command Center: Governance-Arbeitsbereich', () => {
  it('mountet GovernanceWorkbench in der Detailansicht vor dem Ausführen-Streifen', () => {
    expect(COMMAND).toMatch(/import \{ GovernanceWorkbench \} from '\.\/GovernanceWorkbench'/);
    const details = COMMAND.slice(COMMAND.indexOf('<details'), COMMAND.indexOf('</details>'));
    expect(details).toContain('<GovernanceWorkbench />');
    expect(details.indexOf('<GovernanceWorkbench />')).toBeLessThan(details.indexOf('<DashboardExecuteStrip />'));
  });

  it('übernimmt Listen, Inspector und Anlegen aus dem früheren Dashboard', () => {
    for (const piece of [
      'fetchTenantEvents', 'fetchTenantAssets', 'fetchTenantPolicies', 'fetchFrameworkControls',
      '<GovernanceInspectorPanel', '<CreateAssetModal', '<CreatePolicyModal', '<GovernanceTrendsPanel',
      'archiveAsset(', 'togglePolicy(',
    ]) {
      expect(WORKBENCH).toContain(piece);
    }
  });

  it('zeigt keine Demo-Daten und keine Upgrade-Kacheln', () => {
    expect(WORKBENCH).not.toContain('DEMO_CONTROL_SIGNALS');
    expect(WORKBENCH).not.toContain('DsgvoControlPackPanel');
    expect(WORKBENCH).not.toContain('checkoutHrefForPlan');
    expect(WORKBENCH).not.toContain('SELLABLE_PRICING_TIERS');
  });

  it('meldet Änderungen an alle Dashboard-Loader und lädt über dataVersion neu', () => {
    expect(WORKBENCH).toContain('notifyTenantDataChanged(activeTenantId)');
    expect(WORKBENCH).toContain('[activeTenantId, dataVersion]');
  });

  it('entfernt die an keiner Route hängende Altansicht', () => {
    expect(existsSync('src/features/governance/GovernanceDashboardView.tsx')).toBe(false);
    expect(APP).not.toContain("import('./features/governance/GovernanceDashboardView')");
  });
});

describe('mutationError', () => {
  it('liefert null bei ok', () => {
    expect(mutationError({ ok: true }, 'x')).toBe(null);
  });

  it('liefert die Servermeldung bei { ok: false }', () => {
    expect(mutationError({ ok: false, error: { code: 'forbidden', message: 'Keine Berechtigung' } }, 'x'))
      .toBe('Keine Berechtigung');
  });

  it('fällt ohne Meldung oder Antwort auf den Fallback zurück', () => {
    expect(mutationError({ ok: false }, 'Fallback')).toBe('Fallback');
    expect(mutationError({ ok: false, error: { code: 'e', message: '' } }, 'Fallback')).toBe('Fallback');
    expect(mutationError(null, 'Fallback')).toBe('Fallback');
    expect(mutationError(undefined, 'Fallback')).toBe('Fallback');
  });
});
