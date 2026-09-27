import { describe, expect, it } from 'vitest';
import {
  MAX_PLAN_STEPS,
  buildPlannerInput,
  parseBrowserPlan,
  sanitizePlannedAction,
} from '../../../supabase/functions/_shared/browser-plan';

const plan = (steps: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ summary: 'Cookie-Banner prüfen', steps, ...extra });

describe('parseBrowserPlan', () => {
  it('akzeptiert einen gültigen Plan (auch in ```json-Fences)', () => {
    const out = '```json\n' + plan([
      { action: { type: 'navigate', url: 'https://example.com' }, reason: 'Seite öffnen' },
      { action: { type: 'extract', selector: '#cookie-banner' }, reason: 'Banner lesen' },
      { action: { type: 'screenshot' } },
    ]) + '\n```';
    const result = parseBrowserPlan(out);
    expect(result.kind).toBe('plan');
    if (result.kind !== 'plan') return;
    expect(result.summary).toBe('Cookie-Banner prüfen');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].action).toEqual({ type: 'navigate', url: 'https://example.com/' });
    expect(result.steps[2].reason).toBe('');
  });

  it('gibt eine Ablehnung des Modells weiter', () => {
    expect(parseBrowserPlan('{"refused": "Käufe sind nicht erlaubt"}'))
      .toEqual({ kind: 'refused', reason: 'Käufe sind nicht erlaubt' });
  });

  it('verwirft den ganzen Plan bei einem ungültigen Schritt', () => {
    const result = parseBrowserPlan(plan([
      { action: { type: 'navigate', url: 'https://example.com' } },
      { action: { type: 'navigate', url: 'javascript:alert(1)' } },
    ]));
    expect(result).toEqual({ kind: 'invalid', error: 'Schritt 2 ist ungültig.' });
  });

  it('lehnt Nicht-JSON, leere und zu lange Pläne ab', () => {
    expect(parseBrowserPlan('Ich öffne jetzt die Seite.').kind).toBe('invalid');
    expect(parseBrowserPlan(plan([])).kind).toBe('invalid');
    const tooMany = Array.from({ length: MAX_PLAN_STEPS + 1 }, () => ({ action: { type: 'screenshot' } }));
    expect(parseBrowserPlan(plan(tooMany)).kind).toBe('invalid');
  });
});

describe('sanitizePlannedAction', () => {
  it('lässt nur bekannte Typen und Felder durch', () => {
    expect(sanitizePlannedAction({ type: 'evaluate', script: 'x' })).toBeNull();
    expect(sanitizePlannedAction({ type: 'click', selector: '#ok', extra: 'drop' }))
      .toEqual({ type: 'click', selector: '#ok' });
    expect(sanitizePlannedAction({ type: 'type', selector: '#q' })).toBeNull();
    expect(sanitizePlannedAction({ type: 'navigate', url: 'file:///etc/passwd' })).toBeNull();
  });

  it('begrenzt Scroll- und Wartewerte', () => {
    expect(sanitizePlannedAction({ type: 'scroll', direction: 'down', amount: 99999 }))
      .toEqual({ type: 'scroll', direction: 'down', amount: 5000 });
    expect(sanitizePlannedAction({ type: 'wait', milliseconds: 60000 }))
      .toEqual({ type: 'wait', milliseconds: 10000 });
    expect(sanitizePlannedAction({ type: 'scroll', direction: 'left' })).toBeNull();
  });
});

describe('buildPlannerInput', () => {
  it('enthält Aufgabe und aktuelle Seite', () => {
    const input = buildPlannerInput('Impressum finden', 'https://example.com/');
    expect(input).toContain('AUFGABE: Impressum finden');
    expect(input).toContain('AKTUELLE SEITE: https://example.com/');
  });
});
