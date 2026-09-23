import { useRef, useState, type KeyboardEvent } from 'react';

const TENANT_QUICK = [
  { label: 'Risiko-Übersicht', text: 'Gib mir die aktuelle Risiko-Übersicht über alle meine Assets.' },
  { label: 'Offene Incidents', text: 'Welche Incidents sind aktuell offen und wie weit bin ich noch von der 72h-Frist entfernt?' },
  { label: 'DPIAs Status', text: 'Welche DPIAs sind im Draft und brauchen Aufmerksamkeit?' },
  { label: 'Vendoren ohne DPA', text: 'Welche Vendoren haben noch keinen signed DPA?' },
];

export const ANON_QUICK = [
  { label: 'DSGVO Art. 6', text: 'Welche Rechtsgrundlagen gibt es nach DSGVO Art. 6 für die Verarbeitung personenbezogener Daten?' },
  { label: 'Cookie-Pflichten', text: 'Welche Cookie-Pflichten gelten in Deutschland nach TDDDG und DSGVO?' },
  { label: 'EU AI Act', text: 'Was sind die wichtigsten Pflichten für KI-Systeme unter dem EU AI Act?' },
  { label: 'Website-Audit', text: 'Was sollte ich bei einem DSGVO-Audit meiner Website prüfen?' },
];

export function ChatInput(props: {
  onSend: (text: string) => void;
  isLoading: boolean;
  showQuickActions: boolean;
  disabled?: boolean;
  quickActions?: { label: string; text: string }[];
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!value.trim() || props.isLoading || props.disabled) return;
    props.onSend(value.trim());
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const quickActions = props.quickActions ?? TENANT_QUICK;

  return (
    <div className="space-y-2 border-t border-white/10 p-3">
      {props.showQuickActions && (
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((q) => (
            <button
              key={q.label}
              onClick={() => props.onSend(q.text)}
              disabled={props.disabled || props.isLoading}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          onInput={grow}
          rows={1}
          placeholder={props.placeholder ?? (props.disabled ? 'Tenant auswählen…' : 'Nachricht schreiben…')}
          disabled={props.isLoading || props.disabled}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-[14px] leading-relaxed text-zinc-50 placeholder-zinc-400 transition-colors focus:border-amber-400/60 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || props.isLoading || props.disabled}
          className="inline-flex h-11 min-w-[44px] flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3.5 text-[13px] font-semibold text-black transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:opacity-100"
          aria-label="Nachricht senden"
        >
          {props.isLoading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" className="opacity-75" />
            </svg>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span className="hidden sm:inline">Senden</span>
            </>
          )}
        </button>
      </div>
      <p className="text-center text-[10px] text-zinc-400">
        KI-Assistent · keine Rechtsberatung · EU-Daten · auditierbar
      </p>
    </div>
  );
}
