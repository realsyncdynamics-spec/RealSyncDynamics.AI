import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MascotStage } from '../../components/landing/products/MascotStage';
import {
  DEMO_STEPS, KI_BOTS, KI_BOTS_SOURCE, PROMISES, RECEPTION_PHASES, START_STEPS, USE_CASES,
} from '../../components/landing/products/kiBotsContent';
import { ProductFooter, ProductNav } from '../../components/landing/products/ProductChrome';
import { statusLabel } from '../../components/landing/products/productLandingShared';
import { faqs } from '../../components/landing/v3/landingV3Data';
import '../../styles/product-landing.css';

/**
 * Produkt-Landingpage KI-Bots & Voice-Agenten (`/ki-bots`) — erster Entwurf.
 *
 * Erste von vier Produktseiten (Website-Architektur, Owner 19.11.2026). Sie
 * dient als Vorlage für den gemeinsamen Aufbau: Hero mit 3D, Produktversprechen,
 * interaktiver Ablauf, Anwendungsbeispiele, Einstieg, Preise/Verfügbarkeit,
 * Handlungsaufforderung, Fragen. Die Gestaltung ist ein Vorschlag und gilt erst
 * nach Freigabe als Regel. Die Seite ist noindex. Navigation und Footer teilt sie
 * mit den übrigen Produktseiten (ProductChrome.tsx). `data-hero-cta` an Hauptbutton
 * und Demo lässt den schwebenden Assistent-Button dort ausblenden (AssistentChip).
 *
 * Status, Preise, Steuerhinweis und Rechtliches kommen aus denselben Quellen
 * wie die Startseite v3 (landingV3Data.ts, productLandingShared.ts).
 */

function Pill({ children }: { children: string }) {
  return <span className="pl-pill">{children}</span>;
}

export default function KiBotsLanding() {
  const [shown, setShown] = useState(0);
  const [waveSignal, setWaveSignal] = useState(0);

  const chatStatus = statusLabel('channel-bots');
  const phoneStatus = statusLabel('voice-telephony');
  const visible = DEMO_STEPS.slice(0, shown);
  const activePhase = shown === 0 ? -1 : DEMO_STEPS[shown - 1]!.phase;
  const done = shown >= DEMO_STEPS.length;

  const nextStep = () => {
    if (shown === 0) setWaveSignal((n) => n + 1);
    setShown((n) => Math.min(n + 1, DEMO_STEPS.length));
  };
  const restart = () => setShown(0);

  return (
    <div className="pl">
      <a href="#ablauf" className="pl-skip">Zum Inhalt springen</a>

      <header className="pl-hero" id="top">
        <ProductNav current="ki-bots" />

        <div className="pl-hero-grid">
          <div className="pl-hero-copy">
            <span className="pl-eyebrow">
              {KI_BOTS.name} · {KI_BOTS.audience}
            </span>
            <h1 className="pl-h1" data-testid="ki-bots-heading">
              <span>{KI_BOTS.h1[0]}</span>
              <span className="pl-h1-2">{KI_BOTS.h1[1]}</span>
            </h1>
            <p className="pl-lead">{KI_BOTS.lead}</p>
            <div className="pl-actions">
              <a className="pl-btn pl-btn--solid pl-btn--lg" href="#ablauf" data-testid="ki-bots-primary" data-hero-cta="ki-bots">
                {KI_BOTS.primaryCta}
              </a>
              <Link className="pl-btn pl-btn--lg" to={KI_BOTS.tryHref}>{KI_BOTS.tryCta}</Link>
            </div>
            <p className="pl-meta" data-testid="ki-bots-status">
              {chatStatus ? <>Chat <Pill>{chatStatus}</Pill></> : null}
              {phoneStatus ? <>Telefon <Pill>{phoneStatus}</Pill></> : null}
            </p>
          </div>
          <MascotStage tag={KI_BOTS.stageTag} caption={KI_BOTS.stageCaption} waveSignal={waveSignal} variant="empfang" />
        </div>
      </header>

      <main>
        <section className="pl-section" aria-labelledby="pl-promise-h">
          <span className="pl-eyebrow">Was Sie bekommen</span>
          <h2 id="pl-promise-h" className="pl-h2">Ihr KI-Mitarbeiter am Empfang.</h2>
          <ol className="pl-promises">
            {PROMISES.map((p, i) => (
              <li key={p.title}>
                <span className="pl-meta">{String(i + 1).padStart(2, '0')}</span>
                <strong>{p.title}</strong>
                <span>{p.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="ablauf" className="pl-section pl-split" aria-labelledby="pl-demo-h">
          <div className="pl-col">
            <span className="pl-eyebrow">So soll der KI-Empfang arbeiten</span>
            <h2 id="pl-demo-h" className="pl-h2">Eine Anfrage, Schritt für Schritt.</h2>
            <p className="pl-text">
              Spielen Sie eine typische Anfrage durch. Rechts sehen Sie, was dabei beim Betrieb ankommt.
            </p>
            <ol className="pl-phases" data-testid="ki-bots-phases">
              {RECEPTION_PHASES.map((label, i) => (
                <li key={label} data-active={i === activePhase} data-done={i < activePhase || (done && i === activePhase)}>
                  <span className="pl-meta">{String(i + 1).padStart(2, '0')}</span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
            <p className="pl-fine">
              Simulierter Beispielablauf ohne Verbindung zu einem echten Assistenten. Name und Nummer sind Platzhalter.
            </p>
          </div>

          <div className="pl-chat" data-testid="ki-bots-demo" data-hero-cta="ki-bots-demo">
            <div className="pl-chat-head">
              <span className="pl-meta">Website-Chat · Beispiel</span>
              {chatStatus ? <Pill>{chatStatus}</Pill> : null}
            </div>
            <ol className="pl-chat-log" aria-live="polite">
              {visible.length === 0 ? (
                <li className="pl-chat-empty">Noch keine Nachricht. Starten Sie den Ablauf.</li>
              ) : (
                visible.map((s, i) => (
                  <li key={i} className="pl-msg" data-speaker={s.speaker}>
                    <span className="pl-meta">
                      {s.speaker === 'kunde' ? 'Kunde' : s.speaker === 'empfang' ? 'KI-Empfang' : 'Übergabe'}
                    </span>
                    <span>{s.text}</span>
                  </li>
                ))
              )}
            </ol>
            <div className="pl-actions">
              <button type="button" className="pl-btn pl-btn--solid" onClick={nextStep} disabled={done}>
                {shown === 0 ? 'Ablauf starten' : 'Nächster Schritt'}
              </button>
              <button type="button" className="pl-btn" onClick={restart} disabled={shown === 0}>
                Von vorn
              </button>
            </div>
          </div>
        </section>

        <section className="pl-section" aria-labelledby="pl-cases-h">
          <span className="pl-eyebrow">Anwendungsbeispiele</span>
          <h2 id="pl-cases-h" className="pl-h2">Wo der Empfang entlastet.</h2>
          <div className="pl-cards">
            {USE_CASES.map((c) => (
              <article key={c.trade} className="pl-card">
                <span className="pl-meta">{c.trade}</span>
                <p>{c.situation}</p>
                <p className="pl-card-result">{c.result}</p>
              </article>
            ))}
          </div>
          <p className="pl-fine">Beispiele zur Veranschaulichung, keine Kundenreferenzen.</p>
        </section>

        <section className="pl-section pl-split" aria-labelledby="pl-start-h">
          <div className="pl-col">
            <span className="pl-eyebrow">Einstieg</span>
            <h2 id="pl-start-h" className="pl-h2">In drei Schritten loslegen.</h2>
          </div>
          <ol className="pl-phases">
            {START_STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="pl-meta">{String(i + 1).padStart(2, '0')}</span>
                <span><strong>{s.title}</strong> {s.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="preise" className="pl-section" aria-labelledby="pl-preise-h">
          <span className="pl-eyebrow">Produktstatus</span>
          <h2 id="pl-preise-h" className="pl-h2">Telefonie ist noch in Vorbereitung.</h2>
          <p className="pl-text">
            Der Voice-Agent für Telefonie kann derzeit nicht gebucht werden. Für ihn wird hier kein allgemeiner Tarif als Telefonie-Checkout ausgegeben.
            Den verfügbaren Chat-Assistenten können Sie separat ausprobieren oder Ihr Interesse am Telefonprodukt vormerken.
          </p>
          <div className="pl-actions">
            <Link className="pl-btn pl-btn--solid" to={KI_BOTS.waitlistHref} data-testid="ki-bots-waitlist-pricing">
              {KI_BOTS.waitlistCta}
            </Link>
            <Link className="pl-btn" to={KI_BOTS.tryHref}>{KI_BOTS.tryCta}</Link>
          </div>
          <p className="pl-fine" data-testid="ki-bots-status-note">
            Ein eigener Telefon-Checkout wird erst angeboten, wenn Angebot, Serverfunktion und Bereitstellung freigegeben sind.
          </p>
        </section>

        <section className="pl-section pl-cta" aria-labelledby="pl-cta-h">
          <h2 id="pl-cta-h" className="pl-h2 pl-h2--xl">Bereit für Ihren KI-Empfang?</h2>
          <p className="pl-text">
            Testen Sie den Chat-Assistenten heute. Für den Empfang am Telefon merken wir Sie vor.
          </p>
          <div className="pl-actions">
            <Link className="pl-btn pl-btn--solid pl-btn--lg" to={KI_BOTS.waitlistHref} data-testid="ki-bots-waitlist">
              {KI_BOTS.waitlistCta}
            </Link>
            <Link className="pl-btn pl-btn--lg" to={KI_BOTS.tryHref} data-testid="ki-bots-try">
              {KI_BOTS.tryCta}
            </Link>
          </div>
        </section>

        <section className="pl-section pl-split" aria-labelledby="pl-fragen-h">
          <div className="pl-col">
            <span className="pl-eyebrow">Häufige Fragen</span>
            <h2 id="pl-fragen-h" className="pl-h2">Kurz beantwortet.</h2>
          </div>
          <div className="pl-faq">
            {faqs()
              .filter((f) => !f.q.includes('Website-Scan'))
              .map((f) => (
                <details key={f.q}>
                  <summary>{f.q}<span aria-hidden="true">+</span></summary>
                  <p>{f.a}</p>
                </details>
              ))}
          </div>
        </section>
      </main>

      <ProductFooter />
    </div>
  );
}
