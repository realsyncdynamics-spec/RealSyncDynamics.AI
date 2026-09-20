import {
  LANDING_ACCENT,
  LANDING_ACCENT_LITE,
  LANDING_ACCENT_SOFT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_PANEL,
  LANDING_TEXT,
} from './landing-theme';

/**
 * „Von der KI-Nutzung zur kontrollierten KI-Organisation" — die sechs
 * Stationen der Governance Runtime aus dem Entwurf.
 *
 * Der Entwurf zeichnet sie als Zeitleiste: sechs Spalten, eine durchgehende
 * Verlaufslinie auf Höhe der Nummernkreise, darunter Titel und Satz. Ab
 * `lg` steht die Linie, darunter bricht das Raster auf zwei Spalten und die
 * Linie entfällt — eine Leiste, die über zwei Zeilen springt, behauptet
 * eine Reihenfolge, die sie nicht mehr zeigt.
 *
 * ## Warum sechs Stationen und nicht vier
 *
 * Der Hero trägt `DISCOVER → CLASSIFY → ENFORCE → PROVE` — die Kurzform für
 * das Versprechen in einer Zeile. Diese Sektion ist die ausführliche
 * Fassung: Sie trennt `ASSESS` von `DISCOVER` und `EVIDENCE` von `AUDIT`,
 * weil das die Schritte sind, an denen in der Praxis Arbeit anfällt. Beide
 * Ketten stehen so im Entwurf; sie widersprechen sich nicht, sie haben
 * unterschiedliche Auflösung.
 */

type RuntimeStation = {
  n: string;
  title: string;
  text: string;
};

/** Wortlaut aus dem Entwurf — nicht umformulieren ohne Abgleich. */
const STATIONS: readonly RuntimeStation[] = [
  {
    n: '01',
    title: 'DISCOVER',
    text: 'KI-Systeme, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.',
  },
  {
    n: '02',
    title: 'ASSESS',
    text: 'Risiken bewerten und Systeme gegen Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.',
  },
  {
    n: '03',
    title: 'GOVERN',
    text: 'Verbindliche Policies, Verantwortlichkeiten und Kontrollanforderungen zentral definieren.',
  },
  {
    n: '04',
    title: 'ENFORCE',
    text: 'Governance-Regeln operativ durchsetzen und Abweichungen kontrolliert behandeln.',
  },
  {
    n: '05',
    title: 'EVIDENCE',
    text: 'Prüfungen, Entscheidungen, Änderungen und Kontrollen nachvollziehbar dokumentieren.',
  },
  {
    n: '06',
    title: 'AUDIT',
    text: 'Eine konsistente Governance-Historie für Management, interne Kontrollen und Audits bereitstellen.',
  },
];

export function GovernanceRuntimeSection() {
  return (
    <section
      id="runtime"
      className="border-b border-white/[0.06] py-[72px] lg:py-[88px]"
      data-runtime-stations={STATIONS.length}
    >
      <div className="mx-auto max-w-[1280px] px-[4vw]">
        <p
          className="text-[10px] tracking-[0.22em]"
          style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
        >
          GOVERNANCE RUNTIME
        </p>
        <h2
          className="mt-4 max-w-2xl text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] leading-[1.12] tracking-[-0.03em]"
          style={{ fontWeight: 600, color: LANDING_TEXT }}
        >
          Von der KI-Nutzung zur{' '}
          <span style={{ color: LANDING_ACCENT }}>kontrollierten KI-Organisation.</span>
        </h2>

        <div className="relative mt-[46px]">
          {/* Verlaufslinie auf Höhe der Nummernkreise — nur wo alle sechs
              Stationen in einer Zeile stehen. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[19px] hidden h-[2px] lg:block"
            style={{
              background: `linear-gradient(90deg, ${LANDING_ACCENT_SOFT}, ${LANDING_ACCENT_LITE} 50%, ${LANDING_ACCENT})`,
            }}
          />

          <ol className="relative grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-6 lg:gap-y-0">
            {STATIONS.map((station) => (
              <li key={station.n} className="lg:pr-[18px]" data-station={station.title}>
                <span
                  className="grid h-10 w-10 place-items-center rounded-full border text-[12px]"
                  style={{
                    fontFamily: LANDING_MONO,
                    backgroundColor: LANDING_PANEL,
                    borderColor: `${LANDING_ACCENT}55`,
                    color: LANDING_ACCENT,
                  }}
                >
                  {station.n}
                </span>
                <h3
                  className="mt-[18px] text-[13px] tracking-[0.2em]"
                  style={{ fontFamily: LANDING_MONO, color: LANDING_TEXT }}
                >
                  {station.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {station.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
