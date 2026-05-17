import { describe, it, expect } from 'vitest';
import {
  redactString,
  redactJson,
  applyPolicy,
  sumHits,
  emptyHits,
} from '../supabase/functions/_shared/redact';

describe('redactString', () => {
  it('redacts email addresses', () => {
    const r = redactString('Kontakt: max.mustermann@example.de bitte');
    expect(r.text).toBe('Kontakt: [REDACTED:email] bitte');
    expect(r.hits.email).toBe(1);
  });

  it('redacts German IBAN', () => {
    const r = redactString('IBAN DE89 3704 0044 0532 0130 00 ueberweisen');
    expect(r.text).toContain('[REDACTED:iban]');
    expect(r.hits.iban).toBe(1);
  });

  it('redacts German phone number', () => {
    const r = redactString('Rufen Sie +49 30 12345678 an');
    expect(r.text).toContain('[REDACTED:phone_de]');
    expect(r.hits.phone_de).toBe(1);
  });

  it('redacts date of birth', () => {
    const r = redactString('Geboren am 15.03.1985 in Berlin');
    expect(r.text).toContain('[REDACTED:date_of_birth]');
    expect(r.hits.date_of_birth).toBe(1);
  });

  it('redacts IPv4 addresses', () => {
    const r = redactString('Client-IP 192.168.1.42 hat zugegriffen');
    expect(r.text).toContain('[REDACTED:ipv4]');
    expect(r.hits.ipv4).toBe(1);
  });

  it('returns empty hits for clean text', () => {
    const r = redactString('Dies ist ein neutraler Satz.');
    expect(r.text).toBe('Dies ist ein neutraler Satz.');
    expect(sumHits(r.hits)).toBe(0);
  });

  it('handles empty and non-string input safely', () => {
    expect(redactString('').text).toBe('');
    expect(sumHits(redactString('').hits)).toBe(0);
  });

  it('redacts multiple categories in one string', () => {
    const r = redactString('max@example.de schreibt von 192.168.0.1');
    expect(r.hits.email).toBe(1);
    expect(r.hits.ipv4).toBe(1);
    expect(r.text).not.toContain('max@example.de');
    expect(r.text).not.toContain('192.168.0.1');
  });
});

describe('redactJson', () => {
  it('walks nested objects', () => {
    const input = {
      user: { email: 'foo@bar.de', name: 'Max' },
      log: ['IP 10.0.0.1', 'OK'],
    };
    const { redacted, hits } = redactJson(input);
    expect((redacted as typeof input).user.email).toBe('[REDACTED:email]');
    expect((redacted as typeof input).user.name).toBe('Max');
    expect((redacted as typeof input).log[0]).toContain('[REDACTED:ipv4]');
    expect(hits.email).toBe(1);
    expect(hits.ipv4).toBe(1);
  });

  it('does not mutate input', () => {
    const input = { msg: 'kontakt@firma.de' };
    redactJson(input);
    expect(input.msg).toBe('kontakt@firma.de');
  });

  it('passes through numbers, booleans, null', () => {
    const { redacted } = redactJson({ n: 42, b: true, x: null });
    expect(redacted).toEqual({ n: 42, b: true, x: null });
  });
});

describe('applyPolicy', () => {
  const input = { contact: 'test@example.org' };

  it('"always" redacts', () => {
    const { redacted, hits } = applyPolicy(input, 'always');
    expect((redacted as typeof input).contact).toBe('[REDACTED:email]');
    expect(hits.email).toBe(1);
  });

  it('"third_party_only" treats input as the third-party subtree', () => {
    // Caller-Verantwortung: nur den Drittpartei-Teilbaum reinreichen.
    const { redacted, hits } = applyPolicy(input, 'third_party_only');
    expect((redacted as typeof input).contact).toBe('[REDACTED:email]');
    expect(hits.email).toBe(1);
  });

  it('"never" returns unchanged value with zero hits', () => {
    const { redacted, hits } = applyPolicy(input, 'never');
    expect(redacted).toEqual(input);
    expect(sumHits(hits)).toBe(0);
  });
});

describe('emptyHits', () => {
  it('returns a fresh zeroed object each call (no shared reference)', () => {
    const a = emptyHits();
    a.email = 5;
    const b = emptyHits();
    expect(b.email).toBe(0);
  });
});
