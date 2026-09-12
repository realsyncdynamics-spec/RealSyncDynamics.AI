import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  LANDING_ACCENT,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_H2,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Dark band between tools and platform — Dominik-Referenz
 * „Detect. Govern. Prove." — dense, not sparse.
 */
export function LandingDarkBand() {
  return (
    <section
      id="runtime"
      className="grid items-center gap-6 border-y border-[#e4cfa2]/10 bg-[#070a10] px-[4vw] py-[48px] lg:grid-cols-[1.15fr_1fr_auto] lg:gap-8 lg:py-[52px]"
    >
      <div>
        <p
          className="text-[9px] tracking-[.22em]"
          style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
        >
          ONE OPERATIONAL PLANE
        </p>
        <h2
          className="mt-2 leading-[1.05] tracking-[-.03em]"
          style={{
            fontFamily: LANDING_SERIF,
            fontWeight: 500,
            fontSize: LANDING_H2,
            color: LANDING_TEXT,
          }}
        >
          Detect. Govern. Prove.
        </h2>
      </div>
      <p className="max-w-md text-[13px] leading-[1.65]" style={{ color: LANDING_MUTED }}>
        Runtime für KI-Risiken, Policies und Evidence — für Module mit Status LIVE.
        Preview und Next stehen auf der Roadmap.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link
          to="/governance-runtime"
          className="inline-flex items-center justify-center gap-2 rounded-full px-[18px] py-[12px] text-[11px] font-semibold transition hover:brightness-110"
          style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
        >
          Runtime öffnen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/welcome?next=%2Fapp%2Fdashboard"
          className="inline-flex items-center justify-center gap-2 rounded-full border px-[18px] py-[12px] text-[11px] font-semibold transition hover:bg-[#e4cfa2]/10"
          style={{ borderColor: `${LANDING_ACCENT}80`, color: LANDING_TEXT }}
        >
          Zum Compliance Dashboard
        </Link>
      </div>
    </section>
  );
}
