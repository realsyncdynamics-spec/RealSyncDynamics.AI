import { Document, Text, View } from '@react-pdf/renderer';
import {
  baseStyles, Bullet, DocMeta, PdfDisclaimer, PdfFooter, PdfHeader, PdfPage,
} from '../shared';

/**
 * Technisch-organisatorische Maßnahmen (TOMs) — Art. 32 DSGVO.
 * 8 Standard-Kategorien analog BSI-Grundschutz / KMU-Praxis.
 */
const SECTIONS: Array<{ title: string; bullets: string[] }> = [
  {
    title: '1. Vertraulichkeit (Art. 32 Abs. 1 lit. b)',
    bullets: [
      'Zutrittskontrolle: Schlüssel- / Chip-Konzept, Besucher-Begleitung, Alarmanlage',
      'Zugangskontrolle: Personalisierte Accounts, MFA, Passwort-Policy (≥ 12 Zeichen)',
      'Zugriffskontrolle: Berechtigungs-Konzept Need-to-know, regelmäßige Review',
      'Trennungskontrolle: Mandantentrennung, getrennte Test-/Prod-Umgebungen',
      'Pseudonymisierung wo möglich (z. B. Logfiles ohne Klar-IP)',
    ],
  },
  {
    title: '2. Integrität (Art. 32 Abs. 1 lit. b)',
    bullets: [
      'Eingabekontrolle: Logging aller Schreibzugriffe inkl. User-ID',
      'Weitergabekontrolle: TLS 1.3 in Transit, dokumentierte Schnittstellen',
      'Datenträger-Verschlüsselung (LUKS / FileVault / BitLocker) für mobile Geräte',
    ],
  },
  {
    title: '3. Verfügbarkeit und Belastbarkeit (Art. 32 Abs. 1 lit. b)',
    bullets: [
      'Backup-Konzept: tägliche Backups, geo-redundant, 30-Tage-Retention',
      'USV / Redundanz auf Datacenter-Ebene (Provider-SLA)',
      'Incident-Response-Plan, Quartalsweise Notfall-Übung',
    ],
  },
  {
    title: '4. Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung (Art. 32 Abs. 1 lit. d)',
    bullets: [
      'Datenschutz-Management-System mit jährlichem Review',
      'Externe Penetrationstests mind. alle 24 Monate',
      'Mitarbeiterschulungen mind. jährlich, dokumentiert',
    ],
  },
  {
    title: '5. Auftragskontrolle',
    bullets: [
      'AVV mit allen Auftragsverarbeitern abgeschlossen',
      'Sub-Processor-Liste aktiv geführt + öffentlich einsehbar',
      'Drittland-Bewertung pro Provider dokumentiert',
    ],
  },
  {
    title: '6. Datenschutzfreundliche Voreinstellungen (Art. 25 DSGVO)',
    bullets: [
      'Privacy by Design + Privacy by Default in Produkt-Entwicklung',
      'Cookie-Banner mit echter Wahlfreiheit (TDDDG § 25)',
      'Minimal-Data-Prinzip in Formularen',
    ],
  },
  {
    title: '7. Meldewesen Datenschutzvorfälle (Art. 33 / 34)',
    bullets: [
      '72-Stunden-Meldekette dokumentiert',
      'Eskalations-Matrix Mitarbeiter → DSB → Aufsichtsbehörde',
      'Vorfall-Logbuch mit Volltext-Beschreibung + Maßnahmen',
    ],
  },
  {
    title: '8. Schulung und Awareness',
    bullets: [
      'Onboarding-Module für neue Mitarbeiter mit Datenschutz-Pflichteinheit',
      'Phishing-Simulationen mind. quartalsweise',
      'Datenschutz-Wiki / FAQ intern verfügbar',
    ],
  },
];

export function TOMTemplate({ meta }: { meta: DocMeta }) {
  return (
    <Document
      title={`TOM-Dokumentation — ${meta.company}`}
      author="RealSyncDynamics.AI"
      subject="DSGVO Art. 32 Technisch-organisatorische Maßnahmen"
    >
      <PdfPage>
        <PdfHeader docTitle="Technisch-organisatorische Maßnahmen" />

        <Text style={baseStyles.eyebrow}>Art. 32 DSGVO</Text>
        <Text style={baseStyles.h1}>Technisch-organisatorische Maßnahmen (TOM)</Text>
        <Text style={baseStyles.lead}>
          Verantwortlicher: {meta.company}{meta.domain ? ` · ${meta.domain}` : ''}
        </Text>

        <Text style={baseStyles.p}>
          Die nachfolgenden Maßnahmen sichern die Vertraulichkeit, Integrität, Verfügbarkeit
          und Belastbarkeit der Verarbeitungssysteme im Sinne von Art. 32 DSGVO.
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.title} wrap={false}>
            <Text style={baseStyles.h2}>{s.title}</Text>
            {s.bullets.map((b, i) => <Bullet key={`${s.title}-${i}`}>{b}</Bullet>)}
          </View>
        ))}

        <Text style={baseStyles.h2}>Kontakt für Rückfragen</Text>
        <Text style={baseStyles.p}>{meta.company} · {meta.contactEmail}</Text>
        {meta.dpo && (
          <Text style={baseStyles.p}>Datenschutzbeauftragter: {meta.dpo.name} ({meta.dpo.email})</Text>
        )}

        <PdfDisclaimer />
        <PdfFooter meta={meta} />
      </PdfPage>
    </Document>
  );
}
