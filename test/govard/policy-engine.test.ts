import { describe, expect, it } from 'vitest';
import { evaluatePolicies, evaluateRule } from '../../workers/govard-gateway/src/policy/engine';
import type { PolicyRule, PolicyVersion } from '../../workers/govard-gateway/src/types';

let versionCounter = 0;
function policy(rule: PolicyRule, action: PolicyVersion['action'] = 'DENY'): PolicyVersion {
  versionCounter += 1;
  return {
    id: `pv-${versionCounter}`,
    org_id: 'org-1',
    policy_id: `p-${versionCounter}`,
    version: 1,
    name: `policy-${versionCounter}`,
    rule,
    action,
    rule_hash: `hash-${versionCounter}`,
  };
}

const command = (intent: string, payload: Record<string, unknown> = {}) => ({
  intent,
  payload,
  payload_hash: 'ph-1',
});

describe('govard evaluateRule', () => {
  it('ALLOWED_INTENTS: Intent außerhalb der Liste ist ein Verstoß', () => {
    const rule: PolicyRule = { type: 'ALLOWED_INTENTS', intents: ['send_email'] };
    expect(evaluateRule(rule, command('send_email')).status).toBe('PASS');
    expect(evaluateRule(rule, command('transfer_money')).status).toBe('VIOLATION');
  });

  it('REQUIRE_APPROVAL_FOR_INTENT: greift nur bei gelisteten Intents', () => {
    const rule: PolicyRule = { type: 'REQUIRE_APPROVAL_FOR_INTENT', intents: ['send_campaign'] };
    expect(evaluateRule(rule, command('send_campaign')).status).toBe('VIOLATION');
    expect(evaluateRule(rule, command('draft_text')).status).toBe('NOT_APPLICABLE');
  });

  it('MAX_BUDGET: prüft Limit, ist ohne Budget nicht anwendbar', () => {
    const rule: PolicyRule = { type: 'MAX_BUDGET', currency: 'EUR', value: 500 };
    expect(evaluateRule(rule, command('x', { budget: { value: 499, currency: 'EUR' } })).status).toBe('PASS');
    expect(evaluateRule(rule, command('x', { budget: { value: 501, currency: 'EUR' } })).status).toBe('VIOLATION');
    expect(evaluateRule(rule, command('x')).status).toBe('NOT_APPLICABLE');
  });

  it('MAX_BUDGET: fremde Währung ist unprüfbar und damit ein Verstoß, kein Skip', () => {
    const rule: PolicyRule = { type: 'MAX_BUDGET', currency: 'EUR', value: 500 };
    const outcome = evaluateRule(rule, command('x', { budget: { value: 1, currency: 'USD' } }));
    expect(outcome.status).toBe('VIOLATION');
  });

  it('MAX_RECIPIENTS: zählt recipients[] oder recipient_count', () => {
    const rule: PolicyRule = { type: 'MAX_RECIPIENTS', value: 2 };
    expect(evaluateRule(rule, command('x', { recipients: ['a@b.de', 'c@b.de'] })).status).toBe('PASS');
    expect(evaluateRule(rule, command('x', { recipient_count: 4200 })).status).toBe('VIOLATION');
    expect(evaluateRule(rule, command('x')).status).toBe('NOT_APPLICABLE');
  });

  it('ALLOWED_RECIPIENT_DOMAINS: eine fremde Domain reicht für den Verstoß', () => {
    const rule: PolicyRule = { type: 'ALLOWED_RECIPIENT_DOMAINS', domains: ['kunde.de'] };
    expect(evaluateRule(rule, command('x', { recipients: ['a@kunde.de', 'b@KUNDE.de'] })).status).toBe('PASS');
    expect(evaluateRule(rule, command('x', { recipients: ['a@kunde.de', 'x@extern.com'] })).status).toBe('VIOLATION');
    expect(evaluateRule(rule, command('x', { recipients: ['kein-email-format'] })).status).toBe('VIOLATION');
  });

  it('TIME_WINDOW: prüft Stunde in der Zielzeitzone, auch über Nacht', () => {
    const noonUtc = new Date('2026-08-24T12:00:00Z');
    expect(evaluateRule({ type: 'TIME_WINDOW', from_hour: 8, to_hour: 18, tz: 'UTC' }, command('x'), noonUtc).status).toBe('PASS');
    expect(evaluateRule({ type: 'TIME_WINDOW', from_hour: 18, to_hour: 8, tz: 'UTC' }, command('x'), noonUtc).status).toBe('VIOLATION');
    // 12:00 UTC = 14:00 in Berlin (Sommerzeit): Fenster 13–15 Uhr Berlin passt.
    expect(evaluateRule({ type: 'TIME_WINDOW', from_hour: 13, to_hour: 15, tz: 'Europe/Berlin' }, command('x'), noonUtc).status).toBe('PASS');
  });

  it('TIME_WINDOW: unbekannte Zeitzone ist unprüfbar und damit ein Verstoß', () => {
    const rule: PolicyRule = { type: 'TIME_WINDOW', from_hour: 8, to_hour: 18, tz: 'Nicht/Existent' };
    expect(evaluateRule(rule, command('x')).status).toBe('VIOLATION');
  });

  it('unbekannter Regeltyp wird nie still übersprungen', () => {
    const rule = { type: 'FUTURE_RULE' } as unknown as PolicyRule;
    expect(evaluateRule(rule, command('x')).status).toBe('VIOLATION');
  });
});

describe('govard evaluatePolicies', () => {
  it('leeres Policy-Set → DENY (deny by default)', async () => {
    const result = await evaluatePolicies(command('anything'), []);
    expect(result.decision).toBe('DENY');
    expect(result.policy_set_size).toBe(0);
  });

  it('DENY-Verstoß dominiert REQUIRE_APPROVAL', async () => {
    const result = await evaluatePolicies(command('transfer_money'), [
      policy({ type: 'ALLOWED_INTENTS', intents: ['send_email'] }, 'DENY'),
      policy({ type: 'REQUIRE_APPROVAL_FOR_INTENT', intents: ['transfer_money'] }, 'REQUIRE_APPROVAL'),
    ]);
    expect(result.decision).toBe('DENY');
    expect(result.violations).toHaveLength(2);
  });

  it('nur REQUIRE_APPROVAL-Verstöße → APPROVAL', async () => {
    const result = await evaluatePolicies(command('send_campaign'), [
      policy({ type: 'ALLOWED_INTENTS', intents: ['send_campaign'] }, 'DENY'),
      policy({ type: 'REQUIRE_APPROVAL_FOR_INTENT', intents: ['send_campaign'] }, 'REQUIRE_APPROVAL'),
    ]);
    expect(result.decision).toBe('APPROVAL');
  });

  it('WARN-Verstöße blockieren nicht, stehen aber vollständig im Ergebnis', async () => {
    const result = await evaluatePolicies(command('send_email', { recipient_count: 10 }), [
      policy({ type: 'ALLOWED_INTENTS', intents: ['send_email'] }, 'DENY'),
      policy({ type: 'MAX_RECIPIENTS', value: 5 }, 'WARN'),
    ]);
    expect(result.decision).toBe('ALLOW');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].action).toBe('WARN');
  });

  it('jede Policy erscheint im Evaluation Result — Governance-Evidence, nicht Logging', async () => {
    const result = await evaluatePolicies(command('send_email'), [
      policy({ type: 'ALLOWED_INTENTS', intents: ['send_email'] }, 'DENY'),
      policy({ type: 'MAX_BUDGET', currency: 'EUR', value: 100 }, 'DENY'),
      policy({ type: 'REQUIRE_APPROVAL_FOR_INTENT', intents: ['other'] }, 'REQUIRE_APPROVAL'),
    ]);
    expect(result.evaluated).toHaveLength(3);
    expect(result.evaluated.filter((e) => e.result === 'PASS')).toHaveLength(1);
    expect(result.evaluated.filter((e) => e.result === 'NOT_APPLICABLE')).toHaveLength(2);
  });

  it('evaluation_hash bindet an payload_hash und Ergebnis — gleicher Input, gleicher Hash', async () => {
    const policies = [policy({ type: 'ALLOWED_INTENTS', intents: ['send_email'] }, 'DENY')];
    const a = await evaluatePolicies(command('send_email'), policies);
    const b = await evaluatePolicies(command('send_email'), policies);
    expect(a.evaluation_hash).toBe(b.evaluation_hash);

    const other = await evaluatePolicies(
      { intent: 'send_email', payload: {}, payload_hash: 'ph-OTHER' },
      policies,
    );
    expect(other.evaluation_hash).not.toBe(a.evaluation_hash);
  });
});
