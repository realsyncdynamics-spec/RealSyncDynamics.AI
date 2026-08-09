import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Scale, ListChecks } from 'lucide-react';

/**
 * AuditExperience — Einstieg in den echten Audit plus Vorschau auf das, was
 * danach passiert.
 *
 * ⚠️ Bewusste Abweichung vom Auftrag (§12):
 * Der Auftrag skizziert einen vierstufigen Stepper mit Scope-Auswahl
 * (AI Systems / Website / Vendors / GDPR / EU AI Act) und laufendem
 * Discovery-Fortschritt. Die real existierende Audit-Engine ist jedoch
 * domain-basiert (`/audit?domain=…`) und kennt keine Scope-Auswahl. Ein
 * Stepper mit Scope-Checkboxen würde eine Funktion vortäuschen, die es nicht
 * gibt, und ein animierter „Scanning…"-Balken einen Backend-Lauf, der gar
 * nicht startet.
 *
 * Deshalb: Schritt 1 ist **echt** — die Domain-Eingabe übergibt an den
 * bestehenden Audit unter `/audit`. Die Schritte 2–4 sind als Vorschau
 * gekennzeichnet und beschreiben, was der Audit dann tut. Kein simulierter
 * Fortschritt, keine erfundenen Befundzahlen.
 */

const PREVIEW_STEPS = [
  {
    icon: Search,
    step: '02',
    title: 'Discovery',
    text: 'Der Scan erfasst Domain, eingebundene Dienste, Tracker, Datenflüsse und erkennbare KI-Komponenten.',
  },
  {
    icon: Scale,
    step: '03',
    title: 'Klassifizierung',
    text: 'Befunde werden nach Schwere und Regelwerk eingeordnet — DSGVO, TDDDG und EU-AI-Act-Risikoklasse.',
  },
  {
    icon: ListChecks,
    step: '04',
    title: 'Ergebnis',
    text: 'Sie erhalten Risikobewertung, priorisierte Befunde und die Maßnahmen, die zuerst zählen.',
  },
];

export function AuditExperience() {
  const [domain, setDomain] = useState('');
  const navigate = useNavigate();

  // Übergabe an den bestehenden Audit — dieselbe Route und Parametrik, die
  // /landing bereits benutzt. Kein eigener Scan-Pfad auf der Startseite.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = domain.trim();
    navigate(
      trimmed
        ? `/audit?domain=${encodeURIComponent(trimmed)}&source=home-audit`
        : '/audit?source=home-audit',
    );
  }

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden">
      {/* Schritt 1 — echter Einstieg */}
      <div className="p-5 sm:p-8 border-b border-white/10">
        <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-cyan-400 uppercase mb-2">
          01 · Start
        </p>
        <h3 className="text-lg sm:text-xl font-semibold mb-2">Welche Website soll geprüft werden?</h3>
        <p className="text-sm text-white/60 leading-relaxed mb-5 max-w-xl">
          Ohne Account, ohne Kreditkarte. Der Scan startet sofort und liefert eine Risikobewertung
          mit priorisierten Befunden.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg">
          <label htmlFor="audit-domain" className="sr-only">
            Domain für den kostenlosen Compliance Audit
          </label>
          <input
            id="audit-domain"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ihre-domain.de"
            className="flex-1 min-h-[48px] px-4 py-3 rounded-lg border border-white/15 bg-white/5 font-mono text-sm text-white placeholder-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus:border-white/30 transition-colors"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg shrink-0"
          >
            Audit starten<ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* Schritte 2–4 — Vorschau, ausdrücklich als solche gekennzeichnet */}
      <div className="px-5 sm:px-8 pt-5 pb-2 flex flex-wrap items-center gap-2">
        <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/40 uppercase">
          Was danach passiert
        </p>
        <p className="inline-flex items-center gap-1.5 font-mono text-[9px] sm:text-[10px] tracking-widest uppercase text-amber-300 border border-amber-300/30 bg-amber-300/10 rounded px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300" aria-hidden="true" />
          Vorschau
          <span className="sr-only"> — Beschreibung der Schritte, kein laufender Scan</span>
        </p>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 m-5 sm:m-8 mt-3 border border-white/10 rounded-xl overflow-hidden">
        {PREVIEW_STEPS.map(({ icon: Icon, step, title, text }) => (
          <li key={step} className="p-5 bg-[rgb(3,7,18)]">
            <div className="flex items-center gap-2 mb-2.5">
              <Icon className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="font-mono text-[9px] tracking-widest text-white/40 uppercase">
                {step} · {title}
              </span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
