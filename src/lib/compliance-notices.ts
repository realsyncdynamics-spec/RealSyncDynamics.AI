/**
 * Zentralisierte Compliance-Hinweise und Legal-Texte
 *
 * Diese Datei enthält alle gesetzlich erforderlichen Hinweise für:
 * - DSGVO (Datenschutz)
 * - EU AI Act (KI-Governance)
 * - UG (haftungsbeschränkt) Rechtsform
 *
 * Alle Texte sollten zentral von hier aus konsumiert werden.
 */

import { COMPANY, getCompanyDisplayName, getCompanyAddress } from '../config/company';

// ─── DSGVO Hinweise ─────────────────────────────────────────────────────────

export const DSGVO_COMPLIANCE_NOTICE = `
RealSync Dynamics AI ist eine Compliance-Support-Plattform für technische und
organisatorische Maßnahmen. Die Plattform liefert KEINE Rechtsberatung.

Alle Audit-Ergebnisse, Risikobewertungen und Empfehlungen dienen der
unterstützenden Analyse. Letzte Entscheidungen und Verantwortung liegen
beim Betreiber der Website/des Systems.

Für verbindliche Rechtsauskunft, z.B. zur Anwendbarkeit der DSGVO auf Ihren
Betrieb, konsultieren Sie einen Datenschutzbeauftragten oder Rechtsanwalt.
`;

// ─── EU AI Act Transparency Notice ──────────────────────────────────────────

export const EU_AI_ACT_TRANSPARENCY_NOTICE = `
Diese Plattform nutzt KI-Systeme (Sprachmodelle) zur Analyse und
Risikoeinschätzung. Nutzer sollten sich bewusst sein:

1. Automatisierte Entscheidungen treffen keine bindenden Urteile
2. Alle KI-Outputs sind Analysehilfen, keine Garantien
3. Hochrisiko-Szenarien erfordern menschliche Überprüfung
4. Für regulierte Sektoren (Finanz, Gesundheit, etc.) gelten zusätzliche
   Anforderungen — diese Plattform kann diese nicht allein erfüllen

Weitere Informationen: https://ec.europa.eu/commission/ai-act-documents
`;

// ─── UG Specific Legal Notice ──────────────────────────────────────────────

export function getUGLegalNotice(): string {
  return `
Betreiber dieser Plattform:

${getCompanyDisplayName(true)}
${getCompanyAddress()}
E-Mail: ${COMPANY.supportEmail}

Rechtliche Hinweise:
- Diese Plattform wird als ${COMPANY.legalForm} (haftungsbeschränkt) betrieben
- Die Haftung ist auf die Betriebsvermögen der UG beschränkt
- Für die Nutzung der Plattform gelten die Allgemeinen Geschäftsbedingungen (AGB)
`;
}

// ─── Billing & Subscription Legal Notice ─────────────────────────────────

export const BILLING_TERMS_NOTICE = `
Abonnementbedingungen:

1. Automatische Verlängerung: Alle Abos erneuern sich automatisch am Ende
   der Abrechnungsperiode, es sei denn, Sie kündigen vorher.

2. Kündigungsrecht: Sie können Ihr Abo jederzeit kündigen. Die Kündigung wird
   mit Ablauf der aktuellen Abrechnungsperiode wirksam. Es gibt keine Sperrfrist.

3. Probeabo: Falls Sie ein 14-Tage-Probeabo nutzen, wird die Zahlung erst nach
   Ablauf der Probefrist eingezogen. Sie können jederzeit vor Ende der Frist kündigen.

4. Rechnungsstellung: Rechnungen erhalten Sie digital per E-Mail. Sie können
   diese jederzeit in Ihrer Kundenzone einsehen.

5. Datensicherheit: Zahlungsdaten werden über Stripe (PCI-DSS 3.2.1 zertifiziert)
   verarbeitet und nicht von uns gespeichert.

6. Rückgaberecht: Sie haben 14 Tage Widerrufsrecht nach Kaufabschluss, sofern
   der Service noch nicht genutzt wurde.
`;

// ─── Data Processing Notice (for audits and scans) ──────────────────────────

export const DATA_PROCESSING_NOTICE = `
Datenverarbeitung bei Website-Scans:

1. Datenumfang:
   - Website-HTML, CSS, JavaScript
   - Meta-Tags, Cookies und ähnliche Technologien
   - Tracking-Pixel und externe Scripts

2. Speicherung:
   - Scan-Ergebnisse werden in der EU gehostet (Supabase, AWS Frankfurt)
   - Roh-Daten werden gelöscht nach 30 Tagen

3. Ihre Kontrolle:
   - Sie können Scans jederzeit einsehen
   - Export per DSGVO-Datenzugriff möglich
   - Löschung auf Anfrage

4. Nicht gescannt werden:
   - Private Benutzerdaten (Logins, Zahlungsdaten)
   - Content hinter Authentifizierung

5. API-Zugriffe sind auditierbar und werden protokolliert.
`;

// ─── Impressum Text Generator ──────────────────────────────────────────────

export function generateImpressumText(): string {
  const vat = COMPANY.vatId ? `USt-IdNr.: ${COMPANY.vatId}` : 'USt-IdNr.: [noch zu vergeben]';
  const registry = COMPANY.registryEntry
    ? `${COMPANY.registryEntry}`
    : '[Handelsregister-Eintrag: noch zu vergeben]';

  return `
IMPRESSUM
Angaben gemäß § 5 TMG und § 18 MStV:

Betreiber:
${getCompanyDisplayName(true)}
${getCompanyAddress()}

Telefon: ${COMPANY.supportPhoneOptional || '[wird ergänzt]'}
E-Mail: ${COMPANY.supportEmail}
Website: ${COMPANY.website}

Steuernummer & Registrierung:
${vat}
${registry}

Wirtschafts-ID: ${COMPANY.economicId || '[wird durch BZSt vergeben]'}

Vertretungsberechtigung:
Geschäftsführer/in: [Name wird ergänzt]

Haftungshinweis:
Trotz sorgfältiger Prüfung übernehmen wir für die Richtigkeit, Vollständigkeit
und Aktualität der Inhalte keine Haftung. Besonders für externe Links haften
wir nicht für deren Inhalte.

Datenschutz:
siehe ${COMPANY.website}/privacy

Lizenzen & Quellcode:
Diese Plattform basiert auf Open-Source-Komponenten. Siehe ${COMPANY.website}/licenses
`;
}

// ─── Terms of Service Abstract ─────────────────────────────────────────────

export const TERMS_OF_SERVICE_ABSTRACT = `
Allgemeine Geschäftsbedingungen (Kurzfassung):

Die vollständigen Bedingungen finden Sie auf ${COMPANY.website}/terms

1. Angebot & Abschluss
   - Nutzung ab 18 Jahren
   - Konto und Abonnement nach Registrierung
   - Widerrufsrecht: 14 Tage (sofern Service nicht genutzt)

2. Ihre Verpflichtungen
   - Keine illegalen oder unethischen Nutzungen
   - Sie tragen Verantwortung für Ihre Daten
   - Sie dürfen nicht Malware/Exploits verbreiten

3. Unsere Leistungen
   - Compliance-Analysen als Unterstützung, keine Garantie
   - 99,5% Uptime-Ziel (Best Effort, keine SLA außer bei Enterprise)
   - Bug-Fixes nach bestem Wissen

4. Haftung
   - ${COMPANY.legalForm}-Haftungsbegrenzung (Betriebsvermögen)
   - Ausnahme: Produkthaftung, Datenschutzverletzungen (§ 88 GDPR)

5. Kündigung
   - Nutzer jederzeit, ohne Grund
   - Wir können mit 30 Tagen Frist kündigen (Rechtsverletzung, Zahlungsrückstand)

6. Datenschutz
   - Daten werden in der EU verarbeitet
   - DSGVO-konform
   - Siehe ${COMPANY.website}/privacy

7. Änderungen
   - Wir können diese Bedingungen ändern
   - Ankündigung: 30 Tage vorher
   - Weitergenutzung = Annahme der neuen Bedingungen

8. Streitbeilegung
   - Gerichtsstand: Jena, Deutschland
   - Anwendbares Recht: Deutsches Recht
   - Verbraucherschlichtung siehe ${COMPANY.website}/complaints
`;

// ─── Helper: Check if all required legal docs are ready ───────────────────

export function areLegalDocsComplete(): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!COMPANY.vatId) {
    missing.push('USt-IdNr. (Umsatzsteuer-Identifikationsnummer)');
  }
  if (!COMPANY.registryEntry) {
    missing.push('Handelsregister-Eintrag (HRB)');
  }
  if (!COMPANY.supportPhoneOptional) {
    missing.push('Telefonnummer für Impressum');
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

// ─── Helper: Generate a compliance banner for the website ────────────────

export function getComplianceBanner(context: 'free_audit' | 'paid_subscription' | 'checkout'): string {
  const base = `${COMPANY.complianceDisclaimer}`;

  switch (context) {
    case 'free_audit':
      return `${base} Dieser kostenlose Scan ist ein erste Orientierung — für vollständige Analysen nutzen Sie ein Abo.`;

    case 'paid_subscription':
      return `${base} Alle Daten werden verschlüsselt gespeichert und nur mit Ihrer Zustimmung geteilt.`;

    case 'checkout':
      return `${base} Mit dem Kauf akzeptieren Sie unsere AGB und Datenschutzerklärung.`;

    default:
      return base;
  }
}
