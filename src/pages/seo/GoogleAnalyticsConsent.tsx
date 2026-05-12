import { usePageMeta } from '../../lib/usePageMeta';
import { useJsonLd, faqPageLd, breadcrumbLd, type FaqEntry } from '../../lib/useJsonLd';
import { SeoPageShell, ProseSection } from './SeoPageShell';
import { AuditCTA } from '../../components/sections/AuditCTA';
import { ComplianceFAQ } from '../../components/sections/ComplianceFAQ';

const FAQS: FaqEntry[] = [
  {
    question: 'Braucht Google Analytics immer einen Consent?',
    answer:
      'In den meisten Standard-Setups: ja. Google Analytics setzt Cookies und überträgt Daten an Dritte (typischerweise außerhalb der EU). Die Pflicht zur Einwilligung ergibt sich aus § 25 TTDSG und DSGVO Art. 6. Ausnahmen sind selten und sollten individuell juristisch geprüft werden.',
  },
  {
    question: 'Was ist der Google Consent Mode?',
    answer:
      'Der Consent Mode v2 signalisiert Google den Consent-Status. Ohne Einwilligung sendet er nur aggregierte, anonymisierte Signale. Die Verantwortung für eine wirksame Einwilligung bleibt vollständig beim Website-Betreiber.',
  },
  {
    question: 'Welche technischen Indikatoren prüft der Audit?',
    answer:
      'Geladene gtag- / Tag-Manager-Skripte, Cookies aus typischen Google-Domains, anonymizeIp-Konfiguration sowie Tracker-Domains die noch vor sichtbarem Consent-Banner kommunizieren.',
  },
];

export function GoogleAnalyticsConsent() {
  usePageMeta({
    title: 'Google Analytics Consent prüfen — Tracking vor Einwilligung erkennen',
    description:
      'Prüfen Sie technische Hinweise darauf, ob Google Analytics oder ähnliche Tracking-Dienste vor wirksamer Einwilligung geladen werden.',
    url: 'https://RealSyncDynamicsAI.de/google-analytics-consent',
  });
  useJsonLd('jsonld-faq-ga-consent', faqPageLd(FAQS));
  useJsonLd(
    'jsonld-bc-ga-consent',
    breadcrumbLd([
      { name: 'Home', url: 'https://RealSyncDynamicsAI.de/' },
      { name: 'Google Analytics Consent', url: 'https://RealSyncDynamicsAI.de/google-analytics-consent' },
    ]),
  );

  return (
    <SeoPageShell
      eyebrow="Technische Vorprüfung"
      h1="Google Analytics Consent prüfen"
      breadcrumbs={[{ name: 'Google Analytics Consent' }]}
    >
      <ProseSection>
        <h2 className="font-display font-bold text-titanium-50 text-xl">Google Analytics und Consent</h2>
        <p>
          Google Analytics setzt in den Standard-Implementierungen Cookies (z. B.{' '}
          <code className="text-titanium-100">_ga</code>,{' '}
          <code className="text-titanium-100">_ga_*</code>,{' '}
          <code className="text-titanium-100">_gid</code>) und überträgt Daten — typischerweise auch in die USA.
          Nach § 25 TTDSG ist das Setzen nicht-technisch-notwendiger Cookies in der Regel
          einwilligungspflichtig, parallel braucht DSGVO Art. 6 eine taugliche Rechtsgrundlage. Tracking-Daten
          „funktional" oder „berechtigtes Interesse" zu deklarieren reicht in den meisten Auslegungen nicht aus.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Typische technische Indikatoren</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <code className="text-titanium-100">googletagmanager.com/gtag/js</code> wird direkt aus dem HTML
            geladen — ohne erkennbares Consent-Gating.
          </li>
          <li>Beacons an <code className="text-titanium-100">google-analytics.com/g/collect</code> erfolgen vor
            sichtbarem Consent-Banner.</li>
          <li>Fehlende <code className="text-titanium-100">anonymize_ip</code>-Konfiguration in der gtag-Init.</li>
          <li>Mehrere parallele Tracker (z. B. GA + Meta Pixel + LinkedIn Insight) ohne erkennbares
            Consent-Management-System.</li>
        </ul>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Google Consent Mode v2 sauber einordnen</h2>
        <p>
          Der Consent Mode v2 ist kein Ersatz für eine Einwilligung. Er kommuniziert lediglich den vom
          Consent-Management-System erfassten Status an Google. Ohne wirksame Einwilligung sendet GA nur
          aggregierte Signale — der eigentliche Personenbezug wird damit reduziert, der rechtliche Bedarf
          einer Einwilligung bleibt aber bestehen, sobald nicht-technisch-notwendige Cookies oder vergleichbare
          Speichervorgänge ins Spiel kommen.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Pre-Consent-Risiken im Audit</h2>
        <p>
          Eine technische Vorprüfung kann sichtbare Pre-Consent-Indikatoren erkennen — z. B. ein gtag-Skript,
          das direkt im <code className="text-titanium-100">&lt;head&gt;</code> ohne Consent-Gating geladen
          wird. Solche Hinweise sind ein guter Startpunkt für die Priorisierung. Sie ersetzen weder eine
          vollständige technische Prüfung noch eine rechtliche Bewertung der konkreten Konfiguration.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Schrems-II-Kontext</h2>
        <p>
          Auch bei wirksamer Einwilligung bleibt der Drittlandtransfer in die USA Thema (EuGH C-311/18,
          aktualisiert durch das EU-U.S. Data Privacy Framework 2023). Empfohlen sind zusätzliche Maßnahmen
          wie IP-Anonymisierung, eine Datenverarbeitungsvereinbarung mit Google sowie eine Bewertung der
          Datenexporte im konkreten Kontext.
        </p>
      </ProseSection>

      <AuditCTA source="seo-ga-consent" />

      <ComplianceFAQ entries={FAQS} title="Google Analytics & Consent — Fragen & Antworten" />
    </SeoPageShell>
  );
}
