import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { CompanyContactForm } from '../components/landing/company/CompanyContactForm';
import { COMPANY_LINKS, companyProduct, type CompanyProduct } from '../components/landing/company/companyProducts';
import { loadBusinessIdentity } from '../config/business-identity';
import type { ImplementationStatus } from '../product/implementation-status';
import { PRICING_TAX_NOTE, VOICE_STANDALONE_OFFERS } from '@/shared/pricing';
import '../components/landing/company/company-landing-v6.css';

/**
 * /design/unternehmen-v6 — Unternehmens-Landing v6 (Vorschau, noindex).
 *
 * Umsetzung des Entwurfs vom 18.11.2026 („RealSync Dynamics & AI“, Artifact):
 * klare Button-Hierarchie (1 primär, 1 sekundär, Rest Textlink), Audit-CTA in
 * der Navigation, Nutzen-Hero, Produktkarten mit Status, Preisraster, FAQ und
 * Anliegen-Auswahl im Kontaktformular.
 *
 * Abweichungen vom Entwurf (Repo-Regeln, AGENTS.md):
 * - Status nur aus `src/product/implementation-status.ts` (über companyProducts).
 * - Preise nur aus `shared/pricing.ts` (`VOICE_STANDALONE_OFFERS`).
 * - Hard-Edge: 90-Grad-Kanten; Gold als Akzent wie auf /unternehmen
 *   (Owner-Freigabe 03.11.2026), Statusfarben davon getrennt.
 * - Kein CTA mit „Demo“, keine Antwortzeit-Zusage, kein simuliertes Builder-Feld.
 * - Kontaktformular sendet über die bestehende Edge Function `sales-lead`.
 *
 * /unternehmen (v5) und die Startseite `/` bleiben unverändert.
 */

const PATH = '/design/unternehmen-v6';

const SUBJECTS = [
  'Kostenloses Audit',
  'Voice Agent Onboarding',
  'Landingpage Builder',
  'Allgemeine Anfrage',
] as const;

const NAV = [
  ['produkte', 'Produkte'],
  ['governance', 'Governance OS'],
  ['voice', 'Voice Agent'],
  ['unternehmen', 'Über uns'],
  ['kontakt', 'Kontakt'],
] as const;

const GOS_STEPS = [
  ['Anfrage', 'Eine KI oder ein Mitarbeiter will etwas tun: Daten lesen, eine E-Mail senden, eine Rechnung freigeben.'],
  ['Prüfung', 'Mandant, Berechtigung, Einwilligung und Risiko, in dieser Reihenfolge.'],
  ['Entscheidung', 'Freigegeben, blockiert oder an einen Menschen übergeben. Im Zweifel gilt: nein.'],
  ['Nachweis', 'Jeder Schritt wird versiegelt abgelegt, nachlesbar für Audit, Kunden und Aufsicht.'],
] as const;

const GOS_FEATURES = [
  ['Vorher geprüft', 'Regeln greifen bei jeder Aktion, nicht erst im jährlichen Audit.'],
  ['Beweisbar', 'Protokolle sind per Hash verkettet. Nachträgliche Änderungen werden erkennbar.'],
  ['Im Zweifel: nein', 'Fehlt eine Freigabe oder fällt ein Dienst aus, wird nichts ausgeführt.'],
  ['Mensch entscheidet', 'Kritisches geht nach dem Vier-Augen-Prinzip an Ihr Team.'],
  ['DSGVO & EU AI Act', 'Ausgewählte Anforderungen aus beiden Regelwerken sind als prüfbare Regeln hinterlegt.'],
  ['Transparent', 'Eingesetzte Dienste und KI-Anbieter stehen in der Liste der Sub-Prozessoren.'],
] as const;

const PRODUCT_COPY: Record<CompanyProduct['id'], { lead: string; points: readonly string[]; anchor: string; more: string }> = {
  governance: {
    lead: 'KI kontrolliert einsetzen: Jede Aktion wird vorher geprüft und als Nachweis abgelegt.',
    points: ['Prüfung vor jeder Aktion', 'Versiegelte Protokolle', 'Vier-Augen-Prinzip bei Kritischem'],
    anchor: '#governance',
    more: 'So funktioniert es',
  },
  voice: {
    lead: 'Kein Anruf geht verloren: Der Agent nimmt das Anliegen auf und gibt es an Sie weiter.',
    points: ['Auch nach Feierabend', 'Vorlagen je Branche', 'Notfälle direkt an Menschen'],
    anchor: '#voice',
    more: 'Pakete und Preise',
  },
  builder: {
    lead: 'Ihre Webseite, fertig: mit Impressum und Datenschutz, von uns umgesetzt.',
    points: ['Ohne Programmierung', 'Ohne Agentur-Projekt', 'Anfrage über den Builder-Wizard'],
    anchor: '#builder',
    more: 'Mehr erfahren',
  },
};

/** Branchen aus dem Voice-Onboarding; `hi` = erhöhte Schutzstufe. */
const BRANCHES = [
  ['Handwerk', 'std'],
  ['Metzgerei', 'std'],
  ['KFZ-Werkstatt', 'std'],
  ['Gastronomie & Bäckerei', 'std'],
  ['Hausverwaltung', 'std'],
  ['Kanzlei', 'hi'],
  ['Arztpraxis', 'hi'],
  ['Steuerberatung', 'hi'],
] as const;

const BRANCH_INFO = {
  std: 'Standardvorlage: Anliegen aufnehmen, Rückruf notieren, Notfälle weiterleiten.',
  hi: 'Erhöhte Schutzstufe für Kanzlei, Praxis und Steuerberatung. Datenschutzprüfung ist Pflicht.',
} as const;

const OFFER_NOTE: Record<string, string> = {
  starter: 'Für den Einstieg mit einem Agenten.',
  professional: 'Für Betriebe mit regelmäßigem Anrufaufkommen.',
  kanzlei_praxis: 'Für Kanzlei, Praxis und Steuerberatung: erhöhte Schutzstufe, Datenschutzprüfung Pflicht.',
};

/** Empfehlung im Preisraster (Entwurf 18.11.2026). */
const FEATURED_OFFER = 'professional';

export const MIN_VOICE_EUR = Math.min(...VOICE_STANDALONE_OFFERS.map((o) => o.monthlyEur));

const BADGE_CLASS: Record<ImplementationStatus, string> = {
  live: 'badge s-live',
  preview: 'badge s-preview',
  'coming-soon': 'badge s-next',
};

function StatusBadge({ p }: { p: CompanyProduct }) {
  return <span className={BADGE_CLASS[p.status]}>{p.statusLabel}</span>;
}

export function CompanyLandingV6() {
  const identity = loadBusinessIdentity();
  const governance = companyProduct('governance');
  const voice = companyProduct('voice');
  const builder = companyProduct('builder');
  const [branch, setBranch] = useState(0);
  const branchKind = BRANCHES[branch][1];

  return (
    <div className="rsl6" data-testid="company-landing-v6">
      {/* Meta + noindex aus SEO_CONFIG['/design/unternehmen-v6'] (src/config/seo.ts). */}
      <SEOHead />
      <a className="skip" href="#main">
        Zum Inhalt
      </a>

      <div className="topbar" role="note" aria-label="Status">
        <div className="wrap">
          <span>
            <i className={`dot d-${governance.status}`} aria-hidden="true" />
            Governance OS · {governance.statusLabel}
          </span>
          <span>
            <i className={`dot d-${voice.status}`} aria-hidden="true" />
            Voice Agent · {voice.statusLabel}
          </span>
          <span>DSGVO &amp; EU AI Act im Blick</span>
        </div>
      </div>

      <header className="nav">
        <div className="wrap">
          <a className="brand" href="#top">
            RealSync <em>Dynamics &amp; AI</em>
          </a>
          <nav aria-label="Hauptnavigation">
            <ul>
              {NAV.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <Link className="login" to={COMPANY_LINKS.login}>
            Login
          </Link>
          <Link className="btn btn-primary btn-sm" to={COMPANY_LINKS.audit} data-testid="nav-audit-cta">
            Free Audit
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="wrap">
            <span className="eyebrow">Für den Mittelstand · Made in Thüringen</span>
            <h1 id="hero-title">
              KI im Betrieb – <em>kontrolliert, erreichbar, fertig.</em>
            </h1>
            <p className="lead">
              Wir machen Ihre KI prüfbar, Ihr Telefon erreichbar und Ihre Webseite fertig. Ohne Konzern-Aufwand, mit
              einem festen Ansprechpartner.
            </p>
            <div className="actions">
              <Link className="btn btn-primary" to={COMPANY_LINKS.audit} data-testid="hero-primary-cta">
                Kostenloses Audit starten
              </Link>
              <a className="btn btn-secondary" href="#produkte" data-testid="hero-secondary-cta">
                Produkte ansehen
              </a>
            </div>
            <ul className="trust" aria-label="Auf einen Blick">
              <li>Einstieg kostenlos</li>
              <li>Ein Ansprechpartner</li>
              <li>Voice-Pakete ab {MIN_VOICE_EUR} € im Monat</li>
              <li>Sitz in Thüringen</li>
            </ul>
          </div>
        </section>

        <section id="produkte" aria-labelledby="produkte-title">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Drei Produkte</span>
              <h2 id="produkte-title">Was wir für Ihren Betrieb tun</h2>
            </div>
            <div className="grid3">
              {[governance, voice, builder].map((p) => {
                const c = PRODUCT_COPY[p.id];
                return (
                  <article className="card" key={p.id} data-testid={`product-card-${p.id}`}>
                    <StatusBadge p={p} />
                    <h3>{p.name}</h3>
                    <p>{c.lead}</p>
                    <ul>
                      {c.points.map((pt) => (
                        <li key={pt}>{pt}</li>
                      ))}
                    </ul>
                    <a className="link" href={c.anchor}>
                      {c.more} →
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="governance" aria-labelledby="governance-title">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">
                Governance OS · <StatusBadgeInline p={governance} />
              </span>
              <h2 id="governance-title">
                KI einsetzen – <em>mit Kontrolle</em>
              </h2>
              <p className="lead">
                Auch kleine Betriebe müssen DSGVO und EU AI Act erfüllen, meist ohne eigene Rechtsabteilung. Das
                Governance OS sitzt zwischen Ihrer KI und Ihren Daten: Bevor etwas passiert, wird es geprüft, und jede
                Entscheidung bleibt als Nachweis erhalten.
              </p>
            </div>
            <ol className="steps">
              {GOS_STEPS.map(([t, p]) => (
                <li key={t}>
                  <b>{t}</b>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
            <div className="split">
              <div className="feats">
                {GOS_FEATURES.map(([t, p]) => (
                  <div key={t}>
                    <h3>{t}</h3>
                    <p>{p}</p>
                  </div>
                ))}
              </div>
              <figure className="log" aria-label="Beispiel eines Nachweis-Eintrags">
                <figcaption>BEISPIEL · NACHWEIS-EINTRAG</figcaption>
                <dl>
                  <dt>aktion</dt>
                  <dd>kundendaten.export</dd>
                  <dt>mandant</dt>
                  <dd className="y">✓ geprüft</dd>
                  <dt>berechtigung</dt>
                  <dd className="y">✓ geprüft</dd>
                  <dt>einwilligung</dt>
                  <dd className="n">✕ fehlt</dd>
                  <dt>entscheidung</dt>
                  <dd className="n">blockiert</dd>
                  <dt>siegel</dt>
                  <dd>sha-256 · 9f3c…a1e0</dd>
                  <dt>vorgänger</dt>
                  <dd>sha-256 · 4b7d…02c9</dd>
                </dl>
              </figure>
            </div>
            <div className="actions">
              <Link className="btn btn-primary" to={COMPANY_LINKS.audit}>
                Kostenloses Audit starten
              </Link>
              <Link className="btn btn-secondary" to={COMPANY_LINKS.platform}>
                Plattform ansehen
              </Link>
              <Link className="link" to={COMPANY_LINKS.login}>
                Zum Login →
              </Link>
            </div>
            <p className="note">Im Free Audit sehen Sie, wo bei Ihnen KI im Einsatz ist und wo Lücken sind.</p>
          </div>
        </section>

        <section id="voice" aria-labelledby="voice-title">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">
                Voice Agent · <StatusBadgeInline p={voice} />
              </span>
              <h2 id="voice-title">
                Kein Anruf <em>geht verloren</em>
              </h2>
              <p className="lead">
                Sie stehen auf der Baustelle, in der Behandlung oder am Herd? Der Voice Agent versteht das Anliegen und
                gibt es an Sie weiter, auch nach Feierabend.
              </p>
            </div>
            <div className="benefits">
              <div>
                <b>Annehmen</b>
                <span>auch außerhalb der Öffnungszeiten</span>
              </div>
              <div>
                <b>Notieren</b>
                <span>Anliegen, Terminwünsche, Rückrufe</span>
              </div>
              <div>
                <b>Übergeben</b>
                <span>Notfälle sofort an Menschen</span>
              </div>
            </div>
            <div className="grid3" data-testid="voice-offers">
              {VOICE_STANDALONE_OFFERS.map((o) => (
                <article
                  className={o.id === FEATURED_OFFER ? 'card featured' : 'card'}
                  key={o.id}
                  data-testid={`voice-offer-${o.id}`}
                >
                  {o.id === FEATURED_OFFER && <span className="badge b-featured">Empfohlen</span>}
                  <h3>{o.name}</h3>
                  <div className="price">
                    {o.monthlyEur} €<small>/ Monat</small>
                  </div>
                  <p className="small">{OFFER_NOTE[o.id]}</p>
                </article>
              ))}
            </div>
            <p className="note" data-testid="voice-note">
              Alle Pakete im Status {voice.statusLabel}. Die Telefonie ist in Vorbereitung. {PRICING_TAX_NOTE}
            </p>

            <div className="picker">
              <span className="eyebrow">Schritt 1 von 4 · Branche</span>
              <h3>Welche Branche hat Ihr Betrieb?</h3>
              <p className="small">Die Vorlage bestimmt, was der Agent darf und wann er an einen Menschen übergibt.</p>
              <div className="chips" role="group" aria-label="Branche wählen">
                {BRANCHES.map(([name], i) => (
                  <button
                    key={name}
                    type="button"
                    className="chip"
                    aria-pressed={i === branch}
                    onClick={() => setBranch(i)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="branch-info" role="status" aria-live="polite" data-testid="branch-info">
                {BRANCH_INFO[branchKind]}
              </p>
              <div className="actions">
                <a
                  className="btn btn-primary"
                  href={COMPANY_LINKS.voiceOnboarding}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="voice-onboarding-cta"
                >
                  Onboarding starten
                  <span className="sr-only"> (öffnet in neuem Tab)</span>
                </a>
                <a className="btn btn-secondary" href="#kontakt">
                  Interesse melden
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="builder" aria-labelledby="builder-title">
          <div className="wrap builder">
            <div>
              <span className="eyebrow">
                Landingpage Builder · <StatusBadgeInline p={builder} />
              </span>
              <h2 id="builder-title">
                Ihre Webseite, <em>fertig.</em>
              </h2>
              <p className="lead">
                Mit Impressum und Datenschutz. Sie beschreiben Ihren Betrieb im Builder-Wizard, wir setzen die Seite um.
                Ohne Programmierung, ohne langes Agentur-Projekt.
              </p>
            </div>
            <div className="card">
              <h3>So starten Sie</h3>
              <ol className="mini-steps">
                <li>Betrieb beschreiben</li>
                <li>Anfrage absenden</li>
                <li>Entwurf abstimmen</li>
              </ol>
              <div className="actions">
                <Link className="btn btn-primary" to={COMPANY_LINKS.builder}>
                  Builder-Wizard öffnen
                </Link>
                <Link className="link" to="/warteliste">
                  Auf die Warteliste →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="unternehmen" aria-labelledby="unternehmen-title">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Unser Fokus: der Mittelstand</span>
              <h2 id="unternehmen-title">
                Für Betriebe, die <em>das Land am Laufen halten</em>
              </h2>
              <p className="lead">
                Die Schreinerei, die Praxis, das Restaurant, die Kanzlei: Sie haben keine IT-Abteilung und keine Zeit für
                Projekte. Wir bauen KI, die schnell einsatzbereit ist, nach klaren Regeln arbeitet und bezahlbar bleibt.
              </p>
            </div>
            <dl className="facts">
              <div>
                <dt>Ansprechpartner</dt>
                <dd>1</dd>
              </div>
              <div>
                <dt>Einstieg pro Monat</dt>
                <dd>ab {MIN_VOICE_EUR} €</dd>
              </div>
              <div>
                <dt>Sitz &amp; Ansprechpartner</dt>
                <dd>Thüringen</dd>
              </div>
            </dl>
            <div className="privacy">
              <span className="eyebrow">Datenschutz &amp; Infrastruktur</span>
              <p className="lead">
                Wir berücksichtigen europäische Datenschutzanforderungen bei Auswahl und Konfiguration unserer
                Infrastruktur. Datenverarbeitung und eingesetzte KI-Anbieter richten sich nach dem jeweiligen Dienst, den
                dokumentierten Verarbeitungsbedingungen und den verfügbaren Konfigurationen.
              </p>
              <Link className="link" to={COMPANY_LINKS.subProcessors}>
                Sub-Prozessoren ansehen →
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title">
          <div className="wrap narrow">
            <div className="head">
              <span className="eyebrow">Häufige Fragen</span>
              <h2 id="faq-title">Kurz beantwortet</h2>
            </div>
            <details>
              <summary>Was kostet der Einstieg?</summary>
              <p>
                Das Free Audit ist kostenlos. Es zeigt, wo in Ihrem Betrieb KI im Einsatz ist und wo Lücken sind. Die
                Voice-Agent-Pakete beginnen bei {MIN_VOICE_EUR} € im Monat.
              </p>
            </details>
            <details>
              <summary>Kann der Voice Agent schon Telefonate annehmen?</summary>
              <p>
                Noch nicht. Der Voice Agent ist im Status {voice.statusLabel}, die Telefonie ist in Vorbereitung. Im
                Onboarding stellen Sie Branche, Paket und Freigaben schon heute ein.
              </p>
            </details>
            <details>
              <summary>Was passiert, wenn eine Prüfung fehlschlägt?</summary>
              <p>
                Dann wird die Aktion nicht ausgeführt. Fehlt eine Freigabe oder fällt ein Dienst aus, gilt im Zweifel:
                nein. Kritische Fälle gehen an Ihr Team.
              </p>
            </details>
            <details>
              <summary>Wer ist mein Ansprechpartner?</summary>
              <p>Dominik Steiner, Inhaber von RealSync Dynamics &amp; AI in Neuhaus am Rennweg.</p>
            </details>
          </div>
        </section>

        <section id="kontakt" aria-labelledby="kontakt-title">
          <div className="wrap contact">
            <div>
              <span className="eyebrow">Kontakt</span>
              <h2 id="kontakt-title">
                Erzählen Sie uns <em>von Ihrem Betrieb</em>
              </h2>
              <p className="lead">
                Ein paar Zeilen genügen: Was machen Sie, wo hakt es? Wir melden uns persönlich. Kein Newsletter, keine
                Weitergabe Ihrer Daten zu Werbezwecken.
              </p>
              <dl className="cinfo">
                <div>
                  <dt>E-Mail</dt>
                  <dd>
                    <a href="mailto:info@realsyncdynamicsai.de">info@realsyncdynamicsai.de</a>
                  </dd>
                </div>
                <div>
                  <dt>Telefon</dt>
                  <dd>
                    <a href="tel:+4917640132161">+49 176 4013 2161</a>
                  </dd>
                </div>
                <div>
                  <dt>Standort</dt>
                  <dd>Neuhaus am Rennweg · Thüringen</dd>
                </div>
              </dl>
            </div>
            <CompanyContactForm subjects={SUBJECTS} path={PATH} />
          </div>
        </section>
      </main>

      <footer id="impressum">
        <div className="wrap">
          <div className="fcols">
            <div>
              <h2>Anbieter · § 5 DDG</h2>
              <p>
                RealSync Dynamics
                <br />
                Schwarzburger Str. 31
                <br />
                98724 Neuhaus am Rennweg, Thüringen
              </p>
            </div>
            <div>
              <h2>Vertretung</h2>
              <p>
                Einzelunternehmen, Inhaber Dominik Steiner
                <br />
                Verantwortlich gem. § 18 Abs. 2 MStV: Dominik Steiner
                <br />
                USt-IdNr.: {identity.vatId || 'noch nicht vergeben'}
              </p>
            </div>
            <div>
              <h2>Kontakt</h2>
              <p>
                <a href="mailto:info@realsyncdynamicsai.de">info@realsyncdynamicsai.de</a>
                <br />
                <a href="tel:+4917640132161">+49 176 4013 2161</a>
                <br />
                Datenschutz: <a href="mailto:privacy@realsyncdynamicsai.de">privacy@realsyncdynamicsai.de</a>
              </p>
            </div>
            <div>
              <h2>Datenschutz-Hinweise</h2>
              <p>Angaben aus dem Kontaktformular verwenden wir ausschließlich zur Bearbeitung Ihrer Anfrage.</p>
            </div>
          </div>
          <nav className="flinks" aria-label="Rechtliches">
            <Link to={COMPANY_LINKS.impressum}>Impressum</Link>
            <Link to={COMPANY_LINKS.datenschutz}>Datenschutz</Link>
            <Link to={COMPANY_LINKS.agb}>AGB</Link>
            <Link to={COMPANY_LINKS.widerruf}>Widerruf</Link>
            <Link to={COMPANY_LINKS.avv}>AVV</Link>
            <Link to={COMPANY_LINKS.subProcessors}>Sub-Prozessoren</Link>
            <span className="copy">© 2026 RealSync Dynamics &amp; AI</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function StatusBadgeInline({ p }: { p: CompanyProduct }) {
  return <span className={`st st-${p.status}`}>{p.statusLabel}</span>;
}
