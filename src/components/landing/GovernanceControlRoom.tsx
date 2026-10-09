/**
 * Governance Control Room auf `/` (`#control-room`).
 *
 * Erklärt den Betrieb ohne Fake-KPIs und ohne Demo-Zahlen. Das echte
 * Command Center liegt hinter dem Login (`/app/dashboard`). Verdikte
 * entsprechen dem Vokabular des Policy Decision Point.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const CONTROL_ROOM_CAPABILITIES = [
  { label: 'Policy Decision Point', detail: 'allow · warn · block · require_approval · log_only' },
  { label: 'Freigaben', detail: 'Offene Entscheidungen mit menschlicher Kontrolle' },
  { label: 'Blockierungen', detail: 'Ausführungen stoppen, bevor Schaden entsteht' },
  { label: 'Evidence', detail: 'Jeder Lauf erzeugt einen prüfbaren Eintrag' },
] as const;

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
            <span>Governance Control Room</span>
            <span className="os-demo-tag">LIVE NACH LOGIN</span>
          </div>

          <dl className="m-0 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ backgroundColor: 'var(--color-rs-border)' }}>
            {CONTROL_ROOM_CAPABILITIES.map((item) => (
              <div key={item.label} className="flex flex-col justify-between px-5 py-6" style={{ backgroundColor: 'var(--color-rs-bg-1)' }}>
                <dt className="text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--font-rs-mono)', color: 'var(--color-rs-fg-2)' }}>
                  {item.label}
                </dt>
                <dd className="m-0 mt-3 text-[15px] leading-snug" style={{ fontFamily: 'var(--font-rs-mono)', color: 'var(--color-rs-fg-0)' }}>
                  {item.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 max-w-[40rem] text-[13px]" style={{ color: 'var(--color-rs-fg-2)' }}>
            Keine Beispiel-KPIs auf der Startseite. Ihr Control Room zeigt nach dem Login die
            echten Systeme, Freigaben und Evidence Ihrer Organisation.
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
