import { Link } from 'react-router-dom';
import { BETA, betaSignupHref } from '../../../config/beta';
import {
  ROADMAP_COMING_SOON_ITEMS,
  ROADMAP_LIVE_ITEMS,
  ROADMAP_PREVIEW_ITEMS,
  STATUS_LABEL,
  type ImplementationItem,
} from '../../../product/implementation-status';
import { useLang } from '../../../i18n/useLang';
import { V5_COPY } from './landing-v5-content';

/** Schmales Band ganz oben — nur in der Beta. */
export function BetaRibbon({ source = 'ribbon' }: { source?: string }) {
  if (!BETA.active) return null;
  return (
    <div className="v5-ribbon" role="note">
      <span className="v5-ribbon__dot" aria-hidden="true" />
      <span>
        <b>{BETA.badge}</b>
        <span className="v5-ribbon__long"> · Offene Testphase bis {BETA.endsLabel} — kostenlos registrieren, keine Kreditkarte. Funktionen im Preview-Status sind gekennzeichnet.</span>
      </span>
      <Link to={betaSignupHref(BETA.testPlan, source)}>Jetzt kostenlos testen →</Link>
    </div>
  );
}

/** 4-Schritte-Ablauf mit den klaren v4-Texten im v2-Kartenstil (3D-Karten). */
export function V5Loop() {
  const c = V5_COPY[useLang().lang];
  return (
    <section id="ablauf" className="lv2__section v5-loop" aria-labelledby="v5-loop-title">
      <div className="lv2__wrap">
        <p className="lv2__kicker">{c.loopKicker}</p>
        <h2 id="v5-loop-title" className="lv2__h2">
          {c.loopTitleA} <span className="is-gold">{c.loopTitleEm}</span>
        </h2>
        <p className="v5-intro">{c.loopIntro}</p>
        <ol className="v5-cards">
          {c.loop.map(([kicker, title, text, benefit], i) => (
            <li key={kicker} className="v5-card3d" style={{ ['--i' as string]: i }}>
              <span className="v5-card3d__k">{kicker}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <p className="v5-card3d__benefit">{benefit}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Beta-Programm: Was Tester bekommen, was wir zurück wollen. */
export function V5BetaProgram() {
  if (!BETA.active) return null;
  return (
    <section id="beta" className="lv2__section v5-beta" aria-labelledby="v5-beta-title">
      <div className="lv2__wrap v5-beta__grid">
        <div>
          <p className="lv2__kicker">Beta-Testphase</p>
          <h2 id="v5-beta-title" className="lv2__h2">
            Kostenlos testen, <span className="is-gold">solange die Beta läuft.</span>
          </h2>
          <p className="v5-beta__sub">{BETA.sub}</p>
          <ul className="v5-checks">
            {BETA.promises.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="v5-beta__cta">
            <Link to={betaSignupHref(BETA.testPlan, 'landing-v5-beta')} className="lv2-btn lv2-btn--gold v5-btn3d">
              Kostenlos registrieren
            </Link>
            <Link to="/audit?source=landing-v5-beta" className="lv2-btn lv2-btn--glass v5-btn3d">
              Erst ohne Konto prüfen
            </Link>
          </div>
        </div>
        <ol className="v5-steps" aria-label="Ablauf der Beta">
          <li>
            <b>1 · Registrieren</b>
            <span>Mit E-Mail-Code oder Google-Konto anmelden.</span>
          </li>
          <li>
            <b>2 · Website verbinden</b>
            <span>Domain eintragen — der erste Scan startet automatisch.</span>
          </li>
          <li>
            <b>3 · Im Dashboard arbeiten</b>
            <span>Befunde, Maßnahmen und Nachweise an einem Ort; Module im Preview-Status sind gekennzeichnet.</span>
          </li>
          <li>
            <b>4 · Feedback geben</b>
            <span>Direkt im Dashboard — Ihre Rückmeldung hilft uns, Prioritäten zu setzen.</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

function RoadmapCol({ title, status, items }: { title: string; status: string; items: readonly ImplementationItem[] }) {
  return (
    <div className="v5-rm__col" data-status={status}>
      <h3>
        <i aria-hidden="true" /> {title} <small>{items.length}</small>
      </h3>
      <ul>
        {items.slice(0, 8).map((it) => (
          <li key={it.id}>
            <span className="v5-rm__tag">{STATUS_LABEL[it.status]}</span>
            {it.route ? <Link to={it.route}>{it.name}</Link> : <span>{it.name}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ehrliche Roadmap — liest ausschließlich die Implementation-Status-SSoT. */
export function V5Roadmap() {
  const c = V5_COPY[useLang().lang];
  return (
    <section id="roadmap" className="lv2__section v5-rm" aria-labelledby="v5-rm-title">
      <div className="lv2__wrap">
        <p className="lv2__kicker">{c.rmKicker}</p>
        <h2 id="v5-rm-title" className="lv2__h2">
          {c.rmTitleA} <span className="is-gold">{c.rmTitleEm}</span>
        </h2>
        <p className="v5-intro">{c.rmIntro}</p>
        <div className="v5-rm__grid">
          <RoadmapCol title={c.rmLive} status="live" items={ROADMAP_LIVE_ITEMS} />
          <RoadmapCol title={c.rmPreview} status="preview" items={ROADMAP_PREVIEW_ITEMS} />
          <RoadmapCol title={c.rmNext} status="next" items={ROADMAP_COMING_SOON_ITEMS} />
        </div>
        <p className="v5-rm__more">
          <Link to="/roadmap">{c.rmMore}</Link>
        </p>
      </div>
    </section>
  );
}
