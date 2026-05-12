import { usePageMeta } from '../../lib/usePageMeta';
import { useJsonLd, faqPageLd, breadcrumbLd, type FaqEntry } from '../../lib/useJsonLd';
import { SeoPageShell, ProseSection } from './SeoPageShell';
import { AuditCTA } from '../../components/sections/AuditCTA';
import { ComplianceFAQ } from '../../components/sections/ComplianceFAQ';

const FAQS: FaqEntry[] = [
  {
    question: 'Was ist Pre-Consent Tracking?',
    answer:
      'Tracking, das bereits beim Aufruf der Seite stattfindet — bevor die Nutzerin oder der Nutzer eine wirksame Einwilligung erteilt hat. Typische Beispiele sind Analytics-, Pixel- oder externe Skripte, die direkt aus dem HTML geladen werden.',
  },
  {
    question: 'Warum ist Pre-Consent Tracking riskant?',
    answer:
      'Nach § 25 TTDSG und DSGVO Art. 6 sind nicht technisch notwendige Cookies und vergleichbare Zugriffe in der Regel einwilligungspflichtig. Tracking ohne Consent kann eine fehlende Rechtsgrundlage darstellen — die konkrete Bewertung hängt von Konfiguration und Zweck ab.',
  },
  {
    question: 'Welche Indikatoren prüft der Audit?',
    answer:
      'Erkannte Drittanbieter-Skripte, typische Analytics- und Pixel-Domains, Cookie-Verhalten vor sichtbarem Consent-Banner sowie Tracker-Klassifikationen mit Verweis auf relevante Rechtsgrundlagen.',
  },
];

export function PreConsentTracking() {
  usePageMeta({
    title: 'Pre-Consent Tracking prüfen — DSGVO- und TTDSG-Risiken erkennen',
    description:
      'Erkennen Sie mögliche Tracking-Risiken vor Einwilligung: Cookies, Pixel, externe Skripte und Consent-Verhalten technisch vorprüfen.',
    url: 'https://RealSyncDynamicsAI.de/pre-consent-tracking',
  });
  useJsonLd('jsonld-faq-pre-consent', faqPageLd(FAQS));
  useJsonLd(
    'jsonld-bc-pre-consent',
    breadcrumbLd([
      { name: 'Home', url: 'https://RealSyncDynamicsAI.de/' },
      { name: 'Pre-Consent Tracking', url: 'https://RealSyncDynamicsAI.de/pre-consent-tracking' },
    ]),
  );

  return (
    <SeoPageShell
      eyebrow="Technische Vorprüfung"
      h1="Pre-Consent Tracking prüfen"
      breadcrumbs={[{ name: 'Pre-Consent Tracking' }]}
    >
      <ProseSection>
        <h2 className="font-display font-bold text-titanium-50 text-xl">Was ist Pre-Consent Tracking?</h2>
        <p>
          Als Pre-Consent Tracking bezeichnet man das Laden von Tracking-Komponenten, bevor die Nutzerin oder der
          Nutzer eine wirksame Einwilligung erteilt hat. Klassisch sind das Analytics-Skripte, Pixel von
          Social-Media-Anbietern oder Drittanbieter-Skripte, die direkt aus dem HTML laden. Auch HTTP-Requests an
          externe Endpunkte, das Setzen nicht-technisch-notwendiger Cookies oder das Auslesen von
          Browser-Fingerprint-Signalen zählen dazu.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Warum es DSGVO- und TTDSG-relevant ist</h2>
        <p>
          § 25 TTDSG knüpft den Zugriff auf Endgeräte (Cookies, vergleichbare Speichervorgänge) grundsätzlich an
          eine Einwilligung — ausgenommen sind technisch zwingend erforderliche Zugriffe. Parallel verlangt DSGVO
          Art. 6 eine taugliche Rechtsgrundlage für jede Verarbeitung personenbezogener Daten. Tracking ohne
          Consent fällt häufig in keine der Erlaubnistatbestände und wird in der Rechtsprechung zunehmend kritisch
          gesehen (EuGH C-673/17 „Planet49"; BGH Cookie II 2020).
        </p>
        <p>
          Wichtig: Der konkrete Risikograd hängt vom eingesetzten Dienst, der Konfiguration, dem Zweck und dem
          Verarbeitungskontext ab. Manche cookieless-Setups oder reine Server-Logs lassen sich abweichend
          bewerten — die Einordnung sollte deshalb individuell rechtlich geprüft werden.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Typische Beispiele</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Google Analytics oder Tag Manager, die direkt im &lt;head&gt; geladen werden.</li>
          <li>Meta-Pixel, der einen <code className="text-titanium-100">PageView</code> vor Einwilligung feuert.</li>
          <li>Externe Schriftarten (z. B. direkt eingebundene Google Fonts) mit IP-Übertragung an Dritte.</li>
          <li>LinkedIn Insight Tag, Hotjar, TikTok-Pixel oder ähnliche Tracker mit Auto-Init.</li>
          <li>Cookie-Banner, die „Akzeptieren" und „Ablehnen" technisch ungleich behandeln (Dark Pattern).</li>
        </ul>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Technische Vorprüfung</h2>
        <p>
          Eine technische Vorprüfung kann sichtbare Indikatoren erkennen — z. B. Skripte typischer Tracker-Domains,
          Cookies vor sichtbarem Consent-Banner oder fehlende Granularität bei Banner-Buttons. Solche Hinweise
          ersetzen weder ein vollständiges Audit noch eine anwaltliche Bewertung. Sie sind ein guter Einstieg,
          um Risiken zu priorisieren und einzelne Punkte gezielt zu untersuchen.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Wie geht es weiter?</h2>
        <p>
          Der kostenlose Audit von RealSyncDynamics.AI prüft eine Domain auf typische Pre-Consent-Indikatoren und
          dokumentiert die Befunde mit Verweisen auf relevante Rechtsgrundlagen. Aus der Priorisierung der
          Befunde lässt sich ableiten, welche Risiken zuerst angegangen werden sollten.
        </p>
      </ProseSection>

      <AuditCTA source="seo-pre-consent-tracking" />

      <ComplianceFAQ entries={FAQS} title="Pre-Consent Tracking — Fragen & Antworten" />
    </SeoPageShell>
  );
}
