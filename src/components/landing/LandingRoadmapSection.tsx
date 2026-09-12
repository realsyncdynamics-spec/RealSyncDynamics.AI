import { Link } from 'react-router-dom';
import {
  COMING_SOON_IMPLEMENTATION,
  LIVE_IMPLEMENTATION,
  PREVIEW_IMPLEMENTATION,
  STATUS_LABEL,
  type ImplementationItem,
  type ImplementationStatus,
} from '../../product/implementation-status';
import {
  LANDING_ACCENT,
  LANDING_H2,
  LANDING_LINE,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Automated product roadmap — rendered from implementation-status.ts.
 * Flip a status in the registry → this section updates. No duplicate claims.
 */

const GROUPS: {
  status: ImplementationStatus;
  title: string;
  eyebrow: string;
  items: readonly ImplementationItem[];
}[] = [
  {
    status: 'live',
    title: 'Live',
    eyebrow: 'SHIPPED · REACHABLE',
    items: LIVE_IMPLEMENTATION.filter((i) => i.showOnPlatform || i.id === 'free-audit' || i.id === 'pricing-monthly'),
  },
  {
    status: 'preview',
    title: 'In preview',
    eyebrow: 'DRAFT · NOT PRODUCTION-COMPLETE',
    items: PREVIEW_IMPLEMENTATION,
  },
  {
    status: 'coming-soon',
    title: 'Next',
    eyebrow: 'COMING SOON',
    items: COMING_SOON_IMPLEMENTATION,
  },
];

function StatusBadge({ status }: { status: ImplementationStatus }) {
  const dashed = status !== 'live';
  return (
    <span
      className="shrink-0 border px-2 py-0.5 text-[8px] tracking-[.14em]"
      style={{
        fontFamily: LANDING_MONO,
        borderColor: `${LANDING_ACCENT}${status === 'live' ? '55' : '40'}`,
        borderStyle: dashed ? 'dashed' : 'solid',
        color: status === 'live' ? LANDING_ACCENT : `${LANDING_ACCENT}cc`,
        backgroundColor: status === 'live' ? `${LANDING_ACCENT}14` : 'transparent',
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function RoadmapCard({ item }: { item: ImplementationItem }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-medium leading-snug" style={{ color: LANDING_TEXT }}>
          {item.name}
        </h3>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-2 text-[12px] leading-[1.55]" style={{ color: LANDING_MUTED }}>
        {item.description}
      </p>
      {item.route && (
        <p
          className="mt-3 text-[9px] tracking-[.12em]"
          style={{ fontFamily: LANDING_MONO, color: `${LANDING_ACCENT}99` }}
        >
          {item.route}
        </p>
      )}
    </>
  );

  if (item.status === 'live' && item.route) {
    return (
      <Link
        to={item.route}
        className="block border p-5 transition hover:bg-[#d0c3a4]/05"
        style={{ borderColor: LANDING_LINE, backgroundColor: 'rgba(7,9,13,0.55)' }}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className="border p-5"
      style={{
        borderColor: LANDING_LINE,
        borderStyle: item.status === 'live' ? 'solid' : 'dashed',
        backgroundColor: 'rgba(7,9,13,0.45)',
      }}
    >
      {body}
    </div>
  );
}

export function LandingRoadmapSection() {
  return (
    <section id="roadmap" className="border-t border-[#d0c3a4]/10 py-[72px] lg:py-[80px]">
      <div className="mx-auto max-w-[1500px] px-[4vw]">
        <p
          className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
          style={{
            fontFamily: LANDING_MONO,
            color: LANDING_ACCENT,
            borderColor: `${LANDING_ACCENT}47`,
          }}
        >
          ROADMAP
        </p>
        <h2
          className="mt-[18px] leading-[1.05] tracking-[-.03em]"
          style={{
            fontFamily: LANDING_SERIF,
            fontWeight: 500,
            fontSize: LANDING_H2,
            color: LANDING_TEXT,
          }}
        >
          Was live ist.{' '}
          <em className="not-italic" style={{ color: LANDING_ACCENT }}>
            Was als Nächstes kommt.
          </em>
        </h2>
        <p className="mt-3 max-w-[640px] text-[13px] leading-[1.65]" style={{ color: LANDING_MUTED }}>
          Automatisiert aus dem Product-Registry. Statuswechsel aktualisieren diese Liste —
          ohne doppelte Marketing-Claims.
        </p>

        <div className="mt-10 space-y-12">
          {GROUPS.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.status}>
                <div className="mb-4 flex flex-wrap items-baseline gap-3">
                  <h3
                    className="text-[11px] tracking-[.2em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                  >
                    {group.title.toUpperCase()}
                  </h3>
                  <span
                    className="text-[9px] tracking-[.14em]"
                    style={{ fontFamily: LANDING_MONO, color: 'rgba(154,154,161,0.7)' }}
                  >
                    {group.eyebrow}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <RoadmapCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
