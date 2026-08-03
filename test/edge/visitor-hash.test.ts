/**
 * Vertragstests für die Pageview-Pseudonymisierung (`_shared/visitor-hash.ts`).
 *
 * Belegt den Fix zu T-1 aus COMPLIANCE_AUDIT_2026-07.md:
 *   - session_hash rotierte NICHT täglich (sha256(ip+ua), kein Tagesbestandteil)
 *   - beide Hashes waren ungesalzen und damit über den kleinen Eingaberaum
 *     (IPv4 + gängige User-Agents) praktisch umkehrbar
 *
 * Getestet wird entsprechend:
 *   - Tagesrotation für BEIDE Werte
 *   - Salt geht wirklich ein (anderer Salt → andere Werte)
 *   - visitor_hash != session_hash trotz identischer Eingaben (Scope-Tag)
 *   - kein Salt → wirft (fail closed statt ungesalzen schreiben)
 *   - keine Kollision durch '|' im User-Agent (Längenpräfixe)
 *
 * NICHT getestet (out-of-scope): dass die Function den Salt aus den
 * Function-Secrets liest — das ist Deploy-Konfiguration, keine Logik.
 */
import { describe, it, expect } from 'vitest';
import {
  computeVisitorHashes,
  __internals,
} from '../../supabase/functions/_shared/visitor-hash';

const SALT = 'test-salt-32-bytes-aaaaaaaaaaaaaaaa';
const IP = '203.0.113.7';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0.0.0';

const at = (iso: string) => new Date(iso);

describe('utcDay', () => {
  it('liefert den UTC-Kalendertag', () => {
    expect(__internals.utcDay(at('2026-07-27T10:15:00Z'))).toBe('2026-07-27');
  });

  it('nutzt UTC, nicht die lokale Zeitzone', () => {
    // 23:30 UTC ist in UTC noch der 27., in UTC+2 bereits der 28.
    expect(__internals.utcDay(at('2026-07-27T23:30:00Z'))).toBe('2026-07-27');
  });

  it('wirft bei ungültigem Datum', () => {
    expect(() => __internals.utcDay(new Date('nonsense'))).toThrow(/invalid date/);
  });
});

describe('canonicalMessage', () => {
  it('trennt die Scopes', () => {
    const v = __internals.canonicalMessage('visitor', IP, UA, '2026-07-27');
    const s = __internals.canonicalMessage('session', IP, UA, '2026-07-27');
    expect(v).not.toBe(s);
  });

  it('ist trotz Trennzeichen im User-Agent eindeutig', () => {
    // Ohne Längenpräfixe ergäben diese beiden Kombinationen dieselbe Zeichenkette.
    const a = __internals.canonicalMessage('visitor', '1.2.3.4', '|x', '2026-07-27');
    const b = __internals.canonicalMessage('visitor', '1.2.3.4|', 'x', '2026-07-27');
    expect(a).not.toBe(b);
  });
});

describe('hmacSha256Hex', () => {
  it('ist deterministisch und 64 Zeichen hex', async () => {
    const h1 = await __internals.hmacSha256Hex(SALT, 'msg');
    const h2 = await __internals.hmacSha256Hex(SALT, 'msg');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('wirft bei leerem Secret', async () => {
    await expect(__internals.hmacSha256Hex('', 'msg')).rejects.toThrow(/empty secret/);
  });
});

describe('computeVisitorHashes', () => {
  const base = { ip: IP, userAgent: UA, salt: SALT };

  it('liefert zwei verschiedene 64-Zeichen-Hexwerte', async () => {
    const r = await computeVisitorHashes({ ...base, at: at('2026-07-27T10:00:00Z') });
    expect(r.visitor_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.session_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.visitor_hash).not.toBe(r.session_hash);
    expect(r.day).toBe('2026-07-27');
  });

  it('gleicher Besucher, gleicher Tag → gleiche Werte', async () => {
    const morning = await computeVisitorHashes({ ...base, at: at('2026-07-27T06:00:00Z') });
    const evening = await computeVisitorHashes({ ...base, at: at('2026-07-27T22:00:00Z') });
    expect(evening.visitor_hash).toBe(morning.visitor_hash);
    expect(evening.session_hash).toBe(morning.session_hash);
  });

  // Der eigentliche T-1-Regressionstest.
  it('session_hash rotiert täglich — wie visitor_hash', async () => {
    const day1 = await computeVisitorHashes({ ...base, at: at('2026-07-27T12:00:00Z') });
    const day2 = await computeVisitorHashes({ ...base, at: at('2026-07-28T12:00:00Z') });
    expect(day2.visitor_hash).not.toBe(day1.visitor_hash);
    expect(day2.session_hash).not.toBe(day1.session_hash);
  });

  it('anderer Salt → andere Werte (Salt geht wirklich ein)', async () => {
    const a = await computeVisitorHashes({ ...base, at: at('2026-07-27T12:00:00Z') });
    const b = await computeVisitorHashes({
      ...base, salt: 'ein-anderer-salt', at: at('2026-07-27T12:00:00Z'),
    });
    expect(b.visitor_hash).not.toBe(a.visitor_hash);
    expect(b.session_hash).not.toBe(a.session_hash);
  });

  it('andere IP → andere Werte', async () => {
    const a = await computeVisitorHashes({ ...base, at: at('2026-07-27T12:00:00Z') });
    const b = await computeVisitorHashes({ ...base, ip: '198.51.100.9', at: at('2026-07-27T12:00:00Z') });
    expect(b.visitor_hash).not.toBe(a.visitor_hash);
  });

  it('anderer User-Agent → andere Werte', async () => {
    const a = await computeVisitorHashes({ ...base, at: at('2026-07-27T12:00:00Z') });
    const b = await computeVisitorHashes({ ...base, userAgent: 'curl/8.4.0', at: at('2026-07-27T12:00:00Z') });
    expect(b.visitor_hash).not.toBe(a.visitor_hash);
  });

  it('ohne Salt: wirft, statt ungesalzen zu schreiben (fail closed)', async () => {
    await expect(
      computeVisitorHashes({ ...base, salt: '', at: at('2026-07-27T12:00:00Z') }),
    ).rejects.toThrow(/PAGEVIEW_HASH_SALT is not set/);
  });

  it('leerer User-Agent ist zulässig', async () => {
    const r = await computeVisitorHashes({ ...base, userAgent: '', at: at('2026-07-27T12:00:00Z') });
    expect(r.visitor_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
