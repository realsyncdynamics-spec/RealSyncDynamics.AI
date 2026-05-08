import { Document, Text, View } from '@react-pdf/renderer';
import {
  baseStyles, Bullet, DocMeta, PdfDisclaimer, PdfFooter, PdfHeader, PdfPage,
} from '../shared';

/**
 * Auftragsverarbeitungsvertrag (AVV) — Art. 28 DSGVO Standardklauseln.
 * Auftraggeber-Daten kommen aus DocMeta. Auftragnehmer-Felder bleiben
 * Platzhalter („wird ergänzt durch Vertragspartner") — der AVV wird
 * im realen Gebrauch zwischen zwei Parteien ausgefertigt.
 */
export function AVVTemplate({ meta }: { meta: DocMeta }) {
  return (
    <Document
      title={`AVV — ${meta.company}`}
      author="RealSyncDynamics.AI"
      subject="DSGVO Art. 28 Auftragsverarbeitungsvertrag"
    >
      <PdfPage>
        <PdfHeader docTitle="Auftragsverarbeitungsvertrag" />

        <Text style={baseStyles.eyebrow}>Art. 28 DSGVO</Text>
        <Text style={baseStyles.h1}>Auftragsverarbeitungsvertrag (AVV)</Text>
        <Text style={baseStyles.lead}>
          Zwischen Auftraggeber und Auftragnehmer
        </Text>

        <Text style={baseStyles.h2}>1. Vertragsparteien</Text>
        <Text style={baseStyles.h3}>Auftraggeber (Verantwortlicher):</Text>
        <Text style={baseStyles.p}>{meta.company}</Text>
        <Text style={baseStyles.p}>{meta.address}</Text>
        <Text style={baseStyles.p}>E-Mail: {meta.contactEmail}</Text>

        <Text style={baseStyles.h3}>Auftragnehmer (Auftragsverarbeiter):</Text>
        <Text style={baseStyles.p}>[Name + Anschrift wird ergänzt]</Text>

        <Text style={baseStyles.h2}>2. Gegenstand und Dauer</Text>
        <Text style={baseStyles.p}>
          Gegenstand des Auftrags ist die Verarbeitung personenbezogener Daten im Auftrag des
          Auftraggebers nach Art. 28 DSGVO. Die Dauer richtet sich nach dem Hauptvertrag.
        </Text>

        <Text style={baseStyles.h2}>3. Art und Zweck der Verarbeitung</Text>
        <Text style={baseStyles.p}>
          [Bitte ergänzen: konkrete Art der Verarbeitung — z. B. Hosting, Wartung, Support,
          Cloud-Speicher.]
        </Text>

        <Text style={baseStyles.h2}>4. Art der Daten und Kategorien betroffener Personen</Text>
        <Bullet>Stammdaten (Name, Anschrift, Kontaktdaten)</Bullet>
        <Bullet>Vertrags- und Abrechnungsdaten</Bullet>
        <Bullet>Nutzungsdaten / Log-Daten</Bullet>
        <Bullet>[bitte konkrete Kategorien ergänzen]</Bullet>

        <Text style={baseStyles.h3}>Kategorien betroffener Personen:</Text>
        <Bullet>Kunden / Nutzer / Beschäftigte / Lieferanten [auswählen]</Bullet>

        <Text style={baseStyles.h2}>5. Pflichten des Auftragnehmers</Text>
        <Bullet>Verarbeitung ausschließlich auf dokumentierte Weisung (Art. 28 Abs. 3 lit. a)</Bullet>
        <Bullet>Vertraulichkeitsverpflichtung der mit der Verarbeitung befassten Personen</Bullet>
        <Bullet>Technisch-organisatorische Maßnahmen nach Art. 32 (siehe TOM-Anhang)</Bullet>
        <Bullet>Unterstützung bei Betroffenenrechten (Art. 15 ff.)</Bullet>
        <Bullet>Unterstützung bei Pflichten aus Art. 32–36 (Sicherheit, DSFA, Meldung)</Bullet>
        <Bullet>Löschung oder Rückgabe der Daten nach Vertragsende</Bullet>
        <Bullet>Nachweispflichten (Art. 28 Abs. 3 lit. h)</Bullet>

        <Text style={baseStyles.h2}>6. Sub-Auftragsverarbeiter</Text>
        <Text style={baseStyles.p}>
          Der Auftragnehmer darf Sub-Auftragsverarbeiter nur mit vorheriger Genehmigung des
          Auftraggebers einsetzen. Bei einer allgemeinen Genehmigung informiert der
          Auftragnehmer den Auftraggeber rechtzeitig über jede Änderung.
        </Text>

        <Text style={baseStyles.h2}>7. Rechte des Auftraggebers</Text>
        <Text style={baseStyles.p}>
          Der Auftraggeber hat das Recht zur Kontrolle der Einhaltung dieses Vertrages durch
          den Auftragnehmer (Art. 28 Abs. 3 lit. h). Dies umfasst Inspektionen vor Ort sowie
          die Anforderung von Nachweisen / Zertifikaten.
        </Text>

        <Text style={baseStyles.h2}>8. Drittlandtransfer</Text>
        <Text style={baseStyles.p}>
          Eine Übermittlung personenbezogener Daten in Drittländer (außerhalb EU/EWR) erfolgt
          nur auf Grundlage eines Angemessenheitsbeschlusses, geeigneter Garantien (z. B.
          Standardvertragsklauseln) oder einer Ausnahme nach Art. 49 DSGVO.
        </Text>

        <Text style={baseStyles.h2}>9. Haftung</Text>
        <Text style={baseStyles.p}>
          Es gelten die Haftungsregelungen aus Art. 82 DSGVO sowie ergänzend die Bestimmungen
          des Hauptvertrages.
        </Text>

        <Text style={baseStyles.h2}>10. Schlussbestimmungen</Text>
        <Text style={baseStyles.p}>
          Änderungen oder Ergänzungen bedürfen der Schriftform. Sollten einzelne Bestimmungen
          unwirksam sein, bleibt die Wirksamkeit des Vertrags im Übrigen unberührt.
        </Text>

        <View style={baseStyles.rule} />
        <PdfDisclaimer />
        <PdfFooter meta={meta} />
      </PdfPage>
    </Document>
  );
}
