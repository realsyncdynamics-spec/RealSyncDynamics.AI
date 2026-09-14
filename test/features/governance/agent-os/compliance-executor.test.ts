/**
 * Die Compliance-Session im Dashboard muss ausführen, was sie ausführen kann.
 *
 * ## Warum es diesen Test gibt
 *
 * `/app/dashboard` bewirbt „Compliance · Preview · ausführbar". Ausgeführt
 * wurde bis 2026-09-14 nichts: `createSiteOsExecutor` kennt für die zehn
 * Compliance-Aktionen keine Zuordnung, liefert `not_implemented` und reicht
 * nicht an `defaultExecuteStep` weiter — dessen Preview-Verzweigung war in
 * der App toter Code. Wer den Plan freigab, sah die Session beim **ersten**
 * Schritt blockieren, mit „NOT IMPLEMENTED: no SiteOS mapping for
 * define_compliance_task".
 *
 * Vier Schritte lassen sich aus vorhandenen Daten beantworten. Dieser Test
 * hält fest, dass sie es tun — und dass die übrigen weiterhin ausdrücklich
 * nicht implementiert melden, statt einen Erfolg zu behaupten.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createComplianceExecutor,
  type ComplianceDataSurface,
} from '@/src/features/governance/agent-os/complianceExecutor';
import type { StepResult } from '@/src/core/realsync-os';

const TENANT = 'tenant-1';

const RUN = {
  id: 'run-1',
  tenant_id: TENANT,
  status: 'completed',
  finding_count: 3,
  severity_max: 'high',
  completed_at: '2026-09-14T10:00:00Z',
  started_at: '2026-09-14T09:59:00Z',
  created_at: '2026-09-14T09:58:00Z',
};

const finding = (over: Record<string, unknown>) => ({
  id: 'f', tenant_id: TENANT, scan_run_id: RUN.id, severity: 'low',
  status: 'open', summary: 'Befund', ...over,
});

function surface(over: Partial<ComplianceDataSurface> = {}): ComplianceDataSurface {
  return {
    listWebsitesForTenant: vi.fn(async () => [
      { id: 'w1', tenant_id: TENANT, domain: 'beispiel.de', plan_tier: 'audit', status: 'active', created_at: '' },
    ]),
    listScanRuns: vi.fn(async () => [RUN]),
    listFindingsForScan: vi.fn(async () => [
      finding({ id: 'f1', severity: 'high', status: 'open', summary: 'Tracker ohne Einwilligung' }),
      finding({ id: 'f2', severity: 'low', status: 'open', summary: 'Fehlender Hinweis' }),
      finding({ id: 'f3', severity: 'critical', status: 'resolved', summary: 'Behoben' }),
    ]),
    getScanReport: vi.fn(async () => ({
      report: {}, scan_run: RUN,
      all_findings: [finding({ id: 'f1' }), finding({ id: 'f2' })],
      evidence_catalog: [{ ref: 'sha256:a', supports: ['f1'] }, { ref: 'sha256:b', supports: ['f2'] }],
    })),
    ...over,
  } as ComplianceDataSurface;
}

const run = (action: string, data = surface(), inner?: Parameters<typeof createComplianceExecutor>[1]) =>
  createComplianceExecutor(TENANT, inner, data)({
    step: { id: action, action, agent: 'compliance', risk: 'medium', requiresApproval: false },
    session: { intent: { text: 'Prüfe meine KI-Anwendung.' } },
  } as never) as Promise<StepResult>;

describe('Schritte mit echtem Substrat', () => {
  it('liest die Websites des Mandanten statt sie zu behaupten', async () => {
    const result = await run('list_required_data');
    expect(result.status).toBe('succeeded');
    expect(result.observation).toMatchObject({ anzahl: 1, domains: ['beispiel.de'], quelle: 'websites' });
  });

  it('nimmt Risiko und Findings-Zahl aus dem Scan-Lauf', async () => {
    const result = await run('assess_compliance_risk');
    expect(result.status).toBe('succeeded');
    expect(result.observation).toMatchObject({ scan_run_id: 'run-1', findings: 3, severity_max: 'high' });
  });

  it('macht aus „kein Risiko gemessen" kein geringes Risiko', async () => {
    const ohneBefunde = surface({
      listScanRuns: vi.fn(async () => [{ ...RUN, finding_count: 0, severity_max: null }]),
    } as Partial<ComplianceDataSurface>);
    const result = await run('assess_compliance_risk', ohneBefunde);
    expect(result.observation).toMatchObject({ findings: 0, severity_max: null });
  });

  it('zählt nur offene Findings und verteilt sie nach Schwere', async () => {
    const result = await run('list_open_findings');
    expect(result.status).toBe('succeeded');
    expect(result.observation).toMatchObject({
      offen: 2, gesamt: 3, nach_schwere: { high: 1, low: 1 },
    });
    // Das behobene Finding darf nicht in der Verteilung auftauchen.
    expect((result.observation as { nach_schwere: Record<string, number> }).nach_schwere.critical).toBeUndefined();
  });

  it('zählt echte Evidence-Einträge und verweist auf das Audit Center', async () => {
    const result = await run('assemble_evidence_pack');
    expect(result.status).toBe('succeeded');
    expect(result.observation).toMatchObject({ eintraege: 2, findings: 2, export: '/app/audit' });
  });
});

describe('Fehlende Voraussetzungen', () => {
  it('blockiert ohne Website — und sagt wo sie herkommt', async () => {
    const leer = surface({ listWebsitesForTenant: vi.fn(async () => []) } as Partial<ComplianceDataSurface>);
    const result = await run('list_required_data', leer);
    expect(result.status).toBe('blocked');
    expect(result.reason).toContain('/app/websites');
  });

  it('blockiert ohne Scan-Lauf', async () => {
    const leer = surface({ listScanRuns: vi.fn(async () => []) } as Partial<ComplianceDataSurface>);
    for (const action of ['assess_compliance_risk', 'list_open_findings', 'assemble_evidence_pack']) {
      const result = await run(action, leer);
      expect(result.status, action).toBe('blocked');
      expect(result.reason, action).toContain('Scan');
    }
  });

  it('meldet einen Lesefehler als Fehler, nicht als Ergebnis', async () => {
    const kaputt = surface({
      listWebsitesForTenant: vi.fn(async () => { throw new Error('RLS verweigert'); }),
    } as Partial<ComplianceDataSurface>);
    const result = await run('list_required_data', kaputt);
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('RLS verweigert');
  });
});

describe('Schritte ohne Substrat', () => {
  it('behaupten keinen Erfolg und nennen den echten Ort', async () => {
    const erwartet: Record<string, string> = {
      define_compliance_task: 'agent_tasks',
      create_compliance_plan: '/app/governance/frameworks',
      propose_compliance_actions: '/app/remediation',
      propose_remediation: '/app/remediation',
      generate_closing_report: '/app/audit',
    };
    for (const [action, hinweis] of Object.entries(erwartet)) {
      const result = await run(action);
      expect(result.status, action).toBe('not_implemented');
      expect(result.reason, action).toContain(hinweis);
    }
  });
});

describe('Zusammenspiel', () => {
  it('reicht evaluate_governance an den SiteOS-Agenten durch', async () => {
    const inner = vi.fn(async () => ({ status: 'succeeded', tool: 'siteos.agents.compliance' }) as StepResult);
    const result = await run('evaluate_governance', surface(), inner);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(result.tool).toBe('siteos.agents.compliance');
  });

  it('holt den jüngsten Lauf einmal, nicht je Schritt', async () => {
    const data = surface();
    const executor = createComplianceExecutor(TENANT, undefined, data);
    const step = (action: string) => executor({
      step: { id: action, action, agent: 'compliance', risk: 'medium', requiresApproval: false },
      session: { intent: { text: 'x' } },
    } as never);
    await step('assess_compliance_risk');
    await step('list_open_findings');
    await step('assemble_evidence_pack');
    expect(data.listScanRuns).toHaveBeenCalledTimes(1);
  });

  it('schreibt nichts — der Audit-Trail bleibt service-role', async () => {
    // Die Oberfläche kennt ausschliesslich lesende Aufrufe. Käme ein
    // schreibender dazu, fiele es hier auf.
    const data = surface();
    expect(Object.keys(data).sort()).toEqual([
      'getScanReport', 'listFindingsForScan', 'listScanRuns', 'listWebsitesForTenant',
    ]);
  });
});
