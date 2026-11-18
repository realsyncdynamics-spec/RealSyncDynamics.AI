import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  COMPANY_LINE, LEGAL_LINKS, PRODUCTS, RECEPTIONIST, STATUS_TEXT, productStatus, registryStatus,
} from '../components/landing/v3/landingV3Data';
import { COMPANY } from '../config/company';
import '../styles/profile-bento.css';

/**
 * Gründerprofil „Bento“ — Vorschau unter `/design/profil` (noIndex).
 *
 * Gestaltung aus Dominiks Claude-Design-Canvas „RealSync Bento Profil“.
 * Produkte, Status, Ziele und Firmendaten kommen aus denselben Quellen wie
 * die Startseite (`landingV3Data.ts`, `config/company.ts`).
 *
 * Aus dem Entwurf nicht übernommen, weil nicht belegt:
 *   - „Online · Daten in der EU“ (pauschale EU-Aussage gilt als nicht belegt)
 *   - „signierter Nachweis für jede Entscheidung“, „Art. 50“-Versprechen,
 *     „zur Laufzeit gegen EU AI Act prüfen“ (Policy-Prüfung im Beobachtungsmodus)
 *   - Social-Links ohne echte Profil-URL (Instagram, LinkedIn, X)
 *   - Foto-Platzhalter → Monogramm, bis ein freigestelltes Foto vorliegt
 * Die Suche ist ein Stichwort-Wegweiser ohne KI-Modell und sagt das auch.
 */

const SOURCE = 'profil-bento';
const YOUTUBE_URL = 'https://www.youtube.com/@RealSyncDynamicsAITV';
const GITHUB_URL = 'https://github.com/realsyncdynamics-spec';

interface RouteTarget {
  key: string;
  name: string;
  color: string;
  soft: string;
  answer: string;
  href: string;
  status: string | null;
  words: string[];
}

function berlinTime(now: number): string {
  try {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(now);
  } catch {
    return '--:--';
  }
}

function withSource(href: string): string {
  return href.includes('source=') ? href : `${href}${href.includes('?') ? '&' : '?'}source=${SOURCE}`;
}

function buildTargets(): RouteTarget[] {
  const gov = PRODUCTS.find((p) => p.key === 'governance');
  const builder = PRODUCTS.find((p) => p.key === 'app-builder');
  const tryStatus = registryStatus(RECEPTIONIST.tryRegistryId);
  return [
    {
      key: 'governance',
      name: gov?.name ?? 'Governance OS',
      color: '#2A5BFF',
      soft: 'rgba(42,91,255,.14)',
      answer: gov ? `${gov.body} ${gov.flow}.` : '',
      href: withSource(gov?.href ?? '/governance-runtime'),
      status: gov ? productStatus(gov)?.label ?? null : null,
      words: ['ai act', 'ki-verordnung', 'dsgvo', 'gdpr', 'compliance', 'risiko', 'audit', 'nachweis', 'governance', 'chatbot', 'datenschutz', 'regel', 'freigabe'],
    },
    {
      key: 'voice',
      name: 'RealSync Voice',
      color: '#C07A45',
      soft: 'rgba(192,122,69,.16)',
      answer: `${RECEPTIONIST.heading} ${RECEPTIONIST.body} Status: ${STATUS_TEXT[RECEPTIONIST.status]}${tryStatus ? ` · Chat-Assistent: ${STATUS_TEXT[tryStatus]}` : ''}.`,
      href: withSource(RECEPTIONIST.waitlistHref),
      status: STATUS_TEXT[RECEPTIONIST.status],
      words: ['telefon', 'anruf', 'voice', 'sprach', 'hotline', 'termin', 'empfang', 'erreichbar', 'kundenservice', 'service', 'receptionist'],
    },
    {
      key: 'sites',
      name: 'RealSync Sites',
      color: '#1F9D63',
      soft: 'rgba(31,157,99,.15)',
      answer: builder ? `${builder.body} ${builder.flow}.` : '',
      href: withSource(builder?.href ?? '/build'),
      status: builder ? productStatus(builder)?.label ?? null : null,
      words: ['webseite', 'website', 'homepage', 'landing', 'seo', 'design', 'shop', 'seite', 'domain', 'online', 'app'],
    },
  ];
}

export function ProfileBento() {
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const targets = useMemo(buildTargets, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const q = query.toLowerCase();
  const scores = targets.map((t) => t.words.reduce((n, w) => (q.includes(w) ? n + 1 : n), 0));
  const total = scores.reduce((a, b) => a + b, 0);
  let best = -1;
  if (total > 0) best = scores.indexOf(Math.max(...scores));
  const match = best >= 0 ? targets[best]! : null;

  const examples = ['Muss mein Chatbot den AI Act erfüllen?', 'Telefon-Assistent für meinen Betrieb', 'Neue Webseite für meinen Betrieb'];
  const submit = (e: FormEvent) => e.preventDefault();

  return (
    <div className="pb">
      <main className="pb-grid">
        {/* LINKS */}
        <div className="pb-col">
          <section className="pb-card pb-profile" aria-labelledby="pb-hello">
            <div className="pb-monogram" aria-hidden="true"><span>DS</span></div>
            <span className="pb-handle">@realsyncdynamics</span>
            <h1 id="pb-hello" data-testid="profile-heading">Hallo!<br />Ich bin<br />Dominik</h1>
            <p className="pb-bio">
              <strong>Gründer von {COMPANY.companyName}.</strong> Ich baue Governance-Software, KI-Mitarbeiter
              für Betriebe mit Kundenkontakt und Webseiten mit Charakter — aus dem Thüringer Wald.
            </p>
            <ul className="pb-tags" aria-label="Themen">
              {['EU AI Act', 'DSGVO', 'Voice AI', 'Web Design', 'Cloudflare', 'Gründer'].map((t) => <li key={t}>{t}</li>)}
            </ul>
          </section>

          <section className="pb-card pb-location" aria-label="Standort">
            <div className="pb-map" aria-hidden="true" />
            <div className="pb-pin" aria-hidden="true" />
            <div className="pb-loc-text">
              <span className="pb-loc-city">{COMPANY.headquartersAddress.city}, DE</span>
              <span className="pb-muted"><span data-testid="profile-time">{berlinTime(now)}</span> Ortszeit</span>
            </div>
          </section>

          <section className="pb-card pb-cta" aria-label="Kontakt">
            <Link to="/kontakt" className="pb-btn pb-btn--dark" data-testid="profile-contact">Kontakt</Link>
            <Link to="/" className="pb-btn pb-btn--light">Website</Link>
          </section>
        </div>

        {/* MITTE: Wegweiser */}
        <section className="pb-card pb-search" aria-labelledby="pb-search-title">
          <div className="pb-search-head">
            <span className="pb-mono">REALSYNC WEGWEISER</span>
            <span className="pb-muted pb-small">Stichwort-Zuordnung · ohne KI-Modell</span>
          </div>
          <div className="pb-logo-wrap">
            <div className="pb-coin pb-coin--lg" aria-hidden="true"><span>RS</span></div>
            <h2 id="pb-search-title">RealSync <span>Dynamics &amp; AI</span></h2>
            <p className="pb-muted">Eine Frage. Das passende Produkt.</p>
          </div>

          <form className="pb-form" onSubmit={submit} style={{ boxShadow: `0 0 0 1px rgba(0,0,0,.06), 0 20px 40px -16px rgba(20,18,15,.25), 0 0 0 6px ${match ? match.soft : 'transparent'}` }}>
            <label htmlFor="pb-q" className="pb-sr">Frage an RealSync</label>
            <input
              id="pb-q"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="z. B. Muss mein Chatbot den AI Act erfüllen?"
              data-testid="profile-query"
            />
            <button type="submit" aria-label="Frage senden" className="pb-send">→</button>
          </form>

          <div className="pb-chips">
            {examples.map((t) => (
              <button key={t} type="button" onClick={() => setQuery(t)}>{t}</button>
            ))}
          </div>

          <div className="pb-nodes">
            {targets.map((t, i) => {
              const on = i === best;
              const share = total > 0 ? Math.round((scores[i]! / total) * 100) : 0;
              return (
                <div
                  key={t.key}
                  className={on ? 'pb-node pb-node--on' : 'pb-node'}
                  style={on ? { boxShadow: `0 0 0 1.5px ${t.color}, 0 16px 30px -14px ${t.color}` } : best >= 0 ? { opacity: 0.6 } : undefined}
                  data-testid={`profile-node-${t.key}`}
                >
                  <span className="pb-node-name"><i style={{ background: t.color }} />{t.name}</span>
                  <span className="pb-small pb-muted">{on ? `Passt · ${share} %` : total > 0 ? `${share} %` : t.status ?? 'Bereit'}</span>
                  <span className="pb-bar"><span style={{ width: `${total > 0 ? Math.max(share, 4) : 0}%`, background: t.color }} /></span>
                </div>
              );
            })}
          </div>

          <div className="pb-answer" aria-live="polite">
            {match ? (
              <>
                <div>
                  <span className="pb-answer-label" style={{ color: match.color }}>{match.name}{match.status ? ` · ${match.status}` : ''}</span>
                  <p>{match.answer}</p>
                </div>
                <Link to={match.href} className="pb-btn pb-btn--dark pb-btn--sm" data-testid="profile-open">Öffnen</Link>
              </>
            ) : (
              <div>
                <span className="pb-answer-label">So funktioniert's</span>
                <p>Stell deine Frage in eigenen Worten. Der Wegweiser erkennt Stichwörter und zeigt Governance OS, RealSync Voice oder RealSync Sites.</p>
              </div>
            )}
          </div>
        </section>

        {/* RECHTS */}
        <div className="pb-col">
          <section className="pb-card pb-social" aria-label="Kanäle">
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" aria-label="YouTube: RealSync Dynamics & AI TV">
              <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#0E0E10" /><path d="m10 9 5.2 3-5.2 3z" fill="#FFFFFF" /></svg>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4 1.5-4-2-6-2.5" /><path d="M15 22v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V22" /></svg>
            </a>
            <div className="pb-coin" aria-hidden="true"><span>RS</span></div>
            <a href={`mailto:${COMPANY.supportEmail}`} aria-label={`E-Mail an ${COMPANY.supportEmail}`}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </a>
          </section>

          <section className="pb-card pb-products" aria-labelledby="pb-prod-title">
            <h3 id="pb-prod-title">Meine Produkte</h3>
            <ul>
              {targets.map((t) => (
                <li key={t.key}>
                  <Link to={t.href} data-testid={`profile-product-${t.key}`}>
                    <span className={`pb-icon pb-icon--${t.key}`} aria-hidden="true" />
                    <span className="pb-prod-text">
                      <strong>{t.name}</strong>
                      <span className="pb-muted">{t.status ? `Status: ${t.status}` : '—'}</span>
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
                  <span className="pb-icon pb-icon--tv" aria-hidden="true" />
                  <span className="pb-prod-text">
                    <strong>RealSync Dynamics &amp; AI TV</strong>
                    <span className="pb-muted">YouTube-Kanal</span>
                  </span>
                </a>
              </li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="pb-footer">
        <span>{COMPANY_LINE}</span>
        <nav aria-label="Rechtliches">
          {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
        </nav>
      </footer>
    </div>
  );
}
