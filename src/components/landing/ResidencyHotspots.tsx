import { useState } from 'react';

/**
 * ResidencyHotspots — Markierungen über dem Europa-Globus im Hero.
 *
 * ⚠️ Claim-Disziplin: Die Standorte und Werte sind eine Produktvorschau, keine
 * Karte real betriebener Systeme. Der Block trägt deshalb sichtbar
 * „EU-Datenresidenz · Produktvorschau"; jeder Hotspot wiederholt den Hinweis
 * für Screenreader.
 *
 * Positionierung: prozentual über dem Hintergrundbild und bewusst nur ab `lg`
 * sichtbar. Auf Mobile ist der Globus stark abgedunkelt und beschnitten — die
 * Punkte lägen dort auf beliebigen Bildstellen und wären irreführend.
 *
 * Zugänglichkeit: Jeder Hotspot ist ein echter `<button>` (Fokus, Tastatur,
 * Escape schließt). Kein Hover-only — das Panel öffnet auch per Klick/Enter.
 */

interface Hotspot {
  city: string;
  /** Position in Prozent, bezogen auf den Hero-Container. */
  top: string;
  left: string;
  residency: string;
  systems: string;
  risk: string;
}

/**
 * Positionen sind empirisch gewählt: Sie liegen bei 1024/1280/1440/1920 px
 * jeweils in Bereichen, die KEINE Metrik-Karte überlagert — sonst fängt die
 * Karte die Mausereignisse ab und der Hotspot ist nur per Tastatur erreichbar.
 * Beim Verschieben der Karten müssen diese Werte erneut geprüft werden
 * (e2e-Test „Hotspots sind nicht von Karten verdeckt").
 * Die relative Lage zueinander folgt grob der echten Geografie.
 */
const HOTSPOTS: readonly Hotspot[] = [
  { city: 'Amsterdam', top: '34%', left: '51%', residency: 'EU · Amsterdam', systems: '4 KI-Systeme', risk: 'Risiko: niedrig' },
  { city: 'Berlin', top: '36%', left: '65%', residency: 'EU · Berlin', systems: '6 KI-Systeme', risk: 'Risiko: niedrig' },
  { city: 'Frankfurt', top: '56%', left: '62%', residency: 'EU · Frankfurt', systems: '9 KI-Systeme', risk: 'Risiko: mittel' },
  { city: 'Paris', top: '64%', left: '50%', residency: 'EU · Paris', systems: '5 KI-Systeme', risk: 'Risiko: hoch' },
];

export function ResidencyHotspots() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div
      className="hidden lg:block absolute inset-0 z-20 pointer-events-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(null);
      }}
    >
      <p className="absolute bottom-6 left-1/2 font-mono text-[9px] tracking-widest text-white/40 uppercase px-2 py-1 rounded bg-[rgb(3,7,18)]/60 backdrop-blur-sm">
        EU-Datenresidenz · Produktvorschau
      </p>

      {HOTSPOTS.map((h) => {
        const isOpen = open === h.city;
        return (
          <div key={h.city} className="absolute pointer-events-auto" style={{ top: h.top, left: h.left }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : h.city)}
              onMouseEnter={() => setOpen(h.city)}
              onMouseLeave={() => setOpen(null)}
              onFocus={() => setOpen(h.city)}
              onBlur={() => setOpen(null)}
              aria-expanded={isOpen}
              className="group relative flex items-center justify-center w-11 h-11 -m-5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span className="absolute w-2 h-2 rounded-full bg-cyan-400 motion-safe:animate-pulse" aria-hidden="true" />
              <span className="absolute w-4 h-4 rounded-full border border-cyan-400/40 group-hover:border-cyan-400/70 transition-colors" aria-hidden="true" />
              <span className="sr-only">
                {h.city}: {h.systems}, {h.risk}, {h.residency}. Produktvorschau, keine Live-Daten.
              </span>
            </button>

            {isOpen && (
              <div
                role="tooltip"
                className="absolute left-5 top-1 w-44 p-3 border border-white/15 bg-[rgb(3,7,18)]/95 backdrop-blur-md rounded-lg shadow-2xl animate-fade-in"
              >
                <p className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase mb-1.5">{h.city}</p>
                <p className="font-mono text-[10px] text-white/70 leading-relaxed">{h.systems}</p>
                <p className="font-mono text-[10px] text-white/70 leading-relaxed">{h.risk}</p>
                <p className="font-mono text-[10px] text-white/45 leading-relaxed mt-1">{h.residency}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
