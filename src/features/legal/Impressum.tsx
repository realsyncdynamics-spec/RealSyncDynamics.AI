import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react';
import {
  isImpressumProductionReady,
  loadBusinessIdentity,
} from '../../config/business-identity';

/**
 * Impressum nach § 5 DDG + § 18 MStV.
 *
 * USt-IdNr., HRB-Eintrag und Wirtschafts-ID werden aus ENV-Vars geladen
 * (VITE_BUSINESS_VAT_ID, VITE_BUSINESS_REGISTRY_ENTRY,
 * VITE_BUSINESS_ECONOMIC_ID). In DEV erscheint ein Hinweis-Banner mit den
 * offenen Feldern — in PROD wird der Banner unterdrueckt, weil das
 * oeffentliche Wording „Pflichtangaben unvollstaendig" rechtlich heikler
 * ist als der eigentliche Fehl-Wert. Stattdessen wird im jeweiligen
 * Abschnitt (USt-IdNr., Wirtschafts-ID, HR-Eintrag) ein dezenter Status
 * inline angezeigt („wird nach Vergabe ergaenzt").
 */
export function Impressum() {
  const identity = loadBusinessIdentity();
  const productionReady = isImpressumProductionReady(identity);
  // Banner nur in DEV — in PROD nicht oeffentlich "unvollstaendig" stehen.
  const showBanner = import.meta.env.DEV;
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3" aria-label="Zurueck zur Startseite">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="font-display font-bold text-sm tracking-tight text-titanium-50">Impressum</h1>
            <div className="text-[11px] text-titanium-400 font-medium">§ 5 DDG · § 18 MStV</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-titanium-300 text-sm leading-relaxed">
        {showBanner && (
          <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-900 rounded-none text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-amber-200">
              <strong>
                {productionReady
                  ? 'DEV-Build: alle Pflichtfelder gesetzt.'
                  : 'DEV-Hinweis: optionale Felder noch leer.'}
              </strong>{' '}
              {!identity.vatId && 'USt-IdNr. — sobald nach Finanzamt-Fragebogen vergeben, in VITE_BUSINESS_VAT_ID setzen. '}
              {!identity.registryEntry && 'HR-Eintrag nur bei UG/GmbH-Umwandlung relevant (VITE_BUSINESS_REGISTRY_ENTRY). '}
              {!identity.economicId && 'Wirtschafts-ID erst nach Vergabe durch BZSt (VITE_BUSINESS_ECONOMIC_ID).'}
            </span>
          </div>
        )}

        <Section title="Anbieter / Verantwortlicher i. S. d. § 5 DDG">
          <p>
            <strong className="text-titanium-50">RealSync Dynamics</strong><br />
            Schwarzburger Str. 31<br />
            98724 Neuhaus am Rennweg<br />
            Thüringen, Deutschland
          </p>
          <p>
            <strong className="text-titanium-50">Rechtsform:</strong> Einzelunternehmen,
            vertreten durch den Inhaber Dominik Steiner.
          </p>
          <p className="text-xs text-titanium-500">
            Handelsname „RealSync Dynamics" bzw. „RealSyncDynamics.AI".
            Gewerbe angemeldet am 13.05.2026 (Gewerbeamt Neuhaus am Rennweg,
            Landkreis Sonneberg, Gemeindekennzahl 16072013).
          </p>
        </Section>

        <Section title="Kontakt">
          <p>
            Telefon: <a className="text-security-400" href="tel:+4917640132161">+49 176 4013 2161</a><br />
            E-Mail: <a className="text-security-400" href="mailto:hello@realsyncdynamicsai.de">hello@realsyncdynamicsai.de</a><br />
            Datenschutz: <a className="text-security-400" href="mailto:privacy@realsyncdynamicsai.de">privacy@realsyncdynamicsai.de</a><br />
            Web: <a className="text-security-400" href="https://RealSyncDynamicsAI.de">RealSyncDynamicsAI.de</a>
          </p>
        </Section>

        <Section title="Vertretungsberechtigte/r">
          <p>
            <strong className="text-titanium-50">Dominik Steiner</strong> (Inhaber / vertretungsberechtigt)
          </p>
        </Section>

        <Section title="Tätigkeitsschwerpunkte">
          <p>
            Entwicklung und Betrieb von Software-as-a-Service (SaaS)-Lösungen
            im Bereich Datenschutz-, Compliance- und KI-Governance,
            insbesondere automatisierte Website- und Tracking-Analysen,
            DSGVO-/TDDDG-Compliance-Monitoring, technische Audit- und
            Reporting-Systeme sowie digitale Compliance-Tools. Erbringung
            von IT-Dienstleistungen, Softwareentwicklung und Bereitstellung
            webbasierter Analyse- und Monitoringplattformen.
          </p>
          <p className="text-xs text-titanium-500">
            Wortlaut gemäß registrierter Gewerbeanmeldung (Anlage zu GewA 1,
            Feld 18, Datum 13.05.2026). WZ-Code: 62.01.0
            (Programmierungstätigkeiten), ergänzend 62.09.0
            (sonstige Tätigkeiten der Informationstechnologie).
          </p>
        </Section>

        <Section title="Handelsregister / Rechtsform">
          {identity.registryEntry ? (
            <p>
              <strong className="text-titanium-50">Registereintrag:</strong> {identity.registryEntry}
            </p>
          ) : (
            <p className="text-titanium-500">
              <span className="text-titanium-300">Aktueller Status:</span> Einzelunternehmen, nicht im Handelsregister eingetragen.
              Bei späterer Umwandlung in UG (haftungsbeschränkt) oder GmbH wird hier der HRB-Eintrag
              (Registergericht Jena oder zuständiges Amtsgericht) ergänzt.
            </p>
          )}
        </Section>

        <Section title="Umsatzsteuer">
          {identity.vatId ? (
            <p>
              USt-IdNr. gemäß § 27 a Umsatzsteuergesetz: <span className="font-mono text-titanium-50">{identity.vatId}</span>
            </p>
          ) : (
            <p>
              Kleinunternehmer i. S. v. § 19 UStG. Es wird keine Umsatzsteuer ausgewiesen.
            </p>
          )}
        </Section>

        <Section title="Wirtschafts-ID (sobald vergeben)">
          {identity.economicId ? (
            <p>
              Wirtschafts-Identifikationsnummer (§ 139c AO): <span className="font-mono text-titanium-50">{identity.economicId}</span>
            </p>
          ) : (
            <p className="text-titanium-500">
              Wirtschafts-Identifikationsnummer (§ 139c AO): noch nicht vergeben
            </p>
          )}
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
            keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG
            für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
            verantwortlich. Nach §§ 7 bis 10 DDG sind wir als Diensteanbieter jedoch
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
