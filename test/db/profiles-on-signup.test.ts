/**
 * `profiles` bekommt einen Erzeugungspfad — Form und die eine Reihenfolge,
 * an der alles haengt.
 *
 * ## Der Befund, den diese Migration schliesst
 *
 * Gemessen am 2026-09-06 gegen Produktion: 6 Nutzer, 1 Profil. Das ist keine
 * Teilluecke, sondern ein geschlossener Kreis — `handle_new_auth_user` legt
 * Mandant und Mitgliedschaft an, aber kein Profil; keine Migration im Repo
 * insertet in `profiles`; und die Tabelle traegt Policies fuer SELECT und
 * UPDATE, aber keine fuer INSERT. Es gab also serverseitig keinen Pfad und
 * clientseitig kein Recht.
 *
 * ## Warum die Reihenfolge im Trigger geprueft wird
 *
 * Der bestehende Waechter steigt aus, sobald eine Mitgliedschaft existiert —
 * und genau die haben alle fuenf betroffenen Nutzer. Ein Profil-Insert
 * **hinter** dem Waechter liefe fuer keinen von ihnen und fiele auch nicht auf:
 * Neue Nutzer bekaemen ihr Profil, Bestandsnutzer nie. Ein Test auf „insertet
 * in profiles" waere gruen und der Fehler bliebe.
 *
 * ## Warum die Haertung mitgeprueft wird
 *
 * `20260501000000` traegt `SET search_path = public, auth`;
 * `20260506220000_security_revoke_excess_grants.sql` hat die Funktion auf
 * `public, extensions, pg_temp` gehaertet und ihr die Client-Grants entzogen.
 * Ein `CREATE OR REPLACE` nach der aelteren Vorlage haette beides
 * stillschweigend zurueckgenommen — der Fix waere zum Sicherheitsrueckschritt
 * geworden.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PFAD = resolve(
  __dirname,
  '../../supabase/migrations/20260906200000_profiles_on_signup.sql',
);
const sql = readFileSync(PFAD, 'utf8');
const code = sql
  .split('\n')
  .filter((z) => !/^\s*--/.test(z))
  .join('\n');

describe('Der Trigger legt das Profil an', () => {
  it('insertet in public.profiles', () => {
    expect(code).toMatch(/INSERT INTO public\.profiles/i);
  });

  it('tut das VOR dem Mitgliedschafts-Waechter', () => {
    const insert = code.indexOf('INSERT INTO public.profiles');
    const waechter = code.indexOf('IF EXISTS (SELECT 1 FROM public.memberships');
    expect(insert, 'Profil-Insert fehlt').toBeGreaterThan(-1);
    expect(waechter, 'Waechter fehlt').toBeGreaterThan(-1);
    expect(
      insert,
      'Hinter dem Waechter bekaeme kein Bestandsnutzer je ein Profil — ' +
        'der Early-Return greift bei jedem, der schon eine Mitgliedschaft hat.',
    ).toBeLessThan(waechter);
  });

  it('kollidiert nicht mit einem vorhandenen Profil', () => {
    expect(code).toMatch(/ON CONFLICT \(id\) DO NOTHING/i);
  });
});

describe('Die bestehende Mandantenlogik bleibt unangetastet', () => {
  for (const zeile of [
    "IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = NEW.id) THEN",
    "v_local_part := COALESCE(split_part(NEW.email, '@', 1), 'mein-team');",
    'INSERT INTO public.tenants (name)',
    "INSERT INTO public.memberships (tenant_id, user_id, role)",
  ]) {
    it(`enthält unverändert: ${zeile.slice(0, 46)}…`, () => {
      expect(code).toContain(zeile);
    });
  }
});

describe('Die Härtung von 20260506220000 bleibt erhalten', () => {
  it('behält den gehärteten search_path, nicht den aus 20260501000000', () => {
    expect(code).toMatch(/SET search_path TO 'public', 'extensions', 'pg_temp'/);
    expect(code, 'das wäre die zurückgenommene Fassung').not.toMatch(
      /SET search_path = public, auth/,
    );
  });

  it('setzt den REVOKE für anon und authenticated erneut', () => {
    expect(code).toMatch(
      /REVOKE ALL ON FUNCTION public\.handle_new_auth_user\(\) FROM PUBLIC, anon, authenticated/i,
    );
  });

  it('öffnet profiles nicht für clientseitiges INSERT', () => {
    // Das Profil entsteht serverseitig; ein INSERT-Recht im Browser wäre
    // Schreibfläche ohne Bedarf (CLAUDE.md §4).
    expect(code).not.toMatch(/CREATE POLICY[\s\S]{0,200}FOR INSERT/i);
  });
});

describe('Der Nachtrag ist additiv', () => {
  it('legt nur an, was fehlt', () => {
    expect(code).toMatch(/LEFT JOIN public\.profiles p ON p\.id = u\.id\s*\n?\s*WHERE p\.id IS NULL/i);
  });

  it('ändert oder löscht nichts', () => {
    for (const verboten of [/\bDROP TABLE\b/i, /\bTRUNCATE\b/i, /\bDELETE FROM\b/i]) {
      expect(code).not.toMatch(verboten);
    }
    // UPDATE auf profiles wäre ein Eingriff in vorhandene Nutzerdaten.
    expect(code).not.toMatch(/UPDATE public\.profiles/i);
  });
});
