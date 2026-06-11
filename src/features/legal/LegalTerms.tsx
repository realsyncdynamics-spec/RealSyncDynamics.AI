import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react';

/**
 * Allgemeine Geschäftsbedingungen (AGB) — RealSyncDynamics.AI
 *
 * Konservative B2B-SaaS-Standard-AGB für die RealSync Dynamics
 * (Einzelunternehmen Dominik Steiner, Kleinunternehmer §19 UStG).
 *
 * Geltungsbereich: Nutzung der unter `realsyncdynamicsai.de`
 * angebotenen SaaS-Plattform für KI- und DSGVO-Governance.
 *
 * Anwendbares Recht: deutsches Recht ohne UN-Kaufrecht (CISG).
 *
 * Verbraucher-/Unternehmer-Trennung: das Angebot richtet sich primär
 * an Unternehmer i. S. v. §14 BGB. Konsumenten-spezifische
 * Pflichthinweise (Widerrufsrecht §312g BGB, ODR-Plattform, etc.)
 * sind dennoch vollständig dokumentiert — wenn ein Verbraucher das
 * Produkt nutzt, gelten diese vorrangig.
 *
 * Hinweis: dieser Text ist eine pragmatische Branchenfassung, ersetzt
 * aber keine anwaltliche Prüfung im Einzelfall — siehe DEV-Banner.
 */
export function LegalTerms() {
  const showDevBanner = import.meta.env.DEV;
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
          aria-label="Zurück zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="font-display font-bold text-sm tracking-tight text-titanium-50">
              Allgemeine Geschäftsbedingungen
            </h1>
            <div className="text-[11px] text-titanium-400 font-medium">
              gültig ab 22. Mai 2026 · Version 1.0
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-titanium-300 text-sm leading-relaxed">
        {showDevBanner && (
          <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-900 rounded-none text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-amber-200">
              <strong>DEV-Hinweis:</strong> Diese AGB-Fassung ist eine pragmatische
              Branchenvorlage. Für die Live-Nutzung bitte einmalig durch eine
              fachkundige Person (z.&nbsp;B. spezialisierter Rechtsbeistand) prüfen
              lassen — insbesondere die Haftungs- und Kündigungsklauseln (§§&nbsp;8, 11).
            </span>
          </div>
        )}

        <Section title="§ 1 Geltungsbereich, Vertragspartner">
          <p>
            (1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB")
            gelten für sämtliche Verträge über die Nutzung der unter
            <span className="font-mono"> realsyncdynamicsai.de </span>
            angebotenen Software-as-a-Service-Plattform (nachfolgend
            „Plattform" oder „Dienst") zwischen
          </p>
          <p>
            <strong className="text-titanium-50">RealSync Dynamics</strong>
            <br />
            Inhaber Dominik Steiner
            <br />
            Schwarzburger Str. 31
            <br />
            98724 Neuhaus am Rennweg
            <br />
            Deutschland
            <br />
            E-Mail:{' '}
            <a className="text-security-400" href="mailto:support@realsyncdynamicsai.de">
              support@realsyncdynamicsai.de
            </a>
          </p>
          <p>
            (nachfolgend „Anbieter") und dem jeweiligen Vertragspartner
            (nachfolgend „Nutzer"). Vollständige Anbieterangaben siehe{' '}
            <Link to="/impressum" className="text-security-400">Impressum</Link>.
          </p>
          <p>
            (2) Das Angebot richtet sich primär an Unternehmer im Sinne
            von §&nbsp;14 BGB. Wird die Plattform durch einen Verbraucher
            i.&nbsp;S.&nbsp;v. §&nbsp;13 BGB genutzt, gelten die zwingenden
            verbraucherschützenden Vorschriften (insbesondere §§&nbsp;312&nbsp;ff. BGB)
            vorrangig vor diesen AGB.
          </p>
          <p>
            (3) Abweichende oder ergänzende Geschäftsbedingungen des
            Nutzers werden nur Vertragsbestandteil, wenn der Anbieter
            ihrer Geltung ausdrücklich in Textform zustimmt.
          </p>
        </Section>

        <Section title="§ 2 Vertragsschluss, Registrierung">
          <p>
            (1) Die Darstellung der Plattform und ihrer Tarife
            (<Link to="/pricing" className="text-security-400">/pricing</Link>)
            stellt kein verbindliches Angebot, sondern eine unverbindliche
            Aufforderung zur Abgabe eines Angebots dar.
          </p>
          <p>
            (2) Der Nutzer gibt sein Vertragsangebot durch Bestellung
            eines Tarifs oder Abschluss eines Free-Audits ab. Der Anbieter
            kann das Angebot innerhalb von sieben Tagen durch Bestätigung
            (per E-Mail oder durch Bereitstellung der Plattform) annehmen.
          </p>
          <p>
            (3) Für die Registrierung benötigt der Nutzer eine gültige
            E-Mail-Adresse. Im B2B-Fall ist anzugeben, in wessen Auftrag
            die Plattform genutzt wird. Eine Weitergabe der Zugangsdaten
            an Dritte ist untersagt.
          </p>
        </Section>

        <Section title="§ 3 Leistungsumfang, Demo-Modus">
          <p>
            (1) Der Anbieter stellt dem Nutzer im Rahmen des gebuchten
            Tarifs eine browserbasierte SaaS-Plattform für KI- und
            DSGVO-Governance zur Verfügung. Der konkrete Leistungsumfang
            ergibt sich aus der jeweiligen Tarifbeschreibung unter{' '}
            <Link to="/pricing" className="text-security-400">/pricing</Link>.
          </p>
          <p>
            (2) Der Anbieter bietet ferner einen kostenfreien
            <strong className="text-titanium-50"> Free Audit </strong>
            sowie einen öffentlich zugänglichen Demo-Modus an. Demo-Inhalte
            (Live-Counter, simulierte Telemetrie, Beispiel-Befunde) sind
            durchgängig sichtbar als „Demo" oder „Simulierte Telemetrie"
            gekennzeichnet und stellen keine Live-Kundendaten dar. Aus dem
            Demo-Modus lassen sich keine Ansprüche auf konkreten
            Funktionsumfang ableiten.
          </p>
          <p>
            (3) Die Plattform unterstützt den Nutzer bei der Identifikation
            potenziell DSGVO-, TTDSG- oder KI-Verordnungs-relevanter
            Sachverhalte (automatische Scans, Tracker-Erkennung,
            KI-System-Inventar). Die Plattform ist ein technisches
            Werkzeug und{' '}
            <strong className="text-titanium-50">
              ersetzt keine Rechtsberatung im Einzelfall
            </strong>
            . Findings sind technische Hinweise, keine endgültigen
            juristischen Bewertungen.
          </p>
          <p>
            (4) Der Anbieter behält sich vor, einzelne Funktionen
            weiterzuentwickeln, anzupassen oder durch funktionsäquivalente
            Nachfolger zu ersetzen, soweit dies für den Nutzer zumutbar
            ist und die Hauptleistungspflicht unberührt bleibt.
          </p>
        </Section>

        <Section title="§ 4 Vergütung, Abrechnung, Zahlungsabwicklung">
          <p>
            (1) Die für den gebuchten Tarif geltenden Preise sind unter{' '}
            <Link to="/pricing" className="text-security-400">/pricing</Link>{' '}
            ausgewiesen. Preise verstehen sich, soweit nicht anders
            angegeben, in Euro.
          </p>
          <p>
            (2) Hinweis: der Anbieter ist Kleinunternehmer im Sinne von
            §&nbsp;19 UStG. Es wird keine Umsatzsteuer ausgewiesen und
            erhoben.
          </p>
          <p>
            (3) Die Abrechnung erfolgt über den Zahlungsdienstleister
            Stripe Payments Europe, Ltd. (Dublin, Irland). Wiederkehrende
            Tarife werden im Voraus pro Abrechnungsperiode abgerechnet.
            Es gelten zusätzlich die jeweiligen Stripe-Nutzungsbedingungen.
          </p>
          <p>
            (4) Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang
            zur Plattform bis zur vollständigen Zahlung zu sperren.
            Weitergehende gesetzliche Rechte bleiben unberührt.
          </p>
        </Section>

        <Section title="§ 5 Pflichten des Nutzers">
          <p>
            (1) Der Nutzer ist verpflichtet, die Plattform nur im Rahmen
            der gesetzlichen Bestimmungen sowie dieser AGB zu nutzen. Die
            Plattform darf insbesondere nicht zur Verarbeitung
            personenbezogener Daten Dritter verwendet werden, wenn dafür
            keine Rechtsgrundlage nach Art.&nbsp;6 DSGVO besteht.
          </p>
          <p>
            (2) Der Nutzer ist allein verantwortlich für die Richtigkeit
            der bei einem Scan eingegebenen URLs sowie dafür, dass er
            berechtigt ist, die Ziel-Domain technisch scannen zu lassen
            (eigene Website, Mandantenauftrag, ausdrückliche Erlaubnis).
          </p>
          <p>
            (3) Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu
            halten. Verlust oder unbefugte Kenntnisnahme ist dem Anbieter
            unverzüglich mitzuteilen.
          </p>
        </Section>

        <Section title="§ 6 Verfügbarkeit, Wartung">
          <p>
            (1) Der Anbieter ist bemüht, eine möglichst hohe
            Verfügbarkeit der Plattform sicherzustellen, schuldet jedoch
            mit Blick auf den Pilot-Status keine bestimmte
            Mindest-Verfügbarkeit, soweit nicht in einem separaten
            SLA-Anhang ausdrücklich vereinbart.
          </p>
          <p>
            (2) Geplante Wartungsarbeiten kündigt der Anbieter, soweit
            zumutbar, vorab per E-Mail oder Statusseite an. Ungeplante
            Ausfälle (z.&nbsp;B. durch Drittanbieter-Störungen) werden so
            schnell wie möglich behoben.
          </p>
        </Section>

        <Section title="§ 7 Datenschutz, Auftragsverarbeitung">
          <p>
            (1) Der Anbieter verarbeitet personenbezogene Daten
            ausschließlich nach Maßgabe der{' '}
            <Link to="/legal/privacy" className="text-security-400">
              Datenschutzerklärung
            </Link>{' '}
            und der DSGVO.
          </p>
          <p>
            (2) Soweit der Nutzer im Rahmen der Plattform-Nutzung
            personenbezogene Daten Dritter durch den Anbieter verarbeiten
            lässt, gilt zusätzlich der unter{' '}
            <Link to="/legal/avv" className="text-security-400">
              /legal/avv
            </Link>{' '}
            bereitgestellte Auftragsverarbeitungsvertrag (AVV) gemäß
            Art.&nbsp;28 DSGVO.
          </p>
          <p>
            (3) Eine aktuelle Liste der vom Anbieter eingesetzten
            Sub-Prozessoren findet sich unter{' '}
            <Link to="/legal/sub-processors" className="text-security-400">
              /legal/sub-processors
            </Link>
            .
          </p>
        </Section>

        <Section title="§ 8 Haftung">
          <p>
            (1) Der Anbieter haftet unbeschränkt für Schäden aus der
            Verletzung des Lebens, des Körpers oder der Gesundheit, die
            auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung
            beruhen, sowie für sonstige Schäden, die auf einer grob
            fahrlässigen oder vorsätzlichen Pflichtverletzung beruhen.
          </p>
          <p>
            (2) Bei der leicht fahrlässigen Verletzung wesentlicher
            Vertragspflichten (Kardinalpflichten) ist die Haftung der
            Höhe nach begrenzt auf den vertragstypischen, vorhersehbaren
            Schaden. Wesentliche Vertragspflichten sind solche, deren
            Erfüllung die ordnungsgemäße Durchführung des Vertrags
            überhaupt erst ermöglicht und auf deren Einhaltung der Nutzer
            regelmäßig vertrauen darf.
          </p>
          <p>
            (3) Im Übrigen ist die Haftung — gleich aus welchem
            Rechtsgrund — ausgeschlossen, soweit gesetzlich zulässig.
          </p>
          <p>
            (4) Eine Garantie übernimmt der Anbieter nur, wenn dies
            ausdrücklich schriftlich vereinbart wurde. Die Plattform ist
            ein technisches Werkzeug zur Compliance-Unterstützung;
            insbesondere wird{' '}
            <strong className="text-titanium-50">
              keine Garantie für DSGVO-, TTDSG- oder KI-Verordnungs-Konformität
            </strong>{' '}
            der vom Nutzer betriebenen Systeme übernommen.
          </p>
          <p>
            (5) Eine Haftung nach dem Produkthaftungsgesetz bleibt
            unberührt.
          </p>
        </Section>

        <Section title="§ 9 Höhere Gewalt">
          <p>
            Bei Ereignissen höherer Gewalt (z.&nbsp;B. großflächige
            Internet-Ausfälle, behördliche Anordnungen, Pandemien,
            Streiks bei Drittanbietern) ruhen die wechselseitigen
            Leistungspflichten für die Dauer der Behinderung. Beide
            Parteien werden sich unverzüglich informieren und
            zumutbare Workarounds abstimmen.
          </p>
        </Section>

        <Section title="§ 10 Geistiges Eigentum">
          <p>
            (1) Die Plattform sowie alle vom Anbieter erstellten
            Inhalte (Reports, Code-Snippets, Diff-Vorschläge) sind
            urheberrechtlich geschützt. Der Nutzer erhält für die
            Dauer des Vertragsverhältnisses ein nicht-ausschließliches,
            nicht übertragbares Nutzungsrecht im Rahmen des gebuchten
            Tarifs.
          </p>
          <p>
            (2) Der Nutzer darf vom Anbieter generierte Reports und
            Snippets für eigene Compliance-Zwecke und gegenüber Behörden
            und Auditoren frei nutzen, vervielfältigen und weitergeben.
          </p>
        </Section>

        <Section title="§ 11 Vertragslaufzeit, Kündigung">
          <p>
            (1) Bezahlte Abonnement-Tarife verlängern sich automatisch
            um die jeweils gewählte Laufzeit (monatlich oder jährlich),
            sofern sie nicht zum Ende der laufenden Periode gekündigt
            werden.
          </p>
          <p>
            (2) Verbraucher können online geschlossene
            Abonnement-Verträge gemäß §&nbsp;312k BGB jederzeit über die
            in der Plattform bereitgestellte Kündigungsmöglichkeit (im
            angemeldeten Bereich, sowie ersatzweise per E-Mail an{' '}
            <a className="text-security-400" href="mailto:support@realsyncdynamicsai.de">
              support@realsyncdynamicsai.de
            </a>
            ) kündigen. Die Kündigung wird zum nächsten regulären
            Abrechnungstermin wirksam, soweit kein außerordentliches
            Kündigungsrecht greift.
          </p>
          <p>
            (3) Das Recht zur außerordentlichen Kündigung aus wichtigem
            Grund bleibt für beide Parteien unberührt. Ein wichtiger
            Grund liegt für den Anbieter insbesondere bei wiederholtem
            Verstoß des Nutzers gegen §&nbsp;5 vor.
          </p>
          <p>
            (4) Kündigungen bedürfen der Textform (E-Mail genügt).
          </p>
        </Section>

        <Section title="§ 12 Widerrufsrecht für Verbraucher">
          <p>
            Verbraucher haben grundsätzlich ein Widerrufsrecht nach
            §§&nbsp;312g, 355 BGB. Bei Verträgen über die Lieferung von
            nicht auf einem körperlichen Datenträger befindlichen
            digitalen Inhalten (SaaS) erlischt das Widerrufsrecht gemäß
            §&nbsp;356 Abs.&nbsp;5 BGB, wenn der Anbieter mit der
            Vertragsausführung begonnen hat, nachdem der Verbraucher
            ausdrücklich zugestimmt und seine Kenntnis vom Erlöschen
            des Widerrufsrechts mit Beginn der Vertragsausführung
            bestätigt hat. Die entsprechende Bestätigung wird im
            Checkout-Prozess als separates Häkchen abgefragt.
          </p>
        </Section>

        <Section title="§ 13 Änderungen dieser AGB">
          <p>
            Der Anbieter kann diese AGB anpassen, soweit dies durch
            gesetzliche Änderungen, höchstrichterliche Rechtsprechung
            oder zur Beseitigung von Regelungslücken erforderlich ist.
            Wesentliche Änderungen kündigt der Anbieter dem Nutzer
            mindestens vier Wochen vorher in Textform an. Widerspricht
            der Nutzer innerhalb dieser Frist nicht, gelten die geänderten
            AGB als angenommen; auf diese Folge wird in der Mitteilung
            ausdrücklich hingewiesen.
          </p>
        </Section>

        <Section title="§ 14 Anwendbares Recht, Gerichtsstand, Streitbeilegung">
          <p>
            (1) Es gilt das Recht der Bundesrepublik Deutschland unter
            Ausschluss des UN-Kaufrechts (CISG). Verbraucherschützende
            Vorschriften des Wohnsitzstaates des Verbrauchers bleiben
            unberührt.
          </p>
          <p>
            (2) Ausschließlicher Gerichtsstand für alle Streitigkeiten
            aus oder im Zusammenhang mit diesem Vertrag ist — soweit der
            Nutzer Kaufmann, juristische Person des öffentlichen Rechts
            oder öffentlich-rechtliches Sondervermögen ist — der Sitz
            des Anbieters. Gegenüber Verbrauchern gilt der gesetzliche
            Gerichtsstand.
          </p>
          <p>
            (3) Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:{' '}
            <a
              className="text-security-400"
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
            >
              ec.europa.eu/consumers/odr
            </a>
            . Der Anbieter ist nicht verpflichtet und nicht bereit, an
            einem Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>

        <Section title="§ 15 Salvatorische Klausel">
          <p>
            Sollten einzelne Bestimmungen dieser AGB ganz oder teilweise
            unwirksam sein oder werden, bleibt die Wirksamkeit der
            übrigen Bestimmungen unberührt. An die Stelle der unwirksamen
            Bestimmung tritt die gesetzliche Regelung.
          </p>
        </Section>

        <div className="flex flex-wrap items-center gap-4 text-xs text-titanium-400 pt-6 border-t border-titanium-900">
          <Link to="/impressum" className="hover:text-titanium-200">Impressum</Link>
          <Link to="/legal/privacy" className="hover:text-titanium-200">Datenschutzerklärung</Link>
          <Link to="/legal/avv" className="hover:text-titanium-200">AVV</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-200">Sub-Prozessoren</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-titanium-50 tracking-tight text-base mb-2">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
