/**
 * Das Terminal darf kein Audit-Ergebnis erfinden.
 *
 * ## Warum das ein eigener Test ist
 *
 * `/app/terminal` ist eine angemeldete Fläche. Bis 2026-09-14 tat sie beim
 * Befehl `/scan <url>` nichts als würfeln:
 *
 *     findingsCount: Math.floor(Math.random() * 25)
 *     riskLevel: ['critical','high','medium','low'][Math.floor(Math.random()*4)]
 *
 * Der Nutzer bekam für seine eigene Domain eine Risikoeinstufung per
 * Zufallszahl — und die daraus abgeleitete Tarif-Empfehlung gleich mit.
 * `/audit` setzte darauf auf: eine erfundene Dateigrösse, ein Download-Link
 * auf einen Host, der nichts ausliefert, die Meldung
 * „✓ Evidence-Chain: N items sealed" mit gewürfeltem N, und `getSeal()`, das
 * einen 64-stelligen Hex-String als SHA-256-Siegel zurückgab — die übergebene
 * `auditId` ignorierte es dabei vollständig.
 *
 * Das wiegt schwerer als ein falscher Zahlenwert. Das Evidence-Modell dieses
 * Repos führt `confidence_score`, `evidence_level` und `verification_status`
 * mit, ausdrücklich um nicht zu überclaimen (siehe `types/governance/report.ts`).
 * Ein gefälschtes Siegel imitiert genau das Artefakt, das im Streitfall
 * beweisen soll.
 *
 * Seither läuft `/scan` über `triggerTenantAudit()` — die `tenant-audit` Edge
 * Function, die in `scan_runs` + `findings` schreibt — und `/audit` liest die
 * Kennzahlen über `getScanReport()`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const TERMINAL = 'src/features/governance/terminal';
const HOOK = read(`${TERMINAL}/useAgenticTerminal.ts`);
const AUDIT_AGENT = read(`${TERMINAL}/agents/AuditAgent.ts`);
const TRIAGE_AGENT = read(`${TERMINAL}/agents/TriageAgent.ts`);
const BARREL = read(`${TERMINAL}/agents/index.ts`);

/** Kommentare ausblenden — dort steht die Historie, warum es den Test gibt. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('/scan im Terminal', () => {
  it('würfelt kein Scan-Ergebnis', () => {
    expect(code(HOOK)).not.toContain('Math.random(');
    expect(code(HOOK)).not.toContain('mockScan');
  });

  it('löst einen echten, mandantengebundenen Scan aus', () => {
    expect(HOOK).toContain("import { triggerTenantAudit, getScanReport } from '../scans/scansApi'");
    expect(HOOK).toContain('await triggerTenantAudit(activeTenantId, url)');
    expect(HOOK).toContain('findingsCount: run.finding_count');
    expect(HOOK).toContain('riskLevel: toRiskLevel(run.severity_max)');
    expect(HOOK).toContain('setContext({ ...context, scanId: run.scan_run_id })');
  });

  it('scannt nach einem Workspace-Wechsel nicht den alten Mandanten', () => {
    // Ohne activeTenantId in der Dependency-Liste haelt der Callback den
    // Mandanten fest, der beim Memoisieren aktiv war.
    expect(HOOK).toContain('[sessionId, logCommand, activeTenantId]');
  });

  it('meldet Fehler der Runtime, statt sie zu verschlucken', () => {
    expect(HOOK).toContain("err instanceof Error ? err.message : 'Scan fehlgeschlagen.'");
    expect(HOOK).toContain('Kein aktiver Workspace');
  });

  it('behauptet keine Zahl klassifizierter KI-Systeme', () => {
    expect(HOOK).toContain('systemsClassified: null');
    expect(TRIAGE_AGENT).toContain('systemsClassified: number | null');
    expect(TRIAGE_AGENT).toContain('if (scan.systemsClassified !== null)');
  });

  it('unterscheidet „kein Risiko gemessen" von „geringes Risiko"', () => {
    expect(TRIAGE_AGENT).toContain("'critical' | 'high' | 'medium' | 'low' | 'info' | 'none'");
  });
});

describe('/audit im Terminal', () => {
  it('erfindet kein Siegel', () => {
    const source = code(AUDIT_AGENT);
    expect(source).not.toContain('Math.random(');
    expect(source).not.toContain('generateSHA256Hash');
    expect(source).not.toContain('getSeal');
    expect(BARREL).not.toContain('getSeal');
  });

  it('behauptet keine versiegelte Evidence-Kette', () => {
    expect(code(AUDIT_AGENT)).not.toContain('items sealed');
    expect(code(AUDIT_AGENT)).not.toContain('generated and sealed');
  });

  it('erfindet weder Dateigrösse noch Download-Adresse', () => {
    const source = code(AUDIT_AGENT);
    expect(source).not.toContain('fileSize');
    expect(source).not.toContain('evidence.realsync.ai');
    expect(source).not.toContain('downloadUrl');
  });

  it('liest die Kennzahlen aus dem echten Scan-Lauf', () => {
    expect(HOOK).toContain('await getScanReport(targetScanId)');
    expect(HOOK).toContain('findingCount: report.all_findings.length');
    expect(HOOK).toContain('evidenceCount: report.evidence_catalog.length');
    expect(AUDIT_AGENT).toContain('facts: AuditFactSheet | null');
  });

  it('nennt ohne lesbaren Report gar keine Zahlen', () => {
    expect(AUDIT_AGENT).toContain('Zu diesem Scan-Lauf liess sich kein Report lesen');
  });

  it('verweist für den signierten Export auf das Audit Center', () => {
    expect(AUDIT_AGENT).toContain('Signierter Export: /app/audit');
  });
});

describe('Plan-Namen-Ratsche', () => {
  it('lässt die drei Gates in AuditAgent.ts unangetastet', () => {
    // scripts/plan-name-gate-baseline.json führt diese Datei mit genau drei
    // Fundstellen (Aufbewahrungsdauer am Plan-Namen). Wer hier aufräumt, muss
    // die Baseline bewusst mitziehen — nicht versehentlich.
    const GATE_PATTERN =
      /\b(?:\w+\.)?(?:plan|tier|planId|planKey|currentPlan|planName)\s*(?:===|!==|==|!=)\s*['"](free|starter|growth|agency|enterprise|partner)['"]/g;
    expect(AUDIT_AGENT.match(GATE_PATTERN)).toHaveLength(3);
  });
});
