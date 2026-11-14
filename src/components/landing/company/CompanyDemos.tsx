import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COMPANY_LINKS } from './companyProducts';

/**
 * Interaktive Demos im Produkt-Dialog der Unternehmens-Landing v5.
 * Alles läuft im Browser; es werden keine Daten gesendet. Timer werden beim
 * Seiten-/Tab-Wechsel (Unmount) und beim Schließen verworfen.
 */

function useTimers() {
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => clear, []);
  return { clear, later };
}

function Segs({ label, options, value, onChange }: { label: string; options: readonly string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="segs" role="group" aria-label={label}>
      {options.map((o, i) => (
        <button key={o} type="button" aria-pressed={i === value} onClick={() => onChange(i)}>
          {o}
        </button>
      ))}
    </div>
  );
}

// ── Governance: Prüfung live erleben ─────────────────────────────────────────

const CHECKS = ['Mandant', 'Berechtigung', 'Einwilligung', 'Risiko'] as const;
const SCENARIOS = ['Kundendaten exportieren', 'Terminbestätigung senden', 'Rechnung über 5.000 € freigeben'] as const;
/** 1 = ok, 0 = blockiert, 2 = Mensch erforderlich (Referenz `SC`). */
const SCENARIO_RESULTS: readonly (readonly number[])[] = [
  [1, 1, 0, 0],
  [1, 1, 1, 1],
  [1, 1, 1, 2],
];
const VERDICTS = ['Blockiert – keine Einwilligung für Export.', 'Freigegeben – Aktion ausgeführt.', 'Mensch erforderlich – Vier-Augen-Prinzip.'] as const;

type CheckState = { cls: '' | 'wait' | 'ok' | 'no'; mark: string };
const IDLE: CheckState[] = CHECKS.map(() => ({ cls: '', mark: '–' }));

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function GovernanceCheckDemo() {
  const [sel, setSel] = useState(0);
  const [rows, setRows] = useState<CheckState[]>(IDLE);
  const [verdict, setVerdict] = useState('');
  const [hash, setHash] = useState('');
  const { clear, later } = useTimers();

  const reset = () => {
    clear();
    setRows(IDLE);
    setVerdict('');
    setHash('');
  };

  const run = () => {
    reset();
    const s = SCENARIO_RESULTS[sel];
    let stop = false;
    CHECKS.forEach((_, i) =>
      later(() => {
        if (stop) return;
        setRows((r) => r.map((x, k) => (k === i ? { cls: 'wait', mark: '…' } : x)));
        later(() => {
          const res = s[i] === 1 ? 'ok' : s[i] === 0 ? 'no' : 'wait';
          setRows((r) => r.map((x, k) => (k === i ? { cls: res, mark: res === 'ok' ? '✓' : res === 'no' ? '✕' : '!' } : x)));
          if (res !== 'ok') stop = true;
        }, 380);
      }, i * 700),
    );
    later(() => {
      setVerdict(VERDICTS[s.includes(0) ? 0 : s.includes(2) ? 2 : 1]);
      setHash('EVIDENCE · SHA-256 ' + randomHex(8) + '…');
    }, 3300);
  };

  return (
    <>
      <Segs
        label="KI-Aktion wählen"
        options={SCENARIOS}
        value={sel}
        onChange={(i) => {
          setSel(i);
          reset();
        }}
      />
      <div className="pm-stage">
        <div className="chk" data-testid="gov-checks">
          {CHECKS.map((c, i) => (
            <CheckRow key={c} label={c} state={rows[i]} />
          ))}
        </div>
        <div className="verdict" role="status" aria-live="polite">
          {verdict}
        </div>
        <div className="hash">{hash}</div>
      </div>
      <p className="note">Simulation im Browser · es werden keine Daten gesendet</p>
      <div className="pm-cta">
        <button className="btn" type="button" onClick={run}>
          Prüfung starten
        </button>
      </div>
    </>
  );
}

function CheckRow({ label, state }: { label: string; state: CheckState }) {
  return (
    <>
      <div className={state.cls || undefined}>{label}</div>
      <span className={state.cls === 'wait' && state.mark === '…' ? undefined : state.cls || undefined}>{state.mark}</span>
    </>
  );
}

// ── Voice: Ein Anruf, wie ihn der Agent führt ────────────────────────────────

type Line = readonly ['c' | 'a' | 'sys', string];
const CALL_BRANCHES = ['Heizungsbau', 'Arztpraxis', 'Restaurant'] as const;
const CALLS: readonly (readonly Line[])[] = [
  [
    ['c', 'Hallo, bei mir ist die Heizung ausgefallen – und es riecht nach Gas.'],
    ['a', 'Hier ist der KI-Assistent von Heizungsbau Rennsteig. Bitte verlassen Sie sofort das Gebäude und rufen Sie die 112.'],
    ['sys', 'GEFAHR ERKANNT · ÜBERGABE AN BEREITSCHAFT'],
  ],
  [
    ['c', 'Ich bräuchte nächste Woche einen Termin.'],
    ['a', 'Ich bin ein KI-Assistent der Praxis. Terminzusagen kann ich nicht geben – ich notiere Ihren Wunsch und die Praxis ruft zurück.'],
    ['sys', 'RÜCKRUF NOTIERT · KEINE AUFZEICHNUNG'],
  ],
  [
    ['c', 'Habt ihr heute Abend noch einen Tisch für vier?'],
    ['a', 'Ich bin der KI-Assistent des Hauses. Ich nehme Ihre Anfrage für vier Personen auf – das Team bestätigt Ihnen den Tisch.'],
    ['sys', 'ANFRAGE AUFGENOMMEN · BESTÄTIGUNG DURCH MENSCH'],
  ],
];

export function VoiceCallDemo() {
  const [sel, setSel] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const { clear, later } = useTimers();

  const run = () => {
    clear();
    setLines([]);
    CALLS[sel].forEach((l, i) => later(() => setLines((ls) => [...ls, l]), i * 1500 + 200));
  };

  return (
    <>
      <Segs
        label="Branche wählen"
        options={CALL_BRANCHES}
        value={sel}
        onChange={(i) => {
          setSel(i);
          clear();
          setLines([]);
        }}
      />
      <div className="pm-stage" style={{ alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <div className="chat" aria-live="polite">
          {lines.map(([t, x], i) => (
            <p key={i} className={t}>
              {x}
            </p>
          ))}
        </div>
      </div>
      <p className="note">Beispielgespräch · Betriebsnamen sind fiktiv</p>
      <div className="pm-cta">
        <button className="btn" type="button" onClick={run}>
          Anruf starten
        </button>
      </div>
    </>
  );
}

// ── Voice: Onboarding in vier Schritten ──────────────────────────────────────

const BRANCHEN = ['Handwerk', 'Metzgerei', 'KFZ-Werkstatt', 'Gastronomie & Bäckerei', 'Hausverwaltung', 'Kanzlei', 'Arztpraxis', 'Steuerberatung'] as const;
/** Paketnamen der Onboarding-Seite; Preise nur dort (nicht in shared/pricing.ts). */
const PAKETE = ['Starter', 'Professional', 'Kanzlei'] as const;
const KANAELE = ['Web', 'Telefonie + Web'] as const;
const STIMMEN = ['Eve', 'Castor', 'Atlas', 'Celeste', 'Ursa', 'Rigel'] as const;
const ONB_STEPS = ['Branche', 'Betrieb', 'Stimme', 'Freigabe'] as const;
const WAVE = [
  ['18px', '0s'],
  ['34px', '-.2s'],
  ['26px', '-.5s'],
  ['40px', '-.1s'],
  ['22px', '-.7s'],
  ['36px', '-.3s'],
  ['16px', '-.9s'],
  ['30px', '-.4s'],
  ['24px', '-.6s'],
] as const;

export function VoiceOnboarding() {
  const [step, setStep] = useState(0);
  const [branche, setBranche] = useState(0);
  const [paket, setPaket] = useState(1);
  const [kanal, setKanal] = useState(1);
  const [stimme, setStimme] = useState(0);
  const go = (n: number) => setStep(Math.max(0, Math.min(3, n)));

  return (
    <div className="onb">
      <div className="onb-steps" role="tablist" aria-label="Einrichtung">
        {ONB_STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            id={`onb-tab-${i}`}
            aria-selected={i === step}
            aria-controls={`onb-panel-${i}`}
            className={i < step ? 'done' : undefined}
            onClick={() => go(i)}
          >
            <b>{String(i + 1).padStart(2, '0')}</b>
            <span>{s}</span>
          </button>
        ))}
      </div>
      {step === 0 && (
        <div className="onb-body on" role="tabpanel" id="onb-panel-0" aria-labelledby="onb-tab-0">
          <h3>Welche Branche?</h3>
          <p>Die Vorlage bestimmt, was der Agent darf – und wann er sofort an einen Menschen übergibt.</p>
          <Segs label="Branche" options={BRANCHEN} value={branche} onChange={setBranche} />
          <span className="seal">
            <i />
            Kanzlei · Praxis · Steuerberatung: erhöhte Stufe, Datenschutzprüfung Pflicht
          </span>
          <div className="onb-foot">
            <button className="btn" type="button" onClick={() => go(1)}>
              Weiter
            </button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="onb-body on" role="tabpanel" id="onb-panel-1" aria-labelledby="onb-tab-1">
          <h3>Betrieb &amp; Paket</h3>
          <div className="field">
            <label htmlFor="onb-name">Betriebsname</label>
            <input id="onb-name" type="text" placeholder="SHK Meisterbetrieb Rennsteig" autoComplete="organization" />
          </div>
          <div className="field">
            <label htmlFor="onb-num">Übergabe-Kontakt (Mensch)</label>
            <input id="onb-num" type="tel" placeholder="Bereitschaftsdienst +49 3679 ···" autoComplete="tel" />
          </div>
          <Segs label="Paket" options={PAKETE} value={paket} onChange={setPaket} />
          <Segs label="Kanal" options={KANAELE} value={kanal} onChange={setKanal} />
          <div className="onb-foot">
            <button className="btn quiet" type="button" onClick={() => go(0)}>
              Zurück
            </button>
            <button className="btn" type="button" onClick={() => go(2)}>
              Weiter
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="onb-body on" role="tabpanel" id="onb-panel-2" aria-labelledby="onb-tab-2">
          <h3>Wie soll der Agent klingen?</h3>
          <div className="wave" aria-hidden="true">
            {WAVE.map(([h, d], i) => (
              <i key={i} style={{ ['--h' as string]: h, animationDelay: d } as CSSProperties} />
            ))}
          </div>
          <Segs label="Stimme" options={STIMMEN} value={stimme} onChange={setStimme} />
          <p>Sechs empfohlene von 28 Grok-Stimmen – alle sprechen Deutsch.</p>
          <div className="onb-foot">
            <button className="btn quiet" type="button" onClick={() => go(1)}>
              Zurück
            </button>
            <button className="btn" type="button" onClick={() => go(3)}>
              Weiter
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="onb-body on" role="tabpanel" id="onb-panel-3" aria-labelledby="onb-tab-3">
          <h3>Freigaben &amp; Start</h3>
          <div className="summary">
            <div>
              <b>Branche</b>
              <span>{BRANCHEN[branche]}</span>
            </div>
            <div>
              <b>Paket</b>
              <span>{PAKETE[paket]}</span>
            </div>
            <div>
              <b>Stimme</b>
              <span>{STIMMEN[stimme]}</span>
            </div>
            <div>
              <b>Kanal</b>
              <span>{KANAELE[kanal]}</span>
            </div>
          </div>
          <span className="seal">
            <i />
            KI-Offenlegung in der Begrüßung · Aufzeichnung standardmäßig aus · Fail-Closed
          </span>
          <div className="onb-foot">
            <button className="btn quiet" type="button" onClick={() => go(2)}>
              Zurück
            </button>
            <a className="btn" href={COMPANY_LINKS.voiceOnboarding} target="_blank" rel="noopener noreferrer">
              Onboarding fortsetzen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Builder: Vorlage wählen ──────────────────────────────────────────────────

const TEMPLATES = [
  { id: 'gastro', name: 'Gastronomie', text: 'Speisekarte, Bestellung, Reservierung', tags: 'Restaurant · Imbiss · Café' },
  { id: 'handwerk', name: 'Handwerk', text: 'Leistungen, Notdienst, Anfrage-Formular', tags: 'Heizung · Elektro · Bau' },
  { id: 'praxis', name: 'Praxis & Kanzlei', text: 'Terminanfrage, Team, Fachgebiete', tags: 'Arzt · Recht · Steuer' },
] as const;

export function TemplatePicker({ onRequest }: { onRequest: (templateName: string | null) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const name = sel === null ? null : TEMPLATES[sel].name;
  return (
    <>
      <div className="gal">
        {TEMPLATES.map((t, i) => (
          <button key={t.id} className="gref tpl" type="button" aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)}>
            <span className="plate gplate">
              <span className="gph">Vorschau folgt</span>
            </span>
            <b>{t.name}</b>
            <span>{t.text}</span>
            <em>{t.tags}</em>
            <i className="pk">Vorlage wählen</i>
          </button>
        ))}
      </div>
      <div className="tpl-cta">
        <p aria-live="polite">{name ? `Gewählt: Vorlage „${name}“.` : 'Noch keine Vorlage gewählt.'}</p>
        <a
          className="btn"
          href="#kontakt"
          onClick={(e) => {
            e.preventDefault();
            onRequest(name);
          }}
        >
          {name ? `Vorlage „${name}“ anfragen` : 'Vorlage anfragen'}
        </a>
      </div>
    </>
  );
}

// ── Builder: So entsteht der Rahmen ──────────────────────────────────────────

const BUILDS = [
  { pick: 'Restaurant', h: 'Ihr Restaurant', s: 'Speisekarte · Bestellung · Reservierung', blocks: ['Speisekarte', 'Kontakt', 'WhatsApp-Bot'] },
  { pick: 'Handwerk', h: 'Ihr Handwerksbetrieb', s: 'Meisterbetrieb in Ihrer Region', blocks: ['Leistungen', 'Kontakt', 'Notdienst-Bot'] },
  { pick: 'Kanzlei', h: 'Ihre Praxis oder Kanzlei', s: 'Termin anfragen · Team · Fachgebiete', blocks: ['Rechtsgebiete', 'Kontakt', 'Terminbuchung'] },
] as const;

export function BuilderPreview() {
  const [bi, setBi] = useState(0);
  const [on, setOn] = useState<boolean[]>([true, true, false]);
  const b = BUILDS[bi];
  return (
    <>
      <Segs label="Branche" options={BUILDS.map((x) => x.pick)} value={bi} onChange={setBi} />
      <div className="mock" aria-label="Vorschau der Seite">
        <div className="bar" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="mh">
          <b>{b.h}</b>
          <span>{b.s}</span>
        </div>
        <div className="mb">
          {b.blocks.map((n, i) => (
            <div key={n} className={on[i] ? 'on' : undefined}>
              {n}
            </div>
          ))}
        </div>
      </div>
      <div className="segs" role="group" aria-label="Bausteine">
        {b.blocks.map((n, i) => (
          <button key={n} type="button" aria-pressed={on[i]} onClick={() => setOn((o) => o.map((v, k) => (k === i ? !v : v)))}>
            {n}
          </button>
        ))}
      </div>
    </>
  );
}
