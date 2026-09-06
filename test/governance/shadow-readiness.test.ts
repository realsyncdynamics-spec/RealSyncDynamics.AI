// Beobachtungsbetrieb auswertbar — die Zwillinge und die Ehrlichkeitsregel.
//
// ## Der Befund, den diese Datei festhält
//
// Bis zum 2026-09-06 schrieben sechs Kanäle in `pdp_shadow_log`, und **nichts
// las ihn**. Der Enforcement-Plan §7 macht den Umschaltzeitpunkt aller
// Enforcement-Schalter von seiner Auswertung abhängig — die Entscheidung, an
// der das ganze Governance OS hängt, hatte damit keine Datengrundlage.
//
// ## Warum die Auswertung von der Kanalliste ausgeht, nicht von den Zeilen
//
// Ein `GROUP BY` über die vorhandenen Zeilen zeigt einen Kanal, der nie
// geschrieben hat, gar nicht erst an. Er sähe damit aus wie ein Kanal ohne
// Befund. Genau dieser Fall ist am 2026-09-04 eingetreten: Der Publish Gate
// protokollierte tagelang nichts, weil sein Aufruf falsch war und der Fehler
// in einem `catch` verschwand. Eine Auswertung mit `GROUP BY` hätte damals
// „keine Divergenzen" gemeldet — und das Umschalten leichter aussehen lassen,
// als es war.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS = resolve(__dirname, '../../supabase/migrations');
const READINESS = resolve(MIGRATIONS, '20260906100000_pdp_shadow_readiness.sql');

const sql = readFileSync(READINESS, 'utf8');
const decide = readFileSync(
  resolve(__dirname, '../../supabase/functions/_shared/pdp/decide.ts'), 'utf8',
);
const view = readFileSync(
  resolve(__dirname, '../../src/features/governance/ShadowReadinessView.tsx'), 'utf8',
);

/** Die Kanalliste aus `pdp_shadow_known_sources()`. */
function sourcesInFunction(): string[] {
  const start = sql.indexOf('SELECT ARRAY[');
  const end = sql.indexOf(']::text[]', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return [...sql.slice(start, end).matchAll(/'([a-z0-9-_]+)'/g)].map((m) => m[1]).sort();
}

/** Die Kanalliste aus der zuletzt angewandten CHECK-Bedingung. */
function sourcesInCheck(): string[] {
  // Nicht gegen eine feste Migration prüfen: Die Bedingung wird erweitert,
  // sobald ein Kanal dazukommt. Maßgeblich ist die höchste Version.
  const massgeblich = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    // Auf die DEFINITION filtern, nicht auf eine Erwaehnung: Die Migration
    // 20260906100000 nennt den Namen im Kommentar, ohne die Bedingung zu
    // setzen. Ein Treffer auf die Erwaehnung waehlt die falsche Datei.
    .filter((f) => {
      const s = readFileSync(resolve(MIGRATIONS, f), 'utf8');
      return s.includes('ADD CONSTRAINT pdp_shadow_log_source_check')
        && s.includes('CHECK (source IN (');
    })
    .pop();
  expect(massgeblich, 'keine Migration definiert pdp_shadow_log_source_check').toBeTruthy();

  const s = readFileSync(resolve(MIGRATIONS, massgeblich!), 'utf8');
  const start = s.indexOf('CHECK (source IN (');
  const block = s.slice(start, s.indexOf('));', start));
  return [...block.matchAll(/'([a-z0-9-_]+)'/g)].map((m) => m[1]).sort();
}

// ───────────────────────────────────────────────────────────────────────────
describe('Kanalliste — drei Stellen, ein Vokabular', () => {
  it('hält Funktion und CHECK-Bedingung zusammen', () => {
    // Ein Kanal, den nur die CHECK-Bedingung kennt, schreibt zwar, taucht in
    // der Auswertung aber nie auf — er wäre unsichtbar, nicht unbeobachtet.
    // Ein Kanal, den nur die Funktion kennt, erschiene dauerhaft als
    // unbeobachtet, obwohl er gar nicht schreiben darf.
    expect(sourcesInFunction()).toEqual(sourcesInCheck());
  });

  it('kennt jeden Kanal, den decide.ts schreiben kann', () => {
    const sig = decide.indexOf('export async function logShadowComparison');
    const block = decide.slice(decide.indexOf('source:', sig), decide.indexOf('legacy_status:', sig));
    const imCode = [...block.matchAll(/'([a-z0-9-_]+)'/g)].map((m) => m[1]).sort();
    expect(imCode.length).toBeGreaterThan(0);
    expect(sourcesInFunction()).toEqual(imCode);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Die Auswertung darf einen stummen Kanal nicht verschlucken', () => {
  it('geht von der Kanalliste aus, nicht von den Zeilen', () => {
    // Das ist die eine Eigenschaft, die diese Migration von einer naiven
    // Auswertung unterscheidet. Ein `FROM pdp_shadow_log ... GROUP BY source`
    // würde den stummen Kanal weglassen.
    expect(sql).toContain('FROM unnest(public.pdp_shadow_known_sources())');
    expect(sql).toContain('LEFT JOIN public.pdp_shadow_log');
  });

  it('weist Beobachtung als eigenes Feld aus', () => {
    expect(sql).toContain('count(l.id) > 0');
    expect(sql).toContain('beobachtet');
  });

  it('stellt die Mandantengrenze im SECURITY-DEFINER-Pfad selbst her', () => {
    // Die Funktion umgeht RLS. Ohne diese Zeile könnte jeder angemeldete
    // Nutzer den Beobachtungsstand fremder Mandanten lesen.
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('public.is_tenant_member(p_tenant_id)');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Richtung der Abweichung', () => {
  it('ordnet die Verdikte beider Engines nach Strenge', () => {
    for (const v of ['allow', 'log', 'log_only', 'warn', 'react', 'require_approval', 'block']) {
      expect(sql).toContain(`WHEN '${v}'`);
    }
  });

  it('gibt Unbekanntem NULL, nicht 0', () => {
    // 0 hiesse „so harmlos wie allow". Ein Verdikt, das die Ordnung nicht
    // kennt, als harmlos zu zählen wäre die stille Variante genau des
    // Fehlers, den diese Migration verhindern soll.
    const fn = sql.slice(sql.indexOf('FUNCTION public.pdp_verdict_rank'), sql.indexOf('COMMENT ON FUNCTION public.pdp_verdict_rank'));
    expect(fn).toContain('ELSE NULL');
    expect(fn).not.toMatch(/ELSE\s+0/);
  });

  it('zählt strenger und lockerer getrennt', () => {
    // „12 Divergenzen" ist keine Entscheidungsgrundlage — die Richtung ist es.
    expect(sql).toContain('v2_strenger');
    expect(sql).toContain('v2_lockerer');
    expect(sql).toContain('wuerde_sperren');
  });

  it('zählt als sperrend, was ab require_approval gilt', () => {
    // require_approval hält genauso an wie block — wer nur `block` zählte,
    // unterschätzte die Folgen des Umschaltens.
    expect(sql).toContain('pdp_verdict_rank(l.v2_status) >= 3');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Die Oberfläche behauptet nichts, was sie nicht weiß', () => {
  it('nennt einen stummen Kanal unbeobachtet, nicht unauffällig', () => {
    expect(view).toContain('unbeobachtet');
    expect(view).toContain('nicht beobachtet');
  });

  it('relativiert „keine Abweichung", solange Kanäle stumm sind', () => {
    // Ohne diesen Satz liest sich eine leere Liste als Entwarnung.
    const leer = view.slice(view.indexOf('Keine Abweichung protokolliert'));
    expect(leer.slice(0, 400)).toContain('unbeobachtet.length > 0');
  });

  it('zeigt den Zustand der Schalter NICHT an', () => {
    // Er ist eine Umgebungsvariable der Edge Functions und im Browser nicht
    // lesbar. Eine geratene Anzeige wäre dieselbe Sorte Behauptung, die diese
    // Seite aufdecken soll — deshalb steht dort nur, welcher Schalter zu
    // welchem Kanal gehört.
    // Whitespace normalisieren: Der Satz steht im JSX ueber mehrere Zeilen,
    // und an dessen Einrueckung darf eine Zusicherung nicht haengen.
    const flach = view.replace(/\s+/g, ' ');
    expect(flach).toContain('im Browser nicht lesbar');
    expect(view).not.toMatch(/mode === 'enforce'/);
  });

  it('hebt den lockereren Fall als den schwereren hervor', () => {
    expect(view).toContain('lockerer');
    expect(view).toContain('die Zusage von heute');
  });
});
