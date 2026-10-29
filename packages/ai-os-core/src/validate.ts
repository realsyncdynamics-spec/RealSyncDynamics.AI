// Register-Integrität — läuft in Unit-Tests und in der Routine `docs-control`.
// Liefert eine Fehlerliste statt zu werfen, damit ein Bericht alle Befunde zeigt.

import { AGENTS } from './agents.ts';
import { ROUTINES } from './routines.ts';
import { SKILLS } from './skills.ts';
import { TOOL_ACTIONS } from './tools.ts';

export function validateRegistry(fileExists: (repoPath: string) => boolean): string[] {
  const errors: string[] = [];
  const actionIds = new Set(TOOL_ACTIONS.map((a) => a.id));
  const skillIds = new Set(SKILLS.map((s) => s.id));
  const routineIds = new Set(ROUTINES.map((r) => r.id));
  const agentIds = new Set(AGENTS.map((a) => a.id));

  const dupes = (ids: string[], kind: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${kind} doppelt: ${id}`);
      seen.add(id);
    }
  };
  dupes(TOOL_ACTIONS.map((a) => a.id), 'Aktion');
  dupes(SKILLS.map((s) => s.id), 'Skill');
  dupes(ROUTINES.map((r) => r.id), 'Routine');
  dupes(AGENTS.map((a) => a.id), 'Agent');

  for (const a of TOOL_ACTIONS) {
    if (a.class === 'critical' && a.channel === 'edge-gateway') {
      errors.push(`Aktion ${a.id}: kritische Aktionen dürfen nicht über das Server-Gateway laufen`);
    }
    if (a.class === 'critical' && a.approval !== 'separate-release') {
      errors.push(`Aktion ${a.id}: kritische Aktionen brauchen approval=separate-release`);
    }
    if (a.class === 'write' && a.approval === 'none') {
      errors.push(`Aktion ${a.id}: Schreibaktionen brauchen mindestens eine Bestätigung`);
    }
  }

  for (const s of SKILLS) {
    if (!agentIds.has(s.agent)) errors.push(`Skill ${s.id}: unbekannter Agent ${s.agent}`);
    if (!fileExists(s.skillFile)) errors.push(`Skill ${s.id}: ${s.skillFile} fehlt`);
    if (s.routineId && !routineIds.has(s.routineId)) errors.push(`Skill ${s.id}: unbekannte Routine ${s.routineId}`);
    for (const id of s.actions) if (!actionIds.has(id)) errors.push(`Skill ${s.id}: unbekannte Aktion ${id}`);
  }

  for (const r of ROUTINES) {
    if (!agentIds.has(r.agent)) errors.push(`Routine ${r.id}: unbekannter Agent ${r.agent}`);
    if (!fileExists(`.github/workflows/${r.workflowFile}`)) errors.push(`Routine ${r.id}: Workflow ${r.workflowFile} fehlt`);
    if (r.limits.maxLlmCostEur !== 0) errors.push(`Routine ${r.id}: Routinen sind deterministisch (maxLlmCostEur = 0)`);
    if (r.limits.timeoutMinutes > 15) errors.push(`Routine ${r.id}: timeoutMinutes > 15`);
    for (const [scope, level] of Object.entries(r.permissions)) {
      if (level !== 'read') errors.push(`Routine ${r.id}: Recht ${scope}=${level} — Routinen lesen nur`);
    }
  }

  for (const a of AGENTS) {
    for (const id of a.skills) if (!skillIds.has(id)) errors.push(`Agent ${a.id}: unbekannter Skill ${id}`);
    for (const id of a.allowedActions) {
      if (!actionIds.has(id)) errors.push(`Agent ${a.id}: unbekannte Aktion ${id}`);
      const action = TOOL_ACTIONS.find((x) => x.id === id);
      if (action?.class === 'critical') errors.push(`Agent ${a.id}: kritische Aktion ${id} in der Positivliste`);
    }
    for (const sid of a.skills) {
      const skill = SKILLS.find((s) => s.id === sid);
      for (const id of skill?.actions ?? []) {
        if (!a.allowedActions.includes(id)) errors.push(`Agent ${a.id}: Skill ${sid} braucht ${id}, nicht in der Positivliste`);
      }
    }
  }
  return errors;
}
