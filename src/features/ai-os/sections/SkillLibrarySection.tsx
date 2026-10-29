// Skill-Bibliothek — Skills anzeigen, Eingaben konfigurieren, ausführen.
// Ausführen heißt ehrlich: entweder die deterministische Routine starten
// (serverseitig) oder den Aufruf für Claude Code kopieren. Ein Skill mit
// Sprachmodell wird hier nicht im Browser „simuliert".

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { AGENTS, getRoutine, getToolAction, SKILLS, type SkillDefinition } from '../../../../packages/ai-os-core/src/index';
import { useAiOsResource, type Resource } from '../aiOsApi';
import type { AiOsSession } from '../AiOsCommandCenter';
import { LastRun, RoutineControls, type RoutinesResponse } from '../routineControls';
import { Panel, Pill, StatusPill } from '../ui';

/** Baut den Claude-Code-Aufruf aus den konfigurierten Eingaben. */
export function buildSkillCommand(skill: SkillDefinition, values: Record<string, string>): string {
  const args = skill.inputs
    .map((i) => [i.name, (values[i.name] ?? '').trim()] as const)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}=${/\s/.test(v) ? JSON.stringify(v) : v}`);
  return [`/${skill.id}`, ...args].join(' ');
}

function SkillCard({ skill, session, routines }: {
  skill: SkillDefinition;
  session: AiOsSession;
  routines: Resource<RoutinesResponse>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const command = buildSkillCommand(skill, values);
  const missing = skill.inputs.filter((i) => i.required && !(values[i.name] ?? '').trim()).map((i) => i.name);
  const routine = skill.routineId ? getRoutine(skill.routineId) : undefined;
  const live = routine && routines.result?.ok ? routines.result.data.routines?.find((r) => r.id === routine.id) : undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id={skill.id} className="aios-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{skill.name}</h2>
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{AGENTS.find((a) => a.id === skill.agent)?.name}</Pill>
          <StatusPill status={skill.status} />
        </div>
      </div>
      <p className="text-sm aios-fg2">{skill.summary}</p>

      <div className="aios-grid-wide">
        <div>
          <h3 className="text-sm font-semibold mb-1">Eingaben</h3>
          <div className="space-y-2">
            {skill.inputs.map((i) => (
              <label key={i.name} className="block text-sm">
                <span className="aios-mono">{i.name}</span>{i.required ? ' *' : ''} <span className="aios-muted">— {i.description}</span>
                <input
                  className="aios-input mt-1"
                  value={values[i.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [i.name]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1">Ausgaben</h3>
          <ul className="text-sm aios-fg2 list-disc pl-5 space-y-1">
            {skill.outputs.map((o) => <li key={o.name}><span className="aios-mono">{o.name}</span>: {o.description}</li>)}
          </ul>
          <h3 className="text-sm font-semibold mb-1 mt-3">Qualitätsanforderungen</h3>
          <ul className="text-sm aios-fg2 list-disc pl-5 space-y-1">{skill.quality.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-1">In Claude Code ausführen</h3>
        <div className="flex flex-wrap items-stretch gap-2">
          <code className="aios-input aios-mono flex-1 min-w-0 break-all" aria-label="Aufruf">{command}</code>
          <button type="button" className="aios-btn" onClick={copy} disabled={missing.length > 0}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
        <p className="text-xs aios-muted mt-1">
          {missing.length > 0 ? `Pflichtfelder fehlen: ${missing.join(', ')}. ` : ''}
          Anleitung: <span className="aios-mono">{skill.skillFile}</span>. Läuft in jeder Claude-Code-Sitzung dieses Repositorys,
          auch als Cloud-Sitzung auf claude.ai/code — ohne eingeschalteten PC.
        </p>
      </div>

      {routine && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Deterministischer Teil als Routine: {routine.name}</h3>
          <div className="mb-2"><LastRun live={live} /></div>
          <RoutineControls routine={routine} live={live} session={session} routinesResource={routines} />
        </div>
      )}

      <p className="text-xs aios-muted">
        Benötigte Rechte: {skill.actions.map((id) => <span key={id} className="aios-mono mr-2">{id}{getToolAction(id)?.class === 'write' ? ' (schreibt)' : ''}</span>)}
      </p>
    </section>
  );
}

export function SkillLibrarySection({ session }: { session: AiOsSession }) {
  const routines = useAiOsResource<RoutinesResponse>('routines');
  return (
    <>
      <h1 className="aios-h1">Skill-Bibliothek</h1>
      <p className="aios-lead">
        Zehn wiederverwendbare Skills mit dokumentierten Eingaben, Ausgaben und Qualitätsanforderungen. Skills lassen sich
        verketten: Der Bericht eines Skills ist die Eingabe des nächsten (z. B. PR-Review → CI-Fehleranalyse).
      </p>
      <Panel title="Register" source="packages/ai-os-core/src/skills.ts · .claude/skills/*/SKILL.md">
        <p className="text-sm aios-fg2">
          {SKILLS.length} Skills, davon {SKILLS.filter((s) => s.routineId).length} mit serverseitiger Routine. Fremde Skills werden
          nicht geladen: nur Dateien aus diesem Repository, Änderungen nur per Pull Request.
        </p>
      </Panel>
      {SKILLS.map((s) => <SkillCard key={s.id} skill={s} session={session} routines={routines} />)}
    </>
  );
}
