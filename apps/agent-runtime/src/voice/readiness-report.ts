/**
 * Voice Readiness Report (Issue #2376, Schritt T0).
 *
 * Liest die vorhandene Tool-Registry und prüft nur, ob die Store-Env-Namen
 * gesetzt sind. Kein Netzwerk, keine Datenbank, keine Secret-Werte in der
 * Ausgabe. Ändert weder Policy noch die Schreibsperre.
 */

import { VOICE_TOOL_BACKEND } from './tool-executors.js';
import { VOICE_WRITE_TOOLS } from './tool-gateway.js';
import { isVoiceToolName, VOICE_TOOLS } from '../voice-tools.js';
import type { VoiceToolName } from '../voice-types.js';

export const VOICE_READINESS_VERSION = 1;

/** Namen, die `createSupabaseVoiceStoreFromEnv` liest. Reihenfolge ist sortiert. */
export const VOICE_STORE_ENV_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL'] as const;

export type VoiceReadinessStep = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8';

export type VoiceToolReadinessState = 'configured' | 'not_configured' | 'write_tool_disabled';

export type VoiceToolAccess = 'read' | 'write';

/**
 * Zuordnung zu #2376 nur dort, wo der Schritt das Werkzeug beim Namen nennt.
 * T5 nennt Termine/Buchungen und die bestehende Schreibsperre.
 * T7 nennt Terminwunsch und Handoff.
 * lookup_kb, create_ticket und export_transcript bleiben ohne Schritt.
 */
const VOICE_TOOL_STEPS: Record<VoiceToolName, readonly VoiceReadinessStep[]> = {
  lookup_kb: [],
  create_ticket: [],
  schedule_appointment: ['T5', 'T7'],
  handoff_human: ['T7'],
  export_transcript: [],
};

export interface VoiceToolReadinessFact {
  name: string;
  writes: boolean;
  writeLocked: boolean;
  hasBackend: boolean;
  requiredEnv: readonly string[];
  steps: readonly string[];
}

export interface VoiceToolReadinessRow {
  name: string;
  access: VoiceToolAccess;
  state: VoiceToolReadinessState;
  ready: boolean;
  env: string[];
  steps: string[];
}

export interface VoiceReadinessReport {
  version: number;
  tools: VoiceToolReadinessRow[];
}

export interface VoiceReadinessCliOptions {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isEnvNameSet(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): boolean {
  const value = env[name];
  return typeof value === 'string' && value.trim() !== '';
}

export function listVoiceToolReadinessFacts(): VoiceToolReadinessFact[] {
  return Object.keys(VOICE_TOOLS)
    .filter(isVoiceToolName)
    .sort(compareCodePoint)
    .map((name) => {
      const spec = VOICE_TOOLS[name];
      return {
        name,
        writes: spec.writes,
        writeLocked: VOICE_WRITE_TOOLS.has(name),
        hasBackend: VOICE_TOOL_BACKEND[name] !== 'none',
        requiredEnv: VOICE_STORE_ENV_NAMES,
        steps: [...VOICE_TOOL_STEPS[name]].sort(compareCodePoint),
      };
    });
}

/**
 * Dieselbe Reihenfolge wie das Gateway:
 * fehlender Store → not_configured, danach Schreibsperre, danach fehlendes Backend.
 * `ready` bleibt falsch für jedes schreibende oder gesperrte Werkzeug.
 */
export function assessVoiceToolReadiness(
  fact: VoiceToolReadinessFact,
  env: Readonly<Record<string, string | undefined>>,
): VoiceToolReadinessRow {
  const missingEnv = fact.requiredEnv.some((name) => !isEnvNameSet(env, name));
  let state: VoiceToolReadinessState;
  if (missingEnv) state = 'not_configured';
  else if (fact.writeLocked) state = 'write_tool_disabled';
  else if (!fact.hasBackend) state = 'not_configured';
  else state = 'configured';

  const access: VoiceToolAccess = fact.writes || fact.writeLocked ? 'write' : 'read';
  const ready = state === 'configured' && access === 'read';

  return {
    name: fact.name,
    access,
    state,
    ready,
    env: [...fact.requiredEnv].sort(compareCodePoint),
    steps: [...fact.steps].sort(compareCodePoint),
  };
}

export function buildVoiceReadinessReport(
  facts: readonly VoiceToolReadinessFact[],
  env: Readonly<Record<string, string | undefined>>,
): VoiceReadinessReport {
  const tools = facts.map((fact) => assessVoiceToolReadiness(fact, env)).sort((a, b) => compareCodePoint(a.name, b.name));
  return { version: VOICE_READINESS_VERSION, tools };
}

export function createVoiceReadinessReport(
  env: Readonly<Record<string, string | undefined>> = process.env,
): VoiceReadinessReport {
  return buildVoiceReadinessReport(listVoiceToolReadinessFacts(), env);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function renderVoiceReadinessMarkdown(report: VoiceReadinessReport): string {
  const lines = [
    '# Voice Readiness Report',
    '',
    'Statische Bestandsaufnahme der registrierten Voice-Tools aus `apps/agent-runtime`.',
    'Kein Netzwerk, keine Datenbank, keine Env-Werte. `Bereit = ja` ist kein Nachweis für Telefonie oder Produktion.',
    '',
    '| Tool | Zugriff | Zustand | Bereit | Env-Namen | Schritte |',
    '|---|---|---|---|---|---|',
  ];
  for (const row of report.tools) {
    const env = row.env.length > 0 ? row.env.join(', ') : '—';
    const steps = row.steps.length > 0 ? row.steps.join(', ') : '—';
    const ready = row.ready ? 'ja' : 'nein';
    lines.push(
      `| ${escapeCell(row.name)} | ${row.access} | ${row.state} | ${ready} | ${escapeCell(env)} | ${escapeCell(steps)} |`,
    );
  }
  lines.push(
    '',
    'Schreibende Werkzeuge bleiben `Bereit = nein`, solange die Schreibsperre gilt.',
    'Schritte T1–T8 stammen aus Issue #2376 und stehen nur dort, wo die Zuordnung eindeutig ist.',
    '',
  );
  return lines.join('\n');
}

export function renderVoiceReadinessJson(report: VoiceReadinessReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function runVoiceReadinessCli(options: VoiceReadinessCliOptions): number {
  const unknown = options.argv.filter((arg) => arg !== '--json');
  if (unknown.length > 0) {
    options.stderr('Unbekanntes Argument. Erlaubt ist nur --json.\n');
    return 2;
  }
  const report = createVoiceReadinessReport(options.env);
  const body = options.argv.includes('--json')
    ? renderVoiceReadinessJson(report)
    : renderVoiceReadinessMarkdown(report);
  options.stdout(body);
  return 0;
}
