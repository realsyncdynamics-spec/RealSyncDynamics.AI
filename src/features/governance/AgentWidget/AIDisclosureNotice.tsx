// EU AI Act Art. 50 compliance: Transparency notice for users interacting with AI systems.
// This component ensures users are clearly informed they are interacting with an AI
// before or immediately upon opening the chatbot. See /legal/datenschutz#ki-systeme
// for the full disclosure text (Art. 50 EU-KI-VO).

interface AIDisclosureNoticeProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function AIDisclosureNotice({ variant = 'compact', className = '' }: AIDisclosureNoticeProps) {
  if (variant === 'full') {
    return (
      <div className={`border-b border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-[13px] ${className}`}>
        <div className="flex items-start gap-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold text-cyan-300">Interaktion mit einem KI-System</p>
            <p className="mt-1 text-cyan-200/85">
              Sie interagieren mit einem automatisierten KI-System (Sprachmodell). Die Antworten werden von einer KI generiert und können Fehler enthalten. Dies ist keine Rechtsberatung — alle Ausgaben verstehen sich als Entwurf und erfordern eigenverantwortliche fachliche Prüfung (Human-in-the-Loop).{' '}
              <a href="/legal/datenschutz#ki-systeme" className="underline decoration-cyan-500/50 hover:text-cyan-100">
                KI-Transparenzerklärung
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant
  return (
    <div className={`border-b border-cyan-500/20 bg-cyan-500/5 px-4 py-2 text-[11px] text-cyan-300 ${className}`}>
      <span className="font-semibold">KI-System:</span> Sie interagieren mit einem automatisierten KI-System. Keine Rechtsberatung.
    </div>
  );
}
