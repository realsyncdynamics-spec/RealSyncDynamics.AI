import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import {
  baseStyles,
  COLORS,
  DOCS_VERSION,
  PdfDisclaimer,
  PdfFooter,
  PdfHeader,
  PdfPage,
} from '../shared';
import type {
  ComplianceGrade,
  Report,
  ReportFinding,
  ReportPayload,
} from '../../types/governance/report';
import type { FindingSeverity, FindingStatus } from '../../types/governance/finding';
import { evidenceRefLabel } from '../../types/governance/evidence';

/**
 * Compliance-Report PDF — consumes ReportPayload (from PR 3) and
 * produces a paginated, branded, audit-grade PDF document.
 *
 * Lazy-loaded via src/pdf/index.ts so @react-pdf/renderer (~150 kB)
 * stays out of the main bundle. Caller does:
 *
 *   const { ReportTemplate } = await import('@/pdf');
 *   const blob = await pdf(<ReportTemplate payload={...} />).toBlob();
 *
 * Stability contract:
 *   - Same input → byte-equivalent output (modulo PDF metadata).
 *   - Layout doesn't depend on network resources; every asset inline.
 *   - Five-color severity palette stable across pages.
 *   - No I/O, no async — pure component.
 */

// Severity-Palette für die PDF-Ausgabe — Spiegel von
// src/lib/governance/severityPalette.ts auf statische Hex-Werte:
//   CRITICAL → rot, HIGH → orange, MEDIUM → amber/gelb,
//   LOW → titanium-neutral, INFO → blau
// React-PDF kann keine Tailwind-Klassen, daher hier inline.
const SEVERITY_PALETTE: Record<FindingSeverity, { label: string; bg: string; fg: string }> = {
  critical: { label: 'KRITISCH', bg: '#FEE2E2', fg: '#991B1B' },
  high:     { label: 'HOCH',     bg: '#FFEDD5', fg: '#9A3412' },
  medium:   { label: 'MITTEL',   bg: '#FEF3C7', fg: '#92400E' },
  low:      { label: 'NIEDRIG',  bg: '#E5E7EB', fg: '#374151' },
  info:     { label: 'INFO',     bg: '#DBEAFE', fg: '#1E40AF' },
};

const STATUS_LABEL: Record<FindingStatus, string> = {
  open:           'offen',
  acknowledged:   'bestätigt',
  fixed:          'behoben (zu prüfen)',
  false_positive: 'kein Treffer',
  ignored:        'akzeptiertes Risiko',
  resolved:       'geschlossen',
};

const GRADE_COLOR: Record<ComplianceGrade, string> = {
  A: '#15803D',
  B: '#65A30D',
  C: '#CA8A04',
  D: '#EA580C',
  F: '#B91C1C',
};

// Compact, internal styles. Inherits from baseStyles where reasonable;
// extends with table + severity-pill specific shapes used only here.
const localStyles = StyleSheet.create({
  scoreBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    marginTop: 4,
  },
  scoreNumber: {
    fontSize: 56,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1,
  },
  scoreLabel: {
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  gradeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#fff',
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  findingCard: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.rule,
    backgroundColor: '#FAFAFA',
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  findingTitle: {
    fontSize: 10,
    color: COLORS.ink,
    flex: 1,
    fontFamily: 'Helvetica-Bold',
  },
  findingMeta: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 1,
  },
  evidenceLabel: {
    fontSize: 8,
    color: COLORS.brass,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
});

function SeverityPill({ severity }: { severity: FindingSeverity }) {
  const p = SEVERITY_PALETTE[severity];
  return (
    <View style={[localStyles.pill, { backgroundColor: p.bg }]}>
      <Text style={{ color: p.fg, fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
        {p.label}
      </Text>
    </View>
  );
}

function BreakdownPills({ severityBreakdown }: { severityBreakdown: Report['severity_breakdown'] }) {
  const entries = (Object.entries(severityBreakdown) as [FindingSeverity, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => {
      const order: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });
  if (entries.length === 0) {
    return (
      <View style={localStyles.breakdownRow}>
        <Text style={[baseStyles.p, { color: '#15803D' }]}>Keine Befunde.</Text>
      </View>
    );
  }
  return (
    <View style={localStyles.breakdownRow}>
      {entries.map(([sev, n]) => {
        const p = SEVERITY_PALETTE[sev];
        return (
          <View key={sev} style={[localStyles.pill, { backgroundColor: p.bg }]}>
            <Text style={{ color: p.fg, fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
              {n} {p.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function FindingItem({ finding, index }: { finding: ReportFinding; index: number }) {
  return (
    <View style={localStyles.findingCard} wrap={false}>
      <View style={localStyles.findingHeader}>
        <Text style={[baseStyles.small, { color: COLORS.muted, width: 18 }]}>
          #{index + 1}
        </Text>
        <SeverityPill severity={finding.severity} />
        <Text style={localStyles.findingTitle}>{finding.summary}</Text>
      </View>
      <Text style={localStyles.findingMeta}>
        Kategorie: {finding.category} · Status: {STATUS_LABEL[finding.status]} · Detektor: {finding.detector}
      </Text>
      {finding.evidence ? (
        <Text style={localStyles.evidenceLabel}>
          Beleg: {evidenceRefLabel(finding.evidence)}
        </Text>
      ) : null}
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr`;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

export interface ReportTemplateProps {
  payload: ReportPayload;
  /** Display label for the scanned subject (domain or tenant name).
   *  Defaults to website_id or scan_run_id if not provided. */
  subjectLabel?: string;
}

export function ReportTemplate({ payload, subjectLabel }: ReportTemplateProps) {
  const { report, scan_run, all_findings, evidence_catalog } = payload;
  const subject = subjectLabel
    ?? report.website_id
    ?? report.scan_run_id;
  const gradeColor = GRADE_COLOR[report.grade];

  // For the footer signature — we don't have a DocMeta for compliance
  // reports, build a minimal one inline.
  const docMeta = {
    company:      subject,
    address:      '',
    contactEmail: '',
    generatedAt:  new Date().toISOString(),
  };

  return (
    <Document
      title={`Compliance-Report — ${subject}`}
      author="RealSyncDynamics.AI"
      subject={`Compliance-Scan vom ${formatDate(report.scanned_at)}`}
    >
      {/* PAGE 1 — Cover + score + breakdowns */}
      <PdfPage>
        <PdfHeader docTitle="Compliance-Report" />

        <Text style={baseStyles.eyebrow}>Auditierbare Zusammenfassung</Text>
        <Text style={baseStyles.h1}>Compliance-Report</Text>
        <Text style={baseStyles.lead}>
          Detektor: {report.detector} · Subjekt: {subject}
        </Text>

        <View style={localStyles.scoreBlock}>
          <View>
            <Text style={[localStyles.scoreNumber, { color: gradeColor }]}>
              {report.score}
            </Text>
            <Text style={localStyles.scoreLabel}>von 100 Punkten</Text>
          </View>
          <View>
            <View style={[localStyles.gradeBadge, { backgroundColor: gradeColor }]}>
              <Text>{report.grade}</Text>
            </View>
            <Text style={[localStyles.scoreLabel, { textAlign: 'center', marginTop: 4 }]}>
              Note
            </Text>
          </View>
        </View>

        <Text style={baseStyles.h2}>Schweregrad-Verteilung</Text>
        <BreakdownPills severityBreakdown={report.severity_breakdown} />

        <Text style={baseStyles.h2}>Übersicht</Text>
        <View style={baseStyles.panel}>
          <Text style={[baseStyles.p, { marginBottom: 4 }]}>
            Scan-ID: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{report.scan_run_id}</Text>
          </Text>
          <Text style={[baseStyles.p, { marginBottom: 4 }]}>
            Scan-Zeitpunkt: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatDate(report.scanned_at)}</Text>
          </Text>
          <Text style={[baseStyles.p, { marginBottom: 4 }]}>
            Dauer: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatDuration(report.duration_ms)}</Text>
          </Text>
          <Text style={baseStyles.p}>
            Befunde gesamt: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{report.total_findings}</Text>
          </Text>
        </View>

        {report.top_findings.length > 0 ? (
          <>
            <Text style={baseStyles.h2}>
              Wichtigste Befunde (Top {report.top_findings.length})
            </Text>
            {report.top_findings.map((f, i) => (
              <FindingItem key={f.id} finding={f} index={i} />
            ))}
          </>
        ) : (
          <View style={baseStyles.panel}>
            <Text style={baseStyles.p}>
              Keine Befunde dieses Scans. Der Detektor hat keine Compliance-Verletzungen erkannt.
            </Text>
          </View>
        )}

        <PdfFooter meta={docMeta} />
      </PdfPage>

      {/* PAGE 2 — All findings (if more than top N) + evidence catalog */}
      {(all_findings.length > report.top_findings.length || evidence_catalog.length > 0) ? (
        <PdfPage>
          <PdfHeader docTitle="Compliance-Report — Details" />

          {all_findings.length > report.top_findings.length ? (
            <>
              <Text style={baseStyles.h2}>
                Alle Befunde ({all_findings.length})
              </Text>
              {all_findings.map((f, i) => (
                <FindingItem
                  key={f.id}
                  index={i}
                  finding={{
                    id:           f.id,
                    category:     f.category,
                    severity:     f.severity,
                    status:       f.status,
                    detector:     f.detector,
                    summary:      f.summary,
                    evidence:     null,  // detail listing intentionally omits evidence
                    confidence_score:    f.confidence_score,
                    evidence_level:      f.evidence_level,
                    verification_status: f.verification_status,
                    created_at:   f.created_at,
                  }}
                />
              ))}
            </>
          ) : null}

          {evidence_catalog.length > 0 ? (
            <>
              <Text style={baseStyles.h2}>
                Beleg-Verzeichnis ({evidence_catalog.length})
              </Text>
              {evidence_catalog.map((e, i) => (
                <View key={i} style={localStyles.findingCard} wrap={false}>
                  <Text style={[baseStyles.p, { marginBottom: 2 }]}>
                    {evidenceRefLabel(e.ref)}
                  </Text>
                  <Text style={baseStyles.small}>
                    Belegt {e.supports.length} {e.supports.length === 1 ? 'Befund' : 'Befunde'}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          <PdfFooter meta={docMeta} />
        </PdfPage>
      ) : null}

      {/* FINAL PAGE — Disclaimer + methodology stamp */}
      <PdfPage>
        <PdfHeader docTitle="Compliance-Report — Methodik" />

        <Text style={baseStyles.h2}>Methodik</Text>
        <Text style={baseStyles.p}>
          Dieser Bericht wurde durch die RealSyncDynamics.AI-Compliance-Engine erstellt.
          Detektor: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{report.detector}</Text>.
          Score-Berechnung gewichtet Befunde nach Schweregrad
          (kritisch −20, hoch −10, mittel −5, niedrig −2, info 0);
          Befunde im Status „kein Treffer", „akzeptiertes Risiko" oder
          „geschlossen" werden nicht eingerechnet; „behoben (zu prüfen)"
          wird zu 50 % gewichtet. Note-Schwellen: A ≥ 90, B ≥ 75, C ≥ 60,
          D ≥ 40, F &lt; 40.
        </Text>

        <Text style={baseStyles.h2}>Reproduzierbarkeit</Text>
        <Text style={baseStyles.p}>
          Dieser Bericht ist Scan-ID-eindeutig: identische Eingaben
          erzeugen denselben Score und dieselben Befunde. Belege werden
          im Beleg-Verzeichnis durch ihren Referenz-Identifier (URL,
          SHA-256, Storage-Pfad oder Event-ID) festgehalten und sind
          unabhängig vom Bericht prüfbar.
        </Text>

        <Text style={baseStyles.h2}>Korrelations-Identifier</Text>
        <Text style={[baseStyles.p, { fontFamily: 'Helvetica-Bold' }]}>
          {scan_run.correlation_id ?? '—'}
        </Text>
        <Text style={baseStyles.small}>
          Verwenden Sie diesen Identifier, um diesen Scan im
          Runtime-Event-Log und im LLM-Anfrage-Log zu verfolgen.
        </Text>

        <PdfDisclaimer />

        <Text style={[baseStyles.small, { marginTop: 12, color: COLORS.muted }]}>
          Methodik-Version: {DOCS_VERSION} · Engine-Build verifizierbar
          gegen Git-SHA des öffentlichen Repositories.
        </Text>

        <PdfFooter meta={docMeta} />
      </PdfPage>
    </Document>
  );
}
