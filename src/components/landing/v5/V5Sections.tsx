import { Link } from 'react-router-dom';
import { BETA, betaSignupHref } from '../../../config/beta';
import {
  ROADMAP_COMING_SOON_ITEMS,
  ROADMAP_LIVE_ITEMS,
  ROADMAP_PREVIEW_ITEMS,
  STATUS_LABEL,
  type ImplementationItem,
} from '../../../product/implementation-status';
import { LOOP_NODES } from '../v4/landing-v4-content';

/** Schmales Band ganz oben — nur in der Beta. */
export function BetaRibbon({ source = 'ribbon' }: { source?: string }) {
  if (!BETA.active) return null;
  return (
    <div className="v5-ribbon" role="note">
      <span className="v5-ribbon__dot" aria-hidden="true" />
      <span>
        <b>{BETA.badge}</b>
        <span className="v5-ribbon__long"> · Offene Testphase bis {BETA.endsLabel} — kostenlos testen, keine Kreditkarte.</span>
      </span>
      <Link to={betaSignupHref(BETA.testPlan, source)}>Jetzt kostenlos testen →</Link>
    </div>
  );
}

/** 4-Schritte-Ablauf mit den klaren v4-Texten im v2-Kartenstil (3D-Karten). */
export function V5Loop() {
  return (
    <section id="ablauf" className="lv2__section v5-loop" aria-labelledby="v5-loop-title">
      <div className="lv2__wrap">
        <p className="lv2__kicker">So funktioniert es</p>
        <h2 id="v5-loop-title" className="lv2__h2">
          Vier Schritte. <span className="is-gold">Ohne Fachchinesisch.</span>
        </h2>
        <ol className="v5-cards">
          {LOOP_NODES.map(([kicker, title, text], i) => (
            <li key={kicker} className="v5-card3d" style={{ ['--i' as string]: i }}>
              <span className="v5-card3d__k">{kicker}</span>
              <h3>{title}</h3>
              <p>{text}</p>
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
            Testen Sie alles. <span className="is-gold">Zahlen Sie nichts.</span>
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
            <span>E-Mail-Code oder Google — in unter einer Minute.</span>
          </li>
          <li>
            <b>2 · Website verbinden</b>
            <span>Domain eintragen, erster Scan startet automatisch.</span>
          </li>
          <li>
            <b>3 · Im Dashboard arbeiten</b>
            <span>Befunde, Maßnahmen, KI-Register und Nachweise an einem Ort.</span>
          </li>
          <li>
            <b>4 · Feedback geben</b>
            <span>Direkt im Dashboard — jede Rückmeldung landet bei uns im Backlog.</span>
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
  return (
    <section id="roadmap" className="lv2__section v5-rm" aria-labelledby="v5-rm-title">
      <div className="lv2__wrap">
        <p className="lv2__kicker">Roadmap · gemessen, nicht versprochen</p>
        <h2 id="v5-rm-title" className="lv2__h2">
          Was heute läuft — <span className="is-gold">und was als Nächstes kommt.</span>
        </h2>
        <div className="v5-rm__grid">
          <RoadmapCol title="Live" status="live" items={ROADMAP_LIVE_ITEMS} />
          <RoadmapCol title="In der Beta" status="preview" items={ROADMAP_PREVIEW_ITEMS} />
          <RoadmapCol title="Geplant" status="next" items={ROADMAP_COMING_SOON_ITEMS} />
        </div>
        <p className="v5-rm__more">
          <Link to="/roadmap">Vollständige Roadmap ansehen →</Link>
        </p>
      </div>
    </section>
  );
}
