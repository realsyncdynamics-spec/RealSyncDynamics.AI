import { useRef, useState, type KeyboardEvent } from 'react';
import { AGENT_STATUS_LABEL, COCKPITS } from './cockpits';

/**
 * Branchen-Umschalter mit Cockpit-Vorschau (WAI-ARIA Tabs, Pfeiltasten,
 * Pos1/Ende). Gleicher Aufbau für jede Branche — genau das ist die Aussage:
 * ein Plattformkern, je Branche eigene Kennzahlen, Agenten und Grenzen.
 */
export function BusinessOsCockpit() {
  const [index, setIndex] = useState(0);
  const [switched, setSwitched] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const c = COCKPITS[index];

  const select = (next: number) => {
    const i = (next + COCKPITS.length) % COCKPITS.length;
    setIndex(i);
    setSwitched(true);
    tabs.current[i]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: COCKPITS.length - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    select(keys[e.key]);
  };

  return (
    <div className="bos-cockpit">
      <div role="tablist" aria-label="Branche wählen" className="bos-tabs" onKeyDown={onKey}>
        {COCKPITS.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`bos-tab-${item.id}`}
            aria-selected={i === index}
            aria-controls="bos-panel"
            tabIndex={i === index ? 0 : -1}
            className="bos-tab"
            onClick={() => {
              setIndex(i);
              setSwitched(true);
            }}
          >
            {item.tab}
          </button>
        ))}
      </div>

      <div
        key={c.id}
        role="tabpanel"
        id="bos-panel"
        aria-labelledby={`bos-tab-${c.id}`}
        className={switched ? 'bos-screen bos-screen-in' : 'bos-screen'}
        data-testid="business-os-cockpit"
      >
        <div className="bos-screen-head">
          <div>
            <p className="bos-screen-title">{c.title}</p>
            <p className="bos-screen-sub">{c.audience}</p>
          </div>
          <span className="bos-screen-brand" aria-hidden="true">Ihr Logo</span>
        </div>

        <dl className="bos-kpis">
          {c.kpis.map((k) => (
            <div key={k.label} className="bos-kpi">
              <dt>{k.label}</dt>
              <dd>{k.value}</dd>
            </div>
          ))}
        </dl>

        <div className="bos-screen-body">
          <section aria-label="AI-Mitarbeiter" className="bos-agents">
            <h3 className="bos-screen-h">Ihre AI-Mitarbeiter</h3>
            <ul>
              {c.agents.map((a) => (
                <li key={a.name}>
                  <span className="bos-agent-name">{a.name}</span>
                  <span className="bos-agent-task">{a.task}</span>
                  <span className={`bos-status bos-status-${a.status}`}>{AGENT_STATUS_LABEL[a.status]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Heute" className="bos-today">
            <h3 className="bos-screen-h">Heute</h3>
            <ul>
              {c.today.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        </div>

        <p className="bos-guardrail">{c.guardrail}</p>
      </div>
      <p className="bos-footnote">Beispielansicht mit erfundenen Werten, keine Kundendaten.</p>
    </div>
  );
}
