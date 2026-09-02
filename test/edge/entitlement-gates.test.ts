/**
 * AP9, Welle 1 und 2 — Durchsetzung nachgerüstet.
 *
 * Die Functions laufen in Deno und lassen sich hier nicht ausführen. Was
 * sich prüfen lässt, ist die Quelle: Trägt jede der genannten Functions das
 * Gate mit dem richtigen Key, und nutzt sie dafür den einen Wächter
 * (`_shared/entitlements.ts`) statt einer eigenen Prüfung? Ein Gate, das
 * beim nächsten Refactoring herausfällt, fällt hier auf.
 *
 * Die Keys sind die aus `PLAN_ENTITLEMENTS`; ein erfundener Key würde durch
 * `entitlement-vocabulary.test.ts` auffallen, ein nicht verkaufter durch den
 * Test unten.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLAN_ORDER, isPlanSelectable, planGrants, type EntitlementKey } from '../../shared/pricing';

const GATES: ReadonlyArray<{ fn: string; key: EntitlementKey }> = [
  { fn: 'appointment-book', key: 'bots.appointments' },
  { fn: 'order-intake', key: 'bots.orders' },
  { fn: 'telegram-webhook', key: 'bots.multi_channel' },
  { fn: 'governance-webhooks', key: 'webhooks.enabled' },
  // Bestand — hier gelistet, damit ein Rückbau auffällt.
  { fn: 'bot-chat', key: 'bots.enabled' },
  { fn: 'whatsapp-webhook', key: 'bots.whatsapp' },
  { fn: 'bot-voice-webhook', key: 'bots.voice' },
  { fn: 'policy-packs', key: 'policy.packs' },
  { fn: 'scheduler', key: 'scheduler.enabled' },
  { fn: 'bulk-scan', key: 'bulk.jobs' },
  { fn: 'evidence-vault', key: 'evidence.advanced' },
  { fn: 'workflow-trigger', key: 'ai.tool.workflows' },
];

function quelle(fn: string): string {
  return readFileSync(`supabase/functions/${fn}/index.ts`, 'utf8');
}

describe('Kostenverursachende Functions prüfen ihr Entitlement', () => {
  it.each(GATES.map((g) => [g.fn, g.key] as const))('%s gated auf %s', (fn, key) => {
    const src = quelle(fn);
    expect(src, `${fn} importiert den Wächter nicht`).toMatch(/from '\.\.\/_shared\/entitlements\.ts'/);
    expect(src, `${fn} prüft ${key} nicht`).toContain(`'${key}'`);
    expect(src).toMatch(/gateFeature\(|requireFeature\(|hasFeature\(/);
  });

  it.each(GATES.map((g) => g.key))('%s wird von einem wählbaren Plan gewährt', (key) => {
    const verkauft = PLAN_ORDER.some((p) => isPlanSelectable(p) && planGrants(p, key));
    expect(verkauft, `${key} sperrt etwas, das niemand kaufen kann`).toBe(true);
  });
});

describe('Cron-Functions nehmen nur Service-Role an', () => {
  it.each(['api-webhook-deliver', 'compliance-remediation-execute', 'scheduler-dispatch'])(
    '%s weist Aufrufe ohne Service-Role-Bearer mit 401 ab',
    (fn) => {
      const src = quelle(fn);
      expect(src).toMatch(/Authorization/);
      expect(src).toMatch(/Bearer \$\{(SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|supabaseServiceRoleKey)\}/);
      expect(src).toMatch(/401/);
    },
  );
});

describe('Der Kunde kann sich nicht selbst freischalten', () => {
  it('appointment-book und order-intake verlassen sich nicht mehr allein auf bot.capabilities', () => {
    for (const fn of ['appointment-book', 'order-intake']) {
      const src = quelle(fn);
      const capIndex = src.indexOf('bot.capabilities?.');
      const gateIndex = src.indexOf('gateFeature(admin, bot.tenant_id');
      expect(capIndex, fn).toBeGreaterThan(-1);
      expect(gateIndex, `${fn}: Gate fehlt`).toBeGreaterThan(capIndex);
    }
  });

  it('governance-webhooks lässt Ausschalten und Widerrufen ohne Entitlement zu', () => {
    const src = quelle('governance-webhooks');
    const toggle = src.slice(src.indexOf('async function handleToggle'), src.indexOf('async function handleRevoke'));
    expect(toggle).toMatch(/if \(enabled\) \{[\s\S]*requireWebhooksEntitlement/);
    const revoke = src.slice(src.indexOf('async function handleRevoke'));
    expect(revoke).not.toContain('requireWebhooksEntitlement');
  });
});
