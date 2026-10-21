/**
 * Lead-Kontext (Scan → Pilot): Validierung und Übergabe ohne URL.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  clearLeadContext,
  isValidLeadEmail,
  normalizeDomainInput,
  readLeadContext,
  rememberLeadContext,
} from '../../../src/features/audit/leadContext';

const ROOT = resolve(__dirname, '../../..');

// jsdom bringt sessionStorage mit; ausserhalb (z. B. Bun) ein Map-Ersatz.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  if (typeof (globalThis as { sessionStorage?: unknown }).sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true, writable: true });
  }
  sessionStorage.clear();
});

describe('normalizeDomainInput (Domain normalisieren / ungültige ablehnen)', () => {
  it('normalizes typical inputs', () => {
    expect(normalizeDomainInput('muster.de')).toBe('muster.de');
    expect(normalizeDomainInput('  https://www.Muster.de/kontakt?x=1#a ')).toBe('muster.de');
    expect(normalizeDomainInput('http://shop.muster.co.uk:443/')).toBe('shop.muster.co.uk');
    expect(normalizeDomainInput('muster.de.')).toBe('muster.de');
    expect(normalizeDomainInput('xn--mller-kva.de')).toBe('xn--mller-kva.de');
  });
  it('rejects invalid domains', () => {
    for (const bad of ['', 'localhost', 'muster', '192.168.0.1', 'http://10.0.0.1', 'mus ter.de', 'muster..de',
      '-muster.de', 'muster.d', 'muster.123', 'javascript:alert(1)', 'a'.repeat(260) + '.de']) {
      expect(normalizeDomainInput(bad), bad).toBeNull();
    }
  });
  it('strips credentials from pasted URLs', () => {
    expect(normalizeDomainInput('https://user:pass@muster.de/')).toBe('muster.de');
  });
});

describe('isValidLeadEmail (E-Mail syntaktisch validieren)', () => {
  it('accepts business addresses', () => {
    expect(isValidLeadEmail('info@muster.de')).toBe(true);
    expect(isValidLeadEmail(' vorname.nachname+scan@muster.co.uk ')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    for (const bad of ['', 'muster.de', 'a@b', 'a@b.c', 'a b@muster.de', 'a@muster de', 'a|b@muster.de', `${'a'.repeat(250)}@muster.de`]) {
      expect(isValidLeadEmail(bad), bad).toBe(false);
    }
  });
});

describe('remember/read/clear', () => {
  it('round-trips normalized values', () => {
    rememberLeadContext({ email: 'Info@Muster.de', domain: 'https://www.muster.de/' });
    expect(readLeadContext()).toEqual({ email: 'info@muster.de', domain: 'muster.de' });
    clearLeadContext();
    expect(readLeadContext()).toBeNull();
  });
  it('stores nothing for invalid input', () => {
    rememberLeadContext({ email: 'kaputt', domain: 'muster.de' });
    expect(readLeadContext()).toBeNull();
  });
  it('expires after two hours', () => {
    rememberLeadContext({ email: 'info@muster.de', domain: 'muster.de' });
    expect(readLeadContext(Date.now() + 2 * 60 * 60 * 1000 + 1)).toBeNull();
  });
  it('ignores tampered storage', () => {
    sessionStorage.setItem('rsd_lead_context', JSON.stringify({ email: 'info@muster.de', domain: 'evil.de/<x>', ts: Date.now() }));
    expect(readLeadContext()).toBeNull();
    sessionStorage.setItem('rsd_lead_context', '{not json');
    expect(readLeadContext()).toBeNull();
  });
});

describe('Pilot-Übergang ohne sensible Daten in URLs', () => {
  const landing = readFileSync(resolve(ROOT, 'src/pages/AuditLanding.tsx'), 'utf8');
  const welcome = readFileSync(resolve(ROOT, 'src/pages/Welcome.tsx'), 'utf8');
  it('AuditLanding remembers the context instead of putting e-mail into links', () => {
    expect(landing).toContain('rememberLeadContext({ email, domain })');
    expect(landing).not.toMatch(/[?&]email=/);
  });
  it('/welcome prefills from the context and clears it after sign-in', () => {
    expect(welcome).toContain("useState(() => readLeadContext()?.email ?? '')");
    expect(welcome).toContain("useState(() => readLeadContext()?.domain ?? '')");
    expect(welcome).toContain('clearLeadContext();');
  });
});
