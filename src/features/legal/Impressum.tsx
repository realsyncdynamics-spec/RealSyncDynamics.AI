import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react';

/**
 * Impressum nach § 5 TMG + § 18 MStV.
 *
 * WICHTIG: Mit eckigen Klammern markierte Felder MÜSSEN vor Live-Schaltung
 * mit echten Daten ersetzt werden. Ohne diese Daten ist die Seite nicht
 * rechtskonform — § 5 TMG-Verstoß = sofort abmahnfähig.
 */
export function Impressum() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Impressum</div>
            <div className="text-[11px] text-titanium-400 font-medium">§ 5 TMG · § 18 MStV</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-titanium-300 text-sm leading-relaxed">
        <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-900 rounded-none text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200">
            <strong>Status: Pre-Launch.</strong> Sitz steht (Neuhaus am Rennweg, Thüringen). Vor Live-Schaltung
            müssen ausstehend ersetzt werden: Strasse + Hausnummer · Telefon · Vor- und Nachname (Inhaber/Geschäftsführer) ·
            HR-Eintrag (falls UG/GmbH) · USt-IdNr. (kommt nach Finanzamt-Fragebogen). Werte in eckigen Klammern <code className="px-1 bg-obsidian-950 text-amber-300">[…]</code> kennzeichnen offene Felder.
          </span>
        </div>

        <Section title="Anbieter / Verantwortlicher i. S. d. § 5 TMG">
          <p>
            <strong className="text-titanium-50">RealSync Dynamics</strong><br />
            Schwarzburger Str. 31<br />
            98721 Neuhaus am Rennweg<br />
            Thüringen, Deutschland
          </p>
          <p className="text-xs text-titanium-500">
            Handelsname „RealSync Dynamics" bzw. „RealSyncDynamics.AI" — finaler
            Eintrag bei Gewerbeanmeldung (Gewerbeamt Neuhaus am Rennweg, Landkreis Sonneberg).
          </p>
        </Section>

        <Section title="Kontakt">
          <p>
            Telefon: <span className="text-titanium-500">[+49 …]</span><br />
            E-Mail: <a className="text-security-400" href="mailto:hello@realsyncdynamicsai.de">hello@realsyncdynamicsai.de</a><br />
            Datenschutz: <a className="text-security-400" href="mailto:privacy@realsyncdynamicsai.de">privacy@realsyncdynamicsai.de</a><br />
            Web: <a className="text-security-400" href="https://realsyncdynamicsai.de">realsyncdynamicsai.de</a>
          </p>
        </Section>

        <Section title="Vertretungsberechtigte/r">
          <p>
            <strong className="text-titanium-50">Dominik Steiner</strong> (Inhaber / vertretungsberechtigt)
          </p>
        </Section>

        <Section title="Tätigkeitsschwerpunkte">
          <p>
            Entwicklung, Vermarktung und Betrieb von KI-gestützten Software-as-a-Service (SaaS)-Lösungen;
            IT-Dienstleistungen; Unternehmensberatung im Bereich digitale Prozessautomatisierung und
            Datenschutz-/AI-Act-Compliance. Schwerpunkt: EU-souveräne KI-Infrastruktur,
            DSGVO-Compliance-Tools (AVV / VVT / DSFA / Cookie-Consent), Audit-Trail.
          </p>
          <p className="text-xs text-titanium-500">
            WZ-Code (vorläufig, finaler Eintrag durch Finanzamt): 62.01.0 (Programmierungstätigkeiten),
            ergänzend 62.09.0 (sonstige Tätigkeiten der Informationstechnologie).
          </p>
        </Section>

        <Section title="Handelsregister / Rechtsform">
          <p className="text-titanium-500">
            <span className="text-titanium-300">Aktueller Status:</span> Einzelunternehmen, nicht im Handelsregister eingetragen.
            Bei späterer Umwandlung in UG (haftungsbeschränkt) oder GmbH wird hier der HRB-Eintrag
            (Registergericht Jena oder zuständiges Amtsgericht) ergänzt.
          </p>
          <p className="text-xs text-titanium-500">
            Falls Einzelunternehmen bleibt: dieser Abschnitt kann entfernt werden, der Hinweis „Nicht im Handelsregister eingetragen" reicht.
          </p>
        </Section>

        <Section title="Umsatzsteuer-Identifikationsnummer">
          <p>
            USt-IdNr. gemäß § 27 a Umsatzsteuergesetz: <span className="text-titanium-500">[wird nach Finanzamt-Fragebogen vergeben]</span>
          </p>
          <p className="text-xs text-titanium-500">
            Falls Kleinunternehmer-Regelung (§ 19 UStG) bei Anmeldung gewählt wird: Diesen Block ersetzen durch
            „Hinweis: Kleinunternehmer i. S. v. § 19 UStG. Es wird keine Umsatzsteuer ausgewiesen."
          </p>
        </Section>

        <Section title="Wirtschafts-ID (sobald vergeben)">
          <p className="text-titanium-500">
            Wirtschafts-Identifikationsnummer (§ 139c AO): [noch nicht vergeben]
          </p>
        </Section>

        <Section title="Aufsichtsbehörde Datenschutz">
          <p>
            Aufgrund des Sitzes in Thüringen ist zuständig:<br />
            <strong className="text-titanium-50">Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit (TLfDI)</strong><br />
            Häßlerstraße 8, 99096 Erfurt<br />
            Telefon: 0361 57 311 29 00 · E-Mail: <a className="text-security-400" href="mailto:poststelle@datenschutz.thueringen.de">poststelle@datenschutz.thueringen.de</a><br />
            Web: <a href="https://www.tlfdi.de" target="_blank" rel="noreferrer noopener" className="text-security-400">tlfdi.de</a>
          </p>
        </Section>

        <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <p>
            <strong className="text-titanium-50">Dominik Steiner</strong><br />
            Anschrift wie Anbieter (siehe oben).
          </p>
          <p className="text-xs text-titanium-500">
            Pflicht bei journalistisch-redaktionell gestalteten Angeboten (z. B. Blog, News).
            Aktuell keine redaktionellen Inhalte — Abschnitt wird bei Blog-Aufnahme aktiv.
          </p>
        </Section>

        <Section title="EU-Streitschlichtung">
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
            bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer noopener" className="text-security-400">https://ec.europa.eu/consumers/odr/</a>.
            Unsere E-Mail-Adresse findest Du oben unter „Kontakt".
          </p>
        </Section>

        <Section title="Verbraucherstreitbeilegung / Universalschlichtungsstelle">
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>

        <Section title="Haftung für Inhalte">
          <p>
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die
            Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch
            keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG
            für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
            verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch
            nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
            überwachen.
          </p>
        </Section>

        <Section title="Haftung für Links">
          <p>
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte
            wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte
            auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist
            stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>
        </Section>

        <Section title="Urheberrecht">
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
            unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
            Verbreitung und jede Art der Verwertung außerhalb der Grenzen des
            Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors.
          </p>
        </Section>

        <div className="flex flex-wrap items-center gap-4 text-xs text-titanium-400 pt-6 border-t border-titanium-900">
          <Link to="/legal/privacy" className="hover:text-titanium-200">Datenschutzerklärung</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-200">Sub-Prozessoren</Link>
          <Link to="/legal/avv" className="hover:text-titanium-200">AVV-Vorlage</Link>
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
