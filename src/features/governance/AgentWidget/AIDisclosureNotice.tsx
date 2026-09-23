// EU AI Act Art. 50 compliance: Transparency notice for users interacting with AI systems.
// This component ensures users are clearly informed they are interacting with an AI
// before or immediately upon opening the chatbot. See /legal/datenschutz#ki-systeme
// for the full disclosure text (Art. 50 EU-KI-VO).

interface AIDisclosureNoticeProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function AIDisclosureNotice({ variant = 'compact', className = '' }: AIDisclosureNoticeProps) {
  // Compact (default for anon mobile sheet): one line + legal link. Full legal
  // text stays at /legal/datenschutz#ki-systeme — Art. 50 transparency without
  // eating the chat viewport.
  if (variant === 'full') {
    return (
      <div className={`border-b border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[13px] ${className}`}>
        <div className="flex items-start gap-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold text-amber-200">Interaktion mit einem KI-System</p>
            <p className="mt-1 text-zinc-300">
              Sie interagieren mit einem automatisierten KI-System (Sprachmodell). Die Antworten werden von einer KI generiert und können Fehler enthalten. Dies ist keine Rechtsberatung — alle Ausgaben verstehen sich als Entwurf und erfordern eigenverantwortliche fachliche Prüfung (Human-in-the-Loop).{' '}
              <a href="/legal/datenschutz#ki-systeme" className="underline decoration-amber-400/50 hover:text-amber-100">
                KI-Transparenzerklärung
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-b border-amber-400/20 bg-amber-400/8 px-3 py-2 text-[11px] leading-snug text-zinc-300 ${className}`}
      role="note"
    >
      <span className="font-semibold text-amber-200">KI-System · keine Rechtsberatung.</span>{' '}
      <a
        href="/legal/datenschutz#ki-systeme"
        className="underline decoration-amber-400/40 underline-offset-2 hover:text-amber-100"
      >
        Mehr erfahren
      </a>
    </div>
  );
}
