import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Cpu,
  CreditCard,
  Database,
  Layers,
  Server,
  Workflow,
} from 'lucide-react';
import {
  LV2_AI_ACT_TIMELINE,
  LV2_CHAIN_DEMO,
  LV2_EU_NATIVE,
  LV2_EVIDENCE_ARTICLES,
  LV2_FRAMEWORKS,
  LV2_LIFECYCLE,
  LV2_PIPELINE,
  LV2_TIMELINE_NOTE,
  LV2_INFRASTRUCTURE,
  type Lv2EuCard,
} from './landing-v2-content';

/* ── 02 Framework-Leiste ─────────────────────────────────────────────── */
export function FrameworkStrip() {
  return (
    <section className="lv2-frameworks" aria-label="Regelwerke">
      <div className="lv2__wrap lv2-frameworks__row">
        <p className="lv2__kicker">Gebaut für europäische Regulierung</p>
        <ul className="lv2-frameworks__list">
          {LV2_FRAMEWORKS.map((f) => (
            <li key={f} className="lv2-chip">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── 03 EU AI Act ────────────────────────────────────────────────────── */
export function AiActTimeline() {
  return (
    <section id="regulierung" className="lv2__section" aria-labelledby="lv2-reg-title">
      <div className="lv2__wrap">
        <div className="lv2-split">
          <div>
            <p className="lv2__kicker">Der Rahmen</p>
            <h2 id="lv2-reg-title" className="lv2__h2">
              Der EU AI Act ist in Kraft. Nachweise sind jetzt Betriebsaufgabe.
            </h2>
          </div>
          <div className="lv2-split__aside">
            <p className="lv2__lead">
              Anbieter und Betreiber von KI-Systemen müssen Risiken bewerten, Kontrollen umsetzen
              und Konformität dokumentieren – fortlaufend, nicht einmalig. Verstöße gegen verbotene
              Praktiken können mit bis zu 35 Mio. € oder 7 % des weltweiten Jahresumsatzes
              geahndet werden.
            </p>
            <p style={{ marginTop: '1.4em' }}>
              <Link to="/audit?source=landing-v2-regulierung" className="lv2-btn lv2-btn--link">
                Eigene Risikoklasse in 3 Minuten prüfen <ArrowRight size="1em" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>

        <ol className="lv2-timeline" aria-label="Fristen des EU AI Act">
          {LV2_AI_ACT_TIMELINE.map((entry) => (
            <li key={entry.iso} data-current={entry.current ? 'true' : undefined}>
              <time dateTime={entry.iso}>{entry.date}</time>
              <h3 className="lv2__h3">{entry.title}</h3>
              <p>{entry.text}</p>
            </li>
          ))}
        </ol>
        <p className="lv2-timeline__note">{LV2_TIMELINE_NOTE}</p>
      </div>
    </section>
  );
}

/* ── 04 Lifecycle ────────────────────────────────────────────────────── */
export function LifecycleGrid() {
  return (
    <section id="produkt" className="lv2__section" aria-labelledby="lv2-produkt-title">
      <div className="lv2__wrap">
        <p className="lv2__kicker">{LV2_PIPELINE.join(' → ')}</p>
        <h2 id="lv2-produkt-title" className="lv2__h2">
          Ein Betriebssystem für den gesamten Compliance-Lebenszyklus.
        </h2>

        <ol className="lv2-lifecycle">
          {LV2_LIFECYCLE.map((step) => (
            <li key={step.index}>
              <p className="lv2__kicker">
                {step.index} — {step.name}
              </p>
              <h3 className="lv2__h3">{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="lv2-cta-row">
          <Link to="/audit?source=landing-v2-produkt" className="lv2-btn lv2-btn--gold">
            Free Audit starten
          </Link>
          <Link to="/demo-tour" className="lv2-btn lv2-btn--glass">
            Demo ansehen
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 05 Evidence Vault ───────────────────────────────────────────────── */
export function EvidenceChainPreview() {
  return (
    <section id="evidence" className="lv2__section" aria-labelledby="lv2-evidence-title">
      <div className="lv2__wrap">
        <div className="lv2-split lv2-split--wide-aside">
          <div>
            <p className="lv2__kicker">Evidence Vault</p>
            <h2 id="lv2-evidence-title" className="lv2__h2">
              Nachweise, die sich nicht nachträglich ändern lassen.
            </h2>
            <p className="lv2__lead" style={{ marginTop: '1.2em' }}>
              Jeder Log-Eintrag, jede Freigabe und jede Policy-Entscheidung wird per SHA-256 mit
              ihrem Vorgänger verkettet. Manipulationen werden sofort sichtbar – der Audit-Trail
              bleibt vollständig nachvollziehbar.
            </p>

            <ul className="lv2-articles" aria-label="Abgedeckte Artikel">
              {LV2_EVIDENCE_ARTICLES.map((a) => (
                <li key={a.label}>
                  <span>{a.label}</span>
                  <span>{a.ref}</span>
                </li>
              ))}
            </ul>

            <p style={{ marginTop: '1.6em' }}>
              <Link to="/evidence-vault" className="lv2-btn lv2-btn--link">
                Evidence Vault ansehen <ArrowRight size="1em" aria-hidden="true" />
              </Link>
            </p>
          </div>

          <div className="lv2-split__aside">
            <p className="lv2__small lv2__mono" style={{ marginBottom: '0.8em' }}>
              Beispiel-Kette · Demo-Werte
            </p>
            <ol className="lv2-chain" aria-label="Beispiel einer Hash-Kette">
              {LV2_CHAIN_DEMO.map((b) => (
                <li key={b.block} data-sealed={'sealed' in b && b.sealed ? 'true' : undefined}>
                  <div className="lv2-chain__head">
                    <span>BLOCK {b.block}</span>
                    <span>{b.time}</span>
                  </div>
                  <p className="lv2-chain__title">{b.title}</p>
                  <dl className="lv2-chain__hash">
                    <dt>hash</dt>
                    <dd>{b.hash}</dd>
                    <dt>prev</dt>
                    <dd>{b.prev}</dd>
                  </dl>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 06 EU-native ────────────────────────────────────────────────────── */
const EU_ICONS: Record<Lv2EuCard['icon'], typeof Server> = {
  server: Server,
  database: Database,
  layers: Layers,
  cpu: Cpu,
  workflow: Workflow,
  creditcard: CreditCard,
};

export function EuNativeGrid() {
  return (
    <section id="architektur" className="lv2__section" aria-labelledby="lv2-eu-title">
      <div className="lv2__wrap">
        <div className="lv2-split">
          <div>
            <p className="lv2__kicker">Produktionspfad · offen gelegt</p>
            <h2 id="lv2-eu-title" className="lv2__h2">
              Infrastruktur ist Teil des Produkts — deshalb zeigen wir sie.
            </h2>
          </div>
          <p className="lv2__lead lv2-split__aside">
            Die öffentliche SPA wird über Cloudflare Pages ausgeliefert. Daten, Identität und
            serverseitige Functions laufen über Supabase; lokale KI- und Ops-Dienste haben einen
            eigenen VPS-/Docker-Pfad. Die Oberfläche benennt diese Schichten statt sie hinter
            generischen „Cloud“-Claims zu verstecken.
          </p>
        </div>

        <ul className="lv2-eu">
          {LV2_EU_NATIVE.map((card) => {
            const Icon = EU_ICONS[card.icon];
            return (
              <li key={card.title}>
                <Icon size={22} aria-hidden="true" />
                <h3 className="lv2__h3">{card.title}</h3>
                <p>{card.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}


/* ── 06b Infrastruktur-Spiegel ───────────────────────────────────────── */
const INFRA_ICONS = [Server, Database, Workflow, Layers, Cpu, CreditCard] as const;

export function InfrastructureMirror() {
  return (
    <div id="infrastruktur" className="lv2__section lv2-infrastructure" aria-labelledby="lv2-infra-title">
      <div className="lv2__wrap">
        <div className="lv2-split">
          <div>
            <p className="lv2__kicker">Make the invisible visible</p>
            <h2 id="lv2-infra-title" className="lv2__h2">
              Das Frontend zeigt den echten Produktionspfad.
            </h2>
          </div>
          <p className="lv2__lead lv2-split__aside">
            Keine zweite Marketing-Architektur: Jede Karte benennt eine reale Schicht oder öffentliche
            Produktoberfläche und führt auf die dazugehörige Route.
          </p>
        </div>

        <ul className="lv2-infra">
          {LV2_INFRASTRUCTURE.map((item, index) => {
            const Icon = INFRA_ICONS[index] ?? Server;
            return (
              <li key={item.layer} className="lv2-infra__card">
                <div className="lv2-infra__top">
                  <span className="lv2__kicker">{item.layer}</span>
                  <span className="lv2-infra__status">{item.status}</span>
                </div>
                <Icon size={22} aria-hidden="true" />
                <h3 className="lv2__h3">{item.title}</h3>
                <code>{item.path}</code>
                <p>{item.text}</p>
                <Link to={item.to} className="lv2-btn lv2-btn--link">
                  {item.cta} <ArrowRight size="1em" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
