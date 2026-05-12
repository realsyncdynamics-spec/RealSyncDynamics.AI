/**
 * Honest pilot/beta placeholder. No fake logos, no fabricated quotes.
 *
 * Surfaces the current pilot status as a deliberate placeholder block,
 * with three named slots (Pilotkunden / Beta-Partner / Case Studies) that
 * can be filled with real content once contracts and consent are in place.
 *
 * Replace the placeholder bodies with real names + a short context line per
 * slot once a partner has signed off on public attribution.
 */
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

interface Slot {
  eyebrow: string;
  title: string;
  body: string;
}

// TODO(social-proof): replace these placeholder slots with real partners
// once written consent for public attribution is on file.
const SLOTS: Slot[] = [
  {
    eyebrow: 'Pilotkunden',
    title: 'In Aufnahme',
    body: 'Wir nehmen aktuell eine kleine Anzahl Pilotkunden auf — Fokus: SaaS-Anbieter und Datenschutz-Kanzleien im DACH-Raum.',
  },
  {
    eyebrow: 'Beta-Partner',
    title: 'Beta-Programm aktiv',
    body: 'Die Plattform befindet sich im Beta-Stadium. Beta-Partner erhalten direkten Produkt-Einfluss und reduzierte Konditionen.',
  },
  {
    eyebrow: 'Case Studies',
    title: 'In Vorbereitung',
    body: 'Erste veröffentlichbare Case Studies erscheinen, sobald Pilotkunden eine schriftliche Freigabe für die öffentliche Nennung erteilt haben.',
  },
];

export function PilotPartnersPlaceholder() {
  return (
    <section
      id="pilot-partner"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            Status der Plattform
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-2xl mx-auto">
            Pilotkunden, Beta-Partner und Case Studies
          </h2>
          <p className="mt-4 text-sm text-silver-400 max-w-2xl mx-auto leading-relaxed">
            Wir zeigen hier nur, was tatsächlich passiert ist. Keine Stock-Logos, keine erfundenen Zitate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {SLOTS.map((slot) => (
            <div
              key={slot.eyebrow}
              className="p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 rounded-none"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-2">
                {slot.eyebrow}
              </div>
              <div className="font-display font-bold text-titanium-50 text-base mb-2">
                {slot.title}
              </div>
              <p className="text-sm text-silver-300 leading-relaxed">{slot.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/contact-sales?source=pilot-partner"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-obsidian-950 text-sm font-semibold rounded-none transition-colors"
          >
            <Sparkles className="h-4 w-4" /> Als Pilotkunde anfragen
          </Link>
        </div>
      </div>
    </section>
  );
}
