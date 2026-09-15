import type { StepExecutor, StepExecutorContext, StepResult } from '../../../core/realsync-os';
import {
  getScanReport,
  listFindingsForScan,
  listScanRuns,
  listWebsitesForTenant,
} from '../scans/scansApi';

/**
 * Bindet die Compliance-Schritte des Agent OS an die echten Mandantendaten.
 *
 * ## Warum es diese Datei gibt
 *
 * Das Dashboard bewirbt „Compliance · Preview · ausführbar". Ausgeführt wurde
 * bis 2026-09-14 nichts: `createSiteOsExecutor` kennt für die zehn
 * Compliance-Aktionen keine Zuordnung und liefert `not_implemented`, und weil
 * er nicht an `defaultExecuteStep` weiterreicht, war dessen
 * Preview-Verzweigung in der App toter Code. Wer den Plan freigab, sah die
 * Session beim ersten Schritt blockieren — mit der Begründung „NOT
 * IMPLEMENTED: no SiteOS mapping for define_compliance_task".
 *
 * Vier Schritte lassen sich heute mit echten Daten beantworten, ohne etwas zu
 * erfinden und ohne etwas zu schreiben: der Mandant hat Websites, Scan-Läufe,
 * Findings und einen Evidence-Katalog. Genau die werden hier gelesen.
 *
 * ## Was bewusst NICHT passiert
 *
 * Kein Schritt schreibt. Der Audit-Trail (`agent_events`, `agent_outputs`)
 * ist in der Migration ausdrücklich service-role-only — der Browser darf ihn
 * nicht führen, und diese Datei versucht es auch nicht. Was hier entsteht,
 * ist eine Lesesicht auf vorhandene Nachweise, kein neuer Nachweis.
 *
 * Die fünf Schritte ohne Substrat melden weiterhin `not_implemented`, jetzt
 * aber mit einer Begründung, die sagt, was fehlt und wo die echte Funktion
 * liegt — statt einer Zuordnungsmeldung aus dem SiteOS-Executor.
 *
 * `evaluate_governance` wird durchgereicht: dafür gibt es mit dem
 * SiteOS-Compliance-Agenten bereits eine echte Ausführung.
 */

/** Nur die Felder des Scan-Laufs, die dieser Executor liest. */
type ComplianceScanRun = {
  id: string;
  status: string;
  finding_count: number;
  severity_max: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

/**
 * Die gelesenen Quellen als Oberfläche — gleiches Muster wie
 * `SiteOsCommandSurface` in `features/siteos/commandExecutor.ts`, nur enger
 * geschnitten: beschrieben ist, was dieser Executor tatsächlich anfasst, nicht
 * die volle Signatur der API. Die echten Funktionen erfüllen sie, und eine
 * Test-Vorlage muss nicht zwanzig Felder erfinden, von denen keines gelesen
 * wird — erfundene Vollständigkeit ist auch eine Behauptung.
 */
export type ComplianceDataSurface = {
  listWebsitesForTenant: (tenantId: string) => Promise<ReadonlyArray<{ domain: string }>>;
  listScanRuns: (
    tenantId: string,
    opts?: { limit?: number },
  ) => Promise<ReadonlyArray<ComplianceScanRun>>;
  listFindingsForScan: (
    scanRunId: string,
  ) => Promise<ReadonlyArray<{ status: string; severity: string; summary: string }>>;
  getScanReport: (
    scanRunId: string,
  ) => Promise<{ all_findings: ReadonlyArray<unknown>; evidence_catalog: ReadonlyArray<unknown> } | null>;
};

const LIVE_DATA: ComplianceDataSurface = {
  listWebsitesForTenant,
  listScanRuns,
  listFindingsForScan,
  getScanReport,
};

/** Ein Schritt, für den es noch kein Substrat gibt. Sagt, woran es liegt. */
function notBound(action: string, grund: string): StepResult {
  return {
    status: 'not_implemented',
    tool: `agent-os.compliance:${action}`,
    reason: grund,
  };
}

/** Fehlende Voraussetzung im Mandanten — kein Fehler, aber auch kein Ergebnis. */
function missing(action: string, grund: string): StepResult {
  return {
    status: 'blocked',
    tool: `agent-os.compliance:${action}`,
    reason: grund,
  };
}

export function createComplianceExecutor(
  tenantId: string,
  inner?: StepExecutor,
  data: ComplianceDataSurface = LIVE_DATA,
): StepExecutor {
  // Drei Schritte brauchen denselben jüngsten Lauf — einmal holen, nicht dreimal.
  let latestRun: Promise<ComplianceScanRun | null> | null = null;
  const newestRun = (): Promise<ComplianceScanRun | null> => {
    latestRun ??= data.listScanRuns(tenantId, { limit: 1 }).then((runs) => runs[0] ?? null);
    return latestRun;
  };

  return async (ctx: StepExecutorContext): Promise<StepResult> => {
    const { step } = ctx;

    if (!tenantId) {
      return { status: 'failed', tool: 'agent-os.compliance', reason: 'Kein aktiver Mandant.' };
    }

    try {
      switch (step.action) {
        case 'list_required_data': {
          const websites = await data.listWebsitesForTenant(tenantId);
          if (websites.length === 0) {
            return missing(
              step.action,
              'Im Mandanten ist keine Website registriert. Unter /app/websites eintragen, dann erneut starten.',
            );
          }
          return {
            status: 'succeeded',
            tool: 'agent-os.compliance.websites',
            observation: {
              kind: 'tenant_websites',
              anzahl: websites.length,
              domains: websites.map((w) => w.domain),
              quelle: 'websites',
            },
          };
        }

        case 'assess_compliance_risk': {
          const run = await newestRun();
          if (!run) {
            return missing(
              step.action,
              'Noch kein Scan-Lauf für diesen Mandanten. Unter /app/websites einen Scan starten.',
            );
          }
          return {
            status: 'succeeded',
            tool: 'agent-os.compliance.scan_run',
            observation: {
              kind: 'scan_run_risk',
              scan_run_id: run.id,
              status: run.status,
              findings: run.finding_count,
              // `severity_max` ist null, solange keine Findings erfasst sind —
              // das ist etwas anderes als „geringes Risiko" und bleibt null.
              severity_max: run.severity_max,
              gelaufen_am: run.completed_at ?? run.started_at ?? run.created_at,
              quelle: 'scan_runs',
            },
            artifacts: { scanId: run.id },
          };
        }

        case 'list_open_findings': {
          const run = await newestRun();
          if (!run) {
            return missing(
              step.action,
              'Noch kein Scan-Lauf für diesen Mandanten. Unter /app/websites einen Scan starten.',
            );
          }
          const findings = await data.listFindingsForScan(run.id);
          const offen = findings.filter((f) => f.status === 'open');
          const nachSchwere: Record<string, number> = {};
          for (const f of offen) {
            nachSchwere[f.severity] = (nachSchwere[f.severity] ?? 0) + 1;
          }
          return {
            status: 'succeeded',
            tool: 'agent-os.compliance.findings',
            observation: {
              kind: 'open_findings',
              scan_run_id: run.id,
              offen: offen.length,
              gesamt: findings.length,
              nach_schwere: nachSchwere,
              // Nur die Zusammenfassungen, keine Bewertung dazuerfunden.
              titel: offen.slice(0, 5).map((f) => f.summary),
              quelle: 'findings',
            },
          };
        }

        case 'assemble_evidence_pack': {
          const run = await newestRun();
          if (!run) {
            return missing(
              step.action,
              'Noch kein Scan-Lauf für diesen Mandanten. Unter /app/websites einen Scan starten.',
            );
          }
          const report = await data.getScanReport(run.id);
          if (!report) {
            return missing(
              step.action,
              `Zum Scan-Lauf ${run.id} liess sich kein Report lesen.`,
            );
          }
          return {
            status: 'succeeded',
            tool: 'agent-os.compliance.evidence',
            observation: {
              kind: 'evidence_catalog',
              scan_run_id: run.id,
              eintraege: report.evidence_catalog.length,
              findings: report.all_findings.length,
              // Der signierte Export entsteht im Audit Center, nicht hier.
              export: '/app/audit',
              quelle: 'findings.evidence_ref',
            },
          };
        }

        case 'define_compliance_task':
          return notBound(
            step.action,
            'Die Aufgabe wird nirgends abgelegt — für Agent-OS-Aufgaben fehlt der schreibende Pfad (agent_tasks ist service-role-only).',
          );

        case 'create_compliance_plan':
          return notBound(
            step.action,
            'Ein Prüfplan wird noch nicht erzeugt. Rahmenwerke und Kontrollen liegen unter /app/governance/frameworks.',
          );

        case 'propose_compliance_actions':
          return notBound(
            step.action,
            'Maßnahmenvorschläge entstehen noch nicht automatisch. Vorhandene Maßnahmen: /app/remediation.',
          );

        case 'propose_remediation':
          return notBound(
            step.action,
            'Remediation-Pläne werden noch nicht aus der Session erzeugt. Bestehende Pläne: /app/remediation.',
          );

        case 'generate_closing_report':
          return notBound(
            step.action,
            'Der Abschlussbericht wird hier nicht erzeugt. Der signierte Export läuft über das Audit Center: /app/audit.',
          );

        default:
          break;
      }
    } catch (error) {
      return {
        status: 'failed',
        tool: `agent-os.compliance:${step.action}`,
        reason: error instanceof Error ? error.message : 'Compliance-Schritt fehlgeschlagen.',
      };
    }

    // Alles andere — darunter `evaluate_governance` — gehört dem gebundenen
    // Executor darunter.
    if (inner) return inner(ctx);
    return {
      status: 'not_implemented',
      tool: `agent-os.compliance:${step.action}`,
      reason: `Kein Substrat für ${step.action}.`,
    };
  };
}
