/**
 * AP9, Welle 1 bis 3 — Durchsetzung nachgerüstet.
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
  // Welle 3 (2026-09-01): die letzten `UNKNOWN`-Keys der Reality Map.
  { fn: 'tenant-branding-update', key: 'whitelabel.reports' },
  { fn: 'ai-act-risk-inventory', key: 'governance.risk_register' },
  { fn: 'compliance-alert-trigger', key: 'alerts.email' },
  { fn: 'audit-monitor-cron', key: 'alerts.email' },
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
  it.each([
    'api-webhook-deliver',
    'compliance-remediation-execute',
    'scheduler-dispatch',
    // Welle 3: intern, schreiben per Service-Role in fremde Tenants.
    'governance-risk-escalate',
    'compliance-alert-trigger',
    'audit-monitor-cron',
  ])(
    '%s weist Aufrufe ohne Service-Role-Bearer mit 401 ab',
    (fn) => {
      const src = quelle(fn);
      expect(src).toMatch(/Authorization/);
      expect(src).toMatch(/Bearer \$\{(SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|supabaseServiceRoleKey|supabaseKey|SERVICE_KEY)\}/);
      expect(src).toMatch(/401/);
    },
  );
});

describe('Welle 3 — was neben dem Gate repariert wurde', () => {
  it('tenant-branding-update prüft das Token und liest tenant_id aus dem Body, nicht aus einem Claim', () => {
    const src = quelle('tenant-branding-update');
    // Der alte Weg: JWT-Payload von Hand dekodiert, `payload.tenant_id` ohne
    // Signaturprüfung — und der Claim wird nirgends gesetzt.
    expect(src).not.toContain('payload.tenant_id');
    expect(src).not.toMatch(/atob\(/);
    expect(src).toMatch(/from '\.\.\/_shared\/auth\.ts'/);
    expect(src).toContain('requireUser(req)');
    expect(src).toContain("['owner', 'admin']");
    // `functions.invoke()` sendet POST; PATCH allein war unerreichbar.
    expect(src).toMatch(/req\.method !== 'PATCH' && req\.method !== 'POST'/);
    // Das Gate greift erst nach der Rolle — wer nicht Admin ist, erfährt
    // nichts über den Plan.
    expect(src.indexOf("['owner', 'admin']")).toBeLessThan(src.indexOf('requireWhitelabelEntitlement(auth.admin'));
  });

  it('BrandingSettings schickt den Tenant mit', () => {
    const src = readFileSync('src/features/settings/BrandingSettings.tsx', 'utf8');
    const call = src.slice(src.indexOf("invoke('tenant-branding-update'"));
    expect(call).toMatch(/tenant_id: activeTenantId/);
  });

  it('der Alert wird immer protokolliert, nur der Versand hängt am Plan', () => {
    const trigger = quelle('compliance-alert-trigger');
    expect(trigger.indexOf('await logAlert(')).toBeLessThan(trigger.indexOf("hasFeature(entitlements, 'alerts.email')"));
    expect(trigger).toContain('email_skipped_entitlement_missing');

    const cron = quelle('audit-monitor-cron');
    expect(cron).toMatch(/if \(await mayAlert\(supabase, d\.tenant_id\)\)/);
    // Ergebnis wird auch ohne Versand gespeichert.
    expect(cron.indexOf('mayAlert(supabase')).toBeLessThan(cron.indexOf("from('audit_monitor_results').insert"));
  });

  it('governance-risk-score bleibt bewusst ohne Plan-Gate', () => {
    // Die Neuberechnung hängt am KI-Register (`governance.ai_register`,
    // im Free-Plan enthalten) und wird aus `/app/assets/:id` aufgerufen —
    // nicht am Risikoregister. Ein Gate hier sperrte eine freie Fläche.
    const src = quelle('governance-risk-score');
    expect(src).not.toMatch(/from '\.\.\/_shared\/entitlements\.ts'/);
    expect(src).toContain('requireTenantMembership(');
  });

  it('OAuth2ConfigView fragt keine Plan-Namen als Entitlement-Keys ab', () => {
    const src = readFileSync('src/features/api/OAuth2ConfigView.tsx', 'utf8');
    for (const plan of PLAN_ORDER) {
      expect(src, `${plan}.tier ist kein Entitlement-Key`).not.toContain(`'${plan}.tier'`);
    }
    expect(src).toContain('useEntitlements()');
  });
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
