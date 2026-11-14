import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkoutHrefForPlan, formatPriceEur, planById } from '@/shared/pricing';
import { useLang } from '../../../i18n/useLang';
import { BETA, BETA_PUBLIC_OFFER, TRY_FREE, betaSignupHref } from '../../../config/beta';
import {
  ROADMAP_COMING_SOON_ITEMS,
  ROADMAP_LIVE_ITEMS,
  ROADMAP_PREVIEW_ITEMS,
  STATUS_LABEL,
  type ImplementationItem,
} from '../../../product/implementation-status';
import { LOOP_NODES } from '../v4/landing-v4-content';
import { LV2_STACK } from '../v2/landing-v2-content';
import { V5_BETA_STEPS } from '../v5/V5Sections';
import { V5_ENTRY_STEPS } from '../v5/V5UnifiedEntry';
import { LogoMark } from './LogoMark';

const SOURCE = 'landing-v9';

/**
 * Beta-Zusagen aus `config/beta.ts`, ohne die pauschale EU-Hosting-Aussage:
 * Die wurde in #2185/#2186 als unbelegt aus Meta-Texten und Trust-Seiten
 * entfernt. Die Quelle selbst bleibt unverändert (Claims-Änderung = Freigabe).
 */
const BETA_PROMISES = BETA.promises.filter((p) => !p.includes('EU-Hosting'));

const TIERS = (['starter', 'growth', 'agency'] as const).map((id) => planById(id));

function tierHref(id: (typeof TIERS)[number]['id'], source: string) {
  return BETA_PUBLIC_OFFER ? betaSignupHref(id, source) : checkoutHrefForPlan(id, { source });
}

/** Lädt das 3D-Logo nach dem ersten Paint; ohne WebGL bleibt das flache Zeichen stehen. */
function useLogo3D() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState<'pending' | 'on' | 'off'>('pending');

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || navigator.webdriver) {
      setGl('off');
      return;
    }
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
      setGl('off');
      return;
    }
    let unmount: (() => void) | undefined;
    let cancelled = false;
    import('./logoRings3D')
      .then(({ mountLogoRings }) => {
        if (cancelled) return;
        unmount = mountLogoRings({ canvas, container: stage });
        setGl('on');
      })
      .catch(() => setGl('off'));
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  return { stageRef, canvasRef, gl };
}

function RoadmapCol({ title, items }: { title: string; items: readonly ImplementationItem[] }) {
  return (
    <div className="lv9-rm__col">
      <h3>
        {title} <span>{items.length}</span>
      </h3>
      <ul>
        {items.slice(0, 6).map((it) => (
          <li key={it.id}>
            <span className="lv9-rm__tag">{STATUS_LABEL[it.status]}</span>
            {it.route ? <Link to={it.route}>{it.name}</Link> : <span>{it.name}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingV9View() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { stageRef, canvasRef, gl } = useLogo3D();
  const [url, setUrl] = useState('');
  const scanInput = useRef<HTMLInputElement>(null);

  const onScan = (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    navigate(`/audit?source=${SOURCE}-hero` + (u ? '&url=' + encodeURIComponent(u) : ''));
  };

  const focusScan = () => {
    const input = scanInput.current;
    if (!input) return;
    input.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    input.focus({ preventScroll: true });
  };

  const tryHref = BETA_PUBLIC_OFFER ? betaSignupHref(BETA.testPlan, `${SOURCE}-header`) : '#preise';
  const loop = [t('v4HeroLoop1'), t('v4HeroLoop2'), t('v4HeroLoop3'), t('v4HeroLoop4')];

  return (
    <div className="lv9">
      {BETA.active && (
        <div className="lv9-ribbon" role="note">
          <div className="lv9-wrap">
            <span>
              <b>{BETA.badge}</b>Offene Testphase bis {BETA.endsLabel}: kostenlos testen, keine Kreditkarte.
            </span>
            <Link to={betaSignupHref(BETA.testPlan, `${SOURCE}-ribbon`)}>Jetzt kostenlos testen</Link>
          </div>
        </div>
      )}

      <header className="lv9-top">
        <div className="lv9-wrap">
          <Link to="/" className="lv9-brand" aria-label="RealSync Dynamics & AI, zur Startseite">
            <LogoMark className="lv9-brand__mark" />
            <span>
              <span className="lv9-brand__name">REALSYNC</span>
              <span className="lv9-brand__sub">Dynamics &amp; AI</span>
            </span>
          </Link>
          <nav className="lv9-nav" aria-label="Hauptnavigation">
            <a href="#ablauf">Ablauf</a>
            <a href="#einstieg">Einstieg</a>
            {BETA.active && <a href="#beta">Beta</a>}
            <a href="#preise">Preise</a>
            <a href="#roadmap">Roadmap</a>
          </nav>
          <div className="lv9-actions">
            <Link to="/welcome" className="lv9-btn lv9-btn--quiet">
              Login
            </Link>
            {tryHref.startsWith('#') ? (
              <a href={tryHref} className="lv9-btn lv9-btn--solid">
                {TRY_FREE.cta}
              </a>
            ) : (
              <Link to={tryHref} className="lv9-btn lv9-btn--solid">
                {TRY_FREE.cta}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="lv9-hero" aria-labelledby="lv9-hero-title">
          <div className="lv9-wrap">
            <div ref={stageRef} className="lv9-stage" data-gl={gl} aria-hidden="true">
              <canvas ref={canvasRef} />
              <LogoMark className="lv9-stage__fallback" />
            </div>

            {BETA.active && (
              <Link to={betaSignupHref(BETA.testPlan, `${SOURCE}-badge`)} className="lv9-pill">
                <b>{BETA.badge}</b>
                {BETA.headline}
              </Link>
            )}

            <h1 id="lv9-hero-title" data-testid="v9-hero-heading">
              {t('v4HeroTitleA')} {t('v4HeroTitleB')} {t('v4HeroTitleEm')}
            </h1>

            <ol className="lv9-pipeline" aria-label="Ablauf">
              {loop.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <p className="lv9-lede">
              {t('v4HeroLede1')} {t('v4HeroLede2')}
            </p>

            <form className="lv9-scan" onSubmit={onScan}>
              <label className="lv9-sr" htmlFor="lv9-scan-url">
                Website-URL für den kostenlosen Check
              </label>
              <div className="lv9-field">
                <span className="lv9-field__prefix" aria-hidden="true">
                  https://
                </span>
                <input
                  ref={scanInput}
                  id="lv9-scan-url"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ihre-website.de"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button type="submit" data-hero-cta="audit">
                  Prüfen
                </button>
              </div>
              <p className="lv9-note">
                {BETA.active
                  ? `Kostenlos, Ergebnis in 90 Sekunden, keine Kreditkarte. Beta bis ${BETA.endsLabel}.`
                  : 'Kostenlos, Ergebnis in 90 Sekunden, keine Kreditkarte erforderlich.'}
              </p>
            </form>

            <div className="lv9-hero__links">
              <a href="#preise" className="lv9-btn">
                Tarife ansehen
              </a>
              <Link to="/governance-runtime" className="lv9-btn">
                {t('v4HeroSecondaryCta')}
              </Link>
            </div>
          </div>
        </section>

        <section className="lv9-section" id="ablauf" aria-labelledby="lv9-ablauf-title">
          <div className="lv9-wrap">
            <div className="lv9-head">
              <div>
                <p className="lv9-kicker">So funktioniert es</p>
                <h2 id="lv9-ablauf-title">Vier Schritte. Ohne Fachchinesisch.</h2>
              </div>
            </div>
            <ol className="lv9-steps">
              {LOOP_NODES.map(([kicker, title, text]) => (
                <li key={kicker}>
                  <span className="lv9-steps__k">{kicker}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lv9-section" id="einstieg" aria-labelledby="lv9-einstieg-title">
          <div className="lv9-wrap">
            <div className="lv9-head">
              <div>
                <p className="lv9-kicker">Ihr Einstieg</p>
                <h2 id="lv9-einstieg-title">Verstehen, was wichtig ist. Danach gezielt handeln.</h2>
              </div>
              <p className="lv9-sub">
                Vom ersten Website-Check bis zu Ihrem eigenen Unternehmens-Dashboard. Ohne Fachchinesisch, ohne doppelten
                Anmeldeprozess.
              </p>
            </div>
            <div className="lv9-entry">
              <ol className="lv9-list">
                {V5_ENTRY_STEPS.map((s) => (
                  <li key={s.n}>
                    <span className="lv9-list__n">{s.n}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.description}</p>
                      <Link to={`${s.to}${s.to.includes('?') ? '&' : '?'}source=${SOURCE}-entry`}>{s.action}</Link>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="lv9-app" role="region" aria-label="Beispiel eines RealSync-Command-Centers">
                <div className="lv9-app__bar">
                  <strong>RealSync Dynamics &amp; AI</strong>
                  <span>Produktvorschau, Beispieldaten</span>
                </div>
                <div className="lv9-app__body">
                  <div className="lv9-app__nav" aria-hidden="true">
                    <span className="is-on">Übersicht</span>
                    <span>Website-Audit</span>
                    <span>Risiken</span>
                    <span>Maßnahmen</span>
                    <span>Nachweise</span>
                  </div>
                  <div className="lv9-app__main">
                    <span className="lv9-app__label">Command Center, Beispiel</span>
                    <h3>Ihr Betrieb. Ihr Überblick.</h3>
                    <p>Welche Fragen sind geklärt, und was sollten Sie als Nächstes prüfen?</p>
                    <div className="lv9-metrics">
                      <div>
                        <span>Erfasste Website</span>
                        <b>1</b>
                      </div>
                      <div>
                        <span>Offene Prüfpunkte</span>
                        <b>3</b>
                      </div>
                      <div>
                        <span>Dokumentation</span>
                        <b>Bereit</b>
                      </div>
                    </div>
                    <div className="lv9-todo">
                      <div className="lv9-todo__h">
                        <span>Ihre nächsten Schritte</span>
                        <span>Beispiel</span>
                      </div>
                      <p>
                        <i />
                        Cookie-Einbindung kontrollieren<em>Prüfen</em>
                      </p>
                      <p>
                        <i />
                        KI-Regeln für Mitarbeiter festlegen<em>Klärung</em>
                      </p>
                      <p>
                        <i />
                        Zuständigkeit für Freigaben bestimmen<em>Planen</em>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="lv9-disclaimer">
              Die Vorschau enthält keine echten Kundendaten oder gemessenen Compliance-Werte. Ein Website-Scan ersetzt keine
              rechtliche Prüfung.
            </p>
          </div>
        </section>

        {BETA.active && (
          <section className="lv9-section" id="beta" aria-labelledby="lv9-beta-title">
            <div className="lv9-wrap lv9-beta">
              <div>
                <p className="lv9-kicker">Beta-Testphase</p>
                <h2 id="lv9-beta-title">Testen Sie alles. Zahlen Sie nichts.</h2>
                <p className="lv9-sub lv9-beta__sub">{BETA.sub}</p>
                <ul className="lv9-checks">
                  {BETA_PROMISES.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <div className="lv9-row">
                  <Link to={betaSignupHref(BETA.testPlan, `${SOURCE}-beta`)} className="lv9-btn lv9-btn--solid">
                    Kostenlos registrieren
                  </Link>
                  <Link to={`/audit?source=${SOURCE}-beta`} className="lv9-btn">
                    Erst ohne Konto prüfen
                  </Link>
                </div>
              </div>
              <ol className="lv9-list" aria-label="Ablauf der Beta">
                {V5_BETA_STEPS.map(([title, text], i) => (
                  <li key={title}>
                    <span className="lv9-list__n">{i + 1}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <section className="lv9-section" id="preise" aria-labelledby="lv9-preise-title">
          <div className="lv9-wrap">
            <div className="lv9-head">
              <div>
                <p className="lv9-kicker">Preise</p>
                <h2 id="lv9-preise-title">
                  {BETA_PUBLIC_OFFER ? 'Während der Beta für alle Tarife 0 €.' : 'Klare Tarife, monatlich kündbar.'}
                </h2>
              </div>
              <p className="lv9-sub">{TRY_FREE.note}</p>
            </div>
            <div className="lv9-plans">
              {TIERS.map((plan) => (
                <div key={plan.id} className={`lv9-plan${plan.highlight ? ' is-featured' : ''}`} data-plan={plan.id}>
                  <span className="lv9-plan__name">{plan.name}</span>
                  {plan.id === BETA.testPlan && BETA.active && <span className="lv9-plan__flag">Umfang der Beta</span>}
                  <div className="lv9-price">
                    {BETA_PUBLIC_OFFER ? (
                      <>
                        <s>{formatPriceEur(plan.price.monthlyEur)}</s>
                        <b>{formatPriceEur(0)}</b>
                        <small>bis {BETA.endsLabel}</small>
                      </>
                    ) : (
                      <>
                        <b>{formatPriceEur(plan.price.monthlyEur)}</b>
                        <small>pro Monat</small>
                      </>
                    )}
                  </div>
                  <span className="lv9-plan__spacer" />
                  <Link
                    to={tierHref(plan.id, `${SOURCE}-pricing`)}
                    className={`lv9-btn${plan.highlight ? ' lv9-btn--solid' : ''}`}
                    data-hero-cta={`plan-${plan.id}`}
                  >
                    {plan.name}: {TRY_FREE.cta}
                  </Link>
                </div>
              ))}
              <div className="lv9-plan" data-plan="enterprise">
                <span className="lv9-plan__name">Enterprise</span>
                <div className="lv9-price">
                  <b className="lv9-price__text">Auf Anfrage</b>
                </div>
                <span className="lv9-plan__spacer" />
                <Link to={`/contact-sales?tier=enterprise&source=${SOURCE}-pricing`} className="lv9-btn">
                  Enterprise anfragen
                </Link>
              </div>
            </div>
            <p className="lv9-plan-note">Listenpreise pro Monat. {TRY_FREE.note}</p>
          </div>
        </section>

        <section className="lv9-section" id="roadmap" aria-labelledby="lv9-rm-title">
          <div className="lv9-wrap">
            <div className="lv9-head">
              <div>
                <p className="lv9-kicker">Roadmap, gemessen statt versprochen</p>
                <h2 id="lv9-rm-title">Was heute läuft und was als Nächstes kommt.</h2>
              </div>
              <p className="lv9-sub">
                <Link to="/roadmap">Vollständige Roadmap ansehen</Link>
              </p>
            </div>
            <div className="lv9-rm">
              <RoadmapCol title="Live" items={ROADMAP_LIVE_ITEMS} />
              <RoadmapCol title="In der Beta" items={ROADMAP_PREVIEW_ITEMS} />
              <RoadmapCol title="Geplant" items={ROADMAP_COMING_SOON_ITEMS} />
            </div>
          </div>
        </section>

        <section className="lv9-final" aria-labelledby="lv9-final-title">
          <div className="lv9-wrap">
            <h2 id="lv9-final-title">Wissen, wo Ihre Website steht.</h2>
            <button type="button" className="lv9-btn lv9-btn--solid" onClick={focusScan}>
              {t('v4HeroPrimaryCta')}
            </button>
          </div>
        </section>

        <div className="lv9-stack" aria-label="Infrastruktur">
          <div className="lv9-wrap">
            <span>Infrastruktur</span>
            {LV2_STACK.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </main>

      <footer className="lv9-footer">
        <div className="lv9-wrap">
          <span>© {new Date().getFullYear()} RealSync Dynamics &amp; AI</span>
          <nav aria-label="Rechtliches">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/agb">AGB</Link>
            <Link to="/roadmap">Roadmap</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
