import { Link } from 'react-router-dom';
import { CTA } from '../../../content/runtimeVocab';
import { EuropeMapCanvas, type Lv7Theme } from './EuropeMapCanvas';
import {
  AUDIT_CTA,
  DEMO_KPIS,
  enterpriseContent,
  EVIDENCE,
  FLOW,
  HREF,
  LOOP,
  PLANS,
  PLATFORM,
  PRICING_FOOT,
  PRICING_INTRO,
  ROADMAP,
  STACK,
  STATUS_TEXT,
  STEPS,
  TOOLS,
  type Lv7Status,
} from './landing-v7-content';

const THEMES: readonly [Lv7Theme, string][] = [
  ['titan', 'TITAN'],
  ['nacht', 'NACHT'],
];

function Status({ s, children }: { s: Lv7Status; children?: string }) {
  return <span className={`lv7-st lv7-st-${s}`}>{children ?? STATUS_TEXT[s]}</span>;
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function LandingV7View({ theme, onTheme }: { theme: Lv7Theme; onTheme: (t: Lv7Theme) => void }) {
  const ent = enterpriseContent();
  const btn = theme === 'nacht' ? 'lv7-cyan' : 'lv7-gold';

  return (
    <div className="lv7" data-theme={theme}>
      <a className="lv7-skip" href="#lv7-main">
        Zum Inhalt springen
      </a>
      <header className="lv7-header">
        <div className="lv7-header-row">
          <Link className="lv7-brand" to="/">
            RealSync Dynamics.AI
          </Link>
          <div className="lv7-hd-r">
            <nav aria-label="Hauptnavigation">
              <a href="#platform">Produkt</a>
              <a href="#evidence">Evidence</a>
              <a href="#pricing">Preise</a>
              <Link to={HREF.login}>Login</Link>
            </nav>
            <Link className={`lv7-btn-hd ${btn}`} to={HREF.audit}>
              {CTA.startFreeAudit}
            </Link>
          </div>
        </div>
      </header>

      <main id="lv7-main">
        <section className="lv7-hero" aria-labelledby="lv7-h1">
          <div className="lv7-backdrop lv7-bd-titan" aria-hidden="true" />
          <div className="lv7-backdrop lv7-bd-nacht" aria-hidden="true" />
          <EuropeMapCanvas theme={theme} />
          <div className="lv7-hero-shade" aria-hidden="true" />
          <div className="lv7-hero-copy">
            <h1 id="lv7-h1">
              <span className="lv7-l lv7-t">AI Compliance</span>{' '}
              <span className="lv7-l">
                <span className="lv7-t">Operations OS </span>
                <span className="lv7-e">for Europe</span>
              </span>
            </h1>
            <p className="lv7-flow">
              {FLOW.map((step, i) => (
                <span key={step}>
                  {i > 0 && <i aria-hidden="true">→ </i>}
                  {step}
                </span>
              ))}
            </p>

            {theme === 'titan' ? (
              <>
                <p className="lv7-stack">
                  {STACK.map((row, r) => (
                    <span key={r} className="lv7-stack-row">
                      {row.map((item, i) => (
                        <span key={item}>
                          {i > 0 && <b aria-hidden="true">·</b>}
                          {item}
                        </span>
                      ))}
                    </span>
                  ))}
                </p>
                <div className="lv7-chips">
                  <Link className="lv7-chip lv7-gold" to={HREF.audit}>
                    Free Audit
                  </Link>
                  {PLANS.map((p) => (
                    <Link key={p.id} className={`lv7-chip${p.featured ? ' lv7-hot' : ''}`} to={p.heroHref}>
                      <span>
                        {p.name}
                        <strong>
                          {p.price}
                          {p.listPrice && <s aria-label={`statt ${p.listPrice}`}>{p.listPrice}</s>}
                        </strong>
                      </span>
                    </Link>
                  ))}
                  <Link className="lv7-chip" to={HREF.enterprise}>
                    Enterprise
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="lv7-sub">
                  Runtime governance for regulated AI systems.
                  <br />
                  Continuous evidence. EU-native by design.
                </p>
                <div className="lv7-cta-row lv7-cta-hero">
                  <Link className="lv7-cta2 lv7-cyan" to={HREF.audit}>
                    {AUDIT_CTA} <Arrow />
                  </Link>
                  <Link className="lv7-cta2 lv7-ghost-cyan" to={HREF.dashboard}>
                    {CTA.openDashboard}
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="lv7-sec" aria-label="Beispielansicht Governance Runtime">
          <div className="lv7-wrap">
            <div className="lv7-dash lv7-glass">
              <div className="lv7-dash-top">
                <b>GOVERNANCE RUNTIME · BEISPIELANSICHT</b>
                <Status s="demo" />
              </div>
              <dl className="lv7-kpis">
                {DEMO_KPIS.map((k) => (
                  <div key={k.l}>
                    <dt>{k.l}</dt>
                    <dd>{k.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="lv7-dash-note">
                Beispielansicht des Dashboards mit simulierten Werten. Ihre Werte entstehen mit dem ersten Scan.
              </p>
              <ul className="lv7-loop" aria-label="Governance-Kreislauf">
                {LOOP.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="lv7-sec" aria-labelledby="lv7-tools">
          <div className="lv7-wrap">
            <div className="lv7-sec-head">
              <p className="lv7-kicker">GOVERNANCE TOOLS</p>
              <h2 id="lv7-tools">
                Ihre KI-Kanäle. <span>Eine Governance-Ebene.</span>
              </h2>
              <p>Live-Module führen in den Konfigurator. Preview-Module sind als solche gekennzeichnet.</p>
            </div>
            <div className="lv7-tools">
              {TOOLS.map((t) => (
                <article key={t.title} className="lv7-tool lv7-glass">
                  <div className="lv7-meta">
                    {t.eyebrow}
                    <Status s={t.status} />
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                  <ul className="lv7-tags">
                    {t.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <Link to={t.href}>{t.cta}</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lv7-sec" aria-labelledby="lv7-plane">
          <div className="lv7-wrap">
            <div className="lv7-plane">
              <div>
                <p className="lv7-kicker">ONE OPERATIONAL PLANE</p>
                <h2 id="lv7-plane">Detect. Govern. Prove.</h2>
                <p className="lv7-lead">
                  Runtime für KI-Risiken, Policies und Evidence — für Module mit Status LIVE. Preview und Next stehen auf
                  der Roadmap.
                </p>
              </div>
              <div className="lv7-cta-row">
                <Link className="lv7-pill lv7-pill-sun" to={HREF.runtime}>
                  Runtime öffnen
                </Link>
                <Link className="lv7-pill lv7-pill-cream" to={HREF.dashboard}>
                  Zum Compliance Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="lv7-sec" id="platform" aria-labelledby="lv7-platform">
          <div className="lv7-wrap">
            <div className="lv7-sec-head">
              <p className="lv7-kicker">DIE PLATTFORM</p>
              <h2 id="lv7-platform">
                Eine Runtime. <span>Module, die live erreichbar sind.</span>
              </h2>
              <p>
                Nur Capabilities mit Status LIVE aus dem Product-Registry. Preview und Coming Soon stehen unter{' '}
                <a href="#roadmap">Roadmap</a>.
              </p>
            </div>
            <ul className="lv7-mods lv7-glass">
              {PLATFORM.map((m) => {
                const body = (
                  <>
                    <b>{m.name}</b>
                    <Status s="live" />
                    <p>{m.text}</p>
                    {m.route && <u>{m.route}</u>}
                  </>
                );
                return (
                  <li key={m.id}>
                    {m.route ? (
                      <Link className="lv7-mod" to={m.route}>
                        {body}
                      </Link>
                    ) : (
                      <div className="lv7-mod">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="lv7-sec" id="evidence" aria-labelledby="lv7-evidence">
          <div className="lv7-wrap">
            <div className="lv7-sec-head">
              <p className="lv7-kicker">EVIDENCE &amp; TRUST</p>
              <h2 id="lv7-evidence">
                Compliance, die sich <span>beweisen lässt.</span>
              </h2>
              <p>
                PDFs, Logs, Zeitstempel und nachvollziehbare Prüfpfade. Jede Prüfung, jede Entscheidung und jede
                Änderung landet in derselben Governance-Historie.
              </p>
            </div>
            <div className="lv7-ev">
              {EVIDENCE.map((e) => (
                <div key={e.t}>
                  <h3>{e.t}</h3>
                  <p>{e.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lv7-sec" aria-labelledby="lv7-steps">
          <div className="lv7-wrap">
            <div className="lv7-sec-head">
              <p className="lv7-kicker">GOVERNANCE RUNTIME</p>
              <h2 id="lv7-steps">
                Von der KI-Nutzung zur <span>kontrollierten KI-Organisation.</span>
              </h2>
            </div>
            <ol className="lv7-steps">
              {STEPS.map((s, i) => (
                <li key={s.k} className="lv7-step">
                  <i aria-hidden="true">{String(i + 1).padStart(2, '0')}</i>
                  <h3>{s.k}</h3>
                  <p>{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lv7-sec" id="pricing" aria-labelledby="lv7-pricing">
          <div className="lv7-wrap">
            <div className="lv7-sec-head">
              <p className="lv7-kicker">PREISE</p>
              <h2 id="lv7-pricing">
                Pläne für die <span>Governance Runtime.</span>
              </h2>
              <p>{PRICING_INTRO}</p>
            </div>
            <div className="lv7-prices">
              {PLANS.map((p) => (
                <article key={p.id} className={`lv7-price lv7-glass${p.featured ? ' lv7-feat' : ''}`}>
                  <div className="lv7-name">
                    {p.name.toUpperCase()}
                    {p.featured && <span className="lv7-st lv7-st-badge">EMPFOHLEN</span>}
                  </div>
                  <div className="lv7-amt">
                    {p.price}
                    <small> / Monat</small>
                    {p.listPrice && <s aria-label={`statt ${p.listPrice}`}>{p.listPrice}</s>}
                  </div>
                  <p className="lv7-billing">{p.note}</p>
                  <p className="lv7-claim">{p.claim}</p>
                  <ul>
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link className={`lv7-pill ${p.featured ? 'lv7-pill-sun' : 'lv7-pill-cream'}`} to={p.href}>
                    {p.cta}
                  </Link>
                </article>
              ))}
            </div>
            <p className="lv7-tax">
              {PRICING_FOOT} <Link to={HREF.pricing}>Alle Preise und Module</Link>
            </p>
          </div>
        </section>

        <section className="lv7-sec" id="roadmap" aria-labelledby="lv7-roadmap">
          <div className="lv7-wrap">
            <div className="lv7-sec-head">
              <p className="lv7-kicker">ROADMAP</p>
              <h2 id="lv7-roadmap">
                Was live ist. <span>Was als Nächstes kommt.</span>
              </h2>
              <p>Automatisiert aus dem Product-Registry. Statuswechsel aktualisieren diese Liste — ohne doppelte Marketing-Claims.</p>
            </div>
            <div className="lv7-road">
              {ROADMAP.map((col) => (
                <div key={col.status} className={`lv7-col lv7-glass lv7-col-${col.status}`}>
                  <div className="lv7-col-h">
                    <Status s={col.status} />
                    <small>{col.eyebrow}</small>
                  </div>
                  <ul>
                    {col.items.map((i) => (
                      <li key={i.id}>
                        {i.name}
                        <span>{i.hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {ent && (
          <section className="lv7-sec" aria-labelledby="lv7-enterprise">
            <div className="lv7-wrap">
              <div className="lv7-ent lv7-glass">
                <div>
                  <p className="lv7-kicker">ENTERPRISE-ZUGANG</p>
                  <h2 id="lv7-enterprise">Governance mit Ansprechpartner.</h2>
                  <p className="lv7-lead">{ent.tagline}</p>
                  <p className="lv7-lead lv7-muted">{ent.subline}</p>
                  <div className="lv7-amt">
                    {ent.price}
                    {ent.suffix && <small> {ent.suffix}</small>}
                  </div>
                  <div className="lv7-cta-row">
                    <Link className="lv7-pill lv7-pill-sun" to={HREF.enterprise}>
                      {ent.cta}
                    </Link>
                    <Link className="lv7-pill lv7-pill-cream" to={ent.detailsHref}>
                      Leistungen im Detail
                    </Link>
                  </div>
                </div>
                <div>
                  <div className="lv7-ent-grid">
                    {ent.cards.map((c) => (
                      <div key={c.t}>
                        <h3>{c.t}</h3>
                        <p>{c.d}</p>
                      </div>
                    ))}
                  </div>
                  <ul className="lv7-incl">
                    {ent.included.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="lv7-sec lv7-final" aria-labelledby="lv7-final">
          <div className="lv7-wrap">
            <p className="lv7-kicker">WARUM JETZT</p>
            <h2 id="lv7-final">Governance statt Checkliste.</h2>
            <p>Eine Checkliste beruhigt bis zum nächsten Audit. Die Runtime hält den Nachweis, wenn Aufsicht, Kunde oder Board fragt.</p>
            <div className="lv7-cta-row">
              <Link className="lv7-pill lv7-pill-sun" to={HREF.audit}>
                Kostenlosen Governance Scan starten
              </Link>
              <Link className="lv7-pill lv7-pill-cream" to={HREF.pricing}>
                Preise ansehen
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lv7-footer">
        <div className="lv7-wrap">
          <span>
            © {new Date().getFullYear()} RealSync Dynamics AI · Made in Thüringen · EU-native by design · Datenverkehr stilisiert
          </span>
          <nav aria-label="Rechtliches">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/agb">AGB</Link>
            <Link to="/legal/widerruf">Widerruf</Link>
            <Link to="/legal/sub-processors">Sub-Prozessoren</Link>
            <Link to="/kontakt">Kontakt</Link>
          </nav>
        </div>
      </footer>

      <div className="lv7-rail lv7-glass" aria-hidden="true">
        <Status s="live" />
        <Status s="preview" />
        <Status s="coming-soon" />
        <Status s="demo">DEMO</Status>
      </div>
      <div className="lv7-themer" role="group" aria-label="Darstellung">
        {THEMES.map(([t, label]) => (
          <button key={t} type="button" aria-pressed={theme === t} onClick={() => onTheme(t)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
