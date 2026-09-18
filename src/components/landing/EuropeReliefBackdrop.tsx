import type { GaTheme } from './use-ga-theme';

/**
 * Fester Hintergrund der Startseite — in zwei Ausprägungen.
 *
 * ## Genau eine Europa-Darstellung je Variante
 *
 *   titan — gebürstetes Titan, Carbon-Gewebe, Europa als fotorealistische
 *           Aufnahme in Metall/Gold getont
 *   night — Schwarz, Europa als fotografische Nachtaufnahme mit Stadtlichtern
 *
 * Beide Ebenen gleichzeitig zu zeigen war ein Fehler der ersten Fassung: Das
 * Foto bringt sein eigenes Europa mit, das Relief legte sich versetzt und in
 * anderem Maßstab darüber. Man sah Europa doppelt, und das las sich als
 * Defekt. Jede Variante zeigt den Kontinent deshalb genau einmal.
 *
 * ## Vollständig statisch
 *
 * Kein Lichtdrift, keine Dauerbewegung, keine Zeiger-Parallaxe und keine
 * Kameraprojektion. Der Hintergrund steht fest — er reagiert weder auf die
 * Maus noch auf die Zeit. Tiefe entsteht allein aus dem Relief selbst.
 *
 * ## Fotorealismus braucht ein Foto
 *
 * Beide Varianten setzen auf derselben Aufnahme auf (`public/europe-globe.webp`),
 * nur unterschiedlich getont: Nacht in Originalfarben, Titan entsättigt mit
 * einem Goldschleier im `color-dodge`. Eine frühere Fassung baute Europa als
 * SVG-Relief aus projizierter Natural-Earth-Geometrie nach — technisch sauber,
 * aber als Vektorgrafik bleibt es Illustration. Wo „fotorealistisch" gefordert
 * ist, führt daran kein Weg vorbei, dass ein Bild das Bild liefert.
 *
 * Das Relief samt Generator (`scripts/generate-europe-relief.mjs`) und Asset
 * ist deshalb entfallen; es steht in der Git-Historie, falls es zurück soll.
 */

export function EuropeReliefBackdrop({ theme }: { theme: GaTheme }) {
  const night = theme === 'night';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual={night ? 'europe-night-photo' : 'europe-relief-titan'}
      data-hero-framing="europe-right"
      data-hero-scenery={night ? 'europe-night-citylights' : 'titan-chrome-gold-network'}
      style={{
        background: night
          ? 'radial-gradient(70% 60% at 62% 40%, #070d14 0%, #04070a 58%, #010305 100%)'
          : // Lichtkante oben Mitte-links wie in der Bildreferenz, darunter eine
            // durchgehende Metallfläche im Mittelton. Der Verlauf lief vorher bis
            // #16171a durch — ab Bildmitte war die Fläche praktisch schwarz und
            // von „gebürstetem Titan" nichts mehr zu sehen.
            'radial-gradient(46% 52% at 44% -6%, rgba(255,255,255,.78) 0%, rgba(226,229,234,.34) 32%, transparent 62%),' +
            'radial-gradient(80% 60% at 86% 24%, rgba(188,194,202,.26) 0%, transparent 62%),' +
            'linear-gradient(176deg, #85898f 0%, #6d7278 22%, #565b61 52%, #44484e 78%, #34383d 100%)',
      }}
    >
      {/* Bürststruktur: feine horizontale Linien über der Titanfläche. */}
      {!night && (
      <div
        className="absolute inset-0 opacity-[.35] mix-blend-overlay"
        style={{
          background:
            'repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px),' +
            'repeating-linear-gradient(180deg, rgba(0,0,0,.08) 0 1px, transparent 1px 7px)',
        }}
      />
      )}

      {/* Konstruktionsraster in Viertelspalten + Satzspiegel-Kanten. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(90deg, rgba(214,220,228,.05) 1px, transparent 1px)',
          backgroundSize: '25% 100%',
        }}
      />
      <div className="absolute inset-y-0 left-[4vw] right-[4vw] border-x border-[rgba(214,220,228,.08)]" />

      {/* Lichtstimmung: warmer Horizont in Titan, kühler Schimmer in der Nacht. */}
      <div
        className="absolute inset-0"
        style={{
          background: night
            ? 'radial-gradient(48% 44% at 64% 42%, rgba(34,195,230,.10) 0%, transparent 66%)'
            : 'radial-gradient(54% 48% at 56% 50%, rgba(232,189,146,.24) 0%, transparent 62%),' +
              'linear-gradient(180deg, rgba(214,220,228,.08) 0%, transparent 9%),' +
              'radial-gradient(72% 46% at 50% 26%, rgba(232,189,146,.12) 0%, transparent 66%)',
        }}
      />

      {/* Carbon-Gewebe unter der Textspalte — Titan-Grundtextur. */}
      {!night && (
      <div
        className="absolute inset-0 opacity-[.34]"
        style={{
          backgroundColor: '#14161a',
          backgroundImage:
            'linear-gradient(27deg, #1b1e23 5px, transparent 5px),' +
            'linear-gradient(207deg, #1b1e23 5px, transparent 5px),' +
            'linear-gradient(27deg, #101216 5px, transparent 5px),' +
            'linear-gradient(207deg, #101216 5px, transparent 5px),' +
            'linear-gradient(90deg, #17191d 10px, transparent 10px),' +
            'linear-gradient(#1d2025 25%, #16181c 25%, #16181c 50%, transparent 50%, transparent 75%, #1a1c21 75%, #1a1c21)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 5px, 10px 0, 0 10px, 10px 5px, 0 0, 0 0',
          maskImage: 'linear-gradient(96deg, #000 0%, #000 40%, rgba(0,0,0,.5) 62%, transparent 86%)',
          WebkitMaskImage:
            'linear-gradient(96deg, #000 0%, #000 40%, rgba(0,0,0,.5) 62%, transparent 86%)',
        }}
      />
      )}

      {/* Nachtvariante: Europa als Foto — die einzige Kartendarstellung
          dieser Fassung, in Originalfarben statt entsättigt. */}
      {night && (
        <div
          className="absolute -right-[2%] -top-[6%] h-[112%] w-[86%]"
          style={{
            backgroundImage: "url('/europe-globe.webp')",
            backgroundSize: 'cover',
            backgroundPosition: '58% 42%',
            filter: 'contrast(1.08) saturate(1.05) brightness(1.02)',
            maskImage:
              'linear-gradient(94deg, transparent 0%, rgba(0,0,0,.35) 16%, #000 42%, #000 100%)',
            WebkitMaskImage:
              'linear-gradient(94deg, transparent 0%, rgba(0,0,0,.35) 16%, #000 42%, #000 100%)',
          }}
        />
      )}

      {/* Europa fotorealistisch — dieselbe Aufnahme wie in der Nachtvariante,
          aber in Titan/Gold getont statt in Blau. Fotorealismus braucht ein
          echtes Bild; als Vektorgrafik nachgebaut bleibt es immer Illustration.

          Der Ton entsteht aus zwei Ebenen: das entsättigte Foto als Relief,
          darüber ein Goldschleier im `color-dodge`, der die Stadtlichter und
          Netzlinien zu warmem Metall aufzieht. */}
      {!night && (
        <>
          <div
            className="absolute -right-[3%] -top-[6%] h-[112%] w-[82%]"
            style={{
              backgroundImage: "url('/europe-globe.webp')",
              backgroundSize: 'cover',
              backgroundPosition: '60% 42%',
              filter: 'grayscale(1) contrast(1.32) brightness(1.16)',
              maskImage:
                'linear-gradient(96deg, transparent 0%, rgba(0,0,0,.4) 18%, #000 44%, #000 100%)',
              WebkitMaskImage:
                'linear-gradient(96deg, transparent 0%, rgba(0,0,0,.4) 18%, #000 44%, #000 100%)',
            }}
          />
          <div
            className="absolute -right-[3%] -top-[6%] h-[112%] w-[82%] mix-blend-color-dodge"
            style={{
              backgroundImage: "url('/europe-globe.webp')",
              backgroundSize: 'cover',
              backgroundPosition: '60% 42%',
              filter: 'grayscale(1) brightness(.42) sepia(1) saturate(2.4) hue-rotate(-12deg)',
              opacity: 0.72,
              maskImage:
                'linear-gradient(96deg, transparent 0%, rgba(0,0,0,.4) 18%, #000 44%, #000 100%)',
              WebkitMaskImage:
                'linear-gradient(96deg, transparent 0%, rgba(0,0,0,.4) 18%, #000 44%, #000 100%)',
            }}
          />
        </>
      )}

      {/* Atmosphäre oben/unten. */}
      <div
        className="absolute inset-0"
        style={{
          background: night
            ? 'linear-gradient(180deg, rgba(2,5,8,.62) 0%, rgba(2,5,8,0) 26%,' +
              ' rgba(2,5,8,.08) 58%, rgba(2,5,8,.88) 100%)'
            : 'linear-gradient(180deg, rgba(16,18,21,.42) 0%, rgba(16,18,21,0) 26%,' +
              ' rgba(16,18,21,.04) 62%, rgba(16,18,21,.52) 100%)',
        }}
      />
      {/* Seitlicher Scrim — hält den Textkontrast links. */}
      <div
        className="absolute inset-0"
        style={{
          background: night
            ? 'linear-gradient(98deg, rgba(2,5,8,.88) 0%, rgba(2,5,8,.66) 32%,' +
              ' rgba(2,5,8,.2) 52%, transparent 72%)'
            : 'linear-gradient(100deg, rgba(14,16,19,.9) 0%, rgba(14,16,19,.78) 24%,' +
              ' rgba(14,16,19,.44) 42%, rgba(14,16,19,.12) 58%, transparent 74%)',
        }}
      />
    </div>
  );
}
