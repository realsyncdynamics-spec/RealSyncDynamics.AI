import { usePageMeta } from '../../lib/usePageMeta';
import { useJsonLd, faqPageLd, breadcrumbLd, softwareApplicationLd, type FaqEntry } from '../../lib/useJsonLd';
import { SeoPageShell, ProseSection } from './SeoPageShell';
import { AuditCTA } from '../../components/sections/AuditCTA';
import { ComplianceFAQ, DEFAULT_COMPLIANCE_FAQ } from '../../components/sections/ComplianceFAQ';

const PAGE_FAQS: FaqEntry[] = [
  {
    question: 'Was ist Continuous Compliance Monitoring?',
    answer:
      'Laufende technische Überwachung von Websites, Tracking-Stacks und KI-Workflows. Statt eines einmaligen Stichprobenaudits entsteht eine nachvollziehbare Historie, die Veränderungen sichtbar macht — etwa neue Tracker, geänderte Cookie-Verhalten oder ausgetauschte Drittanbieter-Skripte.',
  },
  {
    question: 'Wozu reicht ein einmaliger Scan nicht?',
    answer:
      'Websites verändern sich kontinuierlich: neue Tags, neue Plug-ins, neue Marketing-Tools, neue Server-Side-Integrationen. Eine Momentaufnahme dokumentiert nur den aktuellen Stand. Erst ein wiederkehrender Audit erkennt Drift und macht Veränderungen über Zeit nachvollziehbar.',
  },
  {
    question: 'Welche Veränderungen werden erkannt?',
    answer:
      'Neue oder entfernte Tracker, geänderte Cookie-Sets, neue externe Skripte (CDN-Wechsel, Tag-Manager-Updates), Änderungen an Consent-Komponenten sowie Statuswechsel bei Pflichtangaben.',
  },
];

const FAQ_FOR_LD = [...PAGE_FAQS, ...DEFAULT_COMPLIANCE_FAQ];

export function ContinuousCompliance() {
  usePageMeta({
    title: 'Continuous Compliance Monitoring — DSGVO, TTDSG und AI Act laufend überwachen',
    description:
      'Laufende technische Überwachung von Websites, Tracking-Stacks und Compliance-Risiken mit nachvollziehbarer Audit-Historie.',
    url: 'https://RealSyncDynamicsAI.de/continuous-compliance',
  });
  useJsonLd('jsonld-faq-continuous', faqPageLd(FAQ_FOR_LD));
  useJsonLd(
    'jsonld-bc-continuous',
    breadcrumbLd([
      { name: 'Home', url: 'https://RealSyncDynamicsAI.de/' },
      { name: 'Continuous Compliance', url: 'https://RealSyncDynamicsAI.de/continuous-compliance' },
    ]),
  );
  useJsonLd('jsonld-app-continuous', softwareApplicationLd());

  return (
    <SeoPageShell
      eyebrow="Plattform"
      h1="Continuous Compliance Monitoring"
      breadcrumbs={[{ name: 'Continuous Compliance' }]}
    >
      <ProseSection>
        <h2 className="font-display font-bold text-titanium-50 text-xl">Warum einmalige Scans nicht reichen</h2>
        <p>
          DSGVO und TTDSG sind keine „einmal-einrichten"-Themen. Moderne Websites ändern sich permanent: neue
          Marketing-Tools, neue Tag-Manager-Container, neue Drittanbieter-Skripte, neue Embeds aus
          Headless-CMS-Inhalten. Ein Audit, der heute „grün" ist, kann morgen einen neuen Tracker enthalten —
          ohne dass ihn jemand bewusst eingebaut hat.
        </p>
        <p>
          Continuous Compliance Monitoring beobachtet eine Domain wiederkehrend und dokumentiert die
          technische Auswertung über Zeit. Aus der Historie entsteht ein nachvollziehbarer Audit-Trail, mit
          dem sich Veränderungen frühzeitig erkennen und priorisieren lassen.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Was überwacht wird</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Tracking-Skripte und ihre Quell-Domains — inkl. nachgeladener Skripte aus Tag-Managern.</li>
          <li>Cookie-Inventar vor und nach erkennbarem Consent.</li>
          <li>Drittanbieter-Skripte: Fonts, CDN, Analytics, A/B-Test-Frameworks, Heat-Map-Tools.</li>
          <li>Pflichtangaben: Impressum, Datenschutz, Cookie-Banner-Konfiguration.</li>
          <li>Security-Header und Transport-Konfiguration.</li>
          <li>Wo anwendbar: AI-Act-relevante Hinweise zu eingesetzten KI-Diensten.</li>
        </ul>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Drift-Erkennung</h2>
        <p>
          Drift entsteht, wenn sich der technische Stack einer Website verändert — typischerweise unbemerkt.
          Ein neuer Marketing-Pixel, ein ausgetauschtes Consent-Tool, ein CDN-Wechsel: Continuous Monitoring
          erkennt solche Änderungen, ordnet sie ein und gibt Hinweise, ob aus der Veränderung neue
          Compliance-Risiken entstehen.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Nachvollziehbare Audit-Historie</h2>
        <p>
          Jeder Audit-Lauf wird mit Zeitstempel, Methodik-Tag und konkreten Befunden dokumentiert. Diese
          Historie ist eine Grundlage für interne Compliance-Prozesse, AVV-Anhänge oder die Vorbereitung
          einer anwaltlichen Prüfung — sie ersetzt diese Prüfung aber nicht.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Wie steige ich ein?</h2>
        <p>
          Der kostenlose Audit ist der schnellste Einstieg: eine erste technische Vorprüfung Ihrer Domain mit
          priorisierten Hinweisen. Für eine laufende Überwachung können Sie anschließend Starter oder Growth
          aktivieren.
        </p>
      </ProseSection>

      <AuditCTA source="seo-continuous-compliance" secondaryLabel="Monitoring ansehen" />

      <ComplianceFAQ entries={FAQ_FOR_LD} title="Continuous Compliance — Fragen & Antworten" />
    </SeoPageShell>
  );
}
