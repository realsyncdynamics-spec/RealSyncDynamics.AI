import { Link } from 'react-router-dom';
import { Brain, Sparkles, FileSearch, Shield, BookOpen, ArrowRight, AlertTriangle } from 'lucide-react';

/**
 * AIActPanel — Modal-Content für „AI-Act-Layer".
 *
 * Bringt den AI-Act-USP gleichberechtigt zur DSGVO-Achse in den Hero.
 * Verlinkt auf bestehenden /ai-act-klassifikator (Single-System) +
 * neuen /ai-act-workflows (Portfolio-Inventory), beide free.
 *
 * Strategie-Hintergrund: KMU mit Automatisierung haben Angst vor AI-Act-
 * Strafen. Agenturen und Berater brauchen ein Portfolio-Tool, das alle
 * AI-Workflows einer Org gegen Annex III mappt.
 */
export function AIActPanel() {
  return (
    <div className="space-y-6">
      <div className="bg-obsidian-950 border-l-2 border-l-amber-500 pl-4 py-3">
        <p className="text-titanium-200 text-sm leading-relaxed">
          Die EU-AI-Act-Stichtage rollen heran — <strong className="text-titanium-50">Art. 5 (verbotene Praktiken)</strong>{' '}
          gilt seit 2. August 2024, <strong className="text-titanium-50">Annex III High-Risk-Pflichten</strong> ab
          2. August 2026. Für Agenturen und Compliance-Berater bedeutet das: Inventar erstellen, klassifizieren,
          Doku-Bundle vorbereiten — pro Mandant.
        </p>
      </div>

      {/* Two free tools */}
      <div>
        <h3 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Zwei Free-Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            to="/ai-act-klassifikator"
            className="group p-5 bg-obsidian-900 border border-titanium-900 hover:border-amber-700 rounded-none transition-colors block"
          >
            <div className="flex items-center gap-2 mb-2">
              <FileSearch className="h-4 w-4 text-amber-400" />
              <h4 className="font-display font-bold text-titanium-50 text-sm">Risk-Klassifikator (Single-System)</h4>
            </div>
            <p className="text-xs text-titanium-400 mb-3 leading-relaxed">
              12 Fragen — Indikative Annex-III-Einstufung mit Confidence-Score. Pro System / pro Use-Case.
            </p>
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 group-hover:text-amber-300 inline-flex items-center gap-1">
              Klassifikation starten <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link
            to="/ai-act-workflows"
            className="group p-5 bg-obsidian-900 border border-titanium-900 hover:border-amber-700 rounded-none transition-colors block"
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-amber-400" />
              <h4 className="font-display font-bold text-titanium-50 text-sm">Workflow-Inventar (Portfolio)</h4>
              <span className="ml-auto px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-amber-950/50 border border-amber-700 text-amber-300 rounded-none">
                Beta
              </span>
            </div>
            <p className="text-xs text-titanium-400 mb-3 leading-relaxed">
              Alle AI-Workflows einer Organisation sammeln (Chatbot, Lead-Scoring, Recommendation, …) und
              gemeinsam gegen Annex III mappen. Lokale Speicherung, kein Account.
            </p>
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 group-hover:text-amber-300 inline-flex items-center gap-1">
              Inventar starten <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </div>

      {/* What we cover */}
      <div>
        <h3 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Was wir abdecken</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { Icon: AlertTriangle, title: 'Art. 5 Verbote',           body: 'Emotion-Recognition / Workplace, Social-Scoring, Manipulation. 4 explizite Pre-Checks vor Inventarisierung.' },
            { Icon: Sparkles,      title: 'Annex III High-Risk',      body: 'Biometrie / HR / Bildung / Krediteinschätzung / kritische Infrastruktur / Strafverfolgung — Mapping pro Workflow.' },
            { Icon: BookOpen,      title: 'Art. 50 Transparenz',      body: 'Chatbots, Deepfakes, AI-generated Content. Markierungspflicht-Hinweise + Snippets für UX-Labels.' },
            { Icon: Shield,        title: 'GPAI + Foundation Models', body: 'Provider-Pflichten ab 2. August 2025. Für Agenturen, die GenAI-Workflows in Mandanten-Sites einbauen.' },
          ].map((it) => (
            <div key={it.title} className="p-4 bg-obsidian-950 border border-titanium-900 rounded-none">
              <div className="flex items-center gap-2 mb-1.5">
                <it.Icon className="h-3.5 w-3.5 text-amber-400" />
                <div className="font-display font-bold text-sm text-titanium-50">{it.title}</div>
              </div>
              <div className="text-xs text-titanium-400 leading-relaxed">{it.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Agency-CTA */}
      <div className="bg-obsidian-900 border border-amber-700 p-5 rounded-none">
        <h3 className="font-display font-bold text-titanium-50 text-base mb-1.5">Für Agenturen + Compliance-Berater</h3>
        <p className="text-sm text-titanium-300 mb-3 leading-relaxed">
          Multi-Mandanten-Inventar, White-Label-Reports, gemeinsamer DSGVO + AI-Act-Audit pro Domain.
          Procurement-tauglich, AVV-fertig, mit Conformity-Roadmap.
        </p>
        <Link
          to="/contact-sales?intent=agency_aiact"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-obsidian-950 text-sm font-bold rounded-none"
        >
          Pilot-Gespräch starten <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="text-[11px] text-titanium-500 text-center pt-2 border-t border-titanium-900 leading-relaxed">
        Alle Klassifikationen sind <strong className="text-titanium-300">indikativ</strong> — finale Einstufung von High-Risk-Systemen
        erfordert Conformity-Assessment durch Notified Body (Art. 43). Keine Rechtsberatung.
      </div>
    </div>
  );
}
