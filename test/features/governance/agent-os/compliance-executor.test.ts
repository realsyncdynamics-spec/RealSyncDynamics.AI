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
import type { StepExecutor, StepResult } from '@/src/core/realsync-os';

const TENANT = 'tenant-1';

const RUN = {
  id: 'run-1',
  status: 'completed',
  finding_count: 3,
  severity_max: 'high' as string | null,
  started_at: '2026-09-14T09:59:00Z' as string | null,
  completed_at: '2026-09-14T10:00:00Z' as string | null,
  created_at: '2026-09-14T09:58:00Z',
};

const finding = (severity: string, status: string, summary: string) => ({ severity, status, summary });

/**
 * Die Vorlage füllt genau die Felder, die `ComplianceDataSurface` beschreibt —
 * keine erfundene Vollständigkeit, und deshalb auch kein Cast.
 */
function surface(over: Partial<ComplianceDataSurface> = {}): ComplianceDataSurface {
  return {
    listWebsitesForTenant: vi.fn(async () => [{ domain: 'beispiel.de' }]),
    listScanRuns: vi.fn(async () => [RUN]),
    listFindingsForScan: vi.fn(async () => [
      finding('high', 'open', 'Tracker ohne Einwilligung'),
      finding('low', 'open', 'Fehlender Hinweis'),
      finding('critical', 'resolved', 'Behoben'),
    ]),
    getScanReport: vi.fn(async () => ({
      all_findings: [{}, {}],
      evidence_catalog: [{ ref: 'sha256:a' }, { ref: 'sha256:b' }],
    })),
    ...over,
  };
}

const step = (action: string) => ({
  step: { id: action, action, agent: 'compliance', risk: 'medium', requiresApproval: false },
  session: { intent: { text: 'Prüfe meine KI-Anwendung.' } },
}) as unknown as Parameters<StepExecutor>[0];

const run = (action: string, data = surface(), inner?: StepExecutor) =>
  createComplianceExecutor(TENANT, inner, data)(step(action)) as Promise<StepResult>;

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
    });
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
    const leer = surface({ listWebsitesForTenant: vi.fn(async () => []) });
    const result = await run('list_required_data', leer);
    expect(result.status).toBe('blocked');
    expect(result.reason).toContain('/app/websites');
  });

  it('blockiert ohne Scan-Lauf', async () => {
    const leer = surface({ listScanRuns: vi.fn(async () => []) });
    for (const action of ['assess_compliance_risk', 'list_open_findings', 'assemble_evidence_pack']) {
      const result = await run(action, leer);
      expect(result.status, action).toBe('blocked');
      expect(result.reason, action).toContain('Scan');
    }
  });

  it('meldet einen Lesefehler als Fehler, nicht als Ergebnis', async () => {
    const kaputt = surface({
      listWebsitesForTenant: vi.fn(async () => { throw new Error('RLS verweigert'); }),
    });
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
    await executor(step('assess_compliance_risk'));
    await executor(step('list_open_findings'));
    await executor(step('assemble_evidence_pack'));
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
