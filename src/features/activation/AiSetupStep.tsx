/**
 * WP3 — AI-OS-Setup als Schritt der Governance Activation.
 *
 * Erfasst KI-Systeme, Bots/Agenten, Datenklassen und Freigaben als
 * Selbstauskunft. Keine Risikobewertung, keine Scores. Labels und Enums
 * kommen ausschließlich aus `aiSetupCatalog.ts`.
 */
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, Square } from 'lucide-react';
import { OS_ACCENT_TEXT, OS_FOCUS_BORDER } from '../../components/governance-os/osChrome';
import {
  AGENT_GUARDRAIL_NOTE,
  AI_SYSTEM_OPTIONS,
  APPROVAL_LEVEL_OPTIONS,
  APPROVAL_QUESTIONS,
  BOT_AGENT_OPTIONS,
  DATA_CLASS_OPTIONS,
  GUARDED_AGENT_IDS,
  HUMAN_APPROVAL_OPTIONS,
  toggleExclusiveOption,
  toggleOption,
  type AiSetup,
  type ApprovalLevel,
} from './aiSetupCatalog';

interface Option {
  readonly id: string;
  readonly label: string;
}

function OptionGrid({
  options,
  selected,
  onToggle,
  noteFor,
}: {
  options: readonly Option[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  noteFor?: (id: string) => string | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        const note = noteFor?.(opt.id) ?? null;
        return (
          <button
            key={opt.id}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggle(opt.id)}
            className={`text-left p-3 border transition-colors flex items-start gap-2 ${
              active
                ? 'border-[#00B8D4] bg-obsidian-800'
                : 'border-titanium-800 bg-obsidian-950 hover:border-titanium-600'
            }`}
          >
            {active ? (
              <CheckCircle2 className={`h-4 w-4 ${OS_ACCENT_TEXT} shrink-0 mt-0.5`} />
            ) : (
              <Square className="h-4 w-4 text-titanium-600 shrink-0 mt-0.5" />
            )}
            <span className="min-w-0">
              <span className="block text-sm font-medium text-titanium-100">{opt.label}</span>
              {note && (
                <span className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-amber-300">
                  <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
                  {note}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SubSection({
  index,
  title,
  hint,
  children,
}: {
  index: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-titanium-100">
          <span className={`font-mono ${OS_ACCENT_TEXT} mr-2`}>{index}</span>
          {title}
        </h3>
        <p className="mt-1 text-xs text-titanium-500">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function AiSetupStep({
  value,
  onChange,
}: {
  value: AiSetup;
  onChange: (next: AiSetup) => void;
}) {
  const setApproval = (key: (typeof APPROVAL_QUESTIONS)[number]['key'], level: ApprovalLevel) =>
    onChange({ ...value, approvals: { ...value.approvals, [key]: level } });

  return (
    <div className="space-y-8">
      <p className="text-sm text-titanium-400">
        Welche KI nutzt Ihr Unternehmen, welche Bots und Agenten sind geplant, welche Daten sind
        betroffen und was darf ohne Freigabe passieren? Die Angaben werden im Tenant gespeichert.
        Sie sind eine Bestandsaufnahme, keine Risikobewertung.
      </p>

      <label className="block space-y-1.5 max-w-md">
        <span className="text-[11px] uppercase tracking-wider text-titanium-400 font-mono">
          Verantwortliche Rolle für KI
        </span>
        <input
          type="text"
          value={value.responsibleRole}
          onChange={(e) => onChange({ ...value, responsibleRole: e.target.value })}
          placeholder="z. B. AI Officer, DSB, Geschäftsführung"
          className={`w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 outline-none ${OS_FOCUS_BORDER} placeholder:text-titanium-600`}
        />
      </label>

      <SubSection
        index="A"
        title="KI-Systeme"
        hint="Mehrfachauswahl. „Keine KI-Systeme“ schließt die anderen Optionen aus."
      >
        <OptionGrid
          options={AI_SYSTEM_OPTIONS}
          selected={value.aiSystems}
          onToggle={(id) =>
            onChange({ ...value, aiSystems: toggleExclusiveOption(value.aiSystems, id) })
          }
        />
      </SubSection>

      <SubSection
        index="B"
        title="Bots und Agenten"
        hint="Im Einsatz oder geplant. „Keine Bots oder Agenten“ schließt die anderen Optionen aus."
      >
        <OptionGrid
          options={BOT_AGENT_OPTIONS}
          selected={value.botsAgents}
          onToggle={(id) =>
            onChange({ ...value, botsAgents: toggleExclusiveOption(value.botsAgents, id) })
          }
          noteFor={(id) => (GUARDED_AGENT_IDS.includes(id) ? AGENT_GUARDRAIL_NOTE : null)}
        />
      </SubSection>

      <SubSection
        index="C"
        title="Datenklassen"
        hint="Welche Daten verarbeiten KI-Systeme, Bots oder Agenten?"
      >
        <OptionGrid
          options={DATA_CLASS_OPTIONS}
          selected={value.dataClasses}
          onToggle={(id) => onChange({ ...value, dataClasses: toggleOption(value.dataClasses, id) })}
        />
      </SubSection>

      <SubSection
        index="D"
        title="Freigaben"
        hint="Vorbelegt ist die vorsichtige Variante. Änderungen gelten erst nach dem Speichern."
      >
        <div className="space-y-3">
          {APPROVAL_QUESTIONS.map((q) => (
            <fieldset key={q.key} className="border border-titanium-900 bg-obsidian-950 p-3">
              <legend className="px-1 text-xs text-titanium-300">{q.label}</legend>
              <div className="flex flex-wrap gap-2 mt-1">
                {APPROVAL_LEVEL_OPTIONS.map((lvl) => {
                  const active = value.approvals[q.key] === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setApproval(q.key, lvl.id)}
                      className={`px-3 py-1.5 text-xs border transition-colors ${
                        active
                          ? 'border-[#00B8D4] bg-obsidian-800 text-titanium-50'
                          : 'border-titanium-800 text-titanium-400 hover:border-titanium-600'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <label className="flex items-start gap-2 border border-titanium-900 bg-obsidian-950 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value.approvals.logEveryAgentAction}
              onChange={(e) =>
                onChange({
                  ...value,
                  approvals: { ...value.approvals, logEveryAgentAction: e.target.checked },
                })
              }
              className="mt-0.5 accent-[#00B8D4]"
            />
            <span className="text-xs text-titanium-300">
              Jede Agent-Aktion protokollieren (Grundlage für Evidence und Audit-Log)
            </span>
          </label>

          <div className="space-y-2">
            <p className="text-xs text-titanium-300">Menschliche Freigabe immer erforderlich für:</p>
            <OptionGrid
              options={HUMAN_APPROVAL_OPTIONS}
              selected={value.approvals.humanApprovalFor}
              onToggle={(id) =>
                onChange({
                  ...value,
                  approvals: {
                    ...value.approvals,
                    humanApprovalFor: toggleOption(value.approvals.humanApprovalFor, id),
                  },
                })
              }
            />
          </div>
        </div>
      </SubSection>

      {(value.aiSystems.length === 0 || value.botsAgents.length === 0) && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> Bitte bei KI-Systemen und bei Bots/Agenten
          mindestens eine Option wählen, auch „Keine“.
        </p>
      )}
    </div>
  );
}
