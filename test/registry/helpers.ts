// Hilfen fuer die Registry-Tests: Fixture-Kopien mit gezielten Mutationen.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { assessmentInputsHash } from '../../supabase/functions/_shared/registry/inputsHash.ts';

export const REPO = resolve(__dirname, '../..');
export const SCHEMA_DIR = join(REPO, 'registry/schema');
export const REAL_REGISTRY = join(REPO, 'registry');
export const VALID = join(__dirname, 'fixtures/valid');
export const NEGATIVE = join(__dirname, 'fixtures/negative');

const created: string[] = [];

/** Leeres Registry-Verzeichnis (vendors/, deployments/, assessments/ ohne Dateien). */
export function emptyRegistry(): string {
  const dir = mkdtempSync(join(tmpdir(), 'registry-empty-'));
  created.push(dir);
  return dir;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/**
 * Kopiert das gueltige Fixture und wendet `mutate` auf die genannte Datei an.
 * Bei Assessments wird inputs_hash nach der Mutation neu berechnet, ausser
 * `keepHash` ist gesetzt – so testet jede Mutation genau EINE Regel.
 */
export async function mutated(
  relFile: string,
  mutate: (doc: Json) => void,
  opts: { keepHash?: boolean; base?: string; rename?: string } = {},
): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'registry-mut-'));
  created.push(dir);
  cpSync(opts.base ?? VALID, dir, { recursive: true });
  const p = join(dir, relFile);
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  mutate(doc);
  if (relFile.startsWith('assessments/') && !opts.keepHash) doc.inputs_hash = await assessmentInputsHash(doc.inputs);
  writeFileSync(p, JSON.stringify(doc, null, 2));
  if (opts.rename) {
    rmSync(p);
    writeFileSync(join(dir, opts.rename), JSON.stringify(doc, null, 2));
  }
  return dir;
}

/** Datei hinzufuegen (z. B. zweiter Vendor mit gleicher ID). */
export function withExtraFile(relFile: string, content: string, base = VALID): string {
  const dir = mkdtempSync(join(tmpdir(), 'registry-extra-'));
  created.push(dir);
  cpSync(base, dir, { recursive: true });
  writeFileSync(join(dir, relFile), content);
  return dir;
}

export function readJson(dir: string, relFile: string): Json {
  return JSON.parse(readFileSync(join(dir, relFile), 'utf8'));
}

export function listJson(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.json'));
}

export function cleanup(): void {
  for (const d of created.splice(0)) rmSync(d, { recursive: true, force: true });
}
