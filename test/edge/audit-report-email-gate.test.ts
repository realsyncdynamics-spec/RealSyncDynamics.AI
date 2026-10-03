/**
 * Grenze von audit-report-email.
 *
 * Die Function läuft mit `verify_jwt = false`, ihr Kopfkommentar behauptete
 * aber jahrelang das Gegenteil — und im Code gab es keinen eigenen Gate. Wer
 * eine Audit-ID kannte, konnte den Versand auslösen und bekam die
 * Empfängeradresse in der Antwort zurück (gemessen 2026-09-15: 180 von 180
 * Zeilen unversandt, also jede auslösbar).
 *
 * Diese Datei nagelt zwei Dinge fest: die Entscheidungsregel selbst und dass
 * `index.ts` sie tatsächlich vor dem Versand anwendet.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decideSend,
  FRESH_WINDOW_MS,
  CLOCK_SKEW_MS,
} from '../../supabase/functions/audit-report-email/gate';

const KEY = 'service-role-test-key';
const NOW = Date.parse('2026-09-15T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('decideSend', () => {
  it('lässt den Browser direkt nach dem Scan durch', () => {
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: ago(5_000), now: NOW })).toBe('fresh');
  });

  it('lässt ihn bis zum Ende des Fensters durch', () => {
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: ago(FRESH_WINDOW_MS), now: NOW })).toBe('fresh');
  });

  it('sperrt eine später abgegriffene ID', () => {
    // Geteilter Report-Link, Browser-Verlauf, Referrer — alles nach dem Scan.
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: ago(FRESH_WINDOW_MS + 1), now: NOW })).toBe('denied');
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: ago(30 * 86_400_000), now: NOW })).toBe('denied');
  });

  it('toleriert kleinen Uhrenversatz, aber keine Zukunftszeilen', () => {
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: ago(-CLOCK_SKEW_MS), now: NOW })).toBe('fresh');
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: ago(-CLOCK_SKEW_MS - 1), now: NOW })).toBe('denied');
  });

  it('sperrt bei fehlendem oder unlesbarem created_at', () => {
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: null, now: NOW })).toBe('denied');
    expect(decideSend({ authHeader: null, serviceKey: KEY, createdAt: 'kein-datum', now: NOW })).toBe('denied');
  });

  it('lässt den Service-Role-Bearer auch für alte Zeilen durch', () => {
    // Offener Pfad für einen künftigen Cron-Sweep unversandter Audits.
    expect(decideSend({ authHeader: `Bearer ${KEY}`, serviceKey: KEY, createdAt: ago(30 * 86_400_000), now: NOW })).toBe('service');
  });

  it('wertet einen falschen Bearer nicht als Berechtigung', () => {
    const old = ago(FRESH_WINDOW_MS + 1);
    expect(decideSend({ authHeader: 'Bearer falsch', serviceKey: KEY, createdAt: old, now: NOW })).toBe('denied');
    expect(decideSend({ authHeader: KEY, serviceKey: KEY, createdAt: old, now: NOW })).toBe('denied');
    // Anon-Key oder User-JWT des Browsers ist kein Service-Role-Key.
    expect(decideSend({ authHeader: 'Bearer eyJhbGciOi.anon', serviceKey: KEY, createdAt: old, now: NOW })).toBe('denied');
  });

  it('öffnet nichts, wenn der Service-Key in der Runtime fehlt', () => {
    const old = ago(FRESH_WINDOW_MS + 1);
    expect(decideSend({ authHeader: 'Bearer undefined', serviceKey: undefined, createdAt: old, now: NOW })).toBe('denied');
    expect(decideSend({ authHeader: 'Bearer ', serviceKey: '', createdAt: old, now: NOW })).toBe('denied');
  });
});

describe('audit-report-email: Verdrahtung', () => {
  const root = resolve(__dirname, '../..');
  const src = readFileSync(resolve(root, 'supabase/functions/audit-report-email/index.ts'), 'utf8');
  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  const code = src.replace(/^\s*\/\/.*$/gm, '');

  it('prüft die Grenze, bevor versendet oder der Versandstatus verraten wird', () => {
    const gate = code.indexOf('decideSend(');
    const denied = code.indexOf("=== 'denied'");
    expect(gate).toBeGreaterThan(-1);
    expect(denied).toBeGreaterThan(gate);
    expect(denied).toBeLessThan(code.indexOf('audit.email_sent_at'));
    expect(denied).toBeLessThan(code.indexOf('api.resend.com'));
  });

  it('gibt die Empfängeradresse in keiner Antwort zurück', () => {
    const responses = code.match(/jsonResponse\([\s\S]*?\);/g) ?? [];
    expect(responses.length).toBeGreaterThan(0);
    for (const r of responses) expect(r).not.toMatch(/audit\.email\b/);
  });

  it('Kopfkommentar und config.toml widersprechen sich nicht', () => {
    const block = config.match(/\[functions\.audit-report-email\]\s*\n\s*verify_jwt\s*=\s*(\w+)/);
    expect(block?.[1]).toBe('false');
    expect(src).toMatch(/verify_jwt = false/);
    expect(src).not.toMatch(/requires verify_jwt/);
    // Die Sammelliste der verify_jwt=true-Functions darf sie nicht mehr führen.
    const defaultList = config.slice(config.indexOf('# All other functions'));
    expect(defaultList).not.toContain('audit-report-email');
  });
});
