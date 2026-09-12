/**
 * The Governance AI — design preview at `/design/governance`.
 *
 * Enterprise chrome: titanium surfaces, bronze accent, Europe relief behind
 * the hero (Titan / Nacht theme switch). Not live `/`. Honest Preview.
 * Same DE copy + `/audit` acquisition funnel; pricing from shared/pricing.ts,
 * roadmap from product/implementation-status.ts.
 *
 * Ported from the Claude Design export "The Governance AI — Standalone".
 */
import { FormEvent, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { CTA } from '../../content/runtimeVocab';
import {
  HERO_DASHBOARD_CTA_LABEL,
  HERO_EU_LINE,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LONG,
  HERO_SCAN_CTA_PROMISE,
  HERO_SCAN_PROMISE_LINE,
  CONTINUOUS_COMPLIANCE_NARRATIVE,
} from '../../components/governance-frontend/hero-content';
import {
  COMING_SOON_IMPLEMENTATION,
  LIVE_IMPLEMENTATION,
  PREVIEW_IMPLEMENTATION,
  STATUS_LABEL,
  type ImplementationItem,
  type ImplementationStatus,
} from '../../product/implementation-status';
import { COMPANY, getCompanyDisplayName } from '../../config/company';
import { PLANS, checkoutHrefForPlan } from '@/shared/pricing';
import {
  DEMO_FINDINGS,
  DEMO_FRAMEWORKS,
  DEMO_INTENT_CHIPS,
  DEMO_NAV,
  DEMO_TILES,
  ENTERPRISE_CARDS,
  HERO_KICKER,
  HERO_KPIS,
  HERO_LEDE_LINES,
  HERO_PROOF_CHIPS,
  LAYERS,
  NODES,
  PRICING_PLAN_IDS,
  STATUS_BAR,
  THEME_STORAGE_KEY,
  TRUST_FRAMEWORKS,
  type GovernanceTheme,
} from './governance/content';
import './design-governance.css';

const EuropeRelief = lazy(() => import('./governance/EuropeRelief'));

const ENTERPRISE_HREF = '/contact-sales?source=design-governance&intent=enterprise';

const ROADMAP_GROUPS: readonly {
  status: ImplementationStatus;
  title: string;
  eyebrow: string;
  items: readonly ImplementationItem[];
}[] = [
  { status: 'live', title: 'LIVE', eyebrow: 'SHIPPED · REACHABLE', items: LIVE_IMPLEMENTATION },
  { status: 'preview', title: 'IN PREVIEW', eyebrow: 'DRAFT · NOT PRODUCTION-COMPLETE', items: PREVIEW_IMPLEMENTATION },
  { status: 'coming-soon', title: 'NEXT', eyebrow: 'COMING SOON', items: COMING_SOON_IMPLEMENTATION },
];

const PRICING_PLANS = PRICING_PLAN_IDS.map((id) => PLANS.find((p) => p.id === id)).filter(
  (p): p is (typeof PLANS)[number] => p !== undefined,
);

const HEX = '0123456789abcdef';
const randomHash = () =>
  '0x' + Array.from({ length: 6 }, () => HEX[Math.floor(Math.random() * 16)]).join('');

function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function readStoredTheme(): GovernanceTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'night' ? 'night' : 'titan';
  } catch {
    return 'titan';
  }
}

export function DesignGovernanceLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [theme, setThemeState] = useState<GovernanceTheme>(readStoredTheme);
  const plateRef = useRef<HTMLDivElement>(null);

  // Evidence ledger: rolling signatures on the first four nodes.
  const [ledger, setLedger] = useState(() => ({
    hashes: NODES.slice(0, 4).map(randomHash),
    hot: -1,
  }));

  const setTheme = useCallback((next: GovernanceTheme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode / blocked storage — theme just won't persist */
    }
  }, []);

  useEffect(() => {
    let turn = 0;
    let cool: ReturnType<typeof setTimeout> | undefined;
    const tick = setInterval(() => {
      const idx = turn % 4;
      turn += 1;
      setLedger((prev) => ({
        hashes: prev.hashes.map((h, i) => (i === idx ? randomHash() : h)),
        hot: idx,
      }));
      cool = setTimeout(() => setLedger((prev) => ({ ...prev, hot: -1 })), 900);
    }, 2200);
    return () => {
      clearInterval(tick);
      if (cool) clearTimeout(cool);
    };
  }, []);

  // Pointer parallax on the relief plate (skipped for reduced-motion users).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      const plate = plateRef.current;
      if (!plate) return;
      const dx = (e.clientX / window.innerWidth - 0.5) * 2;
      const dy = (e.clientY / window.innerHeight - 0.5) * 2;
      plate.style.transform = `rotateX(${58 - dy * 3}deg) rotateZ(${-16 - dx * 3}deg) translateZ(-40px) scale(.9)`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `/audit?domain=${encodeURIComponent(value)}` : '/audit');
  };

  return (
    <div className="dgov" data-theme={theme}>
      <SEOHead
        title="The Governance AI (Preview) — RealSyncDynamics.AI"
        description={`${CONTINUOUS_COMPLIANCE_NARRATIVE} Design-Preview.`}
        canonical="/design/governance"
        noIndex
      />

      <div id="dgov-bg" aria-hidden="true">
        <div className="rails" />
        <div className="horizon" />
        <div className="carbon" />
        <div className="photo" />
        <div className="photo-tone" />
        <div className="photo-gold" />
        <div id="dgov-scene">
          <div id="dgov-plate" ref={plateRef}>
            <div id="dgov-grid" />
            <Suspense fallback={null}>
              <EuropeRelief theme={theme} />
            </Suspense>
          </div>
        </div>
        <div className="atmos" />
        <div className="scrim" />
      </div>

      <div id="dgov-page">
        <div className="statusbar" aria-label="Betriebsstatus">
          <div className="statusbar-in">
            <i />
            <span>
              <b>{STATUS_BAR.runtime}</b> · {STATUS_BAR.region}
            </span>
            <span>{STATUS_BAR.hosting}</span>
            <div className="right">
              <span>{STATUS_BAR.frameworks}</span>
              <span>{STATUS_BAR.sla}</span>
              <span className="theme-switch" role="group" aria-label="Design-Variante">
                <button type="button" aria-pressed={theme === 'titan'} onClick={() => setTheme('titan')}>
                  TITAN
                </button>
                <button type="button" aria-pressed={theme === 'night'} onClick={() => setTheme('night')}>
                  NACHT
                </button>
              </span>
            </div>
          </div>
        </div>

        <header>
          <div className="head-in">
            <Link className="brand" to="/">
              RealSync Dynamics.AI
            </Link>
            <span className="preview-pill">{STATUS_LABEL.preview}</span>
            <nav aria-label="Hauptnavigation">
              <a className="navlink" href="#product">
                Produkt
              </a>
              <Link className="navlink" to="/evidence">
                Evidence
              </Link>
              <a className="navlink" href="#pricing">
                Preise
              </a>
              <Link className="navlink" to="/welcome">
                Login
              </Link>
              <Link className="cta-pill" to="/audit">
                {HERO_SCAN_CTA_LONG}
              </Link>
            </nav>
          </div>
        </header>

        <main>
          <div className="hero reveal" style={{ animationDelay: '60ms' }}>
            <i className="mark tl" />
            <i className="mark br" />
            <div className="kicker">
              <span>{HERO_KICKER[0]}</span>
              <s />
              <span>{HERO_KICKER[1]}</span>
              <s />
              <span>{HERO_KICKER[2]}</span>
            </div>
            <h1>
              {HERO_HEADLINE.map((segments, line) => (
                <span key={line}>
                  {line > 0 && <br />}
                  {segments.map((segment, i) =>
                    segment.accent ? <em key={i}>{segment.text}</em> : <span key={i}>{segment.text}</span>,
                  )}
                </span>
              ))}
            </h1>
            <p className="loop">{HERO_OPERATING_LOOP}</p>
            <p className="lede">
              {HERO_LEDE_LINES[0]}
              <br />
              {HERO_LEDE_LINES[1]}
            </p>
            <p className="eu-line">{HERO_EU_LINE}</p>
            <div className="cta-row">
              <Link className="btn-primary" to="/audit">
                {HERO_SCAN_CTA_LONG}
                <ArrowIcon />
              </Link>
              <Link className="btn-ghost" to="/app">
                {HERO_DASHBOARD_CTA_LABEL}
              </Link>
            </div>

            <form onSubmit={startScan} className="scan">
              <p>{HERO_SCAN_PROMISE_LINE}</p>
              <label className="sr-only" htmlFor="dgov-domain">
                Domain
              </label>
              <div className="scan-row">
                <input
                  id="dgov-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="domain.example"
                />
                <button type="submit">RUN →</button>
              </div>
              <small>{HERO_SCAN_CTA_PROMISE}</small>
            </form>

            <div className="proof">
              {HERO_PROOF_CHIPS.map((chip) => (
                <span className="chip" key={chip}>
                  <i />
                  {chip}
                </span>
              ))}
            </div>
            <div className="hero-kpis">
              {HERO_KPIS.map((kpi) => (
                <div key={kpi.label}>
                  <b>{kpi.value}</b>
                  <span>{kpi.label}</span>
                </div>
              ))}
            </div>
            <div className="trust">
              <p>SECHS POLICY PACKS · EIN PRÜFPFAD</p>
              <div className="frameworks">
                {TRUST_FRAMEWORKS.map((fw) => (
                  <span key={fw.name} className={fw.next ? 'next' : undefined}>
                    {fw.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* 01 · Workspace preview — demo data, clearly labelled */}
        <section className="band band-a" id="dashboard">
          <div className="band-in">
            <div className="sec-index">
              <b>01</b>
              <span>WORKSPACE</span>
            </div>
            <p className="sec-eyebrow">IHR WORKSPACE</p>
            <h2>
              Das bekommen Sie: <em>Ihr Governance-Dashboard.</em>
            </h2>
            <p className="sec-lede">
              Nach dem Free Audit läuft Ihre Runtime im Command Center weiter — Rahmenwerk-Reifegrade, offene
              Findings, Evidence-Chain und der Agent-Intent auf einer Fläche.
            </p>

            <div className="app">
              <div className="app-bar">
                <div className="dots">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="url">realsyncdynamicsai.de/app/dashboard</div>
                <span className="tag">DEMO · BEISPIELDATEN</span>
              </div>
              <div className="app-body">
                <nav className="app-nav" aria-label="Demo-Navigation">
                  <div className="nav-group">GOVERNANCE OS</div>
                  {DEMO_NAV.map((item) => (
                    <div key={item.label} className={item.active ? 'nav-item active' : 'nav-item'}>
                      <span>{item.label}</span>
                      {item.badge && <b>{item.badge}</b>}
                    </div>
                  ))}
                </nav>
                <div className="app-main">
                  <div className="app-head">
                    <h3>Compliance Command Center</h3>
                    <span>PLAN GROWTH · EU-CENTRAL</span>
                  </div>
                  <div className="tiles">
                    {DEMO_TILES.map((tile) => (
                      <div className="tile" key={tile.label}>
                        <b>
                          {tile.value}
                          {tile.suffix && <i>{tile.suffix}</i>}
                        </b>
                        <span>{tile.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="split">
                    <div className="panel">
                      <div className="panel-head">
                        RAHMENWERK-REIFEGRAD<b>6 POLICY PACKS</b>
                      </div>
                      <div>
                        {DEMO_FRAMEWORKS.map((fw) => (
                          <div className="fw" key={fw.name}>
                            <s>{fw.name}</s>
                            <div className="bar">
                              <u style={{ width: `${fw.pct}%` }} />
                            </div>
                            <em>{fw.label}</em>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="panel">
                      <div className="panel-head">
                        OFFENE FINDINGS<b>PRIORISIERT</b>
                      </div>
                      <div>
                        {DEMO_FINDINGS.map((f) => (
                          <div className="finding" key={f.text}>
                            <span className={`sev sev-${f.sev}`}>{f.label}</span>
                            <em>{f.text}</em>
                            <u>{f.ref}</u>
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
                      <div>
                        {NODES.slice(0, 4).map((n, i) => (
                          <div className="row" key={n.city}>
                            <s>{n.city}</s>
                            <em>{n.role}</em>
                            <u style={{ color: ledger.hot === i ? 'var(--bronze-lite)' : undefined }}>
                              {ledger.hashes[i]}
                            </u>
                          </div>
                        ))}
                      </div>
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
                        {DEMO_INTENT_CHIPS.map((chip) => (
                          <span key={chip}>{chip}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 · Runtime layers */}
        <section className="band band-b" id="product">
          <div className="band-in">
            <div className="sec-index">
              <b>02</b>
              <span>RUNTIME</span>
            </div>
            <p className="sec-eyebrow">PRODUKT</p>
            <h2>
              Eine Runtime. <em>Vier Ebenen.</em>
            </h2>
            <p className="sec-lede">
              Detect, Monitor, Govern und Automate greifen ineinander: was der Scan findet, wird laufend überwacht,
              nach AI-Act-Risiko und DSGVO-Artikel klassifiziert und als Evidence versiegelt.
            </p>
            <div className="cards">
              {LAYERS.map((layer) => (
                <article className="card" key={layer.title}>
                  <p className="card-tag">
                    {layer.index} · {layer.title}
                  </p>
                  <p className="card-role">{layer.role}</p>
                  <p className="body">{layer.body}</p>
                  <ul>
                    {layer.bullets.map((b) => (
                      <li key={b}>
                        <span className="plus">+</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 03 · Pricing — shared/pricing.ts is the single source of truth */}
        <section className="band band-c" id="pricing">
          <div className="band-in">
            <div className="sec-index">
              <b>03</b>
              <span>TARIFE</span>
            </div>
            <p className="sec-eyebrow">PREISE</p>
            <h2>
              Pläne für die <em>Governance Runtime.</em>
            </h2>
            <p className="sec-lede">
              Monatliche Self-Service-Tarife —{' '}
              {PRICING_PLANS.map((p) => `${p.name} €${p.price.monthlyEur}`).join(' · ')}. Jahresabrechnung: Coming
              Soon.
            </p>
            <p className="sec-note">
              Upgrade-Leiter: Einzel-Domain → Starter · SaaS → Growth · Mehrere Kunden → Agency · DSB/Enterprise →
              Anfrage
            </p>
            <div className="cards">
              {PRICING_PLANS.map((plan) => {
                const badge = plan.badges[0];
                return (
                  <article className={plan.highlight ? 'card featured' : 'card'} key={plan.id}>
                    <div className="card-top">
                      <p className="card-tag">{plan.name.toUpperCase()}</p>
                      {badge && <span className="badge">{badge.toUpperCase()}</span>}
                    </div>
                    <h3 className="plan-price">
                      {plan.price.monthlyEur} €<span>/ MONAT</span>
                    </h3>
                    <p className="body">{plan.outcomeHeadline}</p>
                    <ul>
                      {plan.features.audit_evidence.slice(0, 4).map((b) => (
                        <li key={b}>
                          <span className="plus">+</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      className={plan.highlight ? 'plan-cta featured-cta' : 'plan-cta ghost-cta'}
                      to={checkoutHrefForPlan(plan, { source: 'design-governance' })}
                    >
                      {plan.ctaLabel}
                      <ArrowIcon size={14} />
                    </Link>
                  </article>
                );
              })}
            </div>
            <p className="sec-note sec-note-wide">
              Monatlich live · Yearly Coming Soon · <Link to={ENTERPRISE_HREF}>{CTA.enterprise}</Link>
            </p>
          </div>
        </section>

        {/* 04 · Roadmap — implementation-status.ts is the single source of truth */}
        <section className="band band-a" id="roadmap">
          <div className="band-in">
            <div className="sec-index">
              <b>04</b>
              <span>STATUS</span>
            </div>
            <p className="sec-eyebrow">ROADMAP</p>
            <h2>
              Was live ist. <em>Was als Nächstes kommt.</em>
            </h2>
            <p className="sec-lede">
              Status je Modul — live, in Preview oder als Nächstes. Keine doppelten Marketing-Claims.
            </p>
            <div className="roadmap-groups">
              {ROADMAP_GROUPS.map((group) => {
                const dashed = group.status !== 'live';
                const items = group.items.filter((item) => item.showOnRoadmap !== false);
                return (
                  <div key={group.status}>
                    <div className="group-head">
                      <h3>{group.title}</h3>
                      <span>{group.eyebrow}</span>
                    </div>
                    <div className="cards cards-flush">
                      {items.map((item) => (
                        <div className={dashed ? 'rm-card dashed' : 'rm-card'} key={item.id}>
                          <div className="rm-top">
                            <h4>{item.name}</h4>
                            <span className={dashed ? 'status dashed' : 'status'}>{STATUS_LABEL[item.status]}</span>
                          </div>
                          <p>{item.description}</p>
                          {item.route && <u>{item.route}</u>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 05 · Enterprise */}
        <section className="band band-b" id="enterprise">
          <div className="band-in">
            <div className="sec-index">
              <b>05</b>
              <span>ENTERPRISE</span>
            </div>
            <p className="sec-eyebrow">ENTERPRISE · SLA NACH VEREINBARUNG</p>
            <h2>
              Konzernweite Governance über alle sechs Rahmenwerke — <em>mit SLA und SSO.</em>
            </h2>
            <p className="sec-lede">
              Multi-Tenant-Runtime für bis zu 5 Organisationen, zentrale Rechteverwaltung und individuell
              dimensionierte Scheduler- und Automation-Kontingente. Kein Self-Service-Checkout — Enterprise per
              Anfrage.
            </p>
            <div className="ent">
              {ENTERPRISE_CARDS.map((card) => (
                <div key={card.title}>
                  <h4>{card.title}</h4>
                  <p>{card.body}</p>
                  <u>{card.tag}</u>
                </div>
              ))}
            </div>
            <div className="ent-cta">
              <Link className="btn-primary" to={ENTERPRISE_HREF}>
                {CTA.enterprise}
                <ArrowIcon />
              </Link>
              <small>CUSTOM-DPA · BESTELLUNG PER PO</small>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="band band-a" id="next">
          <div className="band-in closing">
            <p className="sec-eyebrow">NÄCHSTER SCHRITT</p>
            <h2>Scan. Dashboard. Evidence.</h2>
            <p className="sec-lede sec-lede-center">
              {CONTINUOUS_COMPLIANCE_NARRATIVE} Der Free Audit ist der Einstieg — danach Governance Activation und
              Workspace.
            </p>
            <div className="cta-row">
              <Link className="btn-primary" to="/audit">
                {HERO_SCAN_CTA_LONG}
                <ArrowIcon />
              </Link>
              <Link className="btn-ghost" to="/app">
                {HERO_DASHBOARD_CTA_LABEL}
              </Link>
              <Link className="btn-ghost" to="/evidence">
                Evidence-Preview
              </Link>
            </div>
          </div>
        </section>

        <footer>
          <div className="foot-legal">
            <div>
              <b>UNTERNEHMEN</b>
              <strong>{getCompanyDisplayName()}</strong>
              <br />
              {COMPANY.headquartersAddress.city}, Deutschland
              <br />
              Registerangaben im <Link to="/impressum">Impressum</Link>
            </div>
            <div>
              <b>BETRIEB</b>
              Alle Daten werden in Europa verarbeitet und gespeichert.
              <br />
              Gebaut für die Datenschutz-Grundverordnung und den EU AI Act.
            </div>
            <div>
              <b>STANDARDS</b>
              DSGVO · EU AI Act · ISO 27001 · NIS2
              <br />
              C2PA-Standard · Evidence-Chain
            </div>
            <div>
              <b>KONTAKT</b>
              Enterprise per Anfrage — SSO, Custom-DPA, Bestellung per PO.
              <br />
              <Link to={ENTERPRISE_HREF}>{CTA.enterprise}</Link>
            </div>
          </div>
          <div className="foot-in">
            <span>© 2026 RealSync Dynamics.AI · Design Preview (nicht Live-/)</span>
            <nav className="legal" aria-label="Rechtliches">
              <Link to="/">Live Landing</Link>
              <i>|</i>
              <Link to="/design/ledger">Ledger Preview</Link>
              <i>|</i>
              <Link to="/design/tribunal">Tribunal Preview</Link>
              <i>|</i>
              <Link to="/impressum">Impressum</Link>
              <i>|</i>
              <Link to="/agb">AGB</Link>
              <i>|</i>
              <Link to="/datenschutz">Datenschutz</Link>
              <i>|</i>
              <Link to="/widerruf">Widerruf</Link>
              <i>|</i>
              <Link to="/kontakt">Kontakt</Link>
              <i>|</i>
              <Link to="/roadmap">Roadmap</Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
