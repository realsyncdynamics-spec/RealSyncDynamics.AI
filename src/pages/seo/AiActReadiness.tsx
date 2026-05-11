import { usePageMeta } from '../../lib/usePageMeta';
import { useJsonLd, faqPageLd, breadcrumbLd, type FaqEntry } from '../../lib/useJsonLd';
import { SeoPageShell, ProseSection } from './SeoPageShell';
import { AuditCTA } from '../../components/sections/AuditCTA';
import { ComplianceFAQ } from '../../components/sections/ComplianceFAQ';

const FAQS: FaqEntry[] = [
  {
    question: 'Was bedeutet AI Act Readiness?',
    answer:
      'Strukturierte technische und organisatorische Vorbereitung auf die Anforderungen der EU-KI-Verordnung. Dazu gehören die Inventarisierung eingesetzter KI-Systeme, eine Einordnung in die Risiko-Klassen (verboten, hoch, begrenzt, minimal), Transparenzpflichten und die Dokumentation der eingesetzten Modelle und Datenflüsse.',
  },
  {
    question: 'Welche KI-Systeme werden vom AI Act erfasst?',
    answer:
      'Alle in der EU bereitgestellten oder dort wirkenden KI-Systeme im Sinne der Verordnung — von einfachen Chatbots bis zu Hochrisiko-Anwendungen in regulierten Bereichen. Die konkrete Einordnung folgt aus Art. 5 (verbotene Praktiken) sowie Annex III (Hochrisiko-Anwendungsfälle).',
  },
  {
    question: 'Was leistet eine technische Vorprüfung?',
    answer:
      'Sie kann erkennen, welche KI- oder Tracking-Komponenten technisch auf einer Website oder in einem Workflow eingesetzt werden — etwa Chatbots, Empfehlungs-Engines, Personalisierungs-Module. Aus den erkannten Bausteinen lässt sich ableiten, welche AI-Act-Pflichten potenziell einschlägig sind.',
  },
];

export function AiActReadiness() {
  usePageMeta({
    title: 'AI Act Readiness — technische Vorprüfung für KI- und Website-Risiken',
    description:
      'Strukturierte technische Vorprüfung für AI-Act-relevante Systeme, Website-Risiken und dokumentierbare Compliance-Prozesse.',
    url: 'https://realsyncdynamicsai.de/ai-act-readiness',
  });
  useJsonLd('jsonld-faq-ai-act', faqPageLd(FAQS));
  useJsonLd(
    'jsonld-bc-ai-act',
    breadcrumbLd([
      { name: 'Home', url: 'https://realsyncdynamicsai.de/' },
      { name: 'AI Act Readiness', url: 'https://realsyncdynamicsai.de/ai-act-readiness' },
    ]),
  );

  return (
    <SeoPageShell
      eyebrow="EU AI Act"
      h1="AI Act Readiness für Websites und KI-Systeme"
      breadcrumbs={[{ name: 'AI Act Readiness' }]}
    >
      <ProseSection>
        <h2 className="font-display font-bold text-titanium-50 text-xl">AI Act Readiness — worum es geht</h2>
        <p>
          Die EU-KI-Verordnung (AI Act) ordnet KI-Systeme nach Risiko ein und bindet daran konkrete Pflichten —
          von verbotenen Praktiken (Art. 5) über Hochrisiko-Anwendungen (Annex III) bis zu Transparenzpflichten
          für Chatbots, generative Systeme und Deepfakes. Die Anforderungen treten gestaffelt in Kraft. Wer
          KI heute schon einsetzt, sollte den Stack strukturiert erfassen, bevor einzelne Pflichten scharfgestellt
          werden.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Technische und organisatorische Hinweise</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Inventar aller eingesetzten KI-Modelle, -Dienste und -SDKs.</li>
          <li>Einordnung nach Risiko-Klasse (verbotene Praktik / hoch / begrenzt / minimal).</li>
          <li>Transparenzpflicht-Inventar: Kennzeichnung von Chatbots, AI-generierten Inhalten und Deepfakes.</li>
          <li>Daten-Governance: Trainingsdaten, Quellen, Datenexporte, Aufbewahrungsfristen.</li>
          <li>Dokumentation der Anbieter und Sub-Prozessoren der eingesetzten KI-Dienste.</li>
          <li>Wo Hochrisiko: Konformitätsbewertung, Notified Body, Risikomanagement, technische Dokumentation.</li>
        </ul>

        <h2 className="font-display font-bold text-titanium-50 text-xl">KI-Workflows im Web-Kontext</h2>
        <p>
          Viele KI-Anwendungsfälle landen heute direkt auf der Website: Chatbots, Empfehlungs-Engines,
          Personalisierungs-Module, AI-gestützte Suche, Sentiment-Analyse. Eine technische Vorprüfung kann
          erkennen, welche dieser Komponenten in einer Domain eingebunden sind — und damit die Grundlage für
          eine AI-Act-Einordnung schaffen.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Dokumentation und Audit-Trails</h2>
        <p>
          Eine zentrale Anforderung des AI Act ist die Dokumentation: welche Systeme im Einsatz sind, in welcher
          Version, mit welchen Daten, in welchem Kontext. Ein nachvollziehbarer Audit-Trail über Zeit
          unterstützt interne Compliance-Prozesse — gerade dort, wo Anbieter-Wechsel oder Modell-Updates
          regelmäßig vorkommen.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Wie der Audit hilft</h2>
        <p>
          Der RealSyncDynamics.AI-Audit kann technische Hinweise auf KI-Bausteine und Drittanbieter-Skripte
          liefern und in eine strukturierte Risikoanalyse mit Verweisen auf relevante AI-Act-Artikel überführen.
          Die Bewertung einzelner Hochrisiko-Fälle bleibt eine juristische Aufgabe; der Audit unterstützt die
          Vorbereitung.
        </p>
      </ProseSection>

      <AuditCTA source="seo-ai-act-readiness" secondaryLabel="Readiness ansehen" secondaryHref="/pricing" />

      <ComplianceFAQ entries={FAQS} title="AI Act Readiness — Fragen & Antworten" />
    </SeoPageShell>
  );
}
