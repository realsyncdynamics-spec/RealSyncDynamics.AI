import { Link } from 'react-router-dom';
import { ArrowLeft, ScrollText } from 'lucide-react';

/**
 * Allgemeine Geschäftsbedingungen (AGB) für die SaaS-Subscriptions.
 *
 * Operativ minimaler, aber konsistenter Stand:
 *   - Geltungsbereich + Vertragspartner
 *   - Vertragsschluss ueber Stripe Checkout (Button-Loesung § 312j BGB)
 *   - Laufzeit + Kuendigung
 *   - Widerrufsrecht B2C (14 Tage)
 *   - Preise + Zahlung (Kleinunternehmer § 19 UStG)
 *   - Verfuegbarkeit + Maintenance
 *   - Haftung
 *   - Datenschutz-Verweis
 *   - Anwendbares Recht + Gerichtsstand
 *
 * Vor Live-Schaltung mit Anwalt reviewen — diese AGB decken den
 * Standard-SaaS-Vertrag ab, aber Sonderfaelle (Enterprise-Custom-Contracts,
 * Reseller, White-Label) brauchen eigene Vertraege.
 */
export function LegalTerms() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
            <ScrollText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Allgemeine Geschäftsbedingungen</div>
            <div className="text-[11px] text-titanium-400 font-medium">Stand 2026-05-19</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-titanium-300 text-sm leading-relaxed">
        <Section title="1. Geltungsbereich und Vertragspartner">
          <p>
            Diese AGB regeln die Nutzung der Software-as-a-Service-Angebote von{' '}
            <strong className="text-titanium-50">RealSync Dynamics</strong>, Schwarzburger Str. 31, 98724 Neuhaus am Rennweg, Deutschland
            (Inhaber: Dominik Steiner; nachfolgend „Anbieter"). Vertragspartner ist die natürliche oder juristische Person, die
            ein kostenpflichtiges Abonnement abschließt (nachfolgend „Kunde").
          </p>
          <p>
            Abweichende oder ergänzende Bedingungen des Kunden gelten nur, wenn der Anbieter ihnen
            ausdrücklich schriftlich zugestimmt hat. Diese AGB gelten in der jeweils zum Zeitpunkt des Vertragsschlusses
            gültigen Fassung.
          </p>
        </Section>

        <Section title="2. Vertragsgegenstand">
          <p>
            Der Anbieter stellt eine cloudbasierte Compliance-Plattform für DSGVO- und EU-AI-Act-Themen bereit (Website-Audits,
            Monitoring, Evidence Vault, Klassifikation von AI-Systemen). Der konkrete Funktionsumfang ergibt sich aus dem
            bei Vertragsschluss gewählten Tarif (Starter, Growth, Agency, Enterprise) gemäß Beschreibung unter{' '}
            <Link to="/pricing" className="text-security-400 hover:underline">/pricing</Link>.
          </p>
          <p>
            Die Plattform ist eine technische Unterstützung. Sie ersetzt keine individuelle Rechtsberatung und keine
            Beauftragung eines Datenschutzbeauftragten, sofern dieser gesetzlich erforderlich ist.
          </p>
        </Section>

        <Section title="3. Vertragsschluss (§ 312j BGB)">
          <p>
            Die Darstellung der Tarife stellt kein bindendes Angebot dar. Der Kunde gibt sein Angebot ab, indem er den
            Bestellprozess über den externen Zahlungsdienstleister Stripe abschließt und den entsprechenden Button mit
            der Beschriftung „zahlungspflichtig bestellen" (oder eine entsprechende eindeutige Formulierung) betätigt.
            Der Vertrag kommt mit Bestätigung durch den Anbieter zustande, spätestens jedoch mit der ersten erfolgreichen
            Abbuchung über Stripe.
          </p>
        </Section>

        <Section title="4. Laufzeit und Kündigung">
          <p>
            Sofern nicht anders vereinbart, läuft das Abonnement monatlich und verlängert sich automatisch um jeweils einen
            weiteren Monat, sofern es nicht zum Ende der laufenden Periode gekündigt wird. Die Kündigung ist jederzeit zum
            Ende der laufenden Abrechnungsperiode möglich und erfolgt durch Klick auf „Abonnement kündigen" im
            Kunden-Dashboard oder per E-Mail an{' '}
            <a className="text-security-400" href="mailto:support@realsyncdynamicsai.de">support@realsyncdynamicsai.de</a>.
          </p>
          <p>
            Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt für beide Parteien unberührt.
          </p>
        </Section>

        <Section title="5. Widerrufsrecht für Verbraucher (B2C)">
          <p>
            Verbraucher im Sinne des § 13 BGB haben das Recht, den Vertrag innerhalb von 14 Tagen ab Vertragsschluss ohne
            Angabe von Gründen zu widerrufen. Die Widerrufserklärung ist zu richten an{' '}
            <a className="text-security-400" href="mailto:support@realsyncdynamicsai.de">support@realsyncdynamicsai.de</a>.
            Hat der Kunde verlangt, dass die Leistung während der Widerrufsfrist beginnt, schuldet er einen anteiligen
            Betrag für die bis zum Widerruf erbrachten Leistungen.
          </p>
          <p className="text-xs text-titanium-500">
            Hinweis: Im B2B-Verkehr (§ 14 BGB) besteht kein gesetzliches Widerrufsrecht.
          </p>
        </Section>

        <Section title="6. Preise und Zahlung">
          <p>
            Es gelten die Preise gemäß <Link to="/pricing" className="text-security-400 hover:underline">/pricing</Link>{' '}
            zum Zeitpunkt des Vertragsschlusses. Der Anbieter ist Kleinunternehmer i. S. v. § 19 UStG; alle Preise sind
            Endpreise und enthalten keine Umsatzsteuer.
          </p>
          <p>
            Die Zahlung erfolgt im Voraus für die jeweilige Abrechnungsperiode über den Zahlungsdienstleister Stripe.
            Bei Zahlungsverzug ist der Anbieter berechtigt, die Bereitstellung der Plattform auszusetzen, bis die Zahlung
            erfolgt ist; gesetzliche Verzugszinsen bleiben unberührt.
          </p>
        </Section>

        <Section title="7. Verfügbarkeit">
          <p>
            Der Anbieter ist um eine Verfügbarkeit der Plattform von 99 % im Jahresmittel bemüht. Ausgenommen sind geplante
            Wartungsfenster sowie Ausfälle aufgrund höherer Gewalt oder Störungen außerhalb des Einflussbereichs des
            Anbieters (z. B. Internet-Backbone, Drittanbieter-APIs). Für Enterprise-Verträge gelten abweichende SLAs gemäß
            individueller Vereinbarung.
          </p>
        </Section>

        <Section title="8. Pflichten des Kunden">
          <p>
            Der Kunde verpflichtet sich, die Plattform nicht für rechtswidrige Zwecke zu nutzen, insbesondere keine
            urheber-, marken- oder persönlichkeitsrechtsverletzenden Inhalte einzustellen und keine Sicherheitsmechanismen
            zu umgehen. Der Kunde ist für die Geheimhaltung seiner Zugangsdaten verantwortlich.
          </p>
        </Section>

        <Section title="9. Haftung">
          <p>
            Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit, für die Verletzung von Leben, Körper
            und Gesundheit sowie nach dem Produkthaftungsgesetz. Für leicht fahrlässige Verletzung wesentlicher
            Vertragspflichten (Kardinalpflichten) ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden
            begrenzt. Eine darüber hinausgehende Haftung ist ausgeschlossen.
          </p>
          <p>
            Insbesondere übernimmt der Anbieter keine Haftung dafür, dass die durch die Plattform identifizierten
            Compliance-Themen vollständig sind oder dass deren Behebung allein zur Rechtskonformität führt. Die Plattform
            ist ein Werkzeug zur technischen Unterstützung; sie ersetzt keine Rechtsberatung.
          </p>
        </Section>

        <Section title="10. Datenschutz">
          <p>
            Die Verarbeitung personenbezogener Daten erfolgt nach Maßgabe der{' '}
            <Link to="/legal/privacy" className="text-security-400 hover:underline">Datenschutzerklärung</Link>.
            Sofern der Kunde personenbezogene Daten Dritter im Rahmen der Plattform verarbeitet, schließen die Parteien
            einen Vertrag zur Auftragsverarbeitung gemäß Art. 28 DSGVO; ein Muster steht unter{' '}
            <Link to="/legal/avv" className="text-security-400 hover:underline">/legal/avv</Link> bereit.
          </p>
        </Section>

        <Section title="11. Änderungen dieser AGB">
          <p>
            Der Anbieter ist berechtigt, diese AGB mit Wirkung für die Zukunft zu ändern. Änderungen werden dem Kunden
            mindestens sechs Wochen vor ihrem Inkrafttreten in Textform mitgeteilt. Widerspricht der Kunde nicht
            innerhalb von vier Wochen nach Zugang, gelten die geänderten AGB als angenommen; auf dieses Recht wird in
            der Mitteilung ausdrücklich hingewiesen.
          </p>
        </Section>

        <Section title="12. Anwendbares Recht, Gerichtsstand, Schlussbestimmungen">
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Gegenüber Verbrauchern
            gilt diese Rechtswahl nur, soweit dem Verbraucher dadurch nicht der Schutz zwingender Vorschriften des
            Rechts des Staates entzogen wird, in dem er seinen gewöhnlichen Aufenthalt hat.
          </p>
          <p>
            Ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist —
            soweit der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
            Sondervermögen ist — der Sitz des Anbieters. Sollten einzelne Bestimmungen unwirksam sein, bleibt die
            Wirksamkeit der übrigen Bestimmungen unberührt.
          </p>
        </Section>

        <Section title="13. Online-Streitbeilegung (Art. 14 Abs. 1 ODR-VO)">
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit:{' '}
            <a className="text-security-400" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer noopener">
              ec.europa.eu/consumers/odr
            </a>
            . Der Anbieter ist nicht bereit oder verpflichtet, an einem Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>

        <div className="pt-6 border-t border-titanium-900 text-xs text-titanium-500">
          Stand: 2026-05-19 · Bei Fragen:{' '}
          <a className="text-security-400" href="mailto:support@realsyncdynamicsai.de">support@realsyncdynamicsai.de</a>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-titanium-50 tracking-tight text-base mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
