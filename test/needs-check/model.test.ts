/**
 * Bedarfs-Check — gemeinsames Modell (shared/needs-check.ts).
 *
 * Reine Logik, kein Backend. Die Parität zur SQL-Funktion prüft
 * test/runtime/db/needs-check-results.db.test.ts gegen Postgres.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AREAS, GOALS, NEEDS_CHECK_CATALOG, NEEDS_CHECK_MODEL_VERSION, RECOMMENDATION_IDS, WEBSITE_URL_PATTERN,
  normalizeWebsiteUrl, recommend, recommendIds, renderRecommendations, validateAnswers,
} from '../../shared/needs-check';

const readMigration = (f: string) => readFileSync(join(__dirname, '../../supabase/migrations', f), 'utf8');
/** Erstfassung (#2262, angewendet) — legt Tabelle, erlaubte Werte und RLS-Policies an. */
const BASE = readMigration('20261115200000_needs_check_results.sql');
/** Härtung — Grants, Trigger, Kontingent, Empfehlung, Ausschluss der Scan-Referenz. */
const MIGRATION = readMigration('20261117190000_needs_check_results_hardening.sql');

describe('Eingabeprüfung', () => {
  it('nimmt gültige Angaben an und normalisiert die Adresse', () => {
    const v = validateAnswers({ goal: 'website', area: 'handwerk', hasWebsite: true, websiteUrl: 'beispiel.de' });
    expect(v).toEqual({ ok: true, answers: { goal: 'website', area: 'handwerk', hasWebsite: true, websiteUrl: 'https://beispiel.de' } });
  });

  it('verwirft eine Adresse, wenn es keine Website gibt', () => {
    const v = validateAnswers({ goal: 'rules', area: 'kanzlei', hasWebsite: false, websiteUrl: 'beispiel.de' });
    expect(v.ok && v.answers.websiteUrl).toBeNull();
  });

  it.each([
    [{ goal: 'hack', area: 'handwerk', hasWebsite: false }, 'goal'],
    [{ goal: 'rules', area: 'mars', hasWebsite: false }, 'area'],
    [{ goal: 'rules', area: 'kanzlei', hasWebsite: 'ja' }, 'hasWebsite'],
    [{ goal: 'rules', area: 'kanzlei', hasWebsite: true, websiteUrl: 'kein text' }, 'websiteUrl'],
  ])('lehnt %o ab (%s)', (input, field) => {
    const v = validateAnswers(input as never);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.field).toBe(field);
  });

  it.each(['https://user:pw@a.de', 'javascript:alert(1)', `https://a.de/${'x'.repeat(300)}`, 'ftp://a.de'])(
    'normalizeWebsiteUrl lehnt %s ab',
    (raw) => expect(normalizeWebsiteUrl(raw)).toBeNull(),
  );
});

describe('Empfehlungslogik Version 1', () => {
  it('liefert für jede Kombination 1–3 eindeutige, bekannte IDs', () => {
    for (const goal of GOALS) {
      for (const hasWebsite of [true, false]) {
        const ids = recommendIds({ goal, hasWebsite });
        expect(ids.length, `${goal}/${hasWebsite}`).toBeGreaterThanOrEqual(1);
        expect(ids.length).toBeLessThanOrEqual(3);
        expect(new Set(ids).size).toBe(ids.length);
        ids.forEach((id) => expect(RECOMMENDATION_IDS).toContain(id));
      }
    }
  });

  it('erste Empfehlung folgt dem Ziel', () => {
    expect(recommendIds({ goal: 'website', hasWebsite: false })[0]).toBe('build.new_site');
    expect(recommendIds({ goal: 'website', hasWebsite: true })[0]).toBe('build.modernize');
    expect(recommendIds({ goal: 'inquiries', hasWebsite: false })[0]).toBe('automate.chat');
    expect(recommendIds({ goal: 'rules', hasWebsite: true })[0]).toBe('govern.runtime');
  });

  it('Texte beziehen sich auf die Angaben', () => {
    const [first] = recommend({ goal: 'website', area: 'praxis', hasWebsite: false, websiteUrl: null });
    expect(first!.reason).toContain('Praxis-Betrieb');
    expect(first!.cta.href).toMatch(/^\/build\?prompt=/);
  });
});

describe('Versionierter Katalog', () => {
  it('Version 1 ist eingefroren — Textänderungen brauchen eine neue Version', () => {
    // Schlägt dieser Test fehl, wurden Texte oder Links von Version 1 geändert.
    // Gespeicherte Ergebnisse würden dann andere Formulierungen zeigen als beim
    // Speichern. Stattdessen: Version 2 anlegen (Katalog, Logik, SQL-Funktion,
    // CHECK in einer neuen Migration) und Version 1 unverändert lassen.
    const hash = createHash('sha256').update(JSON.stringify(NEEDS_CHECK_CATALOG[1])).digest('hex');
    expect(hash).toBe('7ba103d84a7db4d6d9fff40ea2c5555f1cccc644daa540e290275ef62bdcd41f');
  });

  it('enthält keine Preise und keine Verfügbarkeitsangaben', () => {
    const text = JSON.stringify(NEEDS_CHECK_CATALOG);
    expect(text).not.toMatch(/€|\bEUR\b|\bpreis|kostenlos testen|Vorschau|Preview|\blive\b|verfügbar/i);
  });

  it('rendert gespeicherte IDs mit dem Katalog ihrer Version und überspringt Unbekanntes', () => {
    const recs = renderRecommendations(
      ['govern.runtime', 'manipuliert', 'automate.chat'],
      { goal: 'rules', area: 'kanzlei', hasWebsite: false, websiteUrl: null },
      1,
    );
    expect(recs.map((r) => r.id)).toEqual(['govern.runtime', 'automate.chat']);
    expect(recs[0]!.title).toBe(NEEDS_CHECK_CATALOG[1].recommendations['govern.runtime'].title);
  });
});

describe('Abgleich mit der Migration', () => {
  it('erlaubte Werte und Adressmuster stimmen mit den CHECK-Constraints überein', () => {
    expect(BASE).toContain(`goal IN (${GOALS.map((g) => `'${g}'`).join(', ')})`);
    expect(BASE).toContain(`area IN (${AREAS.map((a) => `'${a}'`).join(', ')})`);
    expect(MIGRATION).toContain(`website_url ~* '${WEBSITE_URL_PATTERN}'`);
    expect(MIGRATION).toContain(`model_version in (${NEEDS_CHECK_MODEL_VERSION})`);
  });

  it('der Client darf nur die vier Angaben schreiben', () => {
    expect(MIGRATION).toContain('grant insert (goal, area, has_website, website_url) on public.needs_check_results to authenticated;');
    // Kein tabellenweites INSERT/ALL und kein UPDATE für Nutzer.
    expect(MIGRATION).not.toMatch(/grant (all|[a-z, ]*\binsert) on public\.needs_check_results to authenticated/i);
    expect(MIGRATION).not.toMatch(/grant[^;]*\bupdate\b[^;]*on public\.needs_check_results/i);
  });

  it('keine Scan-Referenz im Ergebnis: Spalten bleiben, sind aber festgelegt und nicht beschreibbar', () => {
    expect(MIGRATION).toContain("check (audit_id is null and result_basis = 'answers')");
    expect(MIGRATION).toContain("new.audit_id := null;");
    expect(MIGRATION).not.toMatch(/grant insert \([^)]*(audit_id|result_basis)/i);
  });

  it('Härtung ist additiv: keine gelöschte Tabelle oder Spalte, alte Kontingent-Logik ersetzt', () => {
    expect(MIGRATION).not.toMatch(/drop\s+table|drop\s+column|truncate|delete\s+from\s+public\.needs_check_results/i);
    expect(MIGRATION).toContain('drop trigger if exists needs_check_results_rate_limit_trg');
    expect(MIGRATION).toContain('drop function if exists public.needs_check_results_rate_limit()');
  });
});
