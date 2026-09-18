/**
 * Error-recovery loop, bolt.diy-style: failed actions become a structured
 * repair prompt. We do not auto-retry against a live model from here —
 * that would spend quota without a user click. The UI feeds this back.
 */

import type { ActionRunResult } from './types';

export function repairPrompt(original: string, failed: ActionRunResult[]): string {
  if (failed.length === 0) return original;
  const lines = failed.map((f) => `- ${f.actionId}: ${f.status} · ${f.gate.control} · ${f.output}`);
  return [
    original.trim(),
    '',
    'Die vorherige Ausführung wurde teilweise blockiert oder ist fehlgeschlagen.',
    'Korrigiere nur die beanstandeten Aktionen. Keine Secrets, keine Produktiv-Deploys, keine Shell.',
    'Fehler:',
    ...lines,
  ].join('\n');
}

export function isRecoverable(results: ActionRunResult[]): boolean {
  return results.some((r) => r.status === 'failed' || (r.status === 'blocked' && r.gate.decision !== 'block'));
}
