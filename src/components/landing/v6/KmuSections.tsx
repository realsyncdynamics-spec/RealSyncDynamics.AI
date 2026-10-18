import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getImplementation } from '../../../product/implementation-status';
import { PUBLIC_STATUS_LABEL } from '../../../product/implementation-status-public';
import {
  DASH_CATEGORIES,
  DASH_DOCS,
  DASH_MEASURES,
  INDUSTRIES,
  JOURNEY,
  PROBLEMS,
  SCOPE_AUTO,
  SCOPE_COMPANY,
  SOURCE_LABEL,
  STEPS,
  TRUST,
  type IconName,
  type Source,
} from './kmu-content';

/**
 * Landing v6 — KMU-Abschnitte (Phase 1). Reine Darstellung; Inhalte aus
 * `kmu-content.ts`, Ziele der Links kommen als Props aus `useLandingV6`.
 * Gestaltung über Klassen in `landing-v6.css` (Präfix `k-`), nicht inline.
 */

const ICON: Record<IconName, ReactNode> = {
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  bulb: (<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z" />),
  list: (<path d="M10 6h10M10 12h10M10 18h10M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />),
  file: (<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 15l2 2 4-4" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  chart: (<path d="M3 3v18h18M8 16v-5M13 16V8M18 16v-3" />),
  cpu: (<><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>),
  database: (<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>),
  flag: (<path d="M5 22V4M5 4h13l-2.5 4.5L18 13H5" />),
  folder: (<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />),
  tool: (<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />),
  scale: (<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z" />),
  heart: (<><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>),
  layers: (<path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5" />),
  building: (<><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>),
  shield: (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  check: (<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>),
  route: (<><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /></>),
  map: (<><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>),
};

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICON[name]}
    </svg>
  );
}

function Arrow() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

/** Status laut `implementation-status` — nie hart im Text. */
const MONITORING_STATUS = getImplementation('continuous-domain-monitoring')?.status ?? 'coming-soon';

function SourceTag({ source }: { source: Source }) {
  return <span className={`k-tag k-tag--${source}`}>{SOURCE_LABEL[source]}</span>;
}

function Head({ kicker, title, accent, lead }: { kicker: string; title: string; accent?: string; lead?: string }) {
  return (
    <div className="k-head">
      <p className="k-kicker">{kicker}</p>
      <h2 className="k-h2">
        {title}
        {accent ? (<> <span className="k-acc">{accent}</span></>) : null}
      </h2>
      {lead ? <p className="k-lead">{lead}</p> : null}
    </div>
  );
}

export function ProblemsSection({ auditHref }: { auditHref: string }) {
  return (
    <section id="probleme" className="k-sec k-sec--alt" aria-labelledby="probleme-h">
      <div className="k-wrap">
        <div className="k-head">
          <p className="k-kicker">DIE AUSGANGSLAGE</p>
          <h2 id="probleme-h" className="k-h2">Wissen Sie, welche digitalen Risiken <span className="k-acc">Ihr Unternehmen betreffen?</span></h2>
          <p className="k-lead">Die meisten Betriebe können diese Fragen nicht auf Anhieb beantworten. Ein Teil lässt sich von außen prüfen, der Rest braucht Ihr Wissen über den eigenen Betrieb.</p>
        </div>
        <ul className="k-grid k-grid--3" role="list">
          {PROBLEMS.map((p) => (
            <li key={p.q} className="k-card">
              <span className="k-ico"><Icon name={p.icon} /></span>
              <h3 className="k-h3">{p.q}</h3>
              <p className="k-text">{p.a}</p>
              <SourceTag source={p.source} />
            </li>
          ))}
        </ul>
        <div className="k-scope" role="group" aria-label="Was der Website-Check prüfen kann">
          <div className="k-scope__col">
            <h3 className="k-h4"><Icon name="search" size={18} /> Von außen automatisch prüfbar</h3>
            <ul role="list">{SCOPE_AUTO.map((s) => (<li key={s}><Icon name="check" size={16} />{s}</li>))}</ul>
          </div>
          <div className="k-scope__col k-scope__col--company">
            <h3 className="k-h4"><Icon name="building" size={18} /> Nur mit Ihren Angaben erfassbar</h3>
            <ul role="list">{SCOPE_COMPANY.map((s) => (<li key={s}><span className="k-dot" aria-hidden="true" />{s}</li>))}</ul>
          </div>
        </div>
        <p className="k-note">Ein externer Website-Scan sieht nur, was öffentlich abrufbar ist. Interne Datenverarbeitung und KI-Nutzung im Betrieb erfasst er nicht vollständig.</p>
        <div className="k-actions">
          <Link to={auditHref} className="k-btn k-btn--primary">Jetzt kostenlosen Website-Check starten<Arrow /></Link>
        </div>
      </div>
    </section>
  );
}

export function ValueChainSection({ auditHref, enterpriseHref }: { auditHref: string; enterpriseHref: string }) {
  return (
    <section id="produkt" className="k-sec" aria-labelledby="produkt-h">
      <div className="k-wrap">
        <div className="k-head">
          <p className="k-kicker">SO FUNKTIONIERT REALSYNC</p>
          <h2 id="produkt-h" className="k-h2">Prüfen. Verstehen. Handeln. <span className="k-acc">Nachweisen.</span></h2>
          <p className="k-lead">Vier Schritte, die aufeinander aufbauen – von der ersten Prüfung bis zum dokumentierten Ergebnis. Orientierung und praktische Unterstützung statt komplizierter Vorschriften.</p>
        </div>
        <ol className="k-chain" role="list">
          {STEPS.map((s) => (
            <li key={s.n} className="k-chain__step">
              <div className="k-chain__node" aria-hidden="true"><Icon name={s.icon} size={24} /></div>
              <div className="k-chain__body">
                <span className="k-chain__n">{s.n}</span>
                <h3 className="k-chain__t">{s.k}</h3>
                <p className="k-text">{s.d}</p>
                <div className="k-example">
                  <span className="k-example__l">Beispiel</span>
                  <p>{s.example}</p>
                </div>
                <p className="k-feature"><Icon name="check" size={16} /><span><span className="k-sr">In der Plattform: </span>{s.feature}</span></p>
              </div>
            </li>
          ))}
        </ol>
        <p className="k-note" data-testid="monitoring-status">
          {MONITORING_STATUS === 'live'
            ? 'Laufende, automatische Überwachung Ihrer Domain ist verfügbar.'
            : `Laufende, automatische Überwachung Ihrer Domain: Status „${PUBLIC_STATUS_LABEL.de[MONITORING_STATUS]}“. Heute starten Sie jede Prüfung selbst.`}
        </p>
        <div className="k-actions">
          <Link to={auditHref} className="k-btn k-btn--primary">Jetzt kostenlosen Website-Check starten<Arrow /></Link>
          <Link to={enterpriseHref} className="k-btn k-btn--ghost">Enterprise anfragen</Link>
        </div>
      </div>
    </section>
  );
}

function Bar({ done, total, tone }: { done: number; total: number; tone: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span className="k-bar" aria-hidden="true">
      <span className={`k-bar__fill k-tone--${tone}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

export function DashboardPreviewSection({ dashboardHref, auditHref }: { dashboardHref: string; auditHref: string }) {
  const done = DASH_MEASURES.filter((m) => m.tone === 'ok').length;
  return (
    <section id="control-room" className="k-sec k-sec--alt" aria-labelledby="dashboard-h">
      <div className="k-wrap">
        <div className="k-head k-head--split">
          <div>
            <p className="k-kicker">IHR DASHBOARD</p>
            <h2 id="dashboard-h" className="k-h2">Alles Wichtige auf einen Blick – <span className="k-acc">auch ohne IT-Kenntnisse.</span></h2>
            <p className="k-lead">Nach der Anmeldung sehen Sie, wo Ihr Betrieb steht: welche Bereiche in Ordnung sind, wo Handlungsbedarf besteht und welche Maßnahmen schon dokumentiert sind.</p>
          </div>
          <Link to={dashboardHref} className="k-btn k-btn--ghost">Zum Dashboard (Anmeldung)<Arrow /></Link>
        </div>

        <figure className="k-dash" aria-labelledby="dash-cap">
          <div className="k-dash__bar">
            <span className="k-dash__dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="k-dash__title">Musterbetrieb · Übersicht</span>
            <span className="k-badge">Vorschau · Beispieldaten</span>
          </div>

          <div className="k-dash__body">
            <div className="k-dash__summary">
              <div className="k-dash__score">
                <svg aria-hidden="true" viewBox="0 0 120 120" width="112" height="112">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--rs-line)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--rs-acc)" strokeWidth="10" strokeLinecap="round" strokeDasharray="314" strokeDashoffset="88" transform="rotate(-90 60 60)" />
                </svg>
                <span className="k-dash__scoreval"><strong>72</strong><small>/ 100</small></span>
              </div>
              <div>
                <p className="k-dash__label">Website-Check · Punktzahl (Beispiel)</p>
                <p className="k-dash__headline">2 wichtige Punkte offen</p>
                <p className="k-text">{done} von {DASH_MEASURES.length} Maßnahmen erledigt · 1 Bereich wartet auf Ihre Angaben</p>
              </div>
            </div>

            <ul className="k-dash__cats" role="list" aria-label="Risikobereiche">
              {DASH_CATEGORIES.map((c) => (
                <li key={c.t} className="k-dash__cat">
                  <div className="k-dash__catrow">
                    <span className="k-dash__catt">{c.t}</span>
                    <span className={`k-pill k-tone--${c.tone}`}>{c.status}</span>
                  </div>
                  <Bar done={c.done} total={c.total} tone={c.tone} />
                  <div className="k-dash__catrow k-dash__meta">
                    <span>{c.done} von {c.total} geprüft</span>
                    <span>{SOURCE_LABEL[c.source]}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="k-dash__cols">
              <div className="k-dash__panel">
                <h3 className="k-dash__ph">Maßnahmen</h3>
                <ul role="list">
                  {DASH_MEASURES.map((m) => (
                    <li key={m.t} className="k-dash__row">
                      <span className={`k-dot k-tone--${m.tone}`} aria-hidden="true" />
                      <span className="k-dash__rowt">{m.t}<small>{m.ref}</small></span>
                      <span className={`k-pill k-tone--${m.tone}`}>{m.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="k-dash__panel">
                <h3 className="k-dash__ph">Dokumentation</h3>
                <ul role="list">
                  {DASH_DOCS.map((d) => (
                    <li key={d.t} className="k-dash__row">
                      <span className={`k-dot k-tone--${d.tone}`} aria-hidden="true" />
                      <span className="k-dash__rowt">{d.t}</span>
                      <span className="k-dash__status">{d.status}</span>
                    </li>
                  ))}
                </ul>
                <div className="k-dash__progress">
                  <span>Dokumentationsstand</span>
                  <Bar done={2} total={3} tone="warn" />
                  <small>2 von 3 Einträgen vollständig</small>
                </div>
              </div>
            </div>
          </div>
          <figcaption id="dash-cap" className="k-dash__cap">
            Vorschau mit erfundenen Beispieldaten zur Veranschaulichung – keine Kundendaten, keine echte Bewertung. Welche Bereiche Ihr Dashboard zeigt, hängt von Ihrem Tarif und Ihren Angaben ab.
          </figcaption>
        </figure>
        <div className="k-actions">
          <Link to={auditHref} className="k-btn k-btn--primary">Mit dem kostenlosen Website-Check beginnen<Arrow /></Link>
        </div>
      </div>
    </section>
  );
}

export function IndustriesSection({ auditHref }: { auditHref: string }) {
  return (
    <section id="branchen" className="k-sec" aria-labelledby="branchen-h">
      <div className="k-wrap">
        <Head kicker="FÜR WEN" title="Gemacht für Betriebe," accent="die keine eigene Rechtsabteilung haben." lead="Ob Werkstatt, Kanzlei oder Mittelständler: Der Einstieg ist für alle gleich einfach. Was sich unterscheidet, sind die typischen Dienste und Abläufe." />
        <ul className="k-grid k-grid--5" role="list">
          {INDUSTRIES.map((i) => (
            <li key={i.t} className="k-card k-card--industry">
              <span className="k-ico"><Icon name={i.icon} /></span>
              <h3 className="k-h3">{i.t}</h3>
              <p className="k-text">{i.d}</p>
              <p className="k-typical"><span>Häufig im Einsatz</span>{i.typical}</p>
            </li>
          ))}
        </ul>
        <p className="k-note">Der Website-Check verarbeitet keine Mandanten- oder Patientendaten: Er ruft nur öffentlich erreichbare Seiten Ihrer Website ab. Branchenspezifische Rechtsberatung ersetzt RealSync nicht.</p>
        <div className="k-actions">
          <Link to={auditHref} className="k-btn k-btn--ghost">Website-Check für meinen Betrieb starten<Arrow /></Link>
        </div>
      </div>
    </section>
  );
}

export function JourneySection({ auditHref, registerHref, loginHref }: { auditHref: string; registerHref: string; loginHref: string }) {
  return (
    <section id="start" className="k-sec k-sec--alt" aria-labelledby="start-h">
      <div className="k-wrap">
        <div className="k-head">
          <p className="k-kicker">IHR WEG MIT REALSYNC</p>
          <h2 id="start-h" className="k-h2">So einfach starten Sie <span className="k-acc">mit RealSyncDynamics.AI</span></h2>
          <p className="k-lead">Kein Fragebogen zum Einstieg. Sie beginnen mit Ihrer Website und entscheiden danach, ob Sie weitermachen.</p>
        </div>
        <ol className="k-journey" role="list">
          {JOURNEY.map((j) => (
            <li key={j.n} className="k-journey__step">
              <span className="k-journey__n" aria-hidden="true">{j.n}</span>
              <span className="k-journey__when">{j.when}</span>
              <h3 className="k-h3"><span className="k-sr">Schritt {j.n}: </span>{j.t}</h3>
              <p className="k-text">{j.d}</p>
            </li>
          ))}
        </ol>
        <div className="k-actions">
          <Link to={auditHref} className="k-btn k-btn--primary">Schritt 1: Website-Check starten<Arrow /></Link>
          <Link to={registerHref} className="k-btn k-btn--ghost">Konto anlegen</Link>
          <Link to={loginHref} className="k-link">Ich habe schon ein Konto</Link>
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section id="vertrauen" className="k-sec" aria-labelledby="vertrauen-h">
      <div className="k-wrap">
        <div className="k-head">
          <p className="k-kicker">VERTRAUEN & TRANSPARENZ</p>
          <h2 id="vertrauen-h" className="k-h2">Ehrlich, was wir prüfen – <span className="k-acc">und was nicht.</span></h2>
        </div>
        <ul className="k-grid k-grid--3" role="list">
          {TRUST.map((t) => (
            <li key={t.t} className="k-card k-card--flat">
              <span className="k-ico"><Icon name={t.icon} /></span>
              <h3 className="k-h3">{t.t}</h3>
              <p className="k-text">{t.d}</p>
              {t.href.startsWith('#') ? (
                <a href={t.href} className="k-link k-link--small">{t.link}</a>
              ) : (
                <Link to={t.href} className="k-link k-link--small">{t.link}</Link>
              )}
            </li>
          ))}
        </ul>
        <div className="k-disclaimer">
          <Icon name="scale" size={20} />
          <p>RealSync unterstützt Sie bei Orientierung, Organisation und Dokumentation. Es ersetzt keine Rechtsberatung und bescheinigt keine DSGVO- oder EU-AI-Act-Konformität. Mehr unter <Link to="/datenschutz">Datenschutz</Link> und <Link to="/legal/sub-processors">Sub-Prozessoren</Link>.</p>
        </div>
      </div>
    </section>
  );
}

export function WebdesignTeaser({ contactHref }: { contactHref: string }) {
  return (
    <section id="webdesign" className="k-sec k-sec--slim" aria-labelledby="webdesign-h">
      <div className="k-wrap">
        <div className="k-teaser">
          <div>
            <p className="k-kicker">ZUSÄTZLICHER SERVICE</p>
            <h2 id="webdesign-h" className="k-h3 k-teaser__t">Sie benötigen eine neue Unternehmenswebsite?</h2>
            <p className="k-text">Individuelles Webdesign – professionell gestaltet und mit Blick auf Datenschutz und digitale Risiken entwickelt.</p>
          </div>
          <Link to={contactHref} className="k-btn k-btn--ghost">Unverbindlich anfragen<Arrow /></Link>
        </div>
      </div>
    </section>
  );
}

/** Für Prüfungen der Reihenfolge und als Doku: neue Abschnitte in Seitenreihenfolge. */
export const KMU_SECTION_IDS = ['probleme', 'produkt', 'control-room', 'branchen', 'start', 'vertrauen', 'webdesign'] as const;

