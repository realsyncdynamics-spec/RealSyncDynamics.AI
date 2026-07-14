import { describe, it, expect } from 'vitest';
import { normalizeDomain, parseDomainList } from '../../src/lib/bulk/domains';

describe('normalizeDomain', () => {
  it('entfernt Schema, Pfad und www bleibt erhalten, lowercased', () => {
    expect(normalizeDomain('https://Example.com/path?x=1')).toBe('example.com');
    expect(normalizeDomain('HTTP://sub.Example.CO.uk/')).toBe('sub.example.co.uk');
  });

  it('lehnt ungültige Eingaben ab (kein Punkt, leer, nur Text)', () => {
    expect(normalizeDomain('localhost')).toBeNull();
    expect(normalizeDomain('   ')).toBeNull();
    expect(normalizeDomain('Acme Corp')).toBeNull();
  });

  it('akzeptiert gültige Multi-Label-Domains', () => {
    expect(normalizeDomain('a-b.example-1.com')).toBe('a-b.example-1.com');
  });
});

describe('parseDomainList', () => {
  it('parst eine gemischte Liste (Zeilen, Komma, Semikolon)', () => {
    const r = parseDomainList('example.com, foo.de\nbar.org; https://baz.io/pfad');
    expect(r.valid).toEqual(['example.com', 'foo.de', 'bar.org', 'baz.io']);
    expect(r.rejected).toHaveLength(0);
    expect(r.total).toBe(4);
  });

  it('dedupliziert nach Normalisierung', () => {
    const r = parseDomainList('example.com\nExample.com\nhttps://example.com/x');
    expect(r.valid).toEqual(['example.com']);
    expect(r.duplicates).toBe(2);
  });

  it('sammelt ungültige Token mit Grund', () => {
    const r = parseDomainList('gut.com\nlocalhost\nnochgut.de\nkaputt');
    expect(r.valid).toEqual(['gut.com', 'nochgut.de']);
    expect(r.rejected.map((x) => x.raw)).toEqual(['localhost', 'kaputt']);
    expect(r.rejected[0].reason).toMatch(/gültiger Domainname/);
  });

  it('behandelt leere Eingabe', () => {
    const r = parseDomainList('   \n  ');
    expect(r.valid).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('ist deterministisch (Reihenfolge des ersten Auftretens)', () => {
    const a = parseDomainList('b.com\na.com\nb.com');
    expect(a.valid).toEqual(['b.com', 'a.com']);
  });
});
