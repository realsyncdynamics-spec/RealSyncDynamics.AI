import { Fragment, useEffect, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COMPANY, getCompanyDisplayName } from '../../../config/company';
import {
  ANCHORS,
  APP_FINDINGS,
  APP_FRAMEWORKS,
  APP_NAV,
  APP_TILES,
  BUILDING_CAPS,
  CLOSING_PILLS,
  ENTERPRISE_TILES,
  GOV_STEPS,
  HERO_FRAMEWORKS,
  HERO_KPIS,
  HERO_PROOF,
  HUD_ORBITS,
  INTENT_CHIPS,
  LEDGER_NODES,
  LIVE_CAPS,
  LOOP_NODES,
  PLANS,
  ROADMAP,
  ROADMAP_FILTERS,
  TOOLS,
  TRUST,
  V4_ROUTES,
  statusOf,
  type TrustIcon,
} from './landing-v4-content';

/*
 * Markup und Klassennamen folgen 1:1 der Referenz `The Governance AI v4.html`
 * (Z. 934–1213); die Optik kommt vollständig aus `styles/landing-v4-classical.css`.
 * Inline-Styles sind die der Referenz-Renderer (dort per style.cssText gesetzt).
 */

function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const LoopArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const HEX = '0123456789abcdef';
const hex = () => HEX[(Math.random() * 16) | 0];
const hash = () => '0x' + Array.from({ length: 6 }, hex).join('');

/* ───────────────── Hintergrund + HUD ───────────────── */

export function V4Backdrop({ canvasRef }: { canvasRef: Ref<HTMLCanvasElement> }) {
  return (
    <>
      <div id="bg" aria-hidden="true">
        <div className="rails" />
        <div className="horizon" />
        <div className="carbon" />
        <canvas id="space3d" ref={canvasRef} />
        <div className="scrim" />
      </div>
      <div id="hud" aria-hidden="true">
        <svg className="orbits" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
          {HUD_ORBITS.map((o) => (
            <ellipse key={o.rot} cx="500" cy="500" rx={o.rx} ry={o.ry} transform={`rotate(${o.rot} 500 500)`} />
          ))}
        </svg>
      </div>
    </>
  );
}

/* ───────────────── Statusleiste + Kopf ───────────────── */

export function V4StatusBar() {
  return (
    <div className="statusbar" aria-label="Betriebsstatus">
      <div className="statusbar-in">
        <i />
        <span>
          <b>RUNTIME OPERATIONAL</b> · EU-CENTRAL
        </span>
        <span>HOSTING IN EUROPA</span>
        <div className="right">
          <span>DSGVO · EU AI ACT · ISO 27001</span>
        </div>
      </div>
    </div>
  );
}

const NAV_ANCHORS = [
  ['platform', 'Produkt'],
  ['evidence', 'Evidence'],
  ['pricing', 'Preise'],
] as const;

/** Kopf: bei scrollY > 60 `v3-stuck`, aktive Sektion (< 40 % Viewporthöhe) → `v3-on`. */
export function V4Header() {
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const secs = NAV_ANCHORS.map(([id]) => document.getElementById(id));
    const onScroll = () => {
      setStuck(scrollY > 60);
      let cur = -1;
      secs.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top < innerHeight * 0.4) cur = i;
      });
      setActive(cur);
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={stuck ? 'v3-stuck' : undefined}>
      <div className="head-in">
        <a className="brand" href="#top">
          RealSync Dynamics.AI
        </a>
        <nav>
          {NAV_ANCHORS.map(([id, label], i) => (
            <a key={id} className={'navlink' + (active === i ? ' v3-on' : '')} href={`#${id}`}>
              {label}
            </a>
          ))}
          <Link className="navlink" to={V4_ROUTES.login}>
            Login
          </Link>
          <Link className="cta-pill" to={V4_ROUTES.audit} data-hero-cta="">
            Free Audit starten
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ───────────────── Hero ───────────────── */

/** Seal-Zeile: Sekundentakt; nach 14–24 s neue Chain-Height (+1, de-DE) und neuer Hash. */
function SealLine() {
  const [seal, setSeal] = useState({ age: 4, height: 1284, hash: '0x9f3c…a71e' });
  useEffect(() => {
    const id = setInterval(() => {
      setSeal((s) => {
        const age = s.age + 1;
        if (age > 14 + Math.random() * 10) {
          return { age: 0, height: s.height + 1, hash: hash() + '…' + hex() + hex() + hex() + hex() };
        }
        return { ...s, age };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="seal-line">
      <i />
      <span>LETZTER NACHWEIS VERANKERT</span>
      <b>vor {seal.age} s</b>
      <span>·</span>
      <span>CHAIN-HEIGHT</span>
      <b>{seal.height.toLocaleString('de-DE')}</b>
      <span>·</span>
      <b>{seal.hash}</b>
    </div>
  );
}

export function V4Hero() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const onScan = (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    navigate(V4_ROUTES.audit + (u ? '?url=' + encodeURIComponent(u) : ''));
  };

  return (
    <main>
      <div className="hero reveal" style={{ animationDelay: '60ms' }}>
        <i className="mark tl" />
        <i className="mark br" />
        <h1>
          <span>AI Compliance</span>
          <br />
          <span>Operations OS</span> <em>for Europe</em>
        </h1>
        <p className="loop">
          Discover
          <LoopArrow />
          Classify
          <LoopArrow />
          Enforce
          <LoopArrow />
          Prove
        </p>
        <p className="lede">
          Runtime governance for regulated AI systems.
          <br />
          Continuous evidence. EU-native by design.
        </p>
        <div className="cta-row">
          <Link className="btn-primary" to={V4_ROUTES.audit} id="scan">
            Free Audit starten <Arrow />
          </Link>
          <Link className="btn-ghost" to={V4_ROUTES.dashboardDemo}>
            Live Dashboard ansehen
          </Link>
        </div>
        <form className="scanform" onSubmit={onScan}>
          <input
            type="url"
            placeholder="Ihre Website für den kostenlosen Governance-Audit"
            aria-label="Website-URL für Governance-Scan"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit">
            Audit starten <Arrow size={14} />
          </button>
        </form>
        <p className="scanform-note">URL genügt · kein Account vor dem Einstieg · Ergebnis in wenigen Minuten</p>
        <div className="proof">
          {HERO_PROOF.map((p) => (
            <span key={p} className="chip">
              <i />
              {p}
            </span>
          ))}
        </div>
        <div className="hero-kpis">
          {HERO_KPIS.map(([v, k]) => (
            <div key={k}>
              <b>{v}</b>
              <span>{k}</span>
            </div>
          ))}
        </div>
        <SealLine />
        <div className="trust">
          <p>SECHS POLICY PACKS · EIN PRÜFPFAD</p>
          <div className="frameworks">
            {HERO_FRAMEWORKS.map(([f, next]) => (
              <span key={f} className={next ? 'next' : undefined}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ───────────────── Ticker + Loopband ───────────────── */

/** „Regulatorische Anker" — doppelt gerendert, 70 s linear endlos, Pause bei Hover (CSS). */
export function V4Ticker() {
  const items = [...ANCHORS, ...ANCHORS];
  return (
    <div className="ticker" aria-label="Regulatorische Anker">
      <div className="ticker-track">
        {items.map(([a, b], i) => (
          <span key={i}>
            <i />
            <b>{a}</b>
            {b}
            <u>ANCHORED</u>
          </span>
        ))}
      </div>
    </div>
  );
}

export function V4LoopBand() {
  return (
    <section className="loopband" aria-label="Governance Loop">
      <div className="loop-grid">
        <div className="loop-wire" />
        {LOOP_NODES.map(([k, h, p]) => (
          <div key={k} className="loop-node">
            <small>{k}</small>
            <h3>{h}</h3>
            <p>{p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SecHead({ no, index, eyebrow }: { no: string; index: string; eyebrow: string }) {
  return (
    <>
      <div className="sec-index">
        <b>{no}</b>
        <span>{index}</span>
      </div>
      <p className="sec-eyebrow">{eyebrow}</p>
    </>
  );
}

/* ───────────────── 01 Workspace ───────────────── */

/** Evidence-Ledger: alle 2200 ms eine Zelle neu, 900 ms Gold-Highlight. */
function Ledger() {
  const [cells, setCells] = useState(() => LEDGER_NODES.map(() => hash()));
  const [lit, setLit] = useState<Record<number, boolean>>({});
  useEffect(() => {
    let turn = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const id = setInterval(() => {
      const i = turn % LEDGER_NODES.length;
      setCells((c) => c.map((v, j) => (j === i ? hash() : v)));
      setLit((l) => ({ ...l, [i]: true }));
      const t = setTimeout(() => {
        timers.delete(t);
        setLit((l) => ({ ...l, [i]: false }));
      }, 900);
      timers.add(t);
      turn++;
    }, 2200);
    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div>
      {LEDGER_NODES.map(([city, role], i) => (
        <div key={city} className="row">
          <s>{city}</s>
          <em>{role}</em>
          <u style={i in lit ? { color: lit[i] ? 'var(--bronze-lite)' : 'var(--titan)' } : undefined}>{cells[i]}</u>
        </div>
      ))}
    </div>
  );
}

export function V4Workspace() {
  return (
    <section className="band band-a" id="dashboard">
      <div className="band-in">
        <SecHead no="01" index="WORKSPACE" eyebrow="IHR WORKSPACE" />
        <h2>
          Das bekommen Sie: <em>Ihr Governance-Dashboard.</em>
        </h2>
        <p className="sec-lede">
          Nach dem Free Audit läuft Ihre Runtime im Command Center weiter — Rahmenwerk-Reifegrade, offene Findings,
          Evidence-Chain und der Agent-Intent auf einer Fläche.
        </p>

        <div className="app">
          <div className="app-bar">
            <div className="dots">
              <i />
              <i />
              <i />
            </div>
            <div className="url">realsyncdynamics.ai/app/dashboard</div>
            <span className="tag">DEMO · BEISPIELDATEN</span>
          </div>
          <div className="app-body">
            <nav className="app-nav">
              <div className="nav-group">GOVERNANCE OS</div>
              {APP_NAV.map(([label, badge, active]) => (
                <div key={label} className={'nav-item' + (active ? ' active' : '')}>
                  <span>{label}</span>
                  {badge ? <b>{badge}</b> : null}
                </div>
              ))}
            </nav>
            <div className="app-main">
              <div className="app-head">
                <h3>Compliance Command Center</h3>
                <span>PLAN GROWTH · EU-CENTRAL</span>
              </div>
              <div className="tiles">
                {APP_TILES.map(([v, suffix, k]) => (
                  <div key={k} className="tile">
                    <b>
                      {v}
                      {suffix ? <i>{suffix}</i> : null}
                    </b>
                    <span>{k}</span>
                  </div>
                ))}
              </div>
              <div className="split">
                <div className="panel">
                  <div className="panel-head">
                    RAHMENWERK-REIFEGRAD<b>6 POLICY PACKS</b>
                  </div>
                  <div>
                    {APP_FRAMEWORKS.map(([name, pct, label]) => (
                      <div key={name} className="fw">
                        <s>{name}</s>
                        <div className="bar">
                          <u style={{ width: `${pct}%` }} />
                        </div>
                        <em>{label}</em>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head">
                    OFFENE FINDINGS<b>PRIORISIERT</b>
                  </div>
                  <div>
                    {APP_FINDINGS.map(([sev, cls, text, ref]) => (
                      <div key={text} className="finding">
                        <span className={`sev ${cls}`}>{sev}</span>
                        <em>{text}</em>
                        <u>{ref}</u>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="split">
                <div className="panel">
                  <div className="panel-head">
                    EVIDENCE-CHAIN<b>ANCHORED</b>
                  </div>
                  <Ledger />
                </div>
                <div className="panel">
                  <div className="panel-head">
                    AGENT OS · INTENT<b>REVIEW-PFLICHTIG</b>
                  </div>
                  <div className="intent">
                    <div className="field">Was möchtest du erledigen?</div>
                    <span className="go">Session starten</span>
                  </div>
                  <div className="intent-chips">
                    {INTENT_CHIPS.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 02 Tools · 03 Plattform · 04 Evidence ───────────────── */

const CARD_H3 = (size: number) =>
  ({ margin: '12px 0 0', fontFamily: 'var(--ff-display)', fontSize: size, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--text)' }) as const;

function StatusTag({ className, label }: { className: string; label: string }) {
  return (
    <span className={className} data-st={statusOf(label)}>
      {label}
    </span>
  );
}

export function V4Tools() {
  return (
    <section className="band band-b" id="tools">
      <div className="band-in">
        <SecHead no="02" index="TOOLS" eyebrow="GOVERNANCE TOOLS" />
        <h2>
          Ihre KI-Kanäle. <em>Eine Governance-Ebene.</em>
        </h2>
        <div className="cards">
          {TOOLS.map(([eye, title, text]) => (
            <article key={title} className="card">
              <p className="card-tag">{eye}</p>
              <h3 style={CARD_H3(20)}>{title}</h3>
              <p className="body">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function V4Platform() {
  return (
    <section className="band band-b" id="platform">
      <div className="band-in">
        <SecHead no="03" index="PLATTFORM" eyebrow="DIE PLATTFORM" />
        <h2>
          Eine Runtime. <em>Kontrollierte KI-Governance.</em>
        </h2>
        <p className="sec-lede">
          RealSyncDynamics.AI verbindet Erkennung, Risikobewertung, Policies, Enforcement und Evidence zu einem
          durchgängigen operativen Kontrollprozess.
        </p>
        <div className="cards">
          {LIVE_CAPS.map(({ name, desc, route }) => {
            const body = (
              <>
                <p className="card-tag" data-st="live">
                  LIVE
                </p>
                <h3 style={CARD_H3(18)}>{name}</h3>
                <p className="body">{desc}</p>
                {route ? (
                  <u
                    style={{
                      marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                      fontFamily: 'var(--ff-mono)', fontSize: 'var(--fs-overline)', letterSpacing: '.12em', color: 'var(--bronze-lite)',
                    }}
                  >
                    Mehr erfahren <Arrow size={13} />
                  </u>
                ) : null}
              </>
            );
            return route ? (
              <Link key={name} className="card" to={route}>
                {body}
              </Link>
            ) : (
              <article key={name} className="card">
                {body}
              </article>
            );
          })}
        </div>
        <div className="group-head" style={{ marginTop: 40 }}>
          <h3 style={{ color: 'var(--titan)' }}>IN ENTWICKLUNG</h3>
          <span>NICHT IN PRODUKTION · AUSGEWIESEN, NICHT MITVERKAUFT</span>
        </div>
        <div className="cards" style={{ marginTop: 0 }}>
          {BUILDING_CAPS.map(([name, desc, note]) => (
            <div key={name} className="rm-card dashed">
              <div className="rm-top">
                <h4>{name}</h4>
                <StatusTag className="status dashed" label="GEPLANT" />
              </div>
              <p>{desc}</p>
              <p>{note}</p>
            </div>
          ))}
        </div>
        <div className="cards" style={{ marginTop: 40 }}>
          {GOV_STEPS.map(([no, title, text]) => (
            <article key={no} className="card">
              <p className="card-tag">
                {no} · {title}
              </p>
              <p className="body">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const TRUST_ICON: Record<TrustIcon, ReactNode> = {
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  file: (
    <>
      <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m3 15 2 2 4-4" />
    </>
  ),
  code: (
    <>
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </>
  ),
};

export function V4Evidence() {
  return (
    <section className="band band-a" id="evidence">
      <div className="band-in">
        <SecHead no="04" index="EVIDENCE" eyebrow="EVIDENCE & TRUST" />
        <h2>
          Compliance, die sich <em>beweisen lässt.</em>
        </h2>
        <p className="sec-lede">
          PDFs, Logs, Zeitstempel und nachvollziehbare Prüfpfade. Jede Prüfung, jede Entscheidung und jede Änderung
          landet in derselben Governance-Historie.
        </p>
        <div className="cards">
          {TRUST.map(([icon, title, text]) => (
            <article key={title} className="card">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--bronze-lite)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {TRUST_ICON[icon]}
              </svg>
              <h3 style={{ ...CARD_H3(18), margin: '16px 0 0' }}>{title}</h3>
              <p className="body" style={{ marginBottom: 0 }}>
                {text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 05 Tarife · 06 Roadmap ───────────────── */

export function V4Pricing() {
  return (
    <section className="band band-c" id="pricing">
      <div className="band-in">
        <SecHead no="05" index="TARIFE" eyebrow="PREISE" />
        <h2>
          Pläne für die <em>Governance Runtime.</em>
        </h2>
        <p className="sec-lede">
          Monatliche Self-Service-Tarife — Starter €79 · Growth €249 · Agency €699. Jahresabrechnung: Coming Soon.
        </p>
        <p className="sec-note">
          Upgrade-Leiter: Einzel-Domain → Starter · SaaS → Growth · Agentur → Agency · DSB/Enterprise → Anfrage
        </p>
        <div className="cards">
          {PLANS.map((p) => (
            <article key={p.id} className={'card' + (p.featured ? ' featured' : '')} data-tier={p.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <p className="card-tag">{p.name}</p>
                {p.badge || p.featured ? <StatusTag className="badge" label={p.badge || 'EMPFOHLEN'} /> : null}
              </div>
              <h3 className="plan-price">
                {p.price} €<span>/ MONAT</span>
              </h3>
              <p className="body">{p.tagline}</p>
              <ul>
                {p.l.map((b) => (
                  <li key={b}>
                    <span className="plus">+</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link className="plan-cta" to={V4_ROUTES.pricing}>
                {p.cta}
                <Arrow size={14} />
              </Link>
            </article>
          ))}
        </div>
        <p className="sec-note" style={{ marginTop: 28, letterSpacing: '.08em' }}>
          Monatlich live · Yearly Coming Soon · <Link to={V4_ROUTES.contactSales}>Enterprise anfragen</Link>
        </p>
      </div>
    </section>
  );
}

/** Roadmap mit Filter ALLE · LIVE · IN PREVIEW · NEXT (blendet Gruppen per Titel-Präfix aus). */
export function V4Roadmap() {
  const [filter, setFilter] = useState('');
  return (
    <section className="band band-a" id="roadmap">
      <div className="band-in">
        <SecHead no="06" index="STATUS" eyebrow="ROADMAP" />
        <h2>
          Was live ist. <em>Was als Nächstes kommt.</em>
        </h2>
        <p className="sec-lede">
          Status je Modul — live, in Preview oder als Nächstes. Keine doppelten Marketing-Claims.
        </p>
        <div id="v3-filter">
          {ROADMAP_FILTERS.map(([label, key]) => (
            <button key={label} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 44 }}>
          {ROADMAP.map((g) => (
            <div key={g.title} style={filter && !g.title.startsWith(filter) ? { display: 'none' } : undefined}>
              <div className="group-head">
                <h3>{g.title}</h3>
                <span>{g.eyebrow}</span>
              </div>
              <div className="cards" style={{ marginTop: 0 }}>
                {g.items.map(([name, desc, route]) => (
                  <div key={name} className={'rm-card' + (g.dashed ? ' dashed' : '')}>
                    <div className="rm-top">
                      <h4>{name}</h4>
                      <StatusTag className={'status' + (g.dashed ? ' dashed' : '')} label={g.status} />
                    </div>
                    <p>{desc}</p>
                    {route ? <u>{route}</u> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 07 Enterprise · Abschluss · Footer ───────────────── */

export function V4Enterprise() {
  return (
    <section className="band band-b" id="enterprise">
      <div className="band-in">
        <SecHead no="07" index="ENTERPRISE" eyebrow="ENTERPRISE-ZUGANG" />
        <h2>
          Governance mit <em>Ansprechpartner.</em>
        </h2>
        <p className="sec-lede">
          Multi-Tenant-Runtime für bis zu 5 Organisationen, zentrale Rechteverwaltung und individuell dimensionierte
          Scheduler- und Automation-Kontingente. Kein Self-Service-Checkout — Enterprise per Anfrage.
        </p>
        <div className="ent">
          {ENTERPRISE_TILES.map(([h, p, u]) => (
            <div key={h}>
              <h4>{h}</h4>
              <p>{p}</p>
              <u>{u}</u>
            </div>
          ))}
        </div>
        <div className="ent-cta">
          <Link className="btn-primary" to={V4_ROUTES.contactSales}>
            Enterprise anfragen <Arrow />
          </Link>
          <small>CUSTOM-DPA · BEHÖRDENVERTRAG · BESTELLUNG PER PO</small>
        </div>
      </div>
    </section>
  );
}

export function V4Closing() {
  return (
    <section className="band band-a" id="next">
      <div className="band-in closing">
        <p className="sec-eyebrow">ONE GOVERNANCE PLANE</p>
        <h2>Governance statt Checkliste.</h2>
        <p className="sec-lede" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
          Compliance statt Selbstauskunft. Evidence statt Behauptung. Enforcement statt Empfehlung.
        </p>
        <div className="frameworks" style={{ justifyContent: 'center', marginTop: 24 }}>
          {CLOSING_PILLS.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
        <div className="cta-row">
          <Link className="btn-primary" to={V4_ROUTES.audit}>
            Free Audit starten <Arrow />
          </Link>
          <a className="btn-ghost" href="#pricing">
            Preise ansehen
          </a>
        </div>
      </div>
    </section>
  );
}

const LEGAL = [
  ['Impressum', V4_ROUTES.impressum],
  ['AGB', V4_ROUTES.agb],
  ['Datenschutz', V4_ROUTES.datenschutz],
  ['Widerruf', V4_ROUTES.widerruf],
  ['Kontakt', V4_ROUTES.kontakt],
  ['Roadmap', V4_ROUTES.roadmap],
] as const;

export function V4Footer() {
  return (
    <footer>
      <div className="foot-legal">
        <div>
          <b>UNTERNEHMEN</b>
          <strong>{getCompanyDisplayName()}</strong>
          <br />
          {COMPANY.headquartersAddress.city}, Deutschland
          {COMPANY.registryEntry ? (
            <>
              <br />
              Handelsregister: {COMPANY.registryEntry}
            </>
          ) : null}
        </div>
        <div>
          <b>BETRIEB</b>Datenhaltung in der EU (Supabase, eu-central-1 · Frankfurt).
          <br />
          Unterstützt DSGVO- und EU-AI-Act-Kontrollen — die rechtliche Bewertung bleibt beim Anwender.
        </div>
        <div>
          <b>STANDARDS</b>Rahmenwerke: DSGVO · EU AI Act · ISO 27001 · NIS2
          <br />
          C2PA Content Credentials
        </div>
        <div>
          <b>KONTAKT</b>Enterprise per Anfrage — SSO, On-Prem, Custom-DPA, Behördenvertrag.
          <br />
          <Link to={V4_ROUTES.contactSales}>Enterprise anfragen</Link>
        </div>
      </div>
      <div className="foot-in">
        <span>&copy; 2026 RealSync Dynamics.AI</span>
        <nav className="legal" aria-label="Rechtliches">
          {LEGAL.map(([label, to], i) => (
            <Fragment key={label}>
              {i > 0 ? <i>|</i> : null}
              <Link to={to}>{label}</Link>
            </Fragment>
          ))}
        </nav>
      </div>
    </footer>
  );
}
