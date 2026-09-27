// Freitext-Planung für die Browser Runtime (browser-execute op: 'plan').
//
// Das Modell (ai_tools.browser_task_planner) liefert JSON; hier wird es
// streng geprüft, bevor der Client es sieht. Der Plan wird NIE serverseitig
// ausgeführt — jeder Schritt geht einzeln über op: 'execute' und damit durch
// dieselbe Policy (Mutationen ⇒ menschliche Freigabe).

export type PlannedBrowserAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'extract'; selector?: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'screenshot' };

export interface BrowserPlanStep {
  action: PlannedBrowserAction;
  reason: string;
}

export type BrowserPlanResult =
  | { kind: 'plan'; summary: string; steps: BrowserPlanStep[] }
  | { kind: 'refused'; reason: string }
  | { kind: 'invalid'; error: string };

export const MAX_PLAN_STEPS = 10;
export const MAX_TASK_CHARS = 1000;

const MAX_SELECTOR = 500;
const MAX_TEXT = 2000;
const MAX_URL = 2000;
const MAX_REASON = 300;

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function httpUrl(value: unknown): string | null {
  const raw = str(value, MAX_URL);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Eine Aktion auf das erlaubte Schema reduzieren; `null` = ungültig. */
export function sanitizePlannedAction(raw: unknown): PlannedBrowserAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case 'navigate': {
      const url = httpUrl(a.url);
      return url ? { type: 'navigate', url } : null;
    }
    case 'scroll': {
      if (a.direction !== 'up' && a.direction !== 'down') return null;
      const amount = typeof a.amount === 'number' && Number.isFinite(a.amount)
        ? Math.min(Math.max(Math.round(a.amount), 1), 5000)
        : undefined;
      return amount === undefined
        ? { type: 'scroll', direction: a.direction }
        : { type: 'scroll', direction: a.direction, amount };
    }
    case 'click': {
      const selector = str(a.selector, MAX_SELECTOR);
      return selector ? { type: 'click', selector } : null;
    }
    case 'type': {
      const selector = str(a.selector, MAX_SELECTOR);
      const text = typeof a.text === 'string' && a.text.length > 0 && a.text.length <= MAX_TEXT ? a.text : null;
      return selector && text !== null ? { type: 'type', selector, text } : null;
    }
    case 'select': {
      const selector = str(a.selector, MAX_SELECTOR);
      const value = str(a.value, MAX_SELECTOR);
      return selector && value ? { type: 'select', selector, value } : null;
    }
    case 'extract': {
      if (a.selector === undefined || a.selector === null || a.selector === '') return { type: 'extract' };
      const selector = str(a.selector, MAX_SELECTOR);
      return selector ? { type: 'extract', selector } : null;
    }
    case 'wait': {
      const ms = typeof a.milliseconds === 'number' && Number.isFinite(a.milliseconds)
        ? Math.min(Math.max(Math.round(a.milliseconds), 0), 10_000)
        : null;
      return ms === null ? null : { type: 'wait', milliseconds: ms };
    }
    case 'screenshot':
      return { type: 'screenshot' };
    default:
      return null;
  }
}

/** JSON aus der Modellantwort holen (auch in ```json-Fences). */
function extractJson(output: string): unknown {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : output).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in model output');
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Modellantwort → geprüfter Plan. Ein einziger ungültiger Schritt verwirft
 * den ganzen Plan (kein stilles Weglassen — sonst stimmt die Reihenfolge
 * nicht mehr mit der Absicht überein).
 */
export function parseBrowserPlan(output: string): BrowserPlanResult {
  let data: unknown;
  try {
    data = extractJson(output);
  } catch {
    return { kind: 'invalid', error: 'Planner lieferte kein gültiges JSON.' };
  }
  if (!data || typeof data !== 'object') return { kind: 'invalid', error: 'Plan ist kein Objekt.' };
  const obj = data as Record<string, unknown>;

  const refused = str(obj.refused, MAX_REASON);
  if (refused) return { kind: 'refused', reason: refused };

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return { kind: 'invalid', error: 'Plan enthält keine Schritte.' };
  }
  if (obj.steps.length > MAX_PLAN_STEPS) {
    return { kind: 'invalid', error: `Plan hat mehr als ${MAX_PLAN_STEPS} Schritte.` };
  }

  const steps: BrowserPlanStep[] = [];
  for (const [i, rawStep] of obj.steps.entries()) {
    const step = rawStep && typeof rawStep === 'object' ? rawStep as Record<string, unknown> : {};
    const action = sanitizePlannedAction(step.action);
    if (!action) return { kind: 'invalid', error: `Schritt ${i + 1} ist ungültig.` };
    steps.push({ action, reason: str(step.reason, MAX_REASON) ?? '' });
  }

  return { kind: 'plan', summary: str(obj.summary, MAX_REASON) ?? '', steps };
}

/** Nutzereingabe für den Planner (System-Prompt liegt in ai_tools). */
export function buildPlannerInput(task: string, currentUrl: string | null): string {
  return [
    `AUFGABE: ${task}`,
    `AKTUELLE SEITE: ${currentUrl ?? 'unbekannt (noch keine Navigation)'}`,
    'Antworte ausschließlich mit dem JSON-Objekt.',
  ].join('\n');
}
