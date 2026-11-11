import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BETA } from '../../../config/beta';
import { acceptClientFacts } from '../../../lib/company-voice/allowlist';
import { answerCompanyQuestion } from '../../../lib/company-voice/answer';
import { curatedFacts } from '../../../lib/company-voice/facts';
import {
  createRecognition,
  elevenLabsFlagFromEnv,
  microphoneAllowed,
  selectVoiceOutput,
  speakGerman,
  stopSpeaking,
  type BrowserSpeechRecognition,
} from '../../../lib/company-voice/speech';
import {
  COMPANY_VOICE_DISCLAIMER,
  type AnswerContext,
  type CompanyAnswer,
  type FactsSource,
  type PublicFact,
} from '../../../lib/company-voice/types';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const INTRO =
  'Demo. Fragen zu RealSyncDynamics.AI beantworte ich nur aus freigegebenen Unternehmensinfos. Keine Rechtsberatung und keine Konformitätszusage. Tippen Sie eine Frage, oder nutzen Sie das Mikrofon nach dem Hinweis.';

const NOTICE =
  'Das Mikrofon startet erst nach diesem Hinweis. Die Spracheingabe nutzt die Web-Speech-Schnittstelle des Browsers. Der Browserhersteller kann die Aufnahme verarbeiten. Diese Seite speichert kein Audio, kein Transkript und setzt dafür kein Tracking. Sie können stattdessen tippen.';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  link?: CompanyAnswer['link'];
}

function betaContext(): AnswerContext {
  return {
    publicBeta: BETA.active && BETA.publicOffer,
    betaEndsLabel: BETA.endsLabel,
  };
}

export function CompanyVoiceWidget() {
  const titleId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLOListElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [open, setOpen] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [input, setInput] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [speechInput, setSpeechInput] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [facts, setFacts] = useState<PublicFact[]>(() => curatedFacts());
  const [source, setSource] = useState<FactsSource>('curated');
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', text: INTRO }]);
  const voice = selectVoiceOutput({
    elevenLabsEnabled: elevenLabsFlagFromEnv(import.meta.env.VITE_ELEVENLABS_BROWSER_ENABLED),
  });

  useEffect(() => {
    setSpeechInput(createRecognition() !== null && microphoneAllowed());
    setMicBlocked(!microphoneAllowed());
  }, []);

  useEffect(() => {
    const list = transcriptRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [turns, interim, open]);

  useEffect(() => {
    if (!open) return undefined;
    const trigger = launcherRef.current;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener('keydown', onKey as unknown as EventListener);
    return () => {
      dialog?.removeEventListener('keydown', onKey as unknown as EventListener);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setListening(false);
      stopSpeaking(window.speechSynthesis);
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/company-voice', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('status');
        const body: unknown = await response.json();
        const record = body && typeof body === 'object' ? (body as { facts?: unknown; source?: unknown }) : null;
        const accepted = acceptClientFacts(record?.facts);
        if (!accepted || cancelled) return;
        setFacts(accepted);
        setSource(record?.source === 'second-brain-staging' ? 'second-brain-staging' : 'curated');
      } catch {
        if (!cancelled) {
          setFacts(curatedFacts());
          setSource('curated');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const speak = (text: string) => {
    if (voice.engine !== 'web-speech') return;
    speakGerman(text, typeof window !== 'undefined' ? window.speechSynthesis : null);
  };

  const submit = (raw: string) => {
    const question = raw.trim().slice(0, 500);
    if (!question) return;
    const result = answerCompanyQuestion(question, facts, betaContext());
    setTurns((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: result.text, link: result.link }]);
    setInput('');
    setInterim('');
    speak(result.text);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(input);
  };

  const startMic = () => {
    if (!noticeAccepted) return;
    const recognition = createRecognition();
    if (!recognition) return;
    recognitionRef.current?.abort();
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      let finalText = '';
      let live = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index]?.[0]?.transcript ?? '';
        if (event.results[index]?.isFinal) finalText += piece;
        else live += piece;
      }
      if (live) setInterim(live);
      if (finalText.trim()) submit(finalText);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setInterim('');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setMicBlocked(true);
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stopMic = () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
  };

  const sourceLabel = source === 'second-brain-staging' ? 'Second Brain (Staging)' : 'kuratierte Fakten';

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="lv6-voice-launcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="company-voice-dialog"
        data-testid="company-voice-launcher"
        onClick={() => setOpen(true)}
      >
        <span className="lv6-voice-badge">Demo</span>
        <span>Fragen</span>
      </button>
      {open ? (
        <div
          ref={dialogRef}
          id="company-voice-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="lv6-voice-panel"
          data-testid="company-voice-panel"
        >
          <div className="lv6-voice-head">
            <div>
              <span className="lv6-voice-badge">Demo</span>
              <h2 id={titleId} className="lv6-voice-title">Fragen zum Unternehmen</h2>
              <p className="lv6-voice-meta">Quelle: {sourceLabel}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Demo schließen">
              Schließen
            </button>
          </div>
          <p className="lv6-voice-note">{COMPANY_VOICE_DISCLAIMER}</p>
          <ol ref={transcriptRef} className="lv6-voice-transcript" aria-live="polite" aria-relevant="additions" aria-label="Transkript">
            {turns.map((turn, index) => (
              <li key={`${turn.role}-${index}`} className="lv6-voice-turn">
                <span>{turn.role === 'user' ? 'Sie' : 'Untertitel'}</span>
                {turn.text}
                {turn.link ? (
                  <>
                    {' '}
                    {turn.link.href.startsWith('#') ? (
                      <a href={turn.link.href}>{turn.link.label}</a>
                    ) : (
                      <Link to={turn.link.href}>{turn.link.label}</Link>
                    )}
                  </>
                ) : null}
              </li>
            ))}
            {interim ? (
              <li className="lv6-voice-turn">
                <span>Sie, vorläufig</span>
                {interim}
              </li>
            ) : null}
          </ol>
          <div className="lv6-voice-note">
            {noticeAccepted ? (
              <p>Mikrofon nur für diese Sitzung. Kein Audio wird gespeichert.</p>
            ) : (
              <p>{NOTICE}</p>
            )}
            {voice.elevenLabs === 'not-bundled' ? (
              <p className="lv6-voice-status">Stimme bleibt die Web Speech API. ElevenLabs ist nicht eingebunden.</p>
            ) : null}
            <button type="button" onClick={() => setNoticeAccepted(true)} disabled={noticeAccepted}>
              {noticeAccepted ? 'Hinweis gelesen' : 'Hinweis gelesen, Mikrofon freigeben'}
            </button>
          </div>
          <form className="lv6-voice-form" onSubmit={onSubmit}>
            <input
              aria-label="Frage als Text"
              data-testid="company-voice-input"
              value={input}
              maxLength={500}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit">Antwort anzeigen</button>
            {speechInput && !micBlocked ? (
              <button
                type="button"
                onClick={listening ? stopMic : startMic}
                disabled={!noticeAccepted && !listening}
                aria-pressed={listening}
              >
                {listening ? 'Zuhören beenden' : 'Sprechen'}
              </button>
            ) : (
              <p className="lv6-voice-status">{micBlocked ? 'Spracheingabe ist auf dieser Seite gesperrt. Bitte tippen.' : 'Dieser Browser hat keine Spracheingabe. Bitte tippen.'}</p>
            )}
            <button type="button" onClick={() => stopSpeaking(window.speechSynthesis)}>
              Vorlesen stoppen
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
