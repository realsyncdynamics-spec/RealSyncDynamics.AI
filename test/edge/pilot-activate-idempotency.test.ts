/**
 * Idempotenz- und Race-Tests der Pilot-Aktivierung.
 *
 * Das ist der Test, der den Flow trägt: Ein Reload, ein doppelter
 * OAuth-Callback oder zwei parallele Tabs dürfen weder den Pilot verlängern
 * noch Subscription, Domain oder Monitoring-Eintrag verdoppeln — und ein
 * zweiter Tenant darf einen fremden Audit niemals bekommen.
 *
 * Geprüft wird die echte Ablauflogik aus `_shared/pilot-activation.ts` gegen
 * einen In-Memory-Store, der die Datenbank-Garantien nachbildet:
 * der atomare Claim (`WHERE user_id IS NULL AND tenant_id IS NULL`),
 * unique(tenant_id, domain) auf `websites` und die Advisory-Lock-Semantik
 * von `pilot_enroll_monitoring_source`.
 */
import { describe, it, expect } from 'vitest';
import { runPilotActivation } from '../../supabase/functions/_shared/pilot-activation';
import {
  createMemoryState,
  createMemoryStore,
  AUDIT_ID,
  TENANT_A,
  TENANT_B,
  USER_A,
  USER_B,
} from './pilot-test-store';

const NOW = Date.parse('2026-08-11T12:00:00.000Z');
const INPUT = { auditId: AUDIT_ID, domain: 'example.com', analyticsConsent: false };
const ACTOR_A = { userId: USER_A, email: 'a@example.com' };
const ACTOR_B = { userId: USER_B, email: 'b@example.com' };

describe('Pilot-Aktivierung — Idempotenz', () => {
  it('zwei gleichzeitige Aufrufe hinterlassen genau einen Zustand', async () => {
    const shared = createMemoryState();
    const storeA = createMemoryStore({ sharedState: shared });
    const storeB = createMemoryStore({ sharedState: shared });

    const [a, b] = await Promise.all([
      runPilotActivation(storeA, ACTOR_A, INPUT, 'req-parallel-1', NOW),
      runPilotActivation(storeB, ACTOR_A, INPUT, 'req-parallel-2', NOW),
    ]);

    // Beide Aufrufe gehören demselben Tenant → beide dürfen erfolgreich sein,
    // genau einer davon als idempotenter Replay.
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect([a.idempotentReplay, b.idempotentReplay].filter(Boolean)).toHaveLength(1);

    // Der geforderte Endzustand: keine Duplikate.
    expect(Object.keys(shared.subscriptions)).toHaveLength(1);
    expect(shared.websites).toHaveLength(1);
    expect(shared.monitoring).toHaveLength(1);
    expect(shared.audits[AUDIT_ID].tenant_id).toBe(TENANT_A);
    expect(shared.audits[AUDIT_ID].user_id).toBe(USER_A);
    expect(shared.audits[AUDIT_ID].claimed_at).not.toBeNull();
    expect(shared.subscriptions[TENANT_A].plan_key).toBe('starter');
    expect(shared.subscriptions[TENANT_A].status).toBe('trialing');
  });

  it('wiederholte Aktivierung verschiebt trial_end nicht', async () => {
    const shared = createMemoryState();

    const first = await runPilotActivation(
      createMemoryStore({ sharedState: shared }), ACTOR_A, INPUT, 'req-a', NOW,
    );
    expect(first.ok).toBe(true);
    const trialEndAfterFirst = shared.subscriptions[TENANT_A].trial_end;
    const trialStartAfterFirst = shared.subscriptions[TENANT_A].trial_start;

    // Zeit vergeht — ein naiver Upsert würde das Fenster jetzt nach vorne
    // schieben und dem Kunden faktisch 28 Tage geben.
    const later = NOW + 3 * 24 * 60 * 60 * 1000;
    const second = await runPilotActivation(
      createMemoryStore({ sharedState: shared }), ACTOR_A, INPUT, 'req-b', later,
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotentReplay).toBe(true);
    // 'reuse': der laufende Trial wird nicht angefasst.
    expect(second.subscriptionAction).toBe('reuse');
    expect(shared.subscriptions[TENANT_A].trial_end).toBe(trialEndAfterFirst);
    expect(shared.subscriptions[TENANT_A].trial_start).toBe(trialStartAfterFirst);
    // Kein zweiter Trial-Aufruf überhaupt.
    expect(shared.trialCalls).toHaveLength(1);
  });

  it('dreifacher Aufruf erzeugt keine Duplikate', async () => {
    const shared = createMemoryState();
    for (const id of ['r1', 'r2', 'r3']) {
      const result = await runPilotActivation(
        createMemoryStore({ sharedState: shared }), ACTOR_A, INPUT, id, NOW,
      );
      expect(result.ok).toBe(true);
    }
    expect(shared.websites).toHaveLength(1);
    expect(shared.monitoring).toHaveLength(1);
    expect(Object.keys(shared.subscriptions)).toHaveLength(1);
    expect(shared.trialCalls).toHaveLength(1);
  });

  it('erkennt die www-Variante als dieselbe Domain und legt sie nicht doppelt an', async () => {
    const shared = createMemoryState({ auditDomain: 'www.example.com' });

    await runPilotActivation(
      createMemoryStore({ sharedState: shared }), ACTOR_A,
      { ...INPUT, domain: 'www.example.com' }, 'r-www', NOW,
    );
    await runPilotActivation(
      createMemoryStore({ sharedState: shared }), ACTOR_A,
      { ...INPUT, domain: 'https://example.com/' }, 'r-apex', NOW,
    );

    expect(shared.websites).toHaveLength(1);
    expect(shared.websites[0].domain).toBe('example.com');
    expect(shared.monitoring).toHaveLength(1);
  });
});

describe('Pilot-Aktivierung — Tenant-Isolation', () => {
  it('ein zweiter Tenant kann einen beanspruchten Audit nicht übernehmen', async () => {
    const shared = createMemoryState();

    const first = await runPilotActivation(
      createMemoryStore({ sharedState: shared }), ACTOR_A, INPUT, 'r-owner', NOW,
    );
    expect(first.ok).toBe(true);

    const second = await runPilotActivation(
      createMemoryStore({ sharedState: shared }), ACTOR_B, INPUT, 'r-thief', NOW,
    );

    expect(second).toMatchObject({ ok: false, status: 409, code: 'AUDIT_ALREADY_CLAIMED' });
    // Eigentum bleibt unverändert.
    expect(shared.audits[AUDIT_ID].tenant_id).toBe(TENANT_A);
    expect(shared.audits[AUDIT_ID].user_id).toBe(USER_A);
    // Und der Angreifer bekommt weder Domain noch Pilot.
    expect(shared.websites.filter((w) => w.tenant_id === TENANT_B)).toHaveLength(0);
    expect(shared.monitoring.filter((m) => m.tenant_id === TENANT_B)).toHaveLength(0);
    expect(shared.subscriptions[TENANT_B]).toBeUndefined();
  });

  it('gleichzeitige Aufrufe zweier Tenants: genau einer gewinnt', async () => {
    const shared = createMemoryState();

    const [a, b] = await Promise.all([
      runPilotActivation(createMemoryStore({ sharedState: shared }), ACTOR_A, INPUT, 'r-a', NOW),
      runPilotActivation(createMemoryStore({ sharedState: shared }), ACTOR_B, INPUT, 'r-b', NOW),
    ]);

    const winners = [a, b].filter((r) => r.ok);
    const losers = [a, b].filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toMatchObject({ code: 'AUDIT_ALREADY_CLAIMED', status: 409 });

    // Genau ein Tenant besitzt den Audit, und nur der hat Nebenwirkungen.
    const ownerTenant = shared.audits[AUDIT_ID].tenant_id;
    expect([TENANT_A, TENANT_B]).toContain(ownerTenant);
    expect(shared.websites).toHaveLength(1);
    expect(shared.websites[0].tenant_id).toBe(ownerTenant);
    expect(Object.keys(shared.subscriptions)).toEqual([ownerTenant]);
  });
});
