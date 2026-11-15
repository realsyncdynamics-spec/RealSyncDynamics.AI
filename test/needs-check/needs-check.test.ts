/**
 * Bedarfs-Check: Auswertung, Eingabeprüfung und Verdrahtung.
 *
 * Die Logik-Tests laufen gegen die echten Funktionen. Die Verdrahtungs-Tests
 * lesen Quelltext (Route, Migration, Seite) — sie belegen, dass etwas
 * vorhanden ist, nicht, dass es gegen eine Datenbank funktioniert. Ein
 * Integrationstest gegen Supabase (RLS mit zwei Nutzern) ist hier nicht enthalten.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NEEDS_AREAS,
  NEEDS_GOALS,
  NEEDS_QUESTIONS,
  NEEDS_WEBSITE,
  deriveNeedsResult,
  parseNeedsAnswers,
  type NeedsAnswers,
} from '../../shared/needs-check';
import { CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const ALL: NeedsAnswers[] = NEEDS_GOALS.flatMap((goal) =>
  NEEDS_AREAS.flatMap((area) => NEEDS_WEBSITE.map((website) => ({ goal, area, website }))),
);

describe('parseNeedsAnswers', () => {
  it('nimmt gültige Antworten an', () => {
    expect(parseNeedsAnswers({ goal: 'new_website', area: 'trade', website: 'no' })).toEqual({
      goal: 'new_website',
      area: 'trade',
      website: 'no',
    });
  });

  it.each([
    null,
    undefined,
    'text',
    [],
    {},
    { goal: 'new_website', area: 'trade' },
    { goal: 'unbekannt', area: 'trade', website: 'no' },
    { goal: 'new_website', area: 'trade', website: 'vielleicht' },
    { goal: 'new_website', area: 'trade', website: 'no', extra: 'x' },
    { goal: 1, area: 'trade', website: 'no' },
  ])('weist ungültige Eingaben ab (%j)', (value) => {
    expect(parseNeedsAnswers(value)).toBeNull();
  });
});

describe('deriveNeedsResult', () => {
  it('liefert für jede Kombination mindestens eine Empfehlung auf Basis der Angaben', () => {
    for (const answers of ALL) {
      const result = deriveNeedsResult(answers);
      expect(result.basis).toBe('self_report');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]?.pillar).toBe(result.primary);
      const ids = result.recommendations.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('ist deterministisch', () => {
    for (const answers of ALL) {
      expect(deriveNeedsResult(answers)).toEqual(deriveNeedsResult({ ...answers }));
    }
  });

  it('verweist nur bei vorhandener Website auf die technische Prüfung', () => {
    for (const answers of ALL) {
      const technical = deriveNeedsResult(answers).recommendations.filter((r) => r.startsTechnicalCheck);
      if (answers.website === 'yes') {
        expect(technical.map((r) => r.to)).toEqual(['/audit']);
      } else {
        expect(technical).toEqual([]);
      }
    }
  });

  it('ordnet die Ziele den Bereichen Build, Automate und Govern zu', () => {
    expect(deriveNeedsResult({ goal: 'new_website', area: 'trade', website: 'no' }).primary).toBe('build');
    expect(deriveNeedsResult({ goal: 'more_inquiries', area: 'trade', website: 'no' }).primary).toBe('build');
    expect(deriveNeedsResult({ goal: 'more_inquiries', area: 'trade', website: 'yes' }).primary).toBe('automate');
    expect(deriveNeedsResult({ goal: 'answer_customers', area: 'office', website: 'yes' }).primary).toBe('automate');
    expect(deriveNeedsResult({ goal: 'ai_rules', area: 'office', website: 'no' }).primary).toBe('govern');
  });

  it('nennt weder Preise noch Zusagen und keine untersagten CTA-Wörter', () => {
    const texts = [
      ...NEEDS_QUESTIONS.flatMap((q) => [q.title, q.hint, ...q.options.map((o) => o.label)]),
      ...ALL.flatMap((a) =>
        deriveNeedsResult(a).recommendations.flatMap((r) => [r.title, r.reason, r.linkLabel]),
      ),
    ].join('\n');
    expect(texts).not.toMatch(/€|\bEUR\b|garantiert|konform|zertifiziert/i);
    for (const word of CI_FORBIDDEN_CTA) {
      expect(texts.toLowerCase()).not.toContain(String(word).toLowerCase());
    }
  });
});

describe('Verdrahtung (Quelltext)', () => {
  const app = read('src/App.tsx');
  const page = read('src/pages/product-entry-points/NeedsCheckPage.tsx');
  const api = read('src/features/needs-check/api.ts');
  const migration = read('supabase/migrations/20261115203000_needs_check_results.sql');
  const landing = read('src/components/landing/v6/LandingV6View.tsx');

  it('Route /check ist registriert und von der Startseite erreichbar', () => {
    expect(app).toContain('<Route path="/check" element={<NeedsCheckPage />} />');
    expect(landing).toContain('to="/check"');
  });

  it('jede Empfehlung zeigt auf eine vorhandene Route', () => {
    const targets = new Set(ALL.flatMap((a) => deriveNeedsResult(a).recommendations.map((r) => r.to)));
    for (const to of targets) {
      expect(app).toContain(`path="${to}"`);
    }
  });

  it('die Seite kennzeichnet das Ergebnis als Selbstauskunft', () => {
    expect(page).toContain('Es wurde keine Website abgerufen und nichts technisch geprüft.');
    expect(page).toContain("save.kind === 'saved'");
  });

  it('der Client setzt weder user_id noch Service-Schlüssel', () => {
    expect(api).not.toMatch(/user_id\s*:/);
    expect(api + page).not.toMatch(/service_role|SERVICE_ROLE/);
  });

  it('die Migration aktiviert RLS, beschränkt auf eigene Zeilen und sperrt anon', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on public.needs_check_results from anon');
    expect(migration.match(/user_id = \(select auth\.uid\(\)\)/g)?.length).toBe(3);
    expect(migration).not.toMatch(/for update|for all/i);
  });

  it('die Datenbank erlaubt genau die Werte der Anwendung', () => {
    for (const value of [...NEEDS_GOALS, ...NEEDS_AREAS, ...NEEDS_WEBSITE]) {
      expect(migration).toContain(`'${value}'`);
    }
  });
});
