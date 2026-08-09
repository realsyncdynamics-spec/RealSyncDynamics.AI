import { useRef, useState, type KeyboardEvent } from 'react';

const TENANT_QUICK = [
  { label: 'Risiko-Übersicht', text: 'Gib mir die aktuelle Risiko-Übersicht über alle meine Assets.' },
  { label: 'Offene Incidents', text: 'Welche Incidents sind aktuell offen und wie weit bin ich noch von der 72h-Frist entfernt?' },
  { label: 'DPIAs Status', text: 'Welche DPIAs sind im Draft und brauchen Aufmerksamkeit?' },
  { label: 'Vendoren ohne DPA', text: 'Welche Vendoren haben noch keinen signed DPA?' },
];

/**
 * Schnellfragen des öffentlichen Assistenten.
 *
 * ⚠️ Bewusst ohne Mandantenbezug: Der anonyme Assistent hat per Design keinen
 * Zugriff auf Tenant-Daten (rate-limited, read-only, kein RLS-Kontext). Fragen
 * wie „Warum ist MEIN Risk Score 87?" oder „Zeig MEINE fehlenden Nachweise"
 * könnte er deshalb nicht beantworten, sondern nur halluzinieren — sie sind
 * hier absichtlich als Mechanik-Fragen formuliert („Wie entsteht …?").
 * Die mandantenbezogene Variante gehört hinter die Auth-Schicht.
 */
export const ANON_QUICK = [
  { label: 'Was zuerst beheben?', text: 'Ich starte mit AI Governance. Welche Compliance-Lücken sollte ich typischerweise zuerst schließen und warum?' },
  { label: 'Risk Score', text: 'Wie entsteht ein Compliance-Risk-Score und welche Faktoren senken ihn am stärksten?' },
  { label: 'DSGVO-Nachweise', text: 'Welche Nachweise brauche ich, um DSGVO-Konformität gegenüber einer Aufsichtsbehörde zu belegen?' },
  { label: 'Hochriskante KI', text: 'Welche KI-Systeme gelten nach EU AI Act als hochriskant und welche Pflichten folgen daraus?' },
  { label: 'Evidence Vault', text: 'Wie funktioniert ein manipulationssicherer Nachweis-Speicher mit Hash-Chain?' },
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
          placeholder={props.placeholder ?? (props.disabled ? 'Tenant auswählen…' : 'Nachricht (Enter zum Senden)')}
          disabled={props.isLoading || props.disabled}
          className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] leading-relaxed text-zinc-100 placeholder-zinc-500 transition-colors focus:border-amber-400/50 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!value.trim() || props.isLoading || props.disabled}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Senden"
        >
          {props.isLoading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" className="opacity-75" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-center text-[10px] text-zinc-600">
        KI-Assistent · keine Rechtsberatung · EU-Daten · auditierbar
      </p>
    </div>
  );
}
