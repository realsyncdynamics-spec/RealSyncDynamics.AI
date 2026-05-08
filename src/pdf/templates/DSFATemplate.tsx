import { Document, Text, View } from '@react-pdf/renderer';
import {
  baseStyles, Bullet, DocMeta, PdfDisclaimer, PdfFooter, PdfHeader, PdfPage,
} from '../shared';

/**
 * Datenschutz-Folgenabschätzung (DSFA) — Art. 35 DSGVO.
 * V1: Schablone mit den 4 Pflichtinhalten aus Art. 35 Abs. 7. Konkrete
 * Risiken bleiben Platzhalter — DSFA ist immer use-case-spezifisch.
 */
export function DSFATemplate({ meta }: { meta: DocMeta }) {
  return (
    <Document
      title={`DSFA — ${meta.company}`}
      author="RealSyncDynamics.AI"
      subject="DSGVO Art. 35 Datenschutz-Folgenabschätzung"
    >
      <PdfPage>
        <PdfHeader docTitle="Datenschutz-Folgenabschätzung" />

        <Text style={baseStyles.eyebrow}>Art. 35 DSGVO</Text>
        <Text style={baseStyles.h1}>Datenschutz-Folgenabschätzung (DSFA)</Text>
        <Text style={baseStyles.lead}>
          Verantwortlicher: {meta.company}{meta.domain ? ` · ${meta.domain}` : ''}
        </Text>

        <Text style={baseStyles.h2}>1. Beschreibung der Verarbeitung (Art. 35 Abs. 7 lit. a)</Text>
        <Text style={baseStyles.h3}>Bezeichnung des Verarbeitungsvorgangs:</Text>
        <Text style={baseStyles.p}>[Bitte ergänzen — z. B. „Bewerber-Screening mit KI-Unterstützung"]</Text>
        <Text style={baseStyles.h3}>Zweck:</Text>
        <Text style={baseStyles.p}>[Bitte ergänzen]</Text>
        <Text style={baseStyles.h3}>Beteiligte Systeme:</Text>
        <Text style={baseStyles.p}>[Bitte ergänzen — Tools, Cloud-Services, ggf. AI-Modelle]</Text>
        <Text style={baseStyles.h3}>Datenkategorien:</Text>
        <Bullet>Stammdaten</Bullet>
        <Bullet>Beschäftigtendaten / Bewerberdaten</Bullet>
        <Bullet>Bewertungs- / Profiling-Ergebnisse</Bullet>

        <Text style={baseStyles.h2}>2. Notwendigkeit und Verhältnismäßigkeit (Art. 35 Abs. 7 lit. b)</Text>
        <Text style={baseStyles.p}>
          Die Verarbeitung ist erforderlich zur [Zweck einsetzen]. Eine weniger eingriffsintensive
          Alternative wurde geprüft und [verworfen / angenommen], weil [Begründung].
        </Text>

        <Text style={baseStyles.h2}>3. Risiken für Betroffene (Art. 35 Abs. 7 lit. c)</Text>
        <Text style={baseStyles.h3}>Identifizierte Risiken:</Text>
        <Bullet>Diskriminierung durch unausgewogene Trainingsdaten (bei AI-Systemen)</Bullet>
        <Bullet>Profilbildung mit Auswirkung auf Lebensentscheidungen (Bewerbung, Bonität)</Bullet>
        <Bullet>Sekundärnutzung außerhalb des ursprünglichen Zwecks</Bullet>
        <Bullet>Verlust der Datenkontrolle bei Sub-Processor-Kette</Bullet>
        <Bullet>[Weitere use-case-spezifische Risiken ergänzen]</Bullet>

        <Text style={baseStyles.h3}>Risiko-Bewertung:</Text>
        <Text style={baseStyles.p}>
          Eintrittswahrscheinlichkeit: [niedrig / mittel / hoch] · Schwere: [niedrig / mittel / hoch]
        </Text>

        <Text style={baseStyles.h2}>4. Abhilfemaßnahmen (Art. 35 Abs. 7 lit. d)</Text>
        <Text style={baseStyles.h3}>Technisch:</Text>
        <Bullet>Pseudonymisierung / Anonymisierung wo möglich</Bullet>
        <Bullet>Verschlüsselung in Transit (TLS 1.3) und at-rest (AES-256)</Bullet>
        <Bullet>Logging aller Schreib-/Lese-Zugriffe</Bullet>

        <Text style={baseStyles.h3}>Organisatorisch:</Text>
        <Bullet>Need-to-know-Berechtigungen + regelmäßige Review</Bullet>
        <Bullet>Mitarbeiterschulung zum konkreten Verarbeitungsvorgang</Bullet>
        <Bullet>Human-in-the-Loop bei automatisierten Entscheidungen (Art. 22)</Bullet>

        <Text style={baseStyles.h3}>Bei AI-Systemen zusätzlich (EU AI Act):</Text>
        <Bullet>Annex-III-Klassifikation dokumentiert</Bullet>
        <Bullet>Human Oversight nach Art. 14 AI Act</Bullet>
        <Bullet>Conformity Assessment falls High-Risk</Bullet>
        <Bullet>Bias-Testing der Trainingsdaten dokumentiert</Bullet>

        <Text style={baseStyles.h2}>5. Konsultation</Text>
        <Text style={baseStyles.p}>
          Datenschutzbeauftragte:r: {meta.dpo ? `${meta.dpo.name} (${meta.dpo.email})` : '[Bitte ergänzen]'}
        </Text>
        <Text style={baseStyles.p}>
          Bei verbleibendem hohen Risiko: Konsultation der Aufsichtsbehörde nach Art. 36 DSGVO.
        </Text>

        <View style={baseStyles.rule} />

        <Text style={baseStyles.h2}>Ergebnis und Freigabe</Text>
        <Text style={baseStyles.p}>
          Verarbeitung [zulässig / zulässig mit Auflagen / unzulässig]. Begründung: [ergänzen].
          Wiedervorlage: jährlich oder bei wesentlichen Änderungen.
        </Text>

        <Text style={baseStyles.p}>{meta.company} · {meta.contactEmail}</Text>

        <PdfDisclaimer />
        <PdfFooter meta={meta} />
      </PdfPage>
    </Document>
  );
}
