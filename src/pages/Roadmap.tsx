import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, ArrowRight } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';
import {
  COMING_SOON_IMPLEMENTATION,
  LIVE_IMPLEMENTATION,
  PREVIEW_IMPLEMENTATION,
  STATUS_LABEL,
  type ImplementationItem,
  type ImplementationStatus,
} from '../product/implementation-status';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from '../components/landing/landing-theme';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';

/**
 * /roadmap — public status board from implementation-status.ts SSOT.
 * No fake ship dates. Every card links to a real route when available.
 */

const SECTIONS: { status: ImplementationStatus; items: readonly ImplementationItem[] }[] = [
  { status: 'live', items: LIVE_IMPLEMENTATION },
  { status: 'preview', items: PREVIEW_IMPLEMENTATION },
  { status: 'coming-soon', items: COMING_SOON_IMPLEMENTATION },
];

function statusBorder(status: ImplementationStatus): string {
  switch (status) {
    case 'live':
      return 'rgba(32,214,154,0.45)';
    case 'preview':
      return `${LANDING_ACCENT}80`;
    case 'coming-soon':
      return 'rgba(154,154,161,0.45)';
  }
}

export function Roadmap() {
  usePageMeta({
    title: 'Roadmap — RealSyncDynamics.AI',
    description:
      'Live, Preview und Coming Soon — ehrlicher Implementierungsstatus der Governance Runtime.',
    url: 'https://realsyncdynamicsai.de/roadmap',
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: LANDING_BG, color: LANDING_TEXT }}>
      <PublicDarkHeader />

      <main className="mx-auto max-w-[1100px] px-[4vw] py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[12px] transition hover:opacity-90"
          style={{ color: LANDING_MUTED }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </Link>

        <p
          className="mt-8 inline-flex items-center gap-2 rounded-full border px-[11px] py-[7px] text-[9px] tracking-[.23em]"
          style={{
            fontFamily: LANDING_MONO,
            color: LANDING_ACCENT,
            borderColor: `${LANDING_ACCENT}47`,
          }}
        >
          <Compass className="h-3 w-3" /> IMPLEMENTATION STATUS
        </p>
        <h1
          className="mt-5 text-[clamp(36px,5vw,56px)] leading-none tracking-tight"
          style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
        >
          Was live ist — und was noch Preview bleibt.
        </h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed" style={{ color: LANDING_MUTED }}>
          Quelle: <span className="font-mono text-[12px]">src/product/implementation-status.ts</span>.
          Keine erfundenen Ship-Dates. Preview = UI/API erreichbar, Backend unvollständig.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map(({ status, items }) => {
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2
                  className="mb-4 text-[11px] tracking-[.2em]"
                  style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                >
                  {STATUS_LABEL[status]}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-col border p-5"
                      style={{
                        borderColor: statusBorder(status),
                        background: 'linear-gradient(135deg, rgba(20,21,25,0.7), rgba(7,9,13,0.72))',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className="text-lg tracking-tight"
                          style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
                        >
                          {item.name}
                        </h3>
                        <span
                          className="shrink-0 border px-2 py-0.5 text-[8px] tracking-[.14em]"
                          style={{
                            fontFamily: LANDING_MONO,
                            borderColor: statusBorder(status),
                            color: LANDING_ACCENT,
                          }}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      <p className="mt-2 flex-1 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                        {item.description}
                      </p>
                      {item.route ? (
                        <Link
                          to={item.route}
                          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium"
                          style={{ color: LANDING_ACCENT }}
                        >
                          Öffnen <ArrowRight className="h-3.5 w-3.5" />
                          <span className="font-mono text-[10px] opacity-70">{item.route}</span>
                        </Link>
                      ) : (
                        <p
                          className="mt-4 font-mono text-[10px] tracking-[.12em]"
                          style={{ color: LANDING_MUTED }}
                        >
                          Keine öffentliche Route
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[11px] font-semibold"
            style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
          >
            Governance Scan starten
          </Link>
          <Link
            to="/kontakt"
            className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-[11px] font-medium"
            style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8ddc8' }}
          >
            Kontakt
          </Link>
        </div>
      </main>

      <footer
        className="border-t border-[#e4cfa2]/12 px-[4vw] py-8 text-[11px]"
        style={{ color: LANDING_MUTED }}
      >
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · Status ehrlich kommuniziert</span>
          <Link to="/legal/methodology" className="hover:text-[#f2eee6]">
            Methodik
          </Link>
        </div>
      </footer>
    </div>
  );
}
