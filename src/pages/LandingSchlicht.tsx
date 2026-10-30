import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { BETA, betaSignupHref } from '../config/beta';
import { COMPANY } from '../config/company';
import { useAnonChat } from '../features/governance/AgentWidget/useAgentChat';
import { ChatMessageView } from '../features/governance/AgentWidget/ChatMessageView';
import { AIDisclosureNotice } from '../features/governance/AgentWidget/AIDisclosureNotice';
import { AssistantRetry, UsRoutingBanner } from '../features/governance/AgentWidget/AssistantNotices';
import { ANON_QUICK } from '../features/governance/AgentWidget/ChatInput';

/**
 * Landing „Schlicht" — Vorschau unter /design/landing-schlicht (Owner-Wunsch
 * 29.10.2026: schlichtes Frontend im Stil von Grok).
 *
 * Eine Fläche, ein Eingabefeld: Die Seite ist der öffentliche Assistent selbst.
 * Kein Nachbau — dieselbe Laufzeit wie der Assistent-Chip (`useAnonChat`,
 * governance-agent op:'chat_anon', rate-limitiert und protokolliert), inklusive
 * KI-Hinweis nach Art. 50 EU-KI-VO, Limit-, US-Routing- und Retry-Hinweisen.
 *
 * `data-hero-cta` am Eingabefeld blendet den schwebenden Assistent-Chip aus,
 * damit nicht zwei Chats gleichzeitig sichtbar sind. `/` bleibt unverändert.
 */
const SOURCE = 'landing-schlicht';
const GOLD = '#e4cfa2';
const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'DM Mono', ui-monospace, monospace";

export function LandingSchlicht() {
  const chat = useAnonChat();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Begrüßung zählt nicht: erst die erste eigene Frage öffnet den Gesprächsmodus.
  const talking = chat.messages.length > 1;

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || chat.isLoading) return;
    void chat.send(message);
    setValue('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(value);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(value);
    }
  };

  const composer = (
    <form onSubmit={onSubmit} data-hero-cta className="w-full">
      <div
        className="flex items-end gap-2 border border-[rgba(228,207,162,0.28)] bg-[#0d0d10] p-2 transition-colors focus-within:border-[rgba(228,207,162,0.7)]"
      >
        <label htmlFor="schlicht-frage" className="sr-only">
          Frage an den KI-Assistenten
        </label>
        <textarea
          id="schlicht-frage"
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
          }}
          onKeyDown={onKey}
          placeholder="Frage stellen …"
          className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-[#ededee] placeholder:text-[#71717a] focus:outline-none"
          disabled={chat.isLoading}
        />
        <button
          type="submit"
          aria-label="Frage senden"
          disabled={!value.trim() || chat.isLoading}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-black transition-opacity disabled:opacity-30"
          style={{ backgroundColor: GOLD }}
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#050506] text-[#ededee] antialiased">
      <SEOHead />

      <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label={`${COMPANY.companyName} – Startseite`}>
          <picture>
            <source srcSet="/brand/rsd-gold-mark-256.webp" type="image/webp" />
            <img src="/brand/rsd-gold-mark-256.png" alt="" width={28} height={28} className="h-7 w-7" />
          </picture>
          <span className="text-[15px] font-semibold tracking-tight" style={{ fontFamily: FONT_DISPLAY }}>
            {COMPANY.companyName}
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px] text-[#97979b]" style={{ fontFamily: FONT_MONO }}>
          {talking && (
            <button
              type="button"
              onClick={chat.reset}
              className="flex items-center gap-1.5 transition-colors hover:text-[#ededee]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Neu
            </button>
          )}
          <Link to="/pricing" className="transition-colors hover:text-[#ededee]">
            Preise
          </Link>
          <Link to="/welcome" className="transition-colors hover:text-[#ededee]">
            Anmelden
          </Link>
        </nav>
      </header>

      {talking ? (
        <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-4 sm:px-6">
          <div className="flex-1 space-y-4 py-4" aria-live="polite">
            {chat.messages.map((m) => (
              <ChatMessageView key={m.id} message={m} />
            ))}
            {chat.canRetry && <AssistantRetry onRetry={() => void chat.retry()} />}
            <div ref={chat.bottomRef} />
          </div>
          <div className="sticky bottom-0 bg-[#050506] pb-4 pt-2">
            {chat.rateLimited && (
              <p className="mb-2 border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-[12px] text-orange-200">
                Anfrage-Limit erreicht (5/min). Bitte in einer Minute erneut versuchen.
              </p>
            )}
            {chat.usRoutingRequired && (
              <div className="mb-2">
                <UsRoutingBanner onAck={() => void chat.acknowledgeUsRouting()} />
              </div>
            )}
            {composer}
            <AIDisclosureNotice variant="compact" className="mt-2" />
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6">
          <picture>
            <source srcSet="/brand/rsd-gold-mark-256.webp" type="image/webp" />
            <img
              src="/brand/rsd-gold-mark-256.png"
              alt=""
              width={96}
              height={96}
              className="mb-6 h-20 w-20 sm:h-24 sm:w-24"
            />
          </picture>
          <h1
            className="mb-3 text-center text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            Was möchten Sie wissen?
          </h1>
          <p className="mb-8 max-w-xl text-center text-[15px] leading-relaxed text-[#97979b]">
            KI-Mitarbeiter mit eingebauter Governance für Betriebe mit Kundenkontakt. Fragen Sie
            unseren öffentlichen Assistenten zu DSGVO und EU AI Act.
          </p>

          {chat.rateLimited && (
            <p className="mb-2 w-full border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-[12px] text-orange-200">
              Anfrage-Limit erreicht (5/min). Bitte in einer Minute erneut versuchen.
            </p>
          )}
          {chat.usRoutingRequired && (
            <div className="mb-2 w-full">
              <UsRoutingBanner onAck={() => void chat.acknowledgeUsRouting()} />
            </div>
          )}
          {composer}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {ANON_QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => submit(q.text)}
                disabled={chat.isLoading}
                className="border px-3 py-1.5 text-[12px] text-[#c2c2c4] transition-colors hover:text-[#ededee] disabled:opacity-40"
                style={{ borderColor: 'rgba(228, 207, 162, 0.22)', fontFamily: FONT_MONO }}
              >
                {q.label}
              </button>
            ))}
          </div>

          <AIDisclosureNotice variant="compact" className="mt-6 w-full text-center" />

          {BETA.active && BETA.publicOffer && (
            <Link
              to={betaSignupHref(BETA.testPlan, SOURCE)}
              className="mt-8 text-[13px] underline-offset-4 hover:underline"
              style={{ color: GOLD, fontFamily: FONT_MONO }}
            >
              Offene Beta · Kostenlos testen →
            </Link>
          )}
        </main>
      )}

      <footer
        className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-4 text-[11px] text-[#71717a]"
        style={{ fontFamily: FONT_MONO }}
      >
        <span>
          © {new Date().getFullYear()} {COMPANY.companyName} · {COMPANY.legalForm}
        </span>
        <Link to="/legal/impressum" className="hover:text-[#c2c2c4]">
          Impressum
        </Link>
        <Link to="/legal/datenschutz" className="hover:text-[#c2c2c4]">
          Datenschutz
        </Link>
      </footer>
    </div>
  );
}
