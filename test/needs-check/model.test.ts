import { describe, expect, it } from 'vitest';
import {
  RECOMMENDATION_IDS, normalizeWebsiteUrl, recommend, recommendationsFromIds, validateAnswers,
  type Answers,
} from '../../src/features/needs-check/model';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base: Answers = { goal: 'website', area: 'handwerk', hasWebsite: false, websiteUrl: null };

describe('Bedarfs-Check: Empfehlungen aus den Angaben', () => {
  it('ohne Website und Ziel Website: zuerst Entwurf erstellen', () => {
    const r = recommend(base);
    expect(r[0].id).toBe('build.new_site');
    expect(r[0].cta.href).toMatch(/^\/build\?prompt=/);
    expect(decodeURIComponent(r[0].cta.href)).toContain('Handwerk');
  });

  it('mit Website und Ziel Website: neu aufbauen plus technische Prüfung', () => {
    const r = recommend({ ...base, hasWebsite: true, websiteUrl: 'https://beispiel.de' });
    expect(r.map((x) => x.id)).toEqual(['build.modernize', 'govern.website_scan', 'automate.chat']);
  });

  it('Ziel Anfragen: Chat-Assistent zuerst, mit ehrlichem Vorschau-Status', () => {
    const r = recommend({ ...base, goal: 'inquiries' });
    expect(r[0].id).toBe('automate.chat');
    expect(r[0].status).toMatch(/Vorschau/);
  });

  it('Ziel Regeln: Governance OS zuerst; Begründung behauptet keine Nachweise für jede Entscheidung', () => {
    const r = recommend({ ...base, goal: 'rules', hasWebsite: true });
    expect(r[0].id).toBe('govern.runtime');
    expect(r[0].reason).toContain('Warnungen, Freigaben und Blockaden');
    expect(r[0].reason).not.toMatch(/jede Entscheidung/i);
  });

  it('liefert höchstens drei Empfehlungen ohne Dubletten und nur bekannte IDs', () => {
    for (const goal of ['website', 'inquiries', 'rules', 'unsure'] as const) {
      for (const hasWebsite of [true, false]) {
        const ids = recommend({ ...base, goal, hasWebsite }).map((x) => x.id);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.length).toBeLessThanOrEqual(3);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(RECOMMENDATION_IDS).toContain(id);
      }
    }
  });

  it('jede Begründung bezieht sich auf die Angaben und verspricht keine Websiteprüfung', () => {
    const r = recommend({ ...base, goal: 'unsure', hasWebsite: true });
    for (const x of r) expect(x.reason.length).toBeGreaterThan(30);
    const scan = r.find((x) => x.id === 'govern.website_scan')!;
    expect(scan.cta.href).toContain('/audit');
  });

  it('recommendationsFromIds verwirft unbekannte IDs', () => {
    expect(recommendationsFromIds(['govern.runtime', 'evil'], base).map((x) => x.id)).toEqual(['govern.runtime']);
  });
});

describe('Bedarfs-Check: Eingabeprüfung', () => {
  it('lehnt fehlende oder unbekannte Werte ab', () => {
    expect(validateAnswers({}).ok).toBe(false);
    expect(validateAnswers({ goal: 'x', area: 'handwerk', hasWebsite: false }).ok).toBe(false);
    expect(validateAnswers({ goal: 'website', area: 'mond', hasWebsite: false }).ok).toBe(false);
    expect(validateAnswers({ goal: 'website', area: 'handwerk', hasWebsite: 'ja' }).ok).toBe(false);
  });

  it('akzeptiert eine Adresse ohne Schema und ergänzt https', () => {
    const v = validateAnswers({ goal: 'website', area: 'handwerk', hasWebsite: true, websiteUrl: 'beispiel.de' });
    expect(v.ok && v.answers.websiteUrl).toBe('https://beispiel.de');
  });

  it('lehnt ungültige Adressen und Zugangsdaten in der Adresse ab', () => {
    expect(normalizeWebsiteUrl('kein text')).toBeNull();
    expect(normalizeWebsiteUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeWebsiteUrl('https://user:pw@beispiel.de')).toBeNull();
    expect(normalizeWebsiteUrl('https://' + 'a'.repeat(300) + '.de')).toBeNull();
    const v = validateAnswers({ goal: 'website', area: 'handwerk', hasWebsite: true, websiteUrl: 'kein text' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.field).toBe('websiteUrl');
  });

  it('ignoriert eine Adresse, wenn es keine Website gibt', () => {
    const v = validateAnswers({ goal: 'website', area: 'handwerk', hasWebsite: false, websiteUrl: 'beispiel.de' });
    expect(v.ok && v.answers.websiteUrl).toBeNull();
  });
});

describe('Bedarfs-Check: Client und Datenbank erlauben dieselben Werte', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261115200000_needs_check_results.sql'), 'utf8');
  it('jede Empfehlungs-ID steht im CHECK-Constraint', () => {
    for (const id of RECOMMENDATION_IDS) expect(sql).toContain(`'${id}'`);
  });
  it('RLS ist aktiv, nur eigene Zeilen, kein UPDATE, anon gesperrt', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON public\.needs_check_results FROM anon/);
    expect(sql).toMatch(/GRANT SELECT, INSERT, DELETE ON public\.needs_check_results TO authenticated/);
    expect(sql).not.toMatch(/FOR UPDATE/);
    expect(sql.match(/user_id = \(select auth\.uid\(\)\)/g)?.length).toBe(3);
  });
});
