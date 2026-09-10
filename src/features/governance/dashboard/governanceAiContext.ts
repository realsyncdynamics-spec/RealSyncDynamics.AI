/**
 * Mandanten-Kontext für Governance AI.
 * Liest Evidence, Vorfälle und Findings — führt nichts aus.
 */
import { fetchTenantEvents, fetchTenantEvidence } from '../governanceApi';
import { fetchTenantIncidents } from '../incidentsApi';
import { listFindingsForScan, listScanRuns } from '../scans/scansApi';

export interface GroundingLine {
  kind: 'incident' | 'evidence' | 'finding';
  id: string;
  title: string;
  severity?: string;
}

export interface GovernanceAiGrounding {
  tenantId: string;
  incidents: GroundingLine[];
  evidence: GroundingLine[];
  findings: GroundingLine[];
  scanLabel: string | null;
  error: string | null;
}

const MAX_LINES = 8;

export async function loadGovernanceAiGrounding(tenantId: string): Promise<GovernanceAiGrounding> {
  try {
    const [incidents, evidence, scans] = await Promise.all([
      fetchTenantIncidents(tenantId),
      fetchTenantEvidence(tenantId, 20),
      listScanRuns(tenantId, { limit: 5, status: 'completed' }).catch(() => []),
    ]);

    const latestScan = scans[0] ?? null;
    const findings = latestScan ? await listFindingsForScan(latestScan.id).catch(() => []) : [];

    // Events nur, wenn Evidence leer ist — sonst doppelt.
    let extraEvents: GroundingLine[] = [];
    if (evidence.length === 0) {
      const events = await fetchTenantEvents(tenantId, 8).catch(() => []);
      extraEvents = events.slice(0, MAX_LINES).map((e) => ({
        kind: 'evidence' as const,
        id: e.id,
        title: e.title,
        severity: e.risk_level,
      }));
    }

    return {
      tenantId,
      incidents: incidents.slice(0, MAX_LINES).map((inc) => ({
        kind: 'incident',
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
      })),
      evidence:
        evidence.length > 0
          ? evidence.slice(0, MAX_LINES).map((row) => ({
              kind: 'evidence' as const,
              id: row.id,
              title: row.title,
            }))
          : extraEvents,
      findings: findings.slice(0, MAX_LINES).map((f) => ({
        kind: 'finding',
        id: f.id,
        title: f.summary,
        severity: f.severity,
      })),
      scanLabel: latestScan?.id ?? null,
      error: null,
    };
  } catch (err) {
    return {
      tenantId,
      incidents: [],
      evidence: [],
      findings: [],
      scanLabel: null,
      error: err instanceof Error ? err.message : 'Kontext konnte nicht geladen werden.',
    };
  }
}

function linesBlock(label: string, lines: GroundingLine[]): string {
  if (lines.length === 0) return `${label}: keine.`;
  return `${label}:\n${lines.map((l) => `- [${l.severity ?? l.kind}] ${l.title} (${l.id.slice(0, 8)})`).join('\n')}`;
}

export function formatGovernanceAiSystemPrompt(grounding: GovernanceAiGrounding | null): string {
  const base =
    'Du bist Governance AI von RealSyncDynamics.AI. Du bist ein Arbeitsassistent für DSGVO, EU AI Act und Website-Governance. Antworte auf Deutsch. Unterscheide klar zwischen Analyse, Empfehlung und tatsächlicher Ausführung. Du hast in diesem Chat keine ausführenden Tools — behaupte niemals, einen Scan, eine Maßnahme oder einen Export ausgeführt zu haben. Bei Rechtsfragen: informativ bleiben, keine individuelle Rechtsberatung.';

  if (!grounding) {
    return `${base}\n\nEs liegt kein Mandantenkontext vor. Sage das ehrlich. Erfinde keine Domains, Scores, Findings oder Mandanten (insbesondere kein atelier-nord).`;
  }

  if (grounding.error) {
    return `${base}\n\nMandantenkontext konnte nicht geladen werden (${grounding.error}). Erfinde keine Ersatzdaten.`;
  }

  const empty =
    grounding.incidents.length === 0 &&
    grounding.evidence.length === 0 &&
    grounding.findings.length === 0;

  const facts = empty
    ? 'Für diesen Mandanten liegen noch keine Vorfälle, Nachweise oder Findings vor. Sage das ehrlich. Erfinde keine Demo-Daten.'
    : [
        linesBlock('Vorfälle', grounding.incidents),
        linesBlock('Nachweise (Evidence)', grounding.evidence),
        linesBlock(
          grounding.scanLabel ? `Findings (letzter Scan ${grounding.scanLabel.slice(0, 8)})` : 'Findings',
          grounding.findings,
        ),
      ].join('\n\n');

  return `${base}\n\nMandantenkontext (nur gelesene RLS-Daten, keine Tool-Ausführung):\n${facts}\n\nWenn der Nutzer nach Status, Risiken oder Nachweisen fragt, beziehe dich ausschließlich auf diese Liste.`;
}
