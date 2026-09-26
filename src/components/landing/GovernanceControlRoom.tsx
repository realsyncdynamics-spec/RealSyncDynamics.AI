/**
 * Governance Control Room auf `/` (`#control-room`).
 *
 * Zeigt, wie der Betrieb aussieht — mit Beispielwerten, die an drei Stellen
 * als solche gekennzeichnet sind (Leiste, Überschrift, Fußzeile). Es gibt
 * auf der Startseite keine Live-Kundendaten; das echte Command Center liegt
 * hinter dem Login (`/app/dashboard`). Die Verdikte entsprechen dem
 * Vokabular des Policy Decision Point.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  CONTROL_ROOM_DECISIONS,
  CONTROL_ROOM_METRICS,
  DEMO_LABEL,
} from '../governance-frontend/hero-content';

const VERDICT_TONE: Record<(typeof CONTROL_ROOM_DECISIONS)[number]['verdict'], string> = {
  allow: 'os-tone-ok',
  warn: 'os-tone-warn',
  block: 'os-tone-block',
  require_approval: 'os-tone-warn',
  log_only: 'os-tone-idle',
};

export function GovernanceControlRoom() {
  return (
    <section id="control-room" className="os-section" aria-labelledby="control-room-heading">
      <div className="os-inner">
        <p className="os-kicker"><b>CONTROL ROOM</b> BETRIEB STATT PAPIER</p>
        <h2 id="control-room-heading" className="os-h2">
          Ein Blick. <span className="os-dim">Alle Entscheidungen Ihrer KI.</span>
        </h2>

        <div className="os-panel mt-10" data-testid="control-room">
          <div className="os-panel__bar">
            <span>Governance Control Room · Workspace „Demo"</span>
            <span className="os-demo-tag">{DEMO_LABEL}</span>
          </div>

          <dl className="m-0 grid grid-cols-2 gap-px md:grid-cols-5" style={{ backgroundColor: 'var(--color-rs-border)' }}>
            {CONTROL_ROOM_METRICS.map((metric) => (
              <div key={metric.label} className="px-5 py-6" style={{ backgroundColor: 'var(--color-rs-bg-1)' }}>
                <dt className="text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--font-rs-mono)', color: 'var(--color-rs-fg-2)' }}>
                  {metric.label}
                </dt>
                <dd className="m-0 mt-3 text-[clamp(28px,3vw,44px)] font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--font-rs-title)', color: 'var(--color-rs-fg-0)' }}>
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t" style={{ borderColor: 'var(--color-rs-border)' }}>
            <p className="m-0 px-5 pt-4 text-[11px] uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--font-rs-mono)', color: 'var(--color-rs-fg-2)' }}>
              Letzte Policy-Entscheidungen
            </p>
            <ul className="m-0 list-none px-0 py-2">
              {CONTROL_ROOM_DECISIONS.map((d) => (
                <li
                  key={d.time}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-[13px] sm:grid-cols-[5.5rem_10rem_minmax(0,1fr)_auto]"
                  style={{ fontFamily: 'var(--font-rs-mono)' }}
                >
                  <span style={{ color: 'var(--color-rs-fg-2)' }}>{d.time}</span>
                  <span className="hidden truncate sm:block" style={{ color: 'var(--color-rs-fg-0)' }}>{d.actor}</span>
                  <span className="truncate" style={{ color: 'var(--color-rs-fg-1)' }}>
                    <span className="sm:hidden" style={{ color: 'var(--color-rs-fg-0)' }}>{d.actor} · </span>
                    {d.action}
                  </span>
                  <span className={`uppercase tracking-[0.1em] ${VERDICT_TONE[d.verdict]}`}>{d.verdict}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 max-w-[40rem] text-[13px]" style={{ color: 'var(--color-rs-fg-2)' }}>
            Beispielwerte zur Veranschaulichung, keine Kundendaten. Ihr eigener Control Room entsteht nach dem Login
            aus Ihren Systemen.
          </p>
          <Link to="/app/dashboard" className="os-link">
            Zum Command Center
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
