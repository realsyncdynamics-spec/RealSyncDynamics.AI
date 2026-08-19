/**
 * Frankfurter Skyline als Silhouette.
 *
 * Freigegeben am 2026-08-19 (Frage 2 der Drei-Fragen-Regel): **ausdrücklich
 * eine Grafik, kein Foto.** Ein fotorealistisches Bild müsste lizenziert
 * eingekauft werden; diese Zeichnung ist rechtefrei, wiegt rund 2 KB und
 * skaliert verlustfrei — ein Foto in dieser Breite läge bei mehreren hundert.
 *
 * ## Warum die Türme benannt sind
 *
 * Eine beliebige Hochhausreihe ist keine Skyline, sondern Dekoration. Frankfurt
 * erkennt man an vier Silhouetten: der Pyramide des Messeturms, der Antenne des
 * Commerzbank-Towers, der Krone der Westendstraße 1 und dem Domturm. Fehlt
 * eine davon, könnte es Rotterdam sein. Die Höhenverhältnisse folgen den
 * echten (Commerzbank 300 m als Bezug), damit die Reihe stimmig wirkt.
 *
 * ## Keine Zufallswerte
 *
 * Die Füllbebauung steht als feste Liste, nicht als `Math.random()`. Zufall
 * ergäbe bei jedem Rendern eine andere Stadt — und im prärenderten HTML eine
 * andere als im Browser, was nach der Hydration sichtbar springt.
 */

/** Ein Baukörper: x-Position, Breite, Höhe, Dachform. */
type Building = {
  x: number;
  w: number;
  h: number;
  top?: 'flat' | 'pyramid' | 'crown' | 'round' | 'spire';
  /** Antennenhöhe über dem Dach, 0 = keine. */
  mast?: number;
};

const GROUND = 260;

/**
 * Luft ueber der hoechsten Spitze.
 *
 * Commerzbank-Tower: 212 hoch, Antenne 54 — die Spitze liegt bei
 * 260 - 212 - 54 = -6. Der Domturm reicht mit seiner Spire aehnlich weit.
 * Ohne diesen Rand schneidet die viewBox beides ab.
 */
const HEADROOM = 24;

/**
 * Die vier Wahrzeichen plus Füllbebauung. Reihenfolge von links nach rechts
 * entspricht grob dem Blick aus Süden über den Main.
 */
const BUILDINGS: readonly Building[] = [
  // ── Füllbebauung westlich ──
  { x: 20, w: 42, h: 74 },
  { x: 68, w: 30, h: 52 },
  { x: 104, w: 46, h: 96, top: 'round' },
  { x: 156, w: 34, h: 62 },
  // Trianon — flaches Dach mit Rücksprung
  { x: 196, w: 52, h: 138 },
  { x: 202, w: 40, h: 152 },
  { x: 254, w: 28, h: 58 },
  // Messeturm — die Pyramide
  { x: 288, w: 58, h: 176, top: 'pyramid' },
  { x: 352, w: 32, h: 66 },
  // Westendstraße 1 — die Krone
  { x: 390, w: 54, h: 146, top: 'crown' },
  { x: 450, w: 36, h: 74 },
  // Commerzbank Tower — höchster Bau, mit Antenne
  { x: 492, w: 62, h: 212, mast: 54 },
  { x: 560, w: 30, h: 68 },
  // Main Tower — runde Kappe, zwei Masten
  { x: 596, w: 52, h: 168, top: 'round', mast: 26 },
  { x: 654, w: 38, h: 82 },
  { x: 698, w: 44, h: 104 },
  // Taunusturm
  { x: 748, w: 44, h: 150 },
  { x: 798, w: 30, h: 60 },
  // Domturm — der einzige nicht-korporative Anker
  { x: 834, w: 26, h: 118, top: 'spire' },
  { x: 866, w: 40, h: 70 },
  // EZB — zwei versetzte Scheiben
  { x: 912, w: 34, h: 148 },
  { x: 942, w: 34, h: 132 },
  { x: 986, w: 46, h: 78 },
  // ── Füllbebauung östlich ──
  { x: 1040, w: 38, h: 96 },
  { x: 1084, w: 52, h: 66 },
  { x: 1142, w: 34, h: 112, top: 'round' },
  { x: 1182, w: 46, h: 74 },
  { x: 1234, w: 30, h: 92 },
  { x: 1270, w: 56, h: 60 },
  { x: 1332, w: 36, h: 88 },
  { x: 1374, w: 44, h: 68 },
  { x: 1424, w: 32, h: 104 },
  { x: 1462, w: 50, h: 72 },
  { x: 1518, w: 38, h: 90 },
  { x: 1562, w: 38, h: 62 },
];

function shapeOf({ x, w, h, top = 'flat' }: Building): string {
  const y = GROUND - h;
  switch (top) {
    case 'pyramid':
      // Spitze mittig, Höhe der Pyramide rund ein Drittel der Breite.
      return `M${x} ${GROUND} L${x} ${y} L${x + w / 2} ${y - w * 0.62} L${x + w} ${y} L${x + w} ${GROUND} Z`;
    case 'crown':
      // Halbrunde Krone, die über die Fassade hinausragt.
      return `M${x} ${GROUND} L${x} ${y} A${w / 2} ${w / 2.6} 0 0 1 ${x + w} ${y} L${x + w} ${GROUND} Z`;
    case 'round':
      return `M${x} ${GROUND} L${x} ${y} A${w / 2} ${w / 3.4} 0 0 1 ${x + w} ${y} L${x + w} ${GROUND} Z`;
    case 'spire':
      return `M${x} ${GROUND} L${x} ${y} L${x + w / 2} ${y - w * 1.9} L${x + w} ${y} L${x + w} ${GROUND} Z`;
    default:
      return `M${x} ${GROUND} L${x} ${y} L${x + w} ${y} L${x + w} ${GROUND} Z`;
  }
}

export function FrankfurtSkyline({ className }: { className?: string }) {
  return (
    <svg
      // Der Ursprung liegt bei -HEADROOM, nicht bei 0: Die Antenne des
      // hoechsten Baus reicht bis y = -6 und waere sonst abgeschnitten.
      // `test/landing/frankfurt-skyline.test.ts` rechnet das nach, statt es
      // zu glauben — der Fehler war in der Datenliste nicht zu sehen.
      viewBox={`0 ${-HEADROOM} 1600 ${GROUND + HEADROOM}`}
      // `slice` statt `meet`: Auf schmalen Bildschirmen soll die Reihe seitlich
      // beschnitten werden, nicht in der Höhe schrumpfen — eine flachgedrückte
      // Skyline sieht nach Fehler aus.
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Nach oben ausblendend, damit die Dächer in den Himmel übergehen
            statt als harte Kante zu stehen. */}
        <linearGradient id="fra-fade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0b1a24" stopOpacity=".92" />
          <stop offset="55%" stopColor="#0d2430" stopOpacity=".62" />
          <stop offset="100%" stopColor="#123444" stopOpacity=".22" />
        </linearGradient>
        <linearGradient id="fra-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="45%" stopColor="#67e8f9" stopOpacity=".55" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g fill="url(#fra-fade)">
        {BUILDINGS.map((b) => (
          <path key={`${b.x}-${b.h}`} d={shapeOf(b)} />
        ))}
      </g>

      {/* Antennen als Linien statt als schmale Rechtecke: Eine 2px-Linie
          bleibt bei jeder Skalierung sichtbar, ein 2px-Rechteck verschwindet. */}
      <g stroke="url(#fra-fade)" strokeWidth="2.5" strokeLinecap="round">
        {BUILDINGS.filter((b) => b.mast).map((b) => (
          <line
            key={`mast-${b.x}`}
            x1={b.x + b.w / 2}
            y1={GROUND - b.h}
            x2={b.x + b.w / 2}
            y2={GROUND - b.h - (b.mast ?? 0)}
          />
        ))}
      </g>

      {/* Lichtsaum auf der Dachkante — das Morgenlicht trifft die Stadt von
          hinten. Sehr schmal, sonst wirkt es wie ein Leuchtstreifen. */}
      <g stroke="url(#fra-rim)" strokeWidth="1.25" fill="none" opacity=".7">
        {BUILDINGS.map((b) => (
          <line
            key={`rim-${b.x}`}
            x1={b.x}
            y1={GROUND - b.h}
            x2={b.x + b.w}
            y2={GROUND - b.h}
          />
        ))}
      </g>
    </svg>
  );
}
