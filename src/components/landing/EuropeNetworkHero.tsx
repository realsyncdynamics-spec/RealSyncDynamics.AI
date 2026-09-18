/**
 * Hero visual — metal Europe relief board (comp 2405CE14A80D764E).
 * Static photo + brushed-steel veil. NOT an interactive globe.
 * Baked-in type from the comp is not used; live copy sits in MainLanding.
 */
import { LANDING_ACCENT } from './landing-theme';

export function EuropeNetworkHero() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual="europe-metal-board"
      data-hero-interactive="false"
    >
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1605}
          height={1080}
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover object-[78%_48%]"
          decoding="async"
        />
      </picture>

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(98deg, #1a1b1d 0%, #1a1b1df2 28%, #1a1b1d99 46%, #1a1b1d22 62%, transparent 78%),' +
            'linear-gradient(180deg, #141516cc 0%, transparent 22%, transparent 78%, #101112ee 100%),' +
            `radial-gradient(48% 58% at 78% 46%, ${LANDING_ACCENT}26 0%, transparent 58%)`,
        }}
      />
    </div>
  );
}
