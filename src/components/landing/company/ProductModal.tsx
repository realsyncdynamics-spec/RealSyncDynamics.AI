import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { suppressAssistant } from '../../assistantSuppression';
import { COMPANY_LINKS, COMPANY_PRODUCTS, COMPANY_TAX_NOTE, VOICE_TELEPHONY_NOTE } from './companyProducts';
import { BuilderPreview, GovernanceCheckDemo, TemplatePicker, VoiceCallDemo, VoiceOnboarding } from './CompanyDemos';

/**
 * Produkt-Demo-Dialog der Unternehmens-Landing v5 (Referenz `#pm`):
 * 3 Produkt-Tabs, je Produkt Seiten mit Seiten-Navigation und Pager.
 * Tastatur: Esc schließt; ←/→ wechselt in der Produkt-Tab-Leiste das Produkt,
 * sonst die Seite (nicht in Eingabefeldern und nicht im Voice-Onboarding).
 * Fokus bleibt im Dialog und
 * kehrt nach dem Schließen zum Auslöser zurück (Aufrufer).
 */

export interface ProductModalProps {
  tab: number;
  page?: number;
  /** Schließen; `to` = Sprungziel auf der Seite statt Fokus-Rückgabe. */
  onClose: (to?: 'kontakt') => void;
  /** Vorlage aus dem Builder-Tab für das Kontaktformular übernehmen. */
  onTemplateRequest: (templateName: string | null) => void;
}

interface Page {
  title: string;
  body: ReactNode;
}

function F3({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <div className="f3">
      {items.map(([b, s]) => (
        <div key={b}>
          <b>{b}</b>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}

function Steps({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <ol className="steps">
      {items.map(([b, s]) => (
        <li key={b}>
          <b>{b}</b>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function buildPages(onContact: () => void, onTemplateRequest: (n: string | null) => void): Page[][] {
  const contactLink = (label: string, primary = false) => (
    <a
      className={primary ? 'btn' : 'btn quiet'}
      href="#kontakt"
      onClick={(e) => {
        e.preventDefault();
        onContact();
      }}
    >
      {label}
    </a>
  );
  return [
    [
      {
        title: 'Überblick',
        body: (
          <>
            <h3>Jede KI-Aktion wird geprüft – bevor sie wirkt.</h3>
            <p>
              Auch kleine Betriebe müssen DSGVO und EU AI Act erfüllen – ohne eigene Rechtsabteilung. Das Governance OS prüft für Sie
              jede KI-Aktion und hält das Ergebnis als Nachweis fest.
            </p>
            <F3 items={[['Vorher', 'geprüft, nicht erst im Audit'], ['Beweisbar', 'versiegeltes Protokoll'], ['Europa', 'DSGVO · EU AI Act']]} />
          </>
        ),
      },
      {
        title: 'Leistungen',
        body: (
          <>
            <h3>Was Sie bekommen</h3>
            <ul className="plist">
              <li>
                Prüfung jeder Aktion nach <strong>Mandant, Berechtigung, Einwilligung und Risiko</strong>
              </li>
              <li>
                Im Zweifel gilt: <strong>nein</strong> – nichts läuft ungeprüft durch
              </li>
              <li>Versiegeltes Protokoll als Nachweis, verkettet per Hash (Evidence-Kette)</li>
              <li>
                Regeln für <strong>DSGVO</strong> und <strong>EU AI Act</strong> eingebaut
              </li>
              <li>Hosting und Nachweise in der EU</li>
            </ul>
          </>
        ),
      },
      {
        title: 'Ablauf',
        body: (
          <>
            <h3>In drei Schritten live</h3>
            <Steps
              items={[
                ['Free Audit', 'Wir prüfen, wo bei Ihnen KI im Einsatz ist – kostenlos.'],
                ['Regeln festlegen', 'Sie bestimmen, was erlaubt, geprüft oder gesperrt ist.'],
                ['Live im Betrieb', 'Jede Aktion wird geprüft und protokolliert.'],
              ]}
            />
          </>
        ),
      },
      {
        title: 'Ausprobieren',
        body: (
          <>
            <h3>Prüfung ausprobieren</h3>
            <p>Wählen Sie eine KI-Aktion und starten Sie die Prüfung.</p>
            <GovernanceCheckDemo />
          </>
        ),
      },
      {
        title: 'Start',
        body: (
          <>
            <h3>Der Einstieg ist kostenlos.</h3>
            <p>Starten Sie mit dem Free Audit – Sie sehen sofort, wo Ihre KI-Nutzung Lücken hat.</p>
            <div className="pm-cta">
              <Link className="btn" to={COMPANY_LINKS.audit}>
                Free Audit starten
              </Link>
              <Link className="btn quiet" to={COMPANY_LINKS.platform}>
                Zur Plattform
              </Link>
              {contactLink('Fragen? Kontakt')}
            </div>
          </>
        ),
      },
    ],
    [
      {
        title: 'Überblick',
        body: (
          <>
            <h3>Damit kein Anruf verloren geht.</h3>
            <p>
              Sie stehen auf der Baustelle, in der Behandlung oder am Herd? Der Voice Agent soll ans Telefon gehen, das Anliegen verstehen
              und es an Sie weitergeben – auch nach Feierabend. Heute legen Sie im Onboarding Branche, Stimme und Freigaben fest.
            </p>
            <F3 items={[['Annehmen', 'auch außerhalb der Öffnungszeiten'], ['Notieren', 'Anliegen, Termine, Rückrufe'], ['Übergeben', 'Notfälle sofort an Menschen']]} />
            <p className="note">{VOICE_TELEPHONY_NOTE ? `Preview · ${VOICE_TELEPHONY_NOTE}` : 'Preview'}</p>
          </>
        ),
      },
      {
        title: 'Leistungen',
        body: (
          <>
            <h3>Was der Agent kann – und was nicht</h3>
            <ul className="plist">
              <li>
                Gibt sich zu Beginn als <strong>KI</strong> zu erkennen
              </li>
              <li>Nimmt Anliegen, Terminwünsche und Rückrufe auf</li>
              <li>
                Macht <strong>keine Zusagen</strong> – Ihr Team bestätigt
              </li>
              <li>
                <strong>Aufzeichnung</strong> standardmäßig aus
              </li>
              <li>Bei Gefahr: sofortige Übergabe an einen Menschen</li>
              <li>
                Acht Branchenvorlagen: Handwerk, Metzgerei, KFZ-Werkstatt, Gastronomie &amp; Bäckerei, Hausverwaltung, Kanzlei, Arztpraxis,
                Steuerberatung
              </li>
            </ul>
            {VOICE_TELEPHONY_NOTE && <p className="note">{VOICE_TELEPHONY_NOTE}</p>}
          </>
        ),
      },
      {
        title: 'Pakete',
        body: (
          <>
            <h3>Drei Pakete für Ihren Betrieb</h3>
            <div className="pricegrid">
              <div>
                <b>Starter</b>
                <em>Web-Agent</em>
              </div>
              <div className="hot">
                <b>Professional</b>
                <em>Web + Telefonie</em>
              </div>
              <div>
                <b>Kanzlei</b>
                <em>Erhöhter Datenschutz</em>
              </div>
            </div>
            <p className="note">Leistungen im Onboarding{VOICE_TELEPHONY_NOTE ? ` · ${VOICE_TELEPHONY_NOTE}` : ''}</p>
            <p className="note" data-testid="voice-tax-note">
              {COMPANY_TAX_NOTE}
            </p>
            <div className="pm-cta">
              <a className="btn" href={COMPANY_LINKS.voiceOnboarding} target="_blank" rel="noopener noreferrer">
                Pakete im Onboarding ansehen
              </a>
            </div>
          </>
        ),
      },
      {
        title: 'Anruf testen',
        body: (
          <>
            <h3>Ein Anruf, wie ihn der Agent führt</h3>
            <VoiceCallDemo />
          </>
        ),
      },
      {
        title: 'Einrichten',
        body: (
          <>
            <h3>Ihr Agent in vier Schritten</h3>
            <VoiceOnboarding />
          </>
        ),
      },
    ],
    [
      {
        title: 'Überblick',
        body: (
          <>
            <h3>Ihre Webseite, fertig.</h3>
            <p>
              Keine Agentur, kein Monate-Projekt: Sie wählen eine Vorlage für Ihre Branche, wir passen sie an Ihren Betrieb an – oder Sie
              bauen selbst im Builder.
            </p>
            <F3 items={[['Fertig', 'mit Impressum und Datenschutz'], ['Zwei Wege', 'von uns gesetzt oder selbst gebaut'], ['Mit Bot', 'Telefon oder WhatsApp, auf Wunsch']]} />
          </>
        ),
      },
      {
        title: 'Vorlagen',
        body: (
          <>
            <h3>Suchen Sie sich Ihre Vorlage aus</h3>
            <TemplatePicker onRequest={onTemplateRequest} />
          </>
        ),
      },
      {
        title: 'Vorschau',
        body: (
          <>
            <h3>So entsteht der Rahmen</h3>
            <BuilderPreview />
          </>
        ),
      },
      {
        title: 'Ablauf',
        body: (
          <>
            <h3>Vom Wunsch zur Seite</h3>
            <Steps
              items={[
                ['Vorlage wählen', 'Branche aussuchen, Bausteine festlegen.'],
                ['Wenige Fragen', 'Projektart, Umfang und Timing in wenigen Klicks.'],
                ['Festangebot', 'Sie erhalten Preis und Zeitplan – dann setzen wir um.'],
              ]}
            />
            <div className="pm-cta">
              <Link className="btn" to={COMPANY_LINKS.builder}>
                Zum Builder
              </Link>
              {contactLink('Seite anfragen')}
            </div>
          </>
        ),
      },
    ],
  ];
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ProductModal({ tab: initialTab, page: initialPage = 0, onClose, onTemplateRequest }: ProductModalProps) {
  const [tab, setTab] = useState(initialTab);
  const [pages, setPages] = useState<number[]>(() => COMPANY_PRODUCTS.map((_, i) => (i === initialTab ? initialPage : 0)));
  const boxRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const content = buildPages(
    () => onClose('kontakt'),
    (name) => {
      onTemplateRequest(name);
      onClose('kontakt');
    },
  );
  const cur = pages[tab];
  const list = content[tab];
  const count = list.length;

  const setPage = useCallback(
    (n: number) => {
      setPages((ps) => ps.map((p, i) => (i === tab ? Math.max(0, Math.min(count - 1, n)) : p)));
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    },
    [tab, count],
  );

  const selectTab = useCallback((i: number, focus = false) => {
    const n = (i + COMPANY_PRODUCTS.length) % COMPANY_PRODUCTS.length;
    setTab(n);
    if (focus) tabRefs.current[n]?.focus();
  }, []);

  // Beim Öffnen: aktiven Produkt-Tab fokussieren, Scrollen der Seite sperren,
  // seitenweiten Assistenten-Chip ausblenden (läge sonst über dem Dialog).
  useEffect(() => {
    tabRefs.current[initialTab]?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const releaseAssistant = suppressAssistant();
    return () => {
      document.body.style.overflow = prev;
      releaseAssistant();
    };
  }, [initialTab]);

  // Nur per Tab erreichbare Elemente im Dialog. Inaktive Tabs (Roving Tabindex,
  // tabIndex=-1) passen auf `button:not([disabled])`, zählen aber nicht.
  const tabbables = useCallback(
    () => (boxRef.current ? Array.from(boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0) : []),
    [],
  );

  // Fokus nicht verlieren: Wird der fokussierte Pager-Button deaktiviert
  // (erste/letzte Seite), wandert der Fokus sonst auf <body> und der nächste
  // Tab verließe den modalen Dialog. Dann auf den anderen Pager-Button setzen.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const a = document.activeElement as HTMLElement | null;
    const onBody = !a || a === document.body;
    const disabledInside = !!a && box.contains(a) && (a as HTMLButtonElement).disabled === true;
    if (!onBody && !disabledInside) return;
    const target = [nextRef.current, prevRef.current].find((b) => b && !b.disabled) ?? tabRefs.current[tab];
    target?.focus();
  }, [tab, cur]);

  // Esc und ←/→ auf Dokumentebene wie in der Referenz: Ein Klick auf Text im
  // Dialog setzt den Fokus auf <body>, die Tasten sollen trotzdem greifen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Tab bei Fokus außerhalb des Dialogs (z. B. <body> nach Klick auf Text)
      // oder auf einem deaktivierten Element: in den Dialog zurückholen.
      if (e.key === 'Tab' && boxRef.current) {
        const a = document.activeElement as HTMLElement | null;
        const outside = !a || !boxRef.current.contains(a) || (a as HTMLButtonElement).disabled === true;
        if (outside) {
          const f = tabbables();
          if (f.length > 0) {
            e.preventDefault();
            (e.shiftKey ? f[f.length - 1] : f[0]).focus();
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const target = e.target as HTMLElement | null;
      // Eingabefelder und das Voice-Onboarding (eigene Schritt-Navigation mit
      // Formular) behalten die Pfeiltasten; dort wird nicht geblättert.
      if (target?.closest?.('input, textarea, select, .onb')) return;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      e.preventDefault();
      if (target?.closest?.('.pm-tabs')) selectTab(tab + dir, true);
      else setPage(cur + dir);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, selectTab, setPage, tab, cur, tabbables]);

  // Fokusfalle: Tab/Shift+Tab bleiben im Dialog. Nur per Tab erreichbare
  // Elemente zählen: Inaktive Tabs (Roving Tabindex, tabIndex=-1) passen auf
  // `button:not([disabled])`, wären sonst „erstes“ Element und Shift+Tab vom
  // tatsächlich ersten Element liefe aus dem Dialog.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && boxRef.current) {
      const f = tabbables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="pm open"
      role="dialog"
      aria-modal="true"
      aria-label="Produkte im Detail"
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pm-box" ref={boxRef}>
        <div className="pm-top">
          <div className="pm-tabs" role="tablist" aria-label="Produkte">
            {COMPANY_PRODUCTS.map((p, i) => (
              <button
                key={p.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`pm-tab-${i}`}
                aria-selected={i === tab}
                aria-controls={`pm-panel-${i}`}
                tabIndex={i === tab ? 0 : -1}
                onClick={() => selectTab(i)}
              >
                {p.tabName}
              </button>
            ))}
          </div>
          <button className="pm-x" type="button" aria-label="Schließen" onClick={() => onClose()}>
            ×
          </button>
        </div>
        <div className="pm-pane on" role="tabpanel" id={`pm-panel-${tab}`} aria-labelledby={`pm-tab-${tab}`}>
          <div className="pgnav" role="tablist" aria-label={`${COMPANY_PRODUCTS[tab].tabName}: Seiten`}>
            {list.map((pg, k) => (
              <button
                key={pg.title}
                type="button"
                role="tab"
                id={`pm-pg-${tab}-${k}`}
                aria-selected={k === cur}
                aria-controls={`pm-pgpanel-${tab}`}
                onClick={() => setPage(k)}
              >
                {pg.title}
              </button>
            ))}
          </div>
          <div className="pgbody" ref={bodyRef}>
            <section key={`${tab}-${cur}`} className="pg on" id={`pm-pgpanel-${tab}`} aria-labelledby={`pm-pg-${tab}-${cur}`} data-testid="pm-page">
              {list[cur].body}
            </section>
          </div>
          <div className="pager">
            <button ref={prevRef} className="btn quiet" type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
              ← Zurück
            </button>
            <span className="pgct" aria-live="polite">
              {cur + 1} / {list.length}
            </span>
            <button ref={nextRef} className="btn" type="button" disabled={cur === list.length - 1} onClick={() => setPage(cur + 1)}>
              Weiter →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
