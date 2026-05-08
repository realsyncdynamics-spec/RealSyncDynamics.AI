import { Document, Text, View } from '@react-pdf/renderer';
import {
  baseStyles, Bullet, DocMeta, PdfDisclaimer, PdfFooter, PdfHeader, PdfPage,
} from '../shared';

/**
 * Datenschutzerklärung — Standard-Template nach Art. 13 + 14 DSGVO.
 * Boilerplate-Struktur, die Eingabedaten einsetzt + Tracker-Befunde
 * aus dem Audit auflistet (falls vorhanden).
 */
export function DSETemplate({ meta }: { meta: DocMeta }) {
  const trackers = meta.trackers ?? [];

  return (
    <Document
      title={`Datenschutzerklärung — ${meta.company}`}
      author="RealSyncDynamics.AI"
      subject="DSGVO Art. 13/14 Datenschutzerklärung"
    >
      <PdfPage>
        <PdfHeader docTitle="Datenschutzerklärung" />

        <Text style={baseStyles.eyebrow}>Art. 13 + 14 DSGVO</Text>
        <Text style={baseStyles.h1}>Datenschutzerklärung</Text>
        <Text style={baseStyles.lead}>
          {meta.company}{meta.domain ? ` · ${meta.domain}` : ''}
        </Text>

        <Text style={baseStyles.h2}>1. Verantwortlicher</Text>
        <Text style={baseStyles.p}>
          Verantwortlicher i. S. d. Art. 4 Nr. 7 DSGVO ist:
        </Text>
        <Text style={baseStyles.p}>{meta.company}</Text>
        <Text style={baseStyles.p}>{meta.address}</Text>
        <Text style={baseStyles.p}>E-Mail: {meta.contactEmail}</Text>

        {meta.dpo && (
          <>
            <Text style={baseStyles.h2}>2. Datenschutzbeauftragter</Text>
            <Text style={baseStyles.p}>
              {meta.dpo.name} — {meta.dpo.email}
            </Text>
          </>
        )}

        <Text style={baseStyles.h2}>{meta.dpo ? '3.' : '2.'} Allgemeine Hinweise zur Datenverarbeitung</Text>
        <Text style={baseStyles.p}>
          Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies
          zur Bereitstellung einer funktionsfähigen Website sowie unserer Inhalte und Leistungen
          erforderlich ist. Rechtsgrundlagen sind in der Regel Art. 6 Abs. 1 lit. a, b oder f DSGVO.
        </Text>

        <Text style={baseStyles.h2}>{meta.dpo ? '4.' : '3.'} Hosting</Text>
        <Text style={baseStyles.p}>
          {meta.hostingProvider
            ? `Diese Website wird gehostet bei: ${meta.hostingProvider}. Mit dem Hoster besteht ein Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO.`
            : 'Hosting-Provider: [bitte ergänzen]. Mit dem Hoster besteht ein Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO.'}
        </Text>

        <Text style={baseStyles.h2}>{meta.dpo ? '5.' : '4.'} Cookies und Tracking</Text>
        <Text style={baseStyles.p}>
          Diese Website verwendet Cookies. Cookies, die für den Betrieb erforderlich sind,
          basieren auf § 25 Abs. 2 Nr. 2 TTDSG. Alle weiteren Cookies werden ausschließlich auf
          Basis Ihrer Einwilligung (§ 25 Abs. 1 TTDSG) gesetzt.
        </Text>

        {trackers.length > 0 && (
          <>
            <Text style={baseStyles.h3}>Eingesetzte Tracker (Stand Audit-Befund):</Text>
            {trackers.map((t, i) => <Bullet key={`tr-${i}`}>{t}</Bullet>)}
          </>
        )}

        <Text style={baseStyles.h2}>{meta.dpo ? '6.' : '5.'} Ihre Rechte</Text>
        <Text style={baseStyles.p}>
          Sie haben jederzeit das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
          (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20)
          und Widerspruch (Art. 21). Wenden Sie sich hierzu an {meta.contactEmail}. Außerdem
          haben Sie ein Beschwerderecht bei der zuständigen Aufsichtsbehörde (Art. 77).
        </Text>

        <Text style={baseStyles.h2}>{meta.dpo ? '7.' : '6.'} Speicherdauer</Text>
        <Text style={baseStyles.p}>
          Personenbezogene Daten werden gelöscht, sobald der Zweck der Verarbeitung entfällt und
          keine gesetzlichen Aufbewahrungsfristen entgegenstehen.
        </Text>

        <View style={baseStyles.rule} />
        <PdfDisclaimer />
        <PdfFooter meta={meta} />
      </PdfPage>
    </Document>
  );
}
