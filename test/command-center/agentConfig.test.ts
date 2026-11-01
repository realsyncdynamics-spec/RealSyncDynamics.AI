import { describe, expect, it } from 'vitest';
import { diffConfig, formatValue, sectionView, validateConfig, type ConfigVersionRow } from '../../src/features/command-center/agentConfig';

describe('validateConfig', () => {
  it('akzeptiert gültige Details', () => {
    expect(validateConfig('details', { role: 'Reviewer', capabilities: ['pr-review'], autopilot_max_level: 'L2' }).ok).toBe(true);
  });
  it('lehnt unbekannte Felder, falsche Typen und ungültiges Level ab', () => {
    const r = validateConfig('details', { foo: 1, capabilities: 'x', autopilot_max_level: 'L9' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('|')).toMatch(/Unbekanntes Feld: foo.*Textliste.*L0–L4/);
  });
  it('lehnt Secrets ab (Wert und Schlüssel)', () => {
    expect(validateConfig('computer', { environment: 'sk_live_abc123' }).ok).toBe(false);
    expect(validateConfig('library', { documents: [{ api_key: 'x' }] }).ok).toBe(false);
  });
  it('lehnt Nicht-Objekte ab', () => {
    expect(validateConfig('library', []).ok).toBe(false);
    expect(validateConfig('library', null).ok).toBe(false);
  });
});

describe('sectionView / diffConfig / formatValue', () => {
  const r = (v: number, status: ConfigVersionRow['status'], section: ConfigVersionRow['section'] = 'details'): ConfigVersionRow => ({
    id: `id${v}${section}`, agent_ref: 'a', section, version: v, config: { role: `r${v}` }, status, change_note: null,
    created_at: '2026-10-30T08:00:00Z', activated_at: null,
  });
  it('trennt aktiv, Entwürfe und Verlauf je Bereich', () => {
    const v = sectionView([r(1, 'superseded'), r(2, 'active'), r(3, 'draft'), r(1, 'active', 'computer')], 'a', 'details');
    expect(v.active?.version).toBe(2);
    expect(v.drafts.map((x) => x.version)).toEqual([3]);
    expect(v.history.map((x) => x.version)).toEqual([1]);
  });
  it('diff und Anzeige', () => {
    expect(diffConfig({ role: 'a', tools: ['x'] }, { role: 'b', tools: ['x'] })).toEqual(['role']);
    expect(diffConfig(null, { role: 'b' })).toEqual(['role']);
    expect(formatValue(undefined)).toBe('nicht gesetzt');
    expect(formatValue(['a', 'b'])).toBe('a, b');
  });
});
