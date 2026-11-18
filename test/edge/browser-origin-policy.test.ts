/** Domain-Freigabe (PR B) – reine Funktionen. */
import { describe, expect, it } from 'vitest';
import { bareOrigin, buildOriginPolicy, checkActions } from '../../supabase/functions/_shared/browser-origin-policy.ts';

const A = 'https://musterbetrieb.example';
const policy = (rows: any[]) => buildOriginPolicy(rows);
const allowA = policy([{ id: 'p1', action: 'allow', mode: 'enforce', condition: { scope: 'browser_origin', origins: [A] } }]);

describe('buildOriginPolicy', () => {
  it('ignoriert fremde Scopes, kaputte Einträge und Nicht-http-Origins', () => {
    const p = policy([
      { action: 'allow', mode: 'enforce', condition: { scope: 'anderes', origins: [A] } },
      { action: 'allow', mode: 'enforce', condition: null },
      { action: 'allow', mode: 'enforce', condition: { scope: 'browser_origin', origins: 'nicht-array' } },
      { action: 'allow', mode: 'enforce', condition: { scope: 'browser_origin', origins: ['javascript:alert(1)', 'file:///etc', 42] } },
      { action: 'require_approval', mode: 'enforce', condition: { scope: 'browser_origin', origins: [A] } },
    ]);
    expect(p.allow.size).toBe(0);
  });

  it('normalisiert URLs aus der Richtlinie auf ihren Origin', () => {
    const p = policy([{ action: 'allow', mode: 'enforce', condition: { scope: 'browser_origin', origins: ['https://MUSTERBETRIEB.example/kontakt?x=1'] } }]);
    expect([...p.allow]).toEqual([A]);
  });
});

describe('checkActions', () => {
  it('erlaubt Folge auf freigegebener Domain', () => {
    expect(checkActions([{ type: 'navigate', url: `${A}/` }, { type: 'extract' }], null, null, allowA)).toEqual({ ok: true, checked: [A] });
  });

  it('Subdomain ist nicht automatisch freigegeben', () => {
    const r = checkActions([{ type: 'navigate', url: 'https://evil.musterbetrieb.example/' }], null, null, allowA);
    expect(r.ok).toBe(false);
  });

  it('http und https sind verschiedene Origins', () => {
    expect(checkActions([{ type: 'navigate', url: 'http://musterbetrieb.example/' }], null, null, allowA).ok).toBe(false);
  });

  it('anderer Port ist ein anderer Origin', () => {
    expect(checkActions([{ type: 'navigate', url: 'https://musterbetrieb.example:8443/' }], null, null, allowA).ok).toBe(false);
  });

  it('Zugangsdaten in der URL ändern den Origin nicht, Ziel-Host zählt', () => {
    expect(checkActions([{ type: 'navigate', url: `https://${'musterbetrieb.example'}@sammler.example/` }], null, null, allowA).ok).toBe(false);
  });

  it('Empfänger wird zusätzlich geprüft', () => {
    expect(checkActions([{ type: 'click' }], A, 'https://sammler.example', allowA).ok).toBe(false);
    expect(checkActions([{ type: 'click' }], A, A, allowA).ok).toBe(true);
  });
});

describe('bareOrigin', () => {
  it.each([
    [A, A], [`${A}/`, A], ['https://MUSTERBETRIEB.example', A],
    [`${A}/pfad`, null], [`${A}?q=1`, null], [`${A}#x`, null], ['https://u:p@musterbetrieb.example', null], ['ftp://x.example', null], [42, null],
  ])('%s ⇒ %s', (input, expected) => {
    expect(bareOrigin(input)).toBe(expected);
  });
});
