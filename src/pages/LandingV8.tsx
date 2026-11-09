import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { COMPANY_PRODUCTS, type CompanyProductId } from '../components/landing/company/companyProducts';
import '../styles/landing-v8.css';

/**
 * Landing v8 — Startseite `/` nach dem Owner-Entwurf vom 09.11.2026
 * („Ein System. Alles im Einklang.", monochrom, 3D-Orbit). Owner-Entscheid:
 * ersetzt v6 auf `/` und hebt dafür den Gold/Cream-Design-Lock für `/` auf;
 * v6 bleibt unter /design/landing-v6.
 *
 * Abweichungen vom Entwurf, beide aus der Wahrheitsschicht:
 * - Status der drei Chips kommt aus `implementation-status.ts` (über
 *   `COMPANY_PRODUCTS`, dieselbe Quelle wie /unternehmen), nicht aus dem Bild.
 * - Impressum/Datenschutz/AGB/Widerruf als schmale Zeile unter der Fußzeile
 *   (Pflichtangaben müssen von jeder Seite erreichbar sein).
 */

const LINKS: Record<CompanyProductId, string> = {
  governance: '/audit',
  voice: '/unternehmen',
  builder: '/frontend-builder',
};

const TAGLINES: Record<CompanyProductId, string> = {
  governance: 'KI unter Ihrer Kontrolle.',
  voice: 'Verbindungen, die bleiben.',
  builder: 'Ihr Auftritt. Auf den Punkt.',
};

const CHIP_NAMES: Record<CompanyProductId, string> = {
  governance: 'Governance OS',
  voice: 'Voice Agent',
  builder: 'Builder',
};

/**
 * Freitext aus der Eingabezeile → passendes Ziel. Bewusst einfache Stichworte:
 * kein Modellaufruf, keine Datenübertragung — die Eingabe verlässt den Browser
 * nur als Teil der Ziel-URL zur Kontaktseite.
 */
export function routeIntent(text: string): string | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  if (/(anruf|telefon|voice|stimme|erreichbar|rückruf|hotline|termin)/.test(q)) return LINKS.voice;
  if (/(website|webseite|homepage|landing|seite|relaunch|builder|shop|auftritt)/.test(q)) return LINKS.builder;
  if (/(\bki\b|\bai\b|dsgvo|ai act|ki-verordnung|governance|compliance|audit|datenschutz|risiko)/.test(q)) return LINKS.governance;
  return `/kontakt?source=landing-home&nachricht=${encodeURIComponent(text.trim().slice(0, 500))}`;
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 84 56" aria-hidden="true" focusable="false">
      <ellipse cx="42" cy="28" rx="40" ry="14" transform="rotate(-28 42 28)" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="44" cy="27" rx="33" ry="9" transform="rotate(-28 44 27)" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="40" cy="29" r="6.4" fill="#0b0b0c" />
      <circle cx="40" cy="29" r="5" fill="currentColor" />
    </svg>
  );
}

const ICONS: Record<CompanyProductId, (p: { className?: string }) => JSX.Element> = {
  governance: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.8 4.5 5.6v5.8c0 4.6 3.1 8.4 7.5 9.8 4.4-1.4 7.5-5.2 7.5-9.8V5.6L12 2.8Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  voice: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {[
        [2.5, 10.5, 13.5],
        [6, 8, 16],
        [9.5, 5.5, 18.5],
        [12, 2, 22],
        [14.5, 5.5, 18.5],
        [18, 8, 16],
        [21.5, 10.5, 13.5],
      ].map(([x, y1, y2]) => (
        <line key={x} x1={x} x2={x} y1={y1} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </svg>
  ),
  builder: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2.5" y="3.5" width="19" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 8.5h19M11 8.5v12M5 13.5h3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

function ChipIcon({ id }: { id: CompanyProductId }) {
  if (id === 'builder') {
    return (
      <svg className="lv8-chip-ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        {[
          [1.5, 1.5],
          [9, 1.5],
          [1.5, 9],
          [9, 9],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        ))}
      </svg>
    );
  }
  const Icon = ICONS[id];
  return <Icon className="lv8-chip-ic" />;
}

function OrbitHero() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!wrap.current || !canvas.current) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    // Szene erst nach dem ersten Bild laden: three.js bleibt aus dem Erst-Bundle.
    import('../components/landing/v8/orbitScene')
      .then(({ mountOrbitScene }) => {
        if (cancelled || !wrap.current || !canvas.current) return;
        try {
          dispose = mountOrbitScene({ canvas: canvas.current, container: wrap.current });
        } catch {
          setFallback(true);
        }
      })
      .catch(() => setFallback(true));
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div ref={wrap} className={`lv8-orbit${fallback ? ' is-fallback' : ''}`} aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  );
}

export function LandingV8() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const target = routeIntent(query);
    if (!target) {
      input.current?.focus();
      return;
    }
    navigate(target);
  };

  return (
    <>
      <SEOHead />
      <div className="lv8">
        <header className="lv8-head">
          <Link to="/" className="lv8-brand" aria-label="RealSync Dynamics – Startseite">
            <LogoMark className="lv8-logo" />
            <span>realsyncdynamicsai.de</span>
          </Link>
          <nav className="lv8-nav" aria-label="Hauptnavigation">
            <Link to="/demo-tour/dashboard">System</Link>
            <a href="#produkte">Produkte</a>
            <Link to="/unternehmen">Unternehmen</Link>
            <Link to="/login" className="lv8-login">
              Login
              <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </Link>
          </nav>
        </header>

        <main className="lv8-main">
          <section className="lv8-hero" aria-labelledby="lv8-title">
            <OrbitHero />
            <p className="lv8-eyebrow">RealSync · Intelligence in Sync</p>
            <h1 id="lv8-title" className="lv8-title">
              <span>Ein System.</span> <span>Alles im Einklang.</span>
            </h1>
            <p className="lv8-sub">KI steuern. Anfragen verbinden. Digital wachsen.</p>

            <form className="lv8-ask" onSubmit={submit} role="search">
              <LogoMark className="lv8-ask-logo" />
              <span className="lv8-ask-sep" aria-hidden="true" />
              <input
                ref={input}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Was möchten Sie mit RealSync bewegen?"
                aria-label="Was möchten Sie mit RealSync bewegen?"
                maxLength={500}
                autoComplete="off"
              />
              <button type="submit" aria-label="Weiter">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>

            <ul className="lv8-chips" aria-label="Produktstatus">
              {COMPANY_PRODUCTS.map((p) => (
                <li key={p.id}>
                  <Link to={LINKS[p.id]} className="lv8-chip" data-status={p.status} data-testid={`lv8-chip-${p.id}`}>
                    <ChipIcon id={p.id} />
                    <span>
                      {CHIP_NAMES[p.id]} · {p.statusLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section id="produkte" className="lv8-products" aria-label="Produkte">
            {COMPANY_PRODUCTS.map((p) => {
              const Icon = ICONS[p.id];
              return (
                <Link key={p.id} to={LINKS[p.id]} className="lv8-product" data-testid={`lv8-product-${p.id}`}>
                  <Icon className="lv8-product-ic" />
                  <span>
                    <b>{p.name}</b>
                    <em>{TAGLINES[p.id]}</em>
                  </span>
                </Link>
              );
            })}
          </section>
        </main>

        <footer className="lv8-foot">
          <p className="lv8-made">Made in Thüringen. Für den Mittelstand.</p>
          <nav className="lv8-legal" aria-label="Rechtliches">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/agb">AGB</Link>
            <Link to="/widerruf">Widerruf</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
