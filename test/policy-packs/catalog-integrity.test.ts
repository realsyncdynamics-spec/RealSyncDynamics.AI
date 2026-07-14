/**
 * Referentielle Integrität der Policy-Pack-Seeds (Regressionsschutz).
 *
 * policy_pack_controls hat KEINEN FK auf framework_controls (nur pack_id ist
 * verknüpft). Ein Tippfehler im control_code eines Packs würde daher stumm ein
 * Control referenzieren, das nie in framework_controls existiert — die
 * Abdeckung zählte es dann für immer als „not_started" (Phantom-Lücke).
 *
 * Dieser Test liest alle Migrations-Seeds und stellt sicher, dass jede
 * VALUES-basierte (pack_id, framework, control_code)-Referenz auf ein
 * geseedetes framework_control auflöst. Der SELECT-basierte ISO-Insert ist per
 * Konstruktion sicher (er liest aus framework_controls) und wird nicht geprüft.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FRAMEWORKS = ['GDPR', 'TDDDG', 'EU_AI_ACT', 'ISO_27001', 'SOC_2', 'NIS2', 'DORA', 'TISAX', 'CUSTOM'];
const FW = FRAMEWORKS.join('|');

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');
}

describe('Policy-Pack-Katalog — referentielle Integrität', () => {
  const sql = readAllMigrations();

  // framework_controls-Seeds: ('FW','code','title', …) — auf 'code' folgt ein
  // weiteres Feld (also ',' nach dem control_code). Das grenzt sie von den
  // 3-Tupeln der policy_pack_controls ab.
  const controlKeys = new Set<string>();
  for (const m of sql.matchAll(new RegExp(`\\('(${FW})','([^']+)',`, 'g'))) {
    controlKeys.add(`${m[1]}::${m[2]}`);
  }

  // policy_pack_controls-Refs: ('pack-id','FW','code') — genau 3 Tupel-Felder.
  const packRefs: Array<{ pack: string; framework: string; code: string }> = [];
  for (const m of sql.matchAll(new RegExp(`\\('([a-z0-9-]+)','(${FW})','([^']+)'\\)`, 'g'))) {
    packRefs.push({ pack: m[1], framework: m[2], code: m[3] });
  }

  it('findet überhaupt Seeds und Referenzen (Parser greift)', () => {
    expect(controlKeys.size).toBeGreaterThan(150); // vollständige Kataloge
    expect(packRefs.length).toBeGreaterThan(40);
  });

  it('jede Pack-Control-Referenz löst auf ein geseedetes framework_control auf', () => {
    const orphans = packRefs.filter((r) => !controlKeys.has(`${r.framework}::${r.code}`));
    expect(orphans).toEqual([]);
  });

  it('referenziert nur zulässige Frameworks', () => {
    const bad = packRefs.filter((r) => !FRAMEWORKS.includes(r.framework));
    expect(bad).toEqual([]);
  });
});
