/**
 * Governance-Plattform MVP Test-Harness.
 *
 * Reproduzierbarer Pass/Fail-Test der Pipeline
 *   (simulierter Detektor)
 *     → Finding[] (mit evidence_ref, hash, tenant_id, scan_run_id, timestamps)
 *     → Report (mit Score, Top-Findings, Disclaimer)
 *     → Export (JSON, round-trip)
 *
 * Verifiziert die *Contracts* (Schema, Vollständigkeit, Mapping), nicht
 * die Detektoren selbst — die Detektoren werden später (oder im e2e-Test)
 * gegen denselben Fixture-Satz laufen gelassen und müssen dieselben
 * Finding-Counts/Kategorien/Severities produzieren.
 *
 * Fixture: test/fixtures/governance-sites.json
 * Test-Plan: docs/testing/governance-platform-test-plan.md
 *
 * Pass-Kriterien je Test sind als `expect(...)` Assertions kodiert; der
 * gesamte Test gilt als Pass, wenn `npm test -- governance-mvp` 0 Exit-Code
 * liefert.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  buildEvidenceCatalog,
  buildReportPayload,
  computeComplianceScore,
  gradeFromScore,
  mapFindingsToReport,
} from '../src/lib/governance/reportMapping';
import {
  formatEvidenceRef,
  parseEvidenceRef,
  type EvidenceRef,
} from '../src/types/governance/evidence';
import type {
  Finding,
  FindingCategory,
  FindingSeverity,
} from '../src/types/governance/finding';
import type { ScanRun } from '../src/types/governance/scan-run';

/* ────────────────────────────────────────────────────────────────────
 * Fixture-Typen
 * ──────────────────────────────────────────────────────────────────── */

interface FixtureFindingExpectation {
  detector:        string;
  category:        FindingCategory;
  severity:        FindingSeverity;
  summary:         string;
  evidence_kind:   'url' | 'sha256';
  evidence_url?:   string;
  evidence_source?: string;
  raw_payload:     Record<string, unknown>;
}

interface FixtureSite {
  id:           string;
  website_id:   string;
  url:          string;
  label:        string;
  raw_html_sample: string;
  expected: {
    finding_count: number;
    max_severity:  FindingSeverity | null;
    categories:    FindingCategory[];
    findings:      FixtureFindingExpectation[];
  };
}

interface FixtureFile {
  $schema_version: string;
  description:     string;
  tenant_id:       string;
  sites:           FixtureSite[];
}

const FIXTURE: FixtureFile = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'governance-sites.json'), 'utf8'),
);

/* ────────────────────────────────────────────────────────────────────
 * Test-Harness-Helfer (KEIN Produktcode — nur Test-Infrastruktur)
 *
 * Diese Helfer simulieren den Daten-Fluss, den der reale Detector-Stack
 * + scan-pipeline + report-Adapter erzeugen würden. Sie kodieren den
 * Contract, gegen den echte Implementierungen geprüft werden müssen.
 * ──────────────────────────────────────────────────────────────────── */

const DISCLAIMER_DE =
  'Diese Auswertung ist keine Rechtsberatung. Sie ersetzt nicht die ' +
  'Prüfung durch eine qualifizierte Person (Anwalt/Datenschutzbeauftragte).';

/** sha256 als hex — über node:crypto, deterministisch. */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Baut den evidence_ref-Wire-String pro Fixture-Erwartung. */
function buildEvidenceFromFixture(exp: FixtureFindingExpectation): string {
  if (exp.evidence_kind === 'url') {
    if (!exp.evidence_url) throw new Error('fixture: evidence_url fehlt');
    return formatEvidenceRef({ kind: 'url', url: exp.evidence_url });
  }
  // sha256 — Hash aus dem evidence_source ableiten
  if (!exp.evidence_source) throw new Error('fixture: evidence_source fehlt');
  return formatEvidenceRef({ kind: 'sha256', hash: sha256Hex(exp.evidence_source) });
}

interface SimulatedScan {
  scanRun:  ScanRun;
  findings: Finding[];
  /** Wall-clock-Messung für Performance-Test. */
  metrics: {
    scan_ms:    number;
    record_ms:  number;
    report_ms:  number;
    export_ms:  number;
  };
  /** Was der Exporter ausliefern würde (JSON-String). */
  exportedJson: string;
}

/**
 * Simuliert die echte Pipeline:
 *   startScanRun → recordScanFinding × n → completeScanRun
 *     → mapFindingsToReport → buildReportPayload → exportReport(JSON)
 *
 * Statt Supabase-Inserts werden In-Memory-Objekte erzeugt. Die
 * Schema-Anforderungen (alle Pflichtfelder gesetzt, Timestamps,
 * korrelation, scan_run_id, tenant_id) bleiben identisch.
 */
function runSimulatedScan(site: FixtureSite): SimulatedScan {
  const tenant_id      = FIXTURE.tenant_id;
  const correlation_id = randomUUID();
  const scan_run_id    = randomUUID();
  const startedIso     = new Date().toISOString();
  const startMark      = performance.now();

  // Schritt 1: simulierter Detektor-Lauf
  const findings: Finding[] = site.expected.findings.map((exp, idx) => {
    const now = new Date().toISOString();
    // Konfidenz/Evidence-Level/Verification leiten sich aus dem
    // Evidence-Kind ab — sha256 = direkte DOM-Observation (höchste
    // Konfidenz), url = inferiert aus Crawl-Ergebnis. Der echte
    // Detector entscheidet dasselbe; das Fixture-Schema bleibt
    // bewusst schlank.
    const isDirectObservation = exp.evidence_kind === 'sha256';
    return {
      id:             randomUUID(),
      tenant_id,
      website_id:     site.website_id,
      scan_run_id,
      category:       exp.category,
      severity:       exp.severity,
      status:         'open',
      detector:       exp.detector,
      evidence_ref:   buildEvidenceFromFixture(exp),
      summary:        exp.summary,
      raw_payload:    { ...exp.raw_payload, fixture_index: idx },
      confidence_score:    isDirectObservation ? 1.0 : 0.85,
      evidence_level:      isDirectObservation ? 'observed' : 'inferred',
      verification_status: 'unverified',
      correlation_id,
      created_at:     now,
      updated_at:     now,
    };
  });
  const scanMark = performance.now();

  // Schritt 2: recordScanFinding (in-memory: das Mapping ist trivial)
  // — wir messen dennoch, um die Stage-Latency abzubilden.
  const recordedFindings = findings.slice(); // no-op copy
  const recordMark = performance.now();

  // Schritt 3: completeScanRun + Roll-up
  const completedIso = new Date().toISOString();
  const durationMs   = Math.max(1, Math.round(scanMark - startMark));
  const severityMax  = highestSeverity(recordedFindings);
  const scanRun: ScanRun = {
    id:             scan_run_id,
    tenant_id,
    website_id:     site.website_id,
    detector:       inferRunDetector(recordedFindings),
    status:         'completed',
    started_at:     startedIso,
    completed_at:   completedIso,
    duration_ms:    durationMs,
    finding_count:  recordedFindings.length,
    severity_max:   severityMax,
    error_code:     null,
    error_message:  null,
    raw_payload:    { source_html_sha256: sha256Hex(site.raw_html_sample) },
    correlation_id,
    created_at:     startedIso,
    updated_at:     completedIso,
  };

  // Schritt 4: Report-Aufbau
  const payload = buildReportPayload(scanRun, recordedFindings, { topN: 10 });
  const reportMark = performance.now();

  // Schritt 5: Export — JSON-Envelope mit Disclaimer (Contract für PDF/Email)
  const envelope = {
    report:           payload.report,
    scan_run:         payload.scan_run,
    all_findings:     payload.all_findings,
    evidence_catalog: payload.evidence_catalog,
    disclaimer:       DISCLAIMER_DE,
    generated_at:     completedIso,
    schema_version:   '1.0',
  };
  const exportedJson = JSON.stringify(envelope);
  const exportMark   = performance.now();

  return {
    scanRun,
    findings: recordedFindings,
    metrics: {
      scan_ms:   Math.max(0, scanMark   - startMark),
      record_ms: Math.max(0, recordMark - scanMark),
      report_ms: Math.max(0, reportMark - recordMark),
      export_ms: Math.max(0, exportMark - reportMark),
    },
    exportedJson,
  };
}

const SEVERITY_RANK_LOCAL: Record<FindingSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};
function highestSeverity(fs: Finding[]): FindingSeverity | null {
  if (fs.length === 0) return null;
  return fs.reduce<FindingSeverity>(
    (acc, f) => (SEVERITY_RANK_LOCAL[f.severity] > SEVERITY_RANK_LOCAL[acc] ? f.severity : acc),
    fs[0].severity,
  );
}

function inferRunDetector(fs: Finding[]): string {
  if (fs.length === 0) return 'gdpr-audit';
  // Wenn alle Findings denselben Detector haben, den nutzen — sonst
  // 'mixed' (in der echten Pipeline ist ein scan_run pro Detector,
  // aber das Fixture-Modell erlaubt aktuell mehrere).
  const uniq = new Set(fs.map((f) => f.detector));
  return uniq.size === 1 ? [...uniq][0] : 'mixed';
}

/** Vergleicht erwartete Findings vs. produzierte Findings für Accuracy-Metriken. */
function diffFindings(
  expected: FixtureFindingExpectation[],
  actual:   Finding[],
): { matched: number; false_positives: number; false_negatives: number } {
  type Key = string;
  const key = (cat: string, sev: string, det: string) => `${cat}|${sev}|${det}`;

  const expectedKeys: Key[] = expected.map((e) => key(e.category, e.severity, e.detector));
  const actualKeys:   Key[] = actual.map((a)  => key(a.category, a.severity, a.detector));

  const remaining = new Map<Key, number>();
  for (const k of expectedKeys) remaining.set(k, (remaining.get(k) ?? 0) + 1);

  let matched = 0;
  let fp      = 0;
  for (const k of actualKeys) {
    const left = remaining.get(k) ?? 0;
    if (left > 0) { matched += 1; remaining.set(k, left - 1); }
    else          { fp += 1; }
  }
  let fn = 0;
  for (const left of remaining.values()) fn += left;

  return { matched, false_positives: fp, false_negatives: fn };
}

/* ────────────────────────────────────────────────────────────────────
 * Pflicht-Test-Daten-Sanity (das Fixture selbst ist Teil des Vertrags)
 * ──────────────────────────────────────────────────────────────────── */

describe('Fixture: governance-sites.json', () => {
  it('lädt sauber und enthält 6 Sites (5 mit Risiken + 1 saubere Kontrolle)', () => {
    expect(FIXTURE.sites).toHaveLength(6);
    const clean = FIXTURE.sites.filter((s) => s.expected.finding_count === 0);
    expect(clean).toHaveLength(1);
    expect(clean[0].id).toBe('site-06-clean-control');
  });

  it('deckt alle geforderten Risiko-Kategorien ab', () => {
    const labels = FIXTURE.sites.map((s) => s.label.toLowerCase());
    expect(labels.some((l) => l.includes('datenschutzlink')) ).toBe(true);
    expect(labels.some((l) => l.includes('pre-consent'))     ).toBe(true);
    expect(labels.some((l) => l.includes('vendor'))          ).toBe(true);
    expect(labels.some((l) => l.includes('ai-chatbot') || l.includes('ai-widget') || l.includes('chatbot'))).toBe(true);
    expect(labels.some((l) => l.includes('impressum'))       ).toBe(true);
    expect(labels.some((l) => l.includes('saubere') || l.includes('kontroll'))).toBe(true);
  });

  it('hat zu jeder Fixture die erwartete Konsistenz finding_count == findings.length', () => {
    for (const s of FIXTURE.sites) {
      expect(s.expected.finding_count, `site ${s.id}`).toBe(s.expected.findings.length);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────
 * 1) Simulierter Scan-Lauf je Site — Evidence-Verifikation
 * ──────────────────────────────────────────────────────────────────── */

describe('Evidence-Verifikation', () => {
  for (const site of FIXTURE.sites) {
    describe(`site ${site.id} — ${site.label}`, () => {
      const result = runSimulatedScan(site);

      it('Scan-Run hat tenant_id, scan_run_id, correlation_id, beide Timestamps', () => {
        expect(result.scanRun.tenant_id).toBe(FIXTURE.tenant_id);
        expect(result.scanRun.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(result.scanRun.correlation_id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(result.scanRun.started_at).toBeTruthy();
        expect(result.scanRun.completed_at).toBeTruthy();
        expect(result.scanRun.status).toBe('completed');
      });

      it('jedes Finding trägt tenant_id, scan_run_id, timestamps, correlation_id', () => {
        for (const f of result.findings) {
          expect(f.tenant_id).toBe(FIXTURE.tenant_id);
          expect(f.scan_run_id).toBe(result.scanRun.id);
          expect(f.correlation_id).toBe(result.scanRun.correlation_id);
          expect(f.created_at).toBeTruthy();
          expect(f.updated_at).toBeTruthy();
          expect(f.id).toMatch(/^[0-9a-f-]{36}$/i);
        }
      });

      it('jedes Finding hat evidence_ref (nicht null, parsebar)', () => {
        for (const f of result.findings) {
          expect(f.evidence_ref, `finding ${f.id}`).not.toBeNull();
          const ref = parseEvidenceRef(f.evidence_ref);
          expect(ref, `evidence_ref unparseable: ${f.evidence_ref}`).not.toBeNull();
          // Opaque ist im Test verboten — Detector muss einen typisierten Ref liefern
          expect((ref as EvidenceRef).kind).not.toBe('opaque');
        }
      });

      it('sha256-Evidenzen haben einen 64-hex Hash, der die Quelle bestätigt', () => {
        for (let i = 0; i < result.findings.length; i++) {
          const f   = result.findings[i];
          const exp = site.expected.findings[i];
          if (exp.evidence_kind !== 'sha256') continue;
          const parsed = parseEvidenceRef(f.evidence_ref);
          expect(parsed?.kind).toBe('sha256');
          if (parsed?.kind !== 'sha256') return;
          expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/);
          // Hash bestätigt die Quelle — Detector hätte denselben Wert berechnet
          expect(parsed.hash).toBe(sha256Hex(exp.evidence_source!));
        }
      });
    });
  }
});

/* ────────────────────────────────────────────────────────────────────
 * 2) Report-Verifikation
 * ──────────────────────────────────────────────────────────────────── */

describe('Report-Verifikation', () => {
  for (const site of FIXTURE.sites) {
    describe(`site ${site.id}`, () => {
      const result    = runSimulatedScan(site);
      const envelope  = JSON.parse(result.exportedJson);
      const report    = envelope.report;

      it('Report wird erzeugt und enthält Pflichtfelder', () => {
        expect(report).toBeTruthy();
        expect(report.scan_run_id).toBe(result.scanRun.id);
        expect(report.tenant_id).toBe(FIXTURE.tenant_id);
        expect(report.scanned_at).toBeTruthy();
        expect(typeof report.score).toBe('number');
        expect(report.score).toBeGreaterThanOrEqual(0);
        expect(report.score).toBeLessThanOrEqual(100);
        expect(['A','B','C','D','F']).toContain(report.grade);
      });

      it('severity-/category-Breakdown ist vollständig vorhanden', () => {
        for (const k of ['critical','high','medium','low','info']) {
          expect(report.severity_breakdown[k]).toBeDefined();
        }
        expect(report.category_breakdown).toBeDefined();
        expect(report.status_breakdown).toBeDefined();
      });

      it('top_findings ist gesetzt und maximal 10 lang, severity-absteigend sortiert', () => {
        expect(Array.isArray(report.top_findings)).toBe(true);
        expect(report.top_findings.length).toBe(site.expected.finding_count);
        if (report.top_findings.length >= 2) {
          for (let i = 0; i < report.top_findings.length - 1; i++) {
            const a = SEVERITY_RANK_LOCAL[report.top_findings[i].severity as FindingSeverity];
            const b = SEVERITY_RANK_LOCAL[report.top_findings[i + 1].severity as FindingSeverity];
            expect(a, `top_findings[${i}]`).toBeGreaterThanOrEqual(b);
          }
        }
      });

      it('Risiko-Score stimmt mit der pure-logic-Berechnung überein', () => {
        const ref = computeComplianceScore(result.findings);
        expect(report.score).toBe(ref);
        expect(report.grade).toBe(gradeFromScore(ref));
      });

      it('Disclaimer „keine Rechtsberatung" ist im Export enthalten', () => {
        expect(typeof envelope.disclaimer).toBe('string');
        expect(envelope.disclaimer.toLowerCase()).toContain('rechtsberatung');
      });

      it('Export liefert valides, round-trip-fähiges JSON', () => {
        // Re-parse + Schlüssel-Set vollständig
        const reparsed = JSON.parse(result.exportedJson);
        expect(reparsed.report.scan_run_id).toBe(report.scan_run_id);
        expect(Array.isArray(reparsed.all_findings)).toBe(true);
        expect(reparsed.all_findings).toHaveLength(site.expected.finding_count);
        expect(Array.isArray(reparsed.evidence_catalog)).toBe(true);
        expect(reparsed.schema_version).toBe('1.0');
      });

      it('Evidence-Catalog dedupliziert und referenziert nur existierende Finding-Ids', () => {
        const ids  = new Set(result.findings.map((f) => f.id));
        const cat  = buildEvidenceCatalog(result.findings);
        for (const entry of cat) {
          expect(entry.supports.length).toBeGreaterThan(0);
          for (const id of entry.supports) {
            expect(ids.has(id), `unknown finding id in catalog: ${id}`).toBe(true);
          }
        }
      });
    });
  }
});

/* ────────────────────────────────────────────────────────────────────
 * 3) Performance-Basics — Latenz-Budget je Stage
 * ──────────────────────────────────────────────────────────────────── */

describe('Performance-Basics', () => {
  // Sehr großzügige Budgets — der Pure-Logic-Path ist sub-ms.
  // Reale Pipeline-Budgets (mit DB-RTT) gehören in einen separaten
  // e2e-Test. Diese Schranken erkennen pathologische Regressionen.
  const BUDGET_MS = {
    scan:   200,
    record: 50,
    report: 50,
    export: 50,
  };

  for (const site of FIXTURE.sites) {
    it(`site ${site.id} bleibt im Budget`, () => {
      const r = runSimulatedScan(site);
      expect(r.metrics.scan_ms,   'scan_ms').toBeLessThan(BUDGET_MS.scan);
      expect(r.metrics.record_ms, 'record_ms').toBeLessThan(BUDGET_MS.record);
      expect(r.metrics.report_ms, 'report_ms').toBeLessThan(BUDGET_MS.report);
      expect(r.metrics.export_ms, 'export_ms').toBeLessThan(BUDGET_MS.export);
    });
  }

  it('Roll-up über alle Sites: kumulativer Lauf < 1s', () => {
    const t0 = performance.now();
    for (const site of FIXTURE.sites) runSimulatedScan(site);
    const totalMs = performance.now() - t0;
    expect(totalMs).toBeLessThan(1000);
  });
});

/* ────────────────────────────────────────────────────────────────────
 * 4) Accuracy — expected vs actual + FP/FN-Metriken
 *
 * Der ehrliche Lauf (oben) hat per Konstruktion 100% Match. Hier
 * verifizieren wir den Metrik-Code selbst gegen einen absichtlich
 * fehlerhaften Lauf, damit echte Detektoren später denselben
 * Vergleicher nutzen können.
 * ──────────────────────────────────────────────────────────────────── */

describe('Accuracy: expected vs actual', () => {
  it('ehrlicher Lauf: 100% match, 0 FP, 0 FN je Site', () => {
    for (const site of FIXTURE.sites) {
      const r = runSimulatedScan(site);
      const d = diffFindings(site.expected.findings, r.findings);
      expect(d.matched, `site ${site.id} matched`).toBe(site.expected.finding_count);
      expect(d.false_positives, `site ${site.id} fp`).toBe(0);
      expect(d.false_negatives, `site ${site.id} fn`).toBe(0);
    }
  });

  it('saubere Kontrollseite produziert exakt 0 Findings (keine FP-Halluzination)', () => {
    const control = FIXTURE.sites.find((s) => s.id === 'site-06-clean-control')!;
    const r = runSimulatedScan(control);
    expect(r.findings).toHaveLength(0);
    expect(r.scanRun.severity_max).toBeNull();
    const report = mapFindingsToReport(r.scanRun, r.findings);
    expect(report.score).toBe(100);
    expect(report.grade).toBe('A');
  });

  it('Metrik erkennt False-Positives korrekt', () => {
    const site = FIXTURE.sites.find((s) => s.id === 'site-01-missing-privacy')!;
    const r = runSimulatedScan(site);
    // Faulty detector: dasselbe Set + 1 zusätzliches medium-Tracker
    const extraFp: Finding = {
      ...r.findings[0],
      id: randomUUID(),
      category: 'tracker',
      severity: 'medium',
      summary: 'FP — sollte nicht erscheinen',
    };
    const d = diffFindings(site.expected.findings, [...r.findings, extraFp]);
    expect(d.false_positives).toBe(1);
    expect(d.false_negatives).toBe(0);
    expect(d.matched).toBe(site.expected.finding_count);
  });

  it('Metrik erkennt False-Negatives korrekt', () => {
    const site = FIXTURE.sites.find((s) => s.id === 'site-02-pre-consent-tracker')!;
    const r = runSimulatedScan(site);
    // Faulty detector: lässt das critical-Consent-Finding fallen
    const droppedOne = r.findings.slice(1);
    const d = diffFindings(site.expected.findings, droppedOne);
    expect(d.false_negatives).toBe(1);
    expect(d.false_positives).toBe(0);
    expect(d.matched).toBe(site.expected.finding_count - 1);
  });

  it('Metrik erkennt Severity-Drift als FP+FN', () => {
    const site = FIXTURE.sites.find((s) => s.id === 'site-04-ai-chatbot')!;
    const r = runSimulatedScan(site);
    // Detector liefert dieselbe Kategorie/Detector, aber Severity=low statt high
    const drifted: Finding[] = [{ ...r.findings[0], severity: 'low' }];
    const d = diffFindings(site.expected.findings, drifted);
    expect(d.matched).toBe(0);
    expect(d.false_positives).toBe(1);
    expect(d.false_negatives).toBe(1);
  });
});

/* ────────────────────────────────────────────────────────────────────
 * 5) Pass/Fail-Matrix — aggregierte Sicht über alle Sites
 *
 * Schlägt fehl, wenn auch nur eine Site die Erwartungen verletzt.
 * Dient als single-source-of-truth für CI / Status-Reporting.
 * ──────────────────────────────────────────────────────────────────── */

describe('Pass/Fail-Matrix', () => {
  it('alle 6 Sites bestehen Evidence + Report + Accuracy', () => {
    const failures: string[] = [];
    for (const site of FIXTURE.sites) {
      const r       = runSimulatedScan(site);
      const envelope = JSON.parse(r.exportedJson);
      const d       = diffFindings(site.expected.findings, r.findings);

      const ok =
        r.findings.length === site.expected.finding_count &&
        r.findings.every((f) => f.tenant_id && f.scan_run_id && f.evidence_ref) &&
        r.scanRun.severity_max === site.expected.max_severity &&
        envelope.report.score === computeComplianceScore(r.findings) &&
        typeof envelope.disclaimer === 'string' &&
        envelope.disclaimer.toLowerCase().includes('rechtsberatung') &&
        d.false_positives === 0 &&
        d.false_negatives === 0;

      if (!ok) failures.push(site.id);
    }
    expect(failures, `failed sites: ${failures.join(', ')}`).toEqual([]);
  });
});
