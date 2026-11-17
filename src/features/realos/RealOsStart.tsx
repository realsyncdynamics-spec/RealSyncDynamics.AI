import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUp, Compass, Globe, MessageSquare, Sparkles } from 'lucide-react';
import {
  ASSISTANT_PROMPT_EVENT,
  type AssistantPromptDetail,
} from '../../components/governance-os/assistantPrompt';
import {
  buildCommandCatalog,
  filterCommands,
  isCommandRunnable,
} from '../../components/governance-os/commandCenterCatalog';
import {
  REALOS_PRODUCTS,
  REALOS_QUICK_ACTIONS,
  REALOS_STATUS_LABEL,
  asWebAddress,
  matchProduct,
  realOsStatus,
  type RealOsProduct,
} from '../../product/realos-products';
import '../../styles/realos-start.css';

type Mode = 'ask' | 'open';

/** Event der Shell für den eingebetteten Browser (GovernanceBrowserShell). */
export const BROWSER_OPEN_EVENT = 'realsync:browser-open';

/**
 * RealOS-Startfläche (`/app/start`) — ein Eingabefeld für alles, darunter
 * Schnellstarts und die Produkte als Kacheln mit Erklärung.
 *
 * - Modus „Fragen“: Text geht an den Assistenten der Shell
 *   (ASSISTANT_PROMPT_EVENT). Abgeschickt wird erst dort — kein eigener
 *   Modell-Call auf dieser Fläche.
 * - Modus „Öffnen“: Web-Adresse → eingebetteter Browser der Shell;
 *   sonst passendes Produkt (Schlüsselwörter) oder ausführbarer Befehl aus
 *   dem Command-Center-Katalog; sonst Hinweis mit Wechsel zu „Fragen“.
 */
export function RealOsStart() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('ask');
  const [value, setValue] = useState('');
  const [noMatch, setNoMatch] = useState<string | null>(null);
  const [openExplainer, setOpenExplainer] = useState<RealOsProduct['id'] | null>(null);
  const fieldId = useId();
  const hintId = useId();
  const commands = useMemo(() => buildCommandCatalog(), []);

  const trimmed = value.trim();
  const suggestion = useMemo(() => (trimmed ? matchProduct(trimmed) : null), [trimmed]);
  const address = useMemo(() => asWebAddress(trimmed), [trimmed]);

  function ask(prompt: string) {
    const detail: AssistantPromptDetail = { prompt };
    window.dispatchEvent(new CustomEvent(ASSISTANT_PROMPT_EVENT, { detail }));
    setValue('');
    setNoMatch(null);
  }

  function open(text: string) {
    const url = asWebAddress(text);
    if (url) {
      window.dispatchEvent(new CustomEvent(BROWSER_OPEN_EVENT, { detail: { url } }));
      setValue('');
      setNoMatch(null);
      return;
    }
    const product = matchProduct(text);
    if (product) {
      navigate(product.route);
      return;
    }
    const command = filterCommands(commands, text).find(isCommandRunnable);
    if (command?.path) {
      navigate(command.path);
      return;
    }
    setNoMatch(text);
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!trimmed) return;
    if (mode === 'ask') ask(trimmed);
    else open(trimmed);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const placeholder =
    mode === 'ask'
      ? 'Frag etwas, z. B. „Wie nimmt mein Bot Anfragen an?“'
      : 'Produkt, Modul oder Web-Adresse, z. B. „Bot“ oder „example.de“';

  return (
    <div className="realos" data-testid="realos-start">
      <section className="realos__hero" aria-labelledby={`${fieldId}-title`}>
        <span className="realos__mark" aria-hidden="true">
          <Sparkles className="h-5 w-5" />
        </span>
        <p className="realos__eyebrow">REALOS · START</p>
        <h1 id={`${fieldId}-title`} className="realos__title">
          Was möchtest du erledigen?
        </h1>

        <form className="realos__composer" onSubmit={submit}>
          <label htmlFor={fieldId} className="sr-only">
            {mode === 'ask' ? 'Frage an den Assistenten' : 'Ziel öffnen'}
          </label>
          <textarea
            id={fieldId}
            className="realos__field"
            rows={2}
            value={value}
            placeholder={placeholder}
            aria-describedby={hintId}
            onChange={(e) => {
              setValue(e.target.value);
              setNoMatch(null);
            }}
            onKeyDown={onKeyDown}
          />
          <div className="realos__bar">
            <div className="realos__modes" role="radiogroup" aria-label="Modus">
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'ask'}
                className="realos__mode"
                data-testid="realos-mode-ask"
                onClick={() => setMode('ask')}
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Fragen
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'open'}
                className="realos__mode"
                data-testid="realos-mode-open"
                onClick={() => setMode('open')}
              >
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                Öffnen
              </button>
            </div>
            <p id={hintId} className="realos__hint">
              {mode === 'ask'
                ? 'Geht an den Assistenten. Gesendet wird erst dort.'
                : 'Enter öffnet das Ziel.'}
            </p>
            <button
              type="submit"
              className="realos__go"
              disabled={!trimmed}
              aria-label={mode === 'ask' ? 'An den Assistenten übergeben' : 'Öffnen'}
              data-testid="realos-submit"
            >
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>

        <div className="realos__assist" aria-live="polite">
          {address && mode === 'open' && (
            <p className="realos__match" data-testid="realos-address">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              Öffnet <span className="realos__mono">{address}</span> im eingebetteten Browser.
            </p>
          )}
          {!address && suggestion && (
            <p className="realos__match" data-testid="realos-suggestion">
              Passt zu <strong>{suggestion.name}</strong>
              <Link to={suggestion.route} className="realos__match-link">
                {suggestion.cta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </p>
          )}
          {noMatch && (
            <p className="realos__match" data-testid="realos-nomatch">
              Kein passendes Ziel gefunden.
              <button
                type="button"
                className="realos__match-link"
                onClick={() => {
                  setMode('ask');
                  ask(noMatch);
                }}
              >
                Als Frage an den Assistenten
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </p>
          )}
        </div>

        <nav className="realos__quick" aria-label="Schnellstart">
          {REALOS_QUICK_ACTIONS.map((action) => (
            <Link key={action.id} to={action.route} className="realos__chip">
              {action.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="realos__apps" aria-labelledby={`${fieldId}-apps`}>
        <h2 id={`${fieldId}-apps`} className="realos__section-title">
          Deine Produkte
        </h2>
        <ul className="realos__grid">
          {REALOS_PRODUCTS.map((product, index) => {
            const status = realOsStatus(product.statusId);
            const sub = product.subStatus;
            const expanded = openExplainer === product.id;
            const panelId = `${fieldId}-explain-${product.id}`;
            return (
              <li key={product.id} className="realos__card" data-testid={`realos-card-${product.id}`}>
                <div className="realos__card-head">
                  <span className="realos__mono">
                    {String(index + 1).padStart(2, '0')} · {product.kicker}
                  </span>
                  <span className={`realos__status realos__status--${status}`}>
                    {REALOS_STATUS_LABEL[status]}
                  </span>
                </div>
                <h3 className="realos__card-title">{product.name}</h3>
                <p className="realos__card-text">{product.oneLiner}</p>
                {sub && (
                  <p className="realos__card-sub realos__mono">
                    {sub.label}: {REALOS_STATUS_LABEL[realOsStatus(sub.statusId)]}
                  </p>
                )}
                <div className="realos__card-actions">
                  <Link to={product.route} className="realos__cta">
                    {product.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    className="realos__explain-toggle"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpenExplainer(expanded ? null : product.id)}
                  >
                    Was ist das?
                  </button>
                </div>
                <div id={panelId} className="realos__explain" hidden={!expanded}>
                  <p>
                    <span className="realos__mono">FÜR WEN</span> {product.audience}
                  </p>
                  <ol className="realos__steps">
                    {product.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p>
                    <span className="realos__mono">ERGEBNIS</span> {product.outcome}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="realos__footnote">
          <span className="realos__mono">Ctrl/⌘ + K</span> öffnet alle Module und Aktionen.
        </p>
      </section>
    </div>
  );
}
