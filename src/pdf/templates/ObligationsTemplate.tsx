import { Document, Text, View } from '@react-pdf/renderer';
import { baseStyles, COLORS, PdfFooter, PdfHeader, PdfPage, type DocMeta } from '../shared';

/**
 * Pflichtenübersicht aus „Ihre Pflichten heute" (Command Center).
 * Inhalt kommt vollständig aus dem Aufrufer: abgeleitete Pflichten plus
 * Status. Das Template erfindet nichts und bewertet nichts.
 */
export interface ObligationsPdfRow {
  title: string;
  kindLabel: string;
  basis: string;
  since?: string;
  because: string;
  statusLabel: string;
  statusDetail: string;
}

export interface ObligationsTemplateProps {
  company: string;
  generatedAt: string;
  doneCount: number;
  rows: ObligationsPdfRow[];
  /** Selbstauskunft in Klartext, z. B. „KI: OpenAI · Daten: Kundendaten". */
  basisSummary: string[];
}

export function ObligationsTemplate(
  { company, generatedAt, doneCount, rows, basisSummary }: ObligationsTemplateProps,
) {
  const meta: DocMeta = { company, address: '', contactEmail: '', generatedAt };
  return (
    <Document
      title={`KI-Pflichtenübersicht — ${company}`}
      author="RealSyncDynamics.AI"
      subject="Pflichten nach KI-VO und DSGVO aus der Selbstauskunft"
    >
      <PdfPage>
        <PdfHeader docTitle="KI-Pflichtenübersicht" />

        <Text style={baseStyles.eyebrow}>KI-VO · DSGVO</Text>
        <Text style={baseStyles.h1}>Pflichtenübersicht KI-Einsatz</Text>
        <Text style={baseStyles.lead}>
          {company} · {doneCount} von {rows.length} erledigt
        </Text>

        <Text style={baseStyles.h3}>Grundlage: Ihre Angaben</Text>
        {basisSummary.map((line) => (
          <Text key={line} style={baseStyles.p}>{line}</Text>
        ))}

        <View style={baseStyles.rule} />

        {rows.map((r, i) => (
          <View key={`${i}-${r.title}`} wrap={false} style={{ marginBottom: 10 }}>
            <Text style={[baseStyles.small, { color: COLORS.brass, fontFamily: 'Helvetica-Bold' }]}>
              {r.kindLabel.toUpperCase()} · {r.statusLabel.toUpperCase()}
            </Text>
            <Text style={[baseStyles.p, { color: COLORS.ink, fontFamily: 'Helvetica-Bold', marginBottom: 2 }]}>
              {r.title}
            </Text>
            <Text style={baseStyles.small}>
              {r.basis}{r.since ? ` · ${r.since}` : ''} · {r.because}
            </Text>
            <Text style={baseStyles.small}>Status: {r.statusDetail}</Text>
          </View>
        ))}

        <View style={baseStyles.panel}>
          <Text style={[baseStyles.small, { color: COLORS.ink2 }]}>
            Hinweis: Diese Übersicht wurde regelbasiert aus Ihrer Selbstauskunft und den im
            Workspace erfassten Daten erzeugt. „Automatisch erkannt" beruht auf
            Einträgen im Workspace, „von Ihnen markiert" auf Ihrer eigenen Angabe. Sie ist ein
            Arbeitsstand, keine Rechtsberatung und keine Bestätigung der Rechtskonformität.
          </Text>
        </View>
        <PdfFooter meta={meta} />
      </PdfPage>
    </Document>
  );
}
