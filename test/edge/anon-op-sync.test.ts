// `AnonOp` gegen den CHECK auf `anon_chat_runs.op`.
//
// ## Warum das eine eigene Prüfung wert ist
//
// Der anonyme Prüfpfad schreibt seine Zeile **vor** der Arbeit
// (`reserveAnonAudit`), und ein abgelehnter Insert führt zu 503 statt zur
// Ausführung. Läuft die TypeScript-Liste mit dem Datenbank-CHECK
// auseinander, fällt deshalb nicht das Protokoll aus, sondern **der ganze
// anonyme Pfad** — und zwar erst in Produktion, weil `supabase/functions`
// von `tsc` ausgeschlossen ist.
//
// Genau dieser Fehler ist beim Einbau des SiteOS-Build-Pfads passiert: Die
// Operationen standen im CHECK, aber nicht im Typ.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

/** Die zuletzt gesetzte Fassung des CHECKs gewinnt — wie in der Datenbank. */
function opsFromMigrations(): string[] {
  const dir = join(ROOT, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  let last: string[] | null = null;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf-8');
    // Nur Definitionen des op-CHECKs, nicht jedes Vorkommen von `op in (`.
    const match = /anon_chat_runs_op_check[\s\S]{0,200}?check\s*\(\s*op\s+in\s*\(([\s\S]*?)\)\s*\)/i.exec(sql);
    if (match) {
      last = [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    }
  }
  return last ?? [];
}

function opsFromType(): string[] {
  const source = readFileSync(join(ROOT, 'supabase', 'functions', '_shared', 'anonAudit.ts'), 'utf-8');
  const block = /export type AnonOp =([\s\S]*?);/.exec(source)?.[1] ?? '';
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

describe('AnonOp und der Datenbank-CHECK', () => {
  it('findet den CHECK in den Migrationen', () => {
    expect(opsFromMigrations().length).toBeGreaterThan(0);
  });

  it('führt dieselben Operationen wie die Datenbank', () => {
    expect(opsFromType()).toEqual(opsFromMigrations());
  });

  it('enthält die beiden SiteOS-Operationen', () => {
    for (const op of ['siteos_build_anon', 'siteos_refine_anon']) {
      expect(opsFromType()).toContain(op);
      expect(opsFromMigrations()).toContain(op);
    }
  });

  it('benutzt nur Operationen, die auch erlaubt sind', () => {
    // Jeder String, den ein Handler als `op` an das Gate gibt, muss im
    // CHECK stehen. Sonst 503 statt Arbeit.
    const handler = readFileSync(
      join(ROOT, 'supabase', 'functions', 'siteos', 'handlers', 'anonymous.ts'),
      'utf-8',
    );
    const used = [...handler.matchAll(/'(siteos_[a-z_]+_anon)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const op of new Set(used)) {
      expect(opsFromMigrations()).toContain(op);
    }
  });
});
