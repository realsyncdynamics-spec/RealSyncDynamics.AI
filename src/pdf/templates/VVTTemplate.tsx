import { Document, Text, View } from '@react-pdf/renderer';
import {
  baseStyles, Bullet, DocMeta, PdfDisclaimer, PdfFooter, PdfHeader, PdfPage,
} from '../shared';

/**
 * Verzeichnis der Verarbeitungstätigkeiten (VVT) — Art. 30 DSGVO.
 * V1: Schablone mit drei Standard-Verarbeitungen (Website-Logs, Kontakt-
 * formular, Marketing-Newsletter). Im realen Gebrauch werden weitere
 * Tätigkeiten ergänzt.
 */
export function VVTTemplate({ meta }: { meta: DocMeta }) {
  return (
    <Document
      title={`Verzeichnis der Verarbeitungstätigkeiten — ${meta.company}`}
      author="RealSyncDynamics.AI"
      subject="DSGVO Art. 30 VVT"
    >
      <PdfPage>
        <PdfHeader docTitle="Verzeichnis der Verarbeitungstätigkeiten" />

        <Text style={baseStyles.eyebrow}>Art. 30 DSGVO</Text>
        <Text style={baseStyles.h1}>Verzeichnis der Verarbeitungstätigkeiten</Text>
        <Text style={baseStyles.lead}>
          Verantwortlicher: {meta.company}{meta.domain ? ` · ${meta.domain}` : ''}
        </Text>

        <Text style={baseStyles.h2}>Verantwortlicher</Text>
        <Text style={baseStyles.p}>{meta.company}, {meta.address}</Text>
        <Text style={baseStyles.p}>Kontakt: {meta.contactEmail}</Text>
        {meta.dpo && (
          <Text style={baseStyles.p}>Datenschutzbeauftragter: {meta.dpo.name} ({meta.dpo.email})</Text>
        )}

        {/* Eintrag 1 */}
        <Text style={baseStyles.h2}>1. Website-Betrieb und Logfiles</Text>
        <Text style={baseStyles.h3}>Zweck:</Text>
        <Text style={baseStyles.p}>Bereitstellung der Website, Stabilität und IT-Sicherheit.</Text>
        <Text style={baseStyles.h3}>Rechtsgrundlage:</Text>
        <Text style={baseStyles.p}>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).</Text>
        <Text style={baseStyles.h3}>Datenkategorien:</Text>
        <Bullet>IP-Adresse, User-Agent, Referer, Zeitstempel</Bullet>
        <Text style={baseStyles.h3}>Empfängerkategorien:</Text>
        <Bullet>{`${meta.hostingProvider ?? '[Hosting-Provider]'} (Auftragsverarbeiter)`}</Bullet>
        <Text style={baseStyles.h3}>Speicherdauer:</Text>
        <Text style={baseStyles.p}>7 Tage rolling, danach automatische Löschung.</Text>
        <Text style={baseStyles.h3}>Drittlandtransfer:</Text>
        <Text style={baseStyles.p}>Nein (innerhalb EU/EWR).</Text>

        <View style={baseStyles.rule} />

        {/* Eintrag 2 */}
        <Text style={baseStyles.h2}>2. Kontaktformular / Anfragebearbeitung</Text>
        <Text style={baseStyles.h3}>Zweck:</Text>
        <Text style={baseStyles.p}>Bearbeitung eingehender Anfragen über das Kontaktformular.</Text>
        <Text style={baseStyles.h3}>Rechtsgrundlage:</Text>
        <Text style={baseStyles.p}>Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) oder lit. f.</Text>
        <Text style={baseStyles.h3}>Datenkategorien:</Text>
        <Bullet>Name, E-Mail, Anfragetext, optional Telefon</Bullet>
        <Text style={baseStyles.h3}>Empfängerkategorien:</Text>
        <Bullet>Email-Hosting-Provider, intern: zuständige Mitarbeiter</Bullet>
        <Text style={baseStyles.h3}>Speicherdauer:</Text>
        <Text style={baseStyles.p}>Bis Anfrage abgearbeitet, danach gemäß Aufbewahrungspflichten.</Text>

        <View style={baseStyles.rule} />

        {/* Eintrag 3 */}
        <Text style={baseStyles.h2}>3. Newsletter / E-Mail-Marketing</Text>
        <Text style={baseStyles.h3}>Zweck:</Text>
        <Text style={baseStyles.p}>Versand redaktioneller Newsletter und Produkt-Updates.</Text>
        <Text style={baseStyles.h3}>Rechtsgrundlage:</Text>
        <Text style={baseStyles.p}>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Double-Opt-In.</Text>
        <Text style={baseStyles.h3}>Datenkategorien:</Text>
        <Bullet>E-Mail-Adresse, Anrede, Klick-/Öffnungs-Statistiken</Bullet>
        <Text style={baseStyles.h3}>Empfängerkategorien:</Text>
        <Bullet>[Newsletter-Provider, z. B. CleverReach / Mailjet] (Auftragsverarbeiter)</Bullet>
        <Text style={baseStyles.h3}>Speicherdauer:</Text>
        <Text style={baseStyles.p}>Bis zum Widerruf der Einwilligung.</Text>

        <Text style={baseStyles.h2}>Weitere Tätigkeiten</Text>
        <Text style={baseStyles.p}>
          [Bitte ergänzen: Bewerbungen, Bestell- / Vertragsabwicklung, Buchhaltung,
          Produktanalytik, Kundensupport-Tickets, Personalverwaltung etc.]
        </Text>

        <View style={baseStyles.rule} />

        <Text style={baseStyles.h2}>Technisch-organisatorische Maßnahmen</Text>
        <Text style={baseStyles.p}>
          Eine Beschreibung der technischen und organisatorischen Maßnahmen i. S. d. Art. 32
          DSGVO findet sich in der TOM-Dokumentation (separates Dokument).
        </Text>

        <PdfDisclaimer />
        <PdfFooter meta={meta} />
      </PdfPage>
    </Document>
  );
}
