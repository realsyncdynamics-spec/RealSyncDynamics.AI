import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, AlertTriangle, ArrowLeft, Clock } from 'lucide-react';

interface FaqEntry {
  q: string;
  a: string;
  ref?: string;
  category: 'grundlagen' | 'risiko' | 'pflichten' | 'fristen' | 'sanktionen' | 'praxis';
}

const faqs: FaqEntry[] = [
  // Grundlagen
  { category: 'grundlagen', q: 'Was ist der EU AI Act?', a: 'Der AI Act (Verordnung (EU) 2024/1689) ist die weltweit erste umfassende Regulierung von KI-Systemen. Er trat im August 2024 in Kraft und gilt EU-weit unmittelbar — wie die DSGVO. Anders als die DSGVO regelt er nicht primär Daten, sondern KI-Systeme als Produkt.', ref: 'VO (EU) 2024/1689' },
  { category: 'grundlagen', q: 'Wer ist betroffen?', a: 'Alle Anbieter, Importeure, Händler und Betreiber von KI-Systemen, die in der EU Wirkung entfalten — auch ohne EU-Sitz (Marktortprinzip). Kanzleien, Krankenhäuser, Banken, HR-Abteilungen und Behörden, die KI einsetzen, sind als „Betreiber" verantwortlich.', ref: 'AI Act Art. 2' },
  { category: 'grundlagen', q: 'Verhältnis zur DSGVO?', a: 'Komplementär — nicht ersetzend. AI Act regelt KI als Produkt (Sicherheit, Transparenz), DSGVO regelt personenbezogene Daten in der KI. Beide gelten parallel. Eine DSFA ist bei High-Risk-KI quasi immer Pflicht.', ref: 'AI Act Erwägungsgrund 9' },

  // Risiko-Klassen
  { category: 'risiko', q: 'Welche Risiko-Klassen gibt es?', a: 'Vier Stufen: (1) Unacceptable Risk — verboten (Social Scoring, Realtime-Biometrie im öffentlichen Raum). (2) High-Risk — strenge Auflagen (Medizin, Verkehr, HR, Bonität, Strafverfolgung). (3) Limited Risk — Transparenzpflichten (Chatbots, Deepfakes). (4) Minimal Risk — keine Auflagen (Spam-Filter, Spielhilfen).', ref: 'AI Act Art. 5–6' },
  { category: 'risiko', q: 'Was zählt als High-Risk?', a: 'Anhang III listet 8 Bereiche: Biometrische Identifikation, kritische Infrastruktur, Bildung, Beschäftigung (HR-Tools, Bewerber-Screening), Zugang zu wesentlichen Dienstleistungen (Bonität, Krankenversicherung), Strafverfolgung, Migration, Justiz und demokratische Prozesse.', ref: 'AI Act Anhang III' },
  { category: 'risiko', q: 'Sind ChatGPT/Claude/Gemini High-Risk?', a: 'Als General-Purpose-AI-Models (GPAI) erstmal nicht — sie haben einen eigenen Pflicht-Katalog (Transparenz, Trainingsdaten-Doku, Copyright-Schutz). ABER: Sobald Du sie in einem High-Risk-Kontext einsetzt (z. B. Bewerber-Screening), wird DEIN System High-Risk und Du übernimmst die Anbieter-Pflichten.', ref: 'AI Act Art. 51 + Art. 25' },

  // Pflichten
  { category: 'pflichten', q: 'Welche Pflichten haben High-Risk-Anbieter?', a: 'Risk-Management-System, Datenqualitäts-Management, Technische Dokumentation, Logging-Pflicht, Transparenzpflicht gegenüber Betreibern, Human Oversight, Genauigkeit + Robustheit + Cybersicherheit. Plus CE-Kennzeichnung und EU-Datenbank-Registrierung.', ref: 'AI Act Art. 8–17' },
  { category: 'pflichten', q: 'Was bedeutet Human Oversight?', a: 'Menschen müssen das KI-System überwachen, seine Output verstehen, eingreifen und stoppen können. Bei automatisierten Entscheidungen mit Folgen für Betroffene (Bewerbung abgelehnt, Kredit verweigert) braucht es einen menschlichen Override. Konkret: Stop-Button + Audit-Trail aller Entscheidungen.', ref: 'AI Act Art. 14' },
  { category: 'pflichten', q: 'Welche Logging-Pflichten gelten?', a: 'High-Risk-Systeme müssen automatische Logs führen über: Input-Daten, Output, Entscheidungs-Begründung, Identität von Bedienpersonal. Aufbewahrung: 6 Monate min., bei behördlicher Anordnung länger. Logs müssen revisionssicher sein.', ref: 'AI Act Art. 12' },
  { category: 'pflichten', q: 'Was muss in der Technischen Dokumentation stehen?', a: 'Anhang IV gibt 9 Punkte vor: System-Beschreibung, Entwicklungsmethodik, Trainingsdaten-Quellen + Bias-Mitigation, Performance-Metriken, Test-Verfahren, Risiko-Management-Maßnahmen, Cybersecurity, Konformitätsbewertung, EU-Konformitätserklärung.', ref: 'AI Act Art. 11 + Anhang IV' },

  // Fristen
  { category: 'fristen', q: 'Wann gilt der AI Act?', a: 'Stufenweise: (1) Verbotene Praktiken: 2. Februar 2025. (2) GPAI-Pflichten: 2. August 2025. (3) High-Risk-Systeme + Sanktionsregime: 2. August 2026. (4) Bereits in Verkehr gebrachte High-Risk-Systeme bekommen bis 2. August 2027 Zeit zur Anpassung.', ref: 'AI Act Art. 113' },
  { category: 'fristen', q: 'Was muss bis 2. August 2026 passieren?', a: 'Wer als Anbieter oder Betreiber eines High-Risk-KI-Systems im Markt ist, muss spätestens dann compliance-ready sein: Conformity Assessment, CE-Kennzeichnung, Risk-Management, Doku, Logging, Human Oversight. Wer es nicht ist, riskiert Marktrückzug + Bußgeld.', ref: 'AI Act Art. 113 lit. b' },
  { category: 'fristen', q: 'Was passiert mit GPAI-Modellen ab 2. August 2025?', a: 'Anbieter von General-Purpose AI Models (OpenAI, Anthropic, Mistral, Meta) müssen Trainingsdaten-Zusammenfassungen veröffentlichen, Copyright respektieren, technische Doku liefern. Bei „systemic risk"-Modellen (FLOPS > 10²⁵) zusätzlich Stresstest + Cyber-Risk-Mitigation.', ref: 'AI Act Art. 53 + Art. 55' },

  // Sanktionen
  { category: 'sanktionen', q: 'Wie hoch sind die Bußgelder?', a: 'Drei Stufen: (1) Verstoß gegen verbotene Praktiken: bis 35 Mio. € oder 7 % des weltweiten Jahresumsatzes. (2) Sonstige Pflichten (High-Risk): bis 15 Mio. € oder 3 %. (3) Falschangaben gegenüber Behörden: bis 7,5 Mio. € oder 1 %.', ref: 'AI Act Art. 99' },
  { category: 'sanktionen', q: 'Wer setzt durch?', a: 'In Deutschland: Bundesnetzagentur als Marktüberwachungsbehörde + die jeweiligen Sektor-Regulierer (BfDI für Datenschutz, BaFin für Finanzen, BfArM für Medizinprodukte). EU-weit koordiniert das AI Office in Brüssel.', ref: 'AI Act Art. 70 + Art. 64' },
  { category: 'sanktionen', q: 'Wirkt der AI Act extraterritorial?', a: 'Ja. Auch US-, UK- oder Schweizer Anbieter sind betroffen, sobald ihr KI-System in der EU genutzt wird oder Output in der EU Wirkung hat. Marktortprinzip wie DSGVO. Ausnahme nur bei privater nicht-beruflicher Nutzung.', ref: 'AI Act Art. 2 Abs. 1' },

  // Praxis
  { category: 'praxis', q: 'Was sollte ich JETZT tun?', a: '1. Inventar aller KI-Systeme im Unternehmen (auch SaaS-Tools mit KI-Features). 2. Risiko-Klassifikation jedes Systems. 3. Bei High-Risk: Gap-Analyse zu den Pflichten. 4. Datenschutz-Folgenabschätzung (DSGVO Art. 35). 5. Human-Oversight-Prozesse + Audit-Log aufbauen. 6. AVV mit allen KI-Anbietern.', ref: 'AI Act Art. 26' },
  { category: 'praxis', q: 'Brauche ich einen AI-Beauftragten?', a: 'Aktuell nicht explizit gefordert (anders als DSGVO mit DSB). Aber: Die Pflicht zu Human Oversight, Risk-Management und Logging zwingt de facto eine zuständige Person/Rolle. Best Practice: Doppelrolle DSB + AI-Compliance-Beauftragter.', ref: 'AI Act Art. 14 + 9' },
  { category: 'praxis', q: 'Gibt es Erleichterungen für KMU?', a: 'Begrenzt. Art. 62 fordert „Berücksichtigung der Interessen kleinerer Anbieter" — z. B. priorisierte Beratung durch Behörden, vereinfachte Doku-Vorlagen, niedrigere Konformitätsbewertungs-Gebühren. KMU bleiben aber materiell vollständig in der Pflicht, sobald sie High-Risk-Systeme einsetzen.', ref: 'AI Act Art. 62' },
  { category: 'praxis', q: 'Wie passt der AI Act zu BAIT/MaRisk?', a: 'BAIT/MaRisk haben bereits hohe Anforderungen an KI in Banken (AT 4.5, AT 7.2). AI Act ergänzt: Konformitätsbewertung als Produkt + EU-Datenbank-Registrierung. Doppel-Compliance ist möglich, wenn beide Frameworks abgebildet sind. Hier brauchst Du verlässlich nachvollziehbare Audit-Logs über jeden Modellaufruf.', ref: 'AI Act Art. 6 Abs. 2 + BAIT AT 4.5' },
];

const categoryMeta: Record<FaqEntry['category'], { label: string; color: string }> = {
  grundlagen:  { label: 'Grundlagen',         color: 'text-emerald-300 border-emerald-900' },
  risiko:      { label: 'Risiko-Klassen',     color: 'text-orange-300 border-orange-900' },
  pflichten:   { label: 'Pflichten',          color: 'text-blue-300 border-blue-900' },
  fristen:     { label: 'Fristen',            color: 'text-amber-300 border-amber-900' },
  sanktionen:  { label: 'Sanktionen',         color: 'text-red-300 border-red-900' },
  praxis:      { label: 'Praxis',             color: 'text-purple-300 border-purple-900' },
};

export function AiActFaq() {
  const grouped = groupBy(faqs, (f) => f.category);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <article>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                <Clock className="h-3 w-3" /> Stand: Mai 2026 · Anwendung ab 2. August 2026
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                EU AI Act — <span className="text-security-400">{faqs.length} Fragen</span> für Entscheider
              </h1>
              <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
                Alle 18 Fragen, die Du als Geschäftsführung, Compliance oder DSB jetzt beantworten musst —
                mit Verweisen auf die konkreten Artikel der Verordnung.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                <Link to="/audit" className="inline-flex items-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                  Compliance-Status der eigenen Site prüfen <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/dsgvo-ki-checkliste" className="inline-flex items-center gap-2 px-5 py-2.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                  DSGVO-Checkliste
                </Link>
              </div>
            </div>

            <div className="space-y-12">
              {(Object.entries(grouped) as [FaqEntry['category'], FaqEntry[]][]).map(([cat, list]) => (
                <section key={cat}>
                  <div className={`inline-block px-3 py-1 border ${categoryMeta[cat].color} text-xs font-bold uppercase tracking-wider rounded-none mb-4`}>
                    {categoryMeta[cat].label}
                  </div>
                  <div className="space-y-4">
                    {list.map((entry, i) => <FaqItem key={`${cat}-${i}`} entry={entry} />)}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-16 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                    Die 87 Tage bis zum 2. August 2026 reichen nicht für Eigenbau.
                  </h2>
                  <p className="text-sm text-titanium-300 leading-relaxed">
                    RealSync Dynamics liefert Audit-Log + Human-Oversight-Workflow + Risk-Klassifikation als SaaS.
                    EU-Datenresidenz, EU-Hosting in Frankfurt, optional self-hosted für sensible Cases.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link to="/contact-sales?source=ai-act-faq" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                  Demo buchen <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                  Compliance-Matrix
                </Link>
                <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                  Kostenloser Site-Scan
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </div>
  );
}

function FaqItem({ entry }: { entry: FaqEntry }) {
  return (
    <details className="group bg-obsidian-900 border border-titanium-900 rounded-none">
      <summary className="cursor-pointer p-4 sm:p-5 list-none flex items-start gap-3">
        <span className="font-display font-bold text-titanium-50 text-sm sm:text-base flex-1">{entry.q}</span>
        <span className="text-titanium-500 text-xs group-open:hidden mt-1">+</span>
        <span className="text-titanium-500 text-xs hidden group-open:inline mt-1">−</span>
      </summary>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1">
        <p className="text-sm text-titanium-300 leading-relaxed mb-2">{entry.a}</p>
        {entry.ref && <div className="text-[11px] text-titanium-500 font-mono">{entry.ref}</div>}
      </div>
    </details>
  );
}

function Header() {
  return (
    <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
      <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div className="font-display font-bold text-sm tracking-tight text-titanium-50">EU AI Act FAQ</div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
        <div>© 2026 RealSync Dynamics · Made in Germany</div>
        <div className="flex flex-wrap gap-3">
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-300">Impressum</Link>
          <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
        </div>
      </div>
    </footer>
  );
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}
