import React from 'react';
import { PublicNav } from '../layout/PublicNav';
import { PublicFooter } from '../layout/PublicFooter';

interface LegalSection {
  heading: string;
  body: string[];
}

interface LegalPageProps {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}

function LegalPage({ title, updatedAt, sections }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <PublicNav />
      <section className="border-b border-titanium-800 py-12 lg:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
            Rechtliches
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">{title}</h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
            Stand: {updatedAt}
          </p>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-3xl space-y-10 px-4 sm:px-6 lg:px-8">
          {sections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-display text-lg font-semibold text-titanium-50">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-titanium-400">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export function DatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      updatedAt="Juni 2026"
      sections={[
        {
          heading: '1. Verantwortlicher',
          body: [
            'Verantwortlicher für die Datenverarbeitung auf dieser Plattform ist RealSync Dynamics.AI (Kontaktdaten siehe Impressum). Bei Fragen zum Datenschutz wenden Sie sich an unseren Datenschutzbeauftragten über die im Impressum genannten Kontaktwege.',
          ],
        },
        {
          heading: '2. Datenverarbeitung im Governance OS',
          body: [
            'Im Rahmen der Nutzung des Governance OS verarbeiten wir Konto-, Nutzungs- und Scan-Daten Ihrer registrierten Websites ausschließlich zur Erbringung der vertraglich vereinbarten Compliance-Leistungen.',
            'Alle personenbezogenen Daten werden auf Infrastruktur innerhalb der Europäischen Union verarbeitet und gespeichert. Eine Übermittlung in Drittländer findet nicht statt, sofern nicht ausdrücklich vereinbart und durch geeignete Garantien (z. B. Standardvertragsklauseln) abgesichert.',
          ],
        },
        {
          heading: '3. Rechtsgrundlagen',
          body: [
            'Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Sicherheit und Weiterentwicklung der Plattform) sowie, soweit erforderlich, auf Grundlage Ihrer Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO.',
          ],
        },
        {
          heading: '4. Speicherdauer & Evidence Vault',
          body: [
            'Compliance-Nachweise (Evidence Vault) werden für die Dauer der vertraglichen Aufbewahrungspflichten gespeichert und revisionssicher signiert (C2PA). Nach Vertragsende werden Daten gemäß den gesetzlichen Aufbewahrungsfristen gelöscht oder anonymisiert.',
          ],
        },
        {
          heading: '5. Ihre Rechte',
          body: [
            'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten. Zur Ausübung dieser Rechte wenden Sie sich an die im Impressum genannten Kontaktdaten.',
          ],
        },
        {
          heading: 'Hinweis',
          body: [
            'Diese Seite ist Teil des Klick-Prototyps „Governance OS Browser" (Phase 2) und enthält Platzhaltertexte. Die rechtsverbindliche Datenschutzerklärung der Plattform finden Sie unter /datenschutz.',
          ],
        },
      ]}
    />
  );
}

export function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      updatedAt="Juni 2026"
      sections={[
        {
          heading: 'Angaben gemäß § 5 TMG',
          body: [
            'RealSync Dynamics.AI',
            '[Straße & Hausnummer]',
            '[PLZ & Ort], Deutschland',
          ],
        },
        {
          heading: 'Kontakt',
          body: ['E-Mail: kontakt@realsyncdynamics.ai', 'Telefon: [Telefonnummer]'],
        },
        {
          heading: 'Vertreten durch',
          body: ['[Name der Geschäftsführung]'],
        },
        {
          heading: 'Registereintrag',
          body: ['Eintragung im Handelsregister.', 'Registergericht: [Registergericht]', 'Registernummer: [HRB-Nummer]'],
        },
        {
          heading: 'Umsatzsteuer-ID',
          body: ['Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: [USt-IdNr.]'],
        },
        {
          heading: 'Hinweis',
          body: [
            'Diese Seite ist Teil des Klick-Prototyps „Governance OS Browser" (Phase 2) und enthält Platzhalterangaben. Das rechtsverbindliche Impressum der Plattform finden Sie unter /impressum.',
          ],
        },
      ]}
    />
  );
}
