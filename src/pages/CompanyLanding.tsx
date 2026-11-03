import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { HeroTiles, type HeroFx } from '../components/landing/company/HeroTiles';
import { ProductModal } from '../components/landing/company/ProductModal';
import { CompanyContactForm, type CompanyContactPrefill } from '../components/landing/company/CompanyContactForm';
import { COMPANY_LINKS, companyProduct, VOICE_TELEPHONY_NOTE } from '../components/landing/company/companyProducts';
import { loadBusinessIdentity } from '../config/business-identity';
import '../components/landing/company/company-landing-v5.css';

/**
 * /unternehmen — Unternehmens-Landing v5 (noindex), Port von
 * `design_handoff_realsync_v5/reference/RealSync Dynamics v5.html`.
 *
 * Owner-Entscheidungen 03.11.2026: Route /unternehmen statt „/" (eigener PR für
 * die Startseite), Gold als einziger Akzent nur auf dieser Seite, Voice-Link auf
 * das Onboarding der Subdomain (Status `voice-agent-onboarding`, Preview).
 * Status und Ziele kommen aus `src/product/implementation-status.ts` bzw.
 * `companyProducts.ts`; Preise erscheinen keine (nicht in shared/pricing.ts).
 */

const NAV = [
  { id: 'produkte', label: 'Produkte', opens: true },
  { id: 'p-os', label: 'Governance OS' },
  { id: 'unternehmen', label: 'Unternehmen' },
  { id: 'kontakt', label: 'Kontakt' },
  { id: 'impressum', label: 'Impressum' },
] as const;

const GOS_STEPS = [
  ['Anfrage', 'Eine KI oder ein Mitarbeiter will etwas tun: Daten lesen, eine E-Mail senden, eine Rechnung freigeben.'],
  ['Prüfung', 'Das Governance OS prüft Mandant, Berechtigung, Einwilligung und Risiko – in dieser Reihenfolge.'],
  ['Entscheidung', 'Freigegeben, blockiert oder an einen Menschen übergeben. Im Zweifel gilt: nein.'],
  ['Nachweis', 'Jeder Schritt wird versiegelt abgelegt – nachlesbar für Audit, Kunden und Aufsicht.'],
] as const;

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const GOS_FEATURES = [
  {
    t: 'Vorher geprüft',
    p: 'Regeln greifen bei jeder Aktion – nicht erst im jährlichen Audit.',
    i: svg(
      <>
        <rect width="18" height="11" x="3" y="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>,
    ),
  },
  {
    t: 'Beweisbar',
    p: 'Versiegelte Protokolle, verkettet per Hash – nachträgliche Änderungen fallen auf.',
    i: svg(
      <>
        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
        <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
        <line x1="8" x2="16" y1="12" y2="12" />
      </>,
    ),
  },
  {
    t: 'Im Zweifel: nein',
    p: 'Fehlt eine Freigabe oder fällt ein Dienst aus, wird nichts ausgeführt.',
    i: svg(
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" />
      </>,
    ),
  },
  {
    t: 'Mensch entscheidet',
    p: 'Kritisches geht zur Freigabe an Ihr Team.',
    i: svg(
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>,
    ),
  },
  {
    t: 'DSGVO & EU AI Act',
    p: 'Pflichten aus beiden Regelwerken sind als prüfbare Regeln hinterlegt.',
    i: svg(
      <>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="m9 15 2 2 4-4" />
      </>,
    ),
  },
  {
    t: 'Hosting in Europa',
    p: 'Datenbank und Nachweise liegen in der EU.',
    i: svg(
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </>,
    ),
  },
] as const;

interface ModalState {
  tab: number;
  page: number;
  trigger: HTMLElement | null;
}

export function CompanyLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const fxRef = useRef<HeroFx>({ pointer: { x: 0, y: 0 }, sy: 0 });
  const [modal, setModal] = useState<ModalState | null>(null);
  const [activeNav, setActiveNav] = useState(-1);
  const [prefill, setPrefill] = useState<CompanyContactPrefill | null>(null);
  const identity = loadBusinessIdentity();
  const governance = companyProduct('governance');
  const voice = companyProduct('voice');

  // 3D-Universum: lazy nach dem ersten Paint, nicht unter Automatisierung (CI/E2E).
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || navigator.webdriver) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;
    import('../components/landing/company/spaceSceneV5')
      .then(({ mountSpaceScene }) => {
        if (cancelled) return;
        try {
          unmount = mountSpaceScene({ canvas, cssTarget: root, pointer: fxRef.current.pointer });
        } catch {
          // Kein WebGL: der schwarze Hintergrund bleibt, die Seite funktioniert weiter.
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  // Maus → Erde + Tafeln (nur bei feinem Zeiger).
  useEffect(() => {
    if (!matchMedia('(hover: hover)').matches) return;
    const p = fxRef.current.pointer;
    const onMove = (e: PointerEvent) => {
      p.x = e.clientX / innerWidth - 0.5;
      p.y = e.clientY / innerHeight - 0.5;
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => removeEventListener('pointermove', onMove);
  }, []);

  // Scroll: Fortschritt, Sticky-Header, aktiver Nav-Punkt, Hero-Parallax.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const heroFx = Array.from(root.querySelectorAll<HTMLElement>('.hero h1, .hero .lede'));
    let max = 1;
    let tops: number[] = [];
    let tick = false;
    let lastCur = -2;
    const measure = () => {
      max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      tops = NAV.map(({ id }) => {
        const s = document.getElementById(id);
        return s ? s.getBoundingClientRect().top + scrollY : Infinity;
      });
    };
    const frame = () => {
      tick = false;
      const y = scrollY;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${(y / max).toFixed(4)})`;
      headerRef.current?.classList.toggle('stuck', y > 40);
      let cur = -1;
      for (let i = 0; i < tops.length; i++) if (tops[i] - innerHeight * 0.45 <= y) cur = i;
      if (cur !== lastCur) {
        lastCur = cur;
        setActiveNav(cur);
      }
      fxRef.current.sy = -Math.min(y, innerHeight) * 0.32;
      if (!reduce && y < innerHeight * 1.2) {
        const k = Math.min(1, y / innerHeight);
        heroFx.forEach((el, i) => {
          el.style.transform = `translate3d(0,${(-y * (0.06 + i * 0.03)).toFixed(1)}px,0)`;
          el.style.opacity = (1 - k * 0.85).toFixed(3);
        });
      }
    };
    const req = () => {
      if (!tick) {
        tick = true;
        requestAnimationFrame(frame);
      }
    };
    const onResize = () => {
      measure();
      req();
    };
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', onResize);
    let ro: ResizeObserver | undefined;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(onResize);
      ro.observe(document.body);
    }
    measure();
    frame();
    return () => {
      removeEventListener('scroll', req);
      removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, []);

  // Einblenden beim Scrollen (Schwelle 0,08, gestaffelt 90 ms je Geschwister).
  // Klasse `shown` statt `in` wie in der Referenz: `.in` ist dort zugleich der
  // Inhaltscontainer (flex-direction: column) und stapelte CTA-Zeile und Fakten.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.rv'));
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((e) => e.classList.add('shown'));
      return;
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          el.classList.add('shown');
          el.addEventListener('transitionend', () => (el.style.willChange = 'auto'), { once: true });
          io.unobserve(el);
        }),
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    els.forEach((e) => {
      const sib = Array.from(e.parentElement?.children ?? []).filter((c) => c.classList.contains('rv'));
      e.style.transitionDelay = `${sib.indexOf(e) * 90}ms`;
      io.observe(e);
    });
    return () => io.disconnect();
  }, []);

  const scrollToId = useCallback((id: string, pulse = false) => {
    const t = document.getElementById(id);
    if (!t) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: t.getBoundingClientRect().top + scrollY - 110, behavior: reduce ? 'auto' : 'smooth' });
    if (pulse) {
      t.classList.remove('pulse');
      window.setTimeout(() => t.classList.add('pulse'), 450);
    }
  }, []);

  const onGo = useCallback(
    (e: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      scrollToId(id, true);
    },
    [scrollToId],
  );

  const openModal = useCallback((tab: number, trigger: HTMLElement | null, page = 0) => {
    setModal({ tab, page, trigger });
  }, []);

  const closeModal = useCallback(
    (to?: 'kontakt') => {
      const trigger = modal?.trigger ?? null;
      setModal(null);
      requestAnimationFrame(() => {
        if (to === 'kontakt') {
          scrollToId('kontakt');
          document.getElementById('c-name')?.focus({ preventScroll: true });
        } else {
          trigger?.focus();
        }
      });
    },
    [modal, scrollToId],
  );

  const onTemplateRequest = useCallback((name: string | null) => {
    setPrefill((p) => ({
      text: name ? `Ich interessiere mich für die Landingpage-Vorlage „${name}“.` : '',
      nonce: (p?.nonce ?? 0) + 1,
    }));
  }, []);

  return (
    <div className="rsl5" ref={rootRef}>
      {/* Meta + noindex aus SEO_CONFIG['/unternehmen'] (src/config/seo.ts). */}
      <SEOHead />
      <div id="bg" aria-hidden="true">
        <canvas id="space3d" ref={canvasRef} />
        <div className="scrim" />
      </div>
      <div id="progress" ref={progressRef} aria-hidden="true" />
      <div id="page">
        <div className="statusbar" role="note" aria-label="Status">
          <span>
            <i />
            <b>GOVERNANCE OS {governance.statusLabel}</b>
          </span>
          <span>VOICE AGENT · {VOICE_TELEPHONY_NOTE ? VOICE_TELEPHONY_NOTE.toUpperCase() : voice.statusLabel}</span>
          <span>HOSTING IN DER EU · DSGVO · EU AI ACT</span>
        </div>
        <header id="top" ref={headerRef}>
          <div className="hin">
            <a className="brand" href="#top">
              RealSync <em>Dynamics &amp; AI</em>
            </a>
            <nav className="sec" aria-label="Hauptnavigation">
              {NAV.map((n, i) =>
                'opens' in n ? (
                  <a
                    key={n.id}
                    className={`navlink${activeNav === i ? ' on' : ''}`}
                    href="#produkte"
                    aria-haspopup="dialog"
                    onClick={(e) => {
                      e.preventDefault();
                      openModal(0, e.currentTarget);
                    }}
                  >
                    {n.label}
                  </a>
                ) : (
                  <a key={n.id} className={`navlink${activeNav === i ? ' on' : ''}`} href={`#${n.id}`}>
                    {n.label}
                  </a>
                ),
              )}
              <span className="sep" aria-hidden="true" />
              <Link className="navlink" to={COMPANY_LINKS.login}>
                Login
              </Link>
            </nav>
          </div>
        </header>

        <div className="heroWrap dark">
          <main className="hero">
            <p className="kick">Für den Mittelstand · Made in Thüringen · Hosting in Europa</p>
            <h1>
              RealSync Dynamics <em>&amp; AI</em>
            </h1>
            <p className="lede">
              KI für kleine und mittlere Unternehmen: Wir machen sie sicher, Ihr Telefon erreichbar und Ihre Webseite fertig – ohne
              Konzern-Aufwand, mit einem Ansprechpartner.
            </p>
            <p className="pick">Gebaut für Handwerk · Praxis · Kanzlei · Gastronomie · Handel – Produkt anklicken und ausprobieren</p>
            <HeroTiles fx={fxRef.current} onGo={onGo} onOpen={(tab, trigger) => openModal(tab, trigger)} />
          </main>
          <i className="scrollcue" aria-hidden="true" />
        </div>

        <section className="band dark" id="p-os" aria-labelledby="p-os-title">
          <div className="in">
            <p className="kick rv">The Governance OS · {governance.statusLabel}</p>
            <h2 className="rv" id="p-os-title">
              KI einsetzen – <em>ohne Risiko</em>
            </h2>
            <p className="sub rv">
              Auch kleine Betriebe müssen DSGVO und EU AI Act erfüllen, ohne eigene Rechtsabteilung. Das Governance OS sitzt zwischen Ihrer KI
              und Ihren Daten: Bevor etwas passiert, wird es geprüft – und jede Entscheidung bleibt als Nachweis erhalten.
            </p>
            <ol className="gos-steps rv">
              {GOS_STEPS.map(([h, p], i) => (
                <li key={h}>
                  <b>{String(i + 1).padStart(2, '0')}</b>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
            <div className="gos-split">
              <div className="gos-feat rv">
                {GOS_FEATURES.map((f) => (
                  <div key={f.t}>
                    <span className="ic">{f.i}</span>
                    <h4>{f.t}</h4>
                    <p>{f.p}</p>
                  </div>
                ))}
              </div>
              <figure className="gos-log rv" aria-label="Beispiel eines Nachweis-Eintrags">
                <figcaption>Beispiel · Nachweis-Eintrag</figcaption>
                <pre>
                  <span>aktion        </span>kundendaten.export{'\n'}
                  <span>mandant       </span>✓ geprüft{'\n'}
                  <span>berechtigung  </span>✓ geprüft{'\n'}
                  <span>einwilligung  </span>
                  <em>✕ fehlt</em>
                  {'\n'}
                  <span>entscheidung  </span>
                  <em>blockiert</em>
                  {'\n'}
                  <span>siegel        </span>sha-256 · 9f3c…a1e0{'\n'}
                  <span>vorgänger     </span>sha-256 · 4b7d…02c9
                </pre>
              </figure>
            </div>
            <p className="gos-start rv">Einstieg kostenlos: Im Free Audit sehen Sie, wo bei Ihnen KI im Einsatz ist und wo Lücken sind.</p>
            <div className="pm-cta rv">
              <Link className="btn" to={COMPANY_LINKS.audit}>
                Free Audit starten
              </Link>
              <button className="btn quiet" type="button" aria-haspopup="dialog" onClick={(e) => openModal(0, e.currentTarget, 3)}>
                Prüfung live testen
              </button>
              <Link className="btn quiet" to={COMPANY_LINKS.platform}>
                Zur Plattform
              </Link>
            </div>
          </div>
        </section>

        <section className="band paper" id="unternehmen" aria-labelledby="unternehmen-title">
          <div className="in">
            <p className="kick rv">Unser Fokus: der Mittelstand</p>
            <h2 className="rv" id="unternehmen-title">
              Für Betriebe, die <em>das Land am Laufen halten</em>
            </h2>
            <p className="sub rv">
              Die Schreinerei, die Praxis, das Restaurant, die Kanzlei: Sie haben keine IT-Abteilung und keine Zeit für Projekte. Wir bauen KI,
              die sofort funktioniert, sicher ist und bezahlbar bleibt – mit einem festen Ansprechpartner aus Thüringen.
            </p>
            <div className="rule rv" />
            <div className="facts rv">
              <div>
                <b>KMU</b>
                <span>Unser Fokus</span>
              </div>
              <div>
                <b>1</b>
                <span>Ansprechpartner</span>
              </div>
              <div>
                <b>0 €</b>
                <span>Governance Scan zum Einstieg</span>
              </div>
              <div>
                <b>EU</b>
                <span>Hosting in Europa</span>
              </div>
            </div>
          </div>
        </section>

        <section className="band dark" id="kontakt" aria-labelledby="kontakt-title">
          <div className="in">
            <p className="kick rv">Kontakt</p>
            <h2 className="rv" id="kontakt-title">
              Erzählen Sie uns <em>von Ihrem Betrieb</em>
            </h2>
            <p className="sub rv">Ein paar Zeilen genügen: Was machen Sie, wo hakt es? Wir melden uns persönlich.</p>
            <CompanyContactForm prefill={prefill} />
            <div className="caddr rv">
              <a href="mailto:info@realsyncdynamicsai.de">info@realsyncdynamicsai.de</a>
              <span>Neuhaus am Rennweg · Thüringen</span>
            </div>
          </div>
        </section>

        {modal && <ProductModal tab={modal.tab} page={modal.page} onClose={closeModal} onTemplateRequest={onTemplateRequest} />}

        <footer id="impressum">
          <div className="fin">
            <div className="fbrand">
              RealSync <em>Dynamics &amp; AI</em>
            </div>
            <div className="imp">
              <div>
                <b>Anbieter · § 5 DDG</b>
                <strong>RealSync Dynamics</strong>
                <br />
                Schwarzburger Str. 31
                <br />
                98724 Neuhaus am Rennweg, Thüringen
              </div>
              <div>
                <b>Vertretung</b>
                Einzelunternehmen, Inhaber <strong>Dominik Steiner</strong>
                <br />
                Verantwortlich gem. § 18 Abs. 2 MStV: Dominik Steiner
                <br />
                USt-IdNr.: {identity.vatId || 'noch nicht vergeben'}
              </div>
              <div>
                <b>Kontakt</b>
                <a href="mailto:info@realsyncdynamicsai.de">info@realsyncdynamicsai.de</a>
                <br />
                <a href="tel:+4917640132161">+49 176 4013 2161</a>
                <br />
                Datenschutz: <a href="mailto:privacy@realsyncdynamicsai.de">privacy@realsyncdynamicsai.de</a>
              </div>
            </div>
            <nav className="legal" aria-label="Rechtliches">
              <Link to={COMPANY_LINKS.impressum}>Impressum</Link>
              <i aria-hidden="true">|</i>
              <Link to={COMPANY_LINKS.datenschutz}>Datenschutz</Link>
              <i aria-hidden="true">|</i>
              <Link to={COMPANY_LINKS.agb}>AGB</Link>
              <i aria-hidden="true">|</i>
              <Link to={COMPANY_LINKS.widerruf}>Widerruf</Link>
              <i aria-hidden="true">|</i>
              <Link to={COMPANY_LINKS.avv}>AVV</Link>
              <i aria-hidden="true">|</i>
              <Link to={COMPANY_LINKS.subProcessors}>Sub-Prozessoren</Link>
            </nav>
            <div className="copy">&copy; 2026 RealSync Dynamics &amp; AI</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
