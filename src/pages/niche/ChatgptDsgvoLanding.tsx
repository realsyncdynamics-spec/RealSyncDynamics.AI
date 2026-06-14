import { Bot, AlertOctagon, FileSearch } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const CONFIG: NicheConfig = {
  segment: 'ChatGPT',
  sourceTag: 'chatgpt-dsgvo',
  eyebrow: 'ChatGPT, KI-Tools & DSGVO',
  headline: 'ChatGPT auf der Website? Drei DSGVO-Risiken, die die meisten Unternehmen übersehen.',
  subline:
    'KI-Chatbots, generierte Texte, KI-Empfehlungssysteme — der EU AI Act und die DSGVO stellen konkrete Anforderungen. Prüfen Sie jetzt, ob Ihre KI-Integrationen konform sind — bevor es die Behörde tut.',
  primaryCtaHref: '/audit?source=chatgpt-dsgvo',
  primaryCtaLabel: 'KI-Compliance jetzt prüfen',
  painCards: [
    {
      Icon: Bot,
      title: 'ChatGPT-Widget auf Website überträgt Nutzereingaben an OpenAI (USA)',
      body: 'Jede Nutzereingabe in einen OpenAI-basierten Chatbot wird an OpenAI-Server in den USA übertragen. Das ist ein Drittland-Transfer nach Art. 44 DSGVO — mit spezifischen Anforderungen an Datenschutzerklärung und Rechtsgrundlage.',
    },
    {
      Icon: AlertOctagon,
      title: 'KI-generierte Texte ohne Kennzeichnung — Art. 50 EU AI Act',
      body: 'Seit 2. August 2025 müssen KI-generierte oder KI-bearbeitete Inhalte nach Art. 50 Abs. 2 EU AI Act als solche gekennzeichnet werden. Die meisten Websites setzen dies bisher nicht um.',
    },
    {
      Icon: FileSearch,
      title: 'Kein Verzeichnis der KI-Systeme — fehlende Dokumentationspflicht',
      body: 'Art. 13 EU AI Act und erweiterte DSGVO-Transparenzpflichten verlangen ein Verzeichnis eingesetzter KI-Systeme mit Beschreibung, Zweck und Risikobewertung. In den meisten KMU fehlt dieses vollständig.',
    },
  ],
  checksTitle: 'Was wir bei KI-Integrationen prüfen',
  checks: [
    {
      title: 'KI-Tool-Erkennung + Drittland-Transfer-Analyse',
      body: 'Wir erkennen automatisch eingebettete KI-Chatbots, Recommendation-Engines und generative Tools (OpenAI, Google Gemini, Anthropic, Intercom AI, Drift AI etc.). Mit Bewertung des Drittland-Transfer-Risikos und Rechtsgrundlagen-Check.',
    },
    {
      title: 'EU AI Act Annex III + Markierungspflicht',
      body: 'Mapping aller erkannten KI-Systeme auf EU AI Act Risikoklassen (minimal, begrenzt, hoch, inakzeptabel). Konkrete Hinweise zur Kennzeichnungspflicht nach Art. 50 und Dokumentationsanforderungen nach Art. 13.',
    },
    {
      title: 'KI-System-Inventar + Evidence-Dokumentation',
      body: 'Strukturiertes Inventar aller eingesetzten KI-Systeme mit Zeitstempel — als Nachweis für interne Dokumentationspflichten und potenzielle Behördenanfragen. Exportierbar als PDF oder JSON.',
    },
  ],
  faqTitle: 'Häufige Fragen zu KI-Tools & DSGVO',
  faqs: [
    {
      q: 'Darf ich ChatGPT auf meiner Website einsetzen?',
      a: 'Grundsätzlich ja, wenn Sie die datenschutzrechtlichen Voraussetzungen erfüllen: Nennung in der Datenschutzerklärung, Rechtsgrundlage für den Drittland-Transfer, ggf. Standard-Vertragsklauseln mit OpenAI. Wir prüfen, ob das bei Ihnen korrekt umgesetzt ist.',
    },
    {
      q: 'Wann gilt der EU AI Act für mein Unternehmen?',
      a: 'Die wichtigsten Pflichten (Verbote inakzeptabler Systeme, Transparenzpflichten für GPAI-Modelle) gelten seit August 2024. Hochrisiko-Systeme (Annex III) gelten ab August 2026. Transparenzpflichten für KI-generierte Inhalte (Art. 50) gelten seit August 2025.',
    },
    {
      q: 'Was ist, wenn mein KI-Tool personenbezogene Daten verarbeitet?',
      a: 'Dann brauchen Sie eine Rechtsgrundlage nach Art. 6 DSGVO, ggf. einen AVV mit dem Anbieter und — wenn es besondere Kategorien betrifft (z. B. Gesundheitsdaten) — Art. 9 DSGVO-Konformität. Wir prüfen den technischen Stand, Ihren DSB klärt die rechtliche Einordnung.',
    },
    {
      q: 'Wir nutzen KI nur intern — brauchen wir trotzdem Dokumentation?',
      a: 'Ja. Auch intern eingesetzte KI-Systeme, die personenbezogene Daten verarbeiten, unterliegen der DSGVO. Hochrisiko-Systeme (z. B. HR-Screening, Kreditentscheidung) brauchen zusätzlich EU AI Act-Dokumentation.',
    },
  ],
};

export function ChatgptDsgvoLanding() {
  return <NicheLanding config={CONFIG} />;
}
