/**
 * Wie Edge Functions den Mandanten eines Nutzers bestimmen.
 *
 * ## Der Fehler, den dieser Test festhält
 *
 * Mehrere Functions suchten den Mandanten über `profiles.active_tenant_id`
 * bzw. `auth.users.raw_app_meta_data->active_tenant_id`. **Beides existiert
 * nicht.** Am 2026-09-01 gegen das Live-Projekt gemessen:
 *
 *   information_schema.columns, public, '%active_tenant%'  → existiert nicht
 *   auth.users mit raw_app_meta_data ? 'active_tenant_id'  → 0 Nutzer
 *
 * Eine Migration vom 2026-07 hält denselben Befund schon für `auth.users`
 * fest — der Irrtum ist also mindestens zweimal unabhängig entstanden. Genau
 * deshalb ist das hier ein Test und keine Notiz.
 *
 * Die einzige Zuordnung Nutzer→Mandant ist `public.memberships`; sie wird
 * beim Registrieren vom Trigger `on_auth_user_created` angelegt (Mandant +
 * Mitgliedschaft als `owner`).
 *
 * ## Warum das so lange unsichtbar blieb
 *
 * Die Fehlermeldungen sahen nach Zuständen aus, nicht nach Defekten:
 * `log-tool-run` antwortete „No active tenant" — als hätte der Nutzer keinen
 * Arbeitsbereich. `dashboard-digest-generate` meldete `digestsCreated: 0` —
 * als hätte niemand einen Digest abonniert. Beides war in Wahrheit eine
 * Abfrage, die nie ein Ergebnis liefern konnte.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FUNCTIONS = resolve(__dirname, '../../supabase/functions');

/** Ohne Kommentare — dort steht die Begründung, nicht der Verstoß. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function entrypoints(): { slug: string; code: string }[] {
  const out: { slug: string; code: string }[] = [];
  for (const entry of readdirSync(FUNCTIONS)) {
    if (entry.startsWith('_')) continue;
    const dir = join(FUNCTIONS, entry);
    if (!statSync(dir).isDirectory()) continue;
    const index = join(dir, 'index.ts');
    try {
      out.push({ slug: entry, code: stripComments(readFileSync(index, 'utf8')) });
    } catch {
      // Verzeichnis ohne index.ts — nicht Gegenstand dieses Tests.
    }
  }
  return out;
}

const ENTRYPOINTS = entrypoints();

describe('Mandantenauflösung in Edge Functions', () => {
  it('liest überhaupt Functions ein', () => {
    // Ohne diese Zusicherung prüfte alles Folgende eine leere Liste.
    expect(ENTRYPOINTS.length).toBeGreaterThan(150);
  });

  it('sucht den Mandanten nirgends über active_tenant_id', () => {
    const offenders = ENTRYPOINTS.filter((f) => f.code.includes('active_tenant_id')).map(
      (f) => f.slug
    );

    expect(
      offenders.sort(),
      'Weder `profiles.active_tenant_id` noch `raw_app_meta_data->active_tenant_id` ' +
        'existieren im Schema. Die Zuordnung Nutzer→Mandant läuft über ' +
        '`public.memberships` — dort nachsehen, nicht die Spalte anlegen.'
    ).toEqual([]);
  });

  it('fragt auth.users nicht über PostgREST ab', () => {
    // `from('auth.users')` sucht eine Tabelle dieses Namens im exponierten
    // Schema. Die gibt es nicht; der Fehler landet in einer Variablen, die
    // niemand prüft, und die Function tut still nichts.
    const offenders = ENTRYPOINTS.filter((f) => /from\(\s*['"]auth\.users['"]/.test(f.code)).map(
      (f) => f.slug
    );

    expect(
      offenders.sort(),
      'PostgREST erreicht `auth.users` nicht. Für Nutzer eines Mandanten ' +
        '`public.memberships` lesen; für Nutzerdaten die Admin-API ' +
        '(`admin.auth.admin.*`).'
    ).toEqual([]);
  });
});

describe('Die beiden reparierten Functions', () => {
  const bySlug = (slug: string) => ENTRYPOINTS.find((f) => f.slug === slug)?.code ?? '';

  it('log-tool-run löst über memberships auf und rät nicht', () => {
    const code = bySlug('log-tool-run');
    expect(code).toContain("from('memberships')");
    expect(code).toContain('Multiple tenants');
  });

  it('dashboard-digest-generate unterscheidet Lesefehler von „keine Mitglieder"', () => {
    // Der ursprüngliche Defekt war genau diese fehlende Unterscheidung: ein
    // fehlgeschlagener Lesezugriff sah aus wie ein leerer Mandant.
    const code = bySlug('dashboard-digest-generate');
    expect(code).toContain("from('memberships')");
    expect(code).toContain('memberErr');
  });
});
