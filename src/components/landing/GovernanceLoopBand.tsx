import { HERO_OPERATING_LOOP } from '../governance-frontend/hero-content';
import { LAYERS } from '../../content/runtimeVocab';
import {
  GA_DISPLAY,
  GA_GOLD_LITE,
  GA_LINE,
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_TEXT,
} from './governance-ai-theme';

/**
 * Governance-Loop unter dem Hero — die vier Stationen als Leitungsband.
 *
 * ## Beide Namen kommen aus der SSoT
 *
 * Die Station heißt wie im Operating Loop (`HERO_OPERATING_LOOP`), die
 * darunterliegende Ebene wie im Produkt-Spine (`LAYERS`). Der Prototyp hatte
 * beide Reihen als Literale — damit wäre die Seite beim nächsten Umbenennen
 * einer Ebene still auseinandergelaufen. Hier werden sie paarweise
 * zusammengeführt: Station `i` gehört zu Ebene `i`.
 *
 * Fällt die Zahl der Stationen und Ebenen auseinander, rendert die Sektion
 * nichts — eine halbe Schleife wäre schlechter als keine.
 */

/** Beschreibt, was an der jeweiligen Station passiert. */
const STATION_BLURBS: readonly string[] = [
  'Headers, Cookies, Tracker, AI-Endpoints und Third-Parties in Sekunden inventarisiert.',
  'Findings nach DSGVO-Artikel und AI-Act-Risikoklasse eingeordnet, ins Register überführt.',
  'Policies als ausführbare Kontrollen — Agenten schlagen Fixes vor, Freigaben bleiben beim Menschen.',
  'Jeder Lauf in der Evidence-Chain versiegelt; Drift wird erkannt und dokumentiert.',
];

const STATIONS = HERO_OPERATING_LOOP.split('→').map((part) => part.trim());

export function GovernanceLoopBand() {
  if (STATIONS.length !== LAYERS.length || STATIONS.length !== STATION_BLURBS.length) return null;

  return (
    <section
      className="relative z-[1] border-t px-[4vw] py-[clamp(40px,5vw,64px)]"
      style={{
        borderColor: GA_LINE_SOFT,
        background: 'linear-gradient(180deg, rgba(20,22,25,.7), rgba(16,17,20,.82))',
      }}
      aria-label="Governance Loop"
    >
      <div className="relative mx-auto grid w-full max-w-[1500px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Leitung mit wanderndem Stromimpuls — erst ab der vierspaltigen
            Anordnung sinnvoll, darunter stehen die Knoten untereinander. */}
        <div
          className="ga-loop-wire pointer-events-none absolute inset-x-0 top-3 hidden h-px lg:block"
          style={{
            background:
              `linear-gradient(90deg, transparent, ${GA_LINE} 6%, ${GA_LINE} 94%, transparent)`,
          }}
          aria-hidden="true"
        />

        {STATIONS.map((station, index) => (
          <div
            key={station}
            className="relative border-l pb-[22px] pl-[26px] pr-[22px] pt-[30px]"
            style={{ borderColor: GA_LINE }}
          >
            <span
              className="absolute -left-[5px] top-2 h-[9px] w-[9px] rounded-full"
              style={{
                backgroundColor: GA_GOLD_LITE,
                boxShadow: '0 0 0 4px rgba(201,162,74,.18), 0 0 14px rgba(230,201,138,.6)',
              }}
              aria-hidden="true"
            />
            <small
              className="block text-[11px] tracking-[.2em]"
              style={{ fontFamily: GA_MONO, color: GA_GOLD_LITE }}
            >
              {String(index + 1).padStart(2, '0')} · {LAYERS[index].title.toUpperCase()}
            </small>
            <h3
              className="mt-2 text-[22px] tracking-[-.02em]"
              style={{ fontFamily: GA_DISPLAY, fontWeight: 600, color: GA_TEXT }}
            >
              {station}
            </h3>
            <p
              className="mt-2 text-[13px] leading-[1.6] text-pretty"
              style={{ color: GA_MUTED }}
            >
              {STATION_BLURBS[index]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
