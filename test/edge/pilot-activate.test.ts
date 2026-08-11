/**
 * Vertragstests für die Pilot-Aktivierung (Free Audit → 14-Tage-Pilot).
 *
 * Getestet wird die ECHTE Ablauflogik aus `_shared/pilot-activation.ts` gegen
 * einen In-Memory-Store, der den Port `PilotStore` implementiert — keine
 * Nachbildung der Funktion, sondern dieselbe Codepfad-Sequenz, die produktiv
 * läuft. Die HTTP-Schale (`pilot-activate/index.ts`) bindet denselben Port an
 * den Service-Role-Client.
 *
 * Sicherheitsrelevanz: `audit_id` und `domain` kommen aus dem Browser. Die hier
 * geprüften Invarianten sind der Grund, warum sie NICHT als Autorisierung
 * taugen — Tenant und Identität kommen ausschließlich aus dem JWT.
 */
import { describe, it, expect } from 'vitest';
import { runPilotActivation } from '../../supabase/functions/_shared/pilot-activation';
import { resolvePilotAction, parseClientIp, isAuditExpired } from '../../supabase/functions/_shared/pilot';
import { normalizeDomain, domainsMatch } from '../../supabase/functions/_shared/domain';
import { createMemoryStore, AUDIT_ID, TENANT_A, USER_A } from './pilot-test-store';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-11T12:00:00.000Z');

describe('normalizeDomain', () => {
  it('entfernt Schema, Pfad, Port, Query und Trailing-Dot', () => {
    expect(normalizeDomain('https://Example.com:443/pfad?q=1#x')).toBe('example.com');
    expect(normalizeDomain('example.com.')).toBe('example.com');
    expect(normalizeDomain('  HTTP://EXAMPLE.COM/  ')).toBe('example.com');
  });

  it('normalisiert www konsistent — gdpr-audit speichert den Hostnamen mit www', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
    expect(normalizeDomain('https://www.example.com/impressum')).toBe('example.com');
    expect(domainsMatch('www.example.com', 'example.com')).toBe(true);
    expect(domainsMatch('https://www.example.com', 'EXAMPLE.COM.')).toBe(true);
  });

  it('lehnt Unbrauchbares ab, statt es durchzureichen', () => {
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
    expect(normalizeDomain('kein hostname')).toBeNull();
    expect(domainsMatch('example.com', 'andere.de')).toBe(false);
  });

  it('lässt sich nicht über Credentials im Host täuschen', () => {
    // Ohne Credential-Strip würde hier `evil.com` als `example.com` gelesen.
    expect(normalizeDomain('https://example.com@evil.com/')).toBe('evil.com');
  });
});

describe('isAuditExpired', () => {
  it('erlaubt Audits innerhalb des 14-Tage-Fensters', () => {
    expect(isAuditExpired(new Date(NOW - 13 * DAY).toISOString(), NOW)).toBe(false);
  });

  it('verweigert Audits jenseits von 14 Tagen', () => {
    expect(isAuditExpired(new Date(NOW - 15 * DAY).toISOString(), NOW)).toBe(true);
  });

  it('behandelt fehlende oder kaputte Zeitstempel als abgelaufen', () => {
    expect(isAuditExpired(null, NOW)).toBe(true);
    expect(isAuditExpired('kein datum', NOW)).toBe(true);
  });
});

describe('parseClientIp', () => {
  it('nimmt die erste IP aus x-forwarded-for', () => {
    expect(parseClientIp('203.0.113.7, 70.41.3.18')).toBe('203.0.113.7');
    expect(parseClientIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('gibt NULL statt eines ungültigen INET-Literals zurück', () => {
    // Der frühere Fallback-String 'unknown' löste in trial_audit_logs.ip_address
    // einen 22P02-Fehler aus.
    expect(parseClientIp('unknown')).toBeNull();
    expect(parseClientIp('999.1.1.1')).toBeNull();
    expect(parseClientIp(null)).toBeNull();
    expect(parseClientIp('')).toBeNull();
  });
});

describe('resolvePilotAction', () => {
  it('legt ohne Subscription einen Pilot an', () => {
    expect(resolvePilotAction(null)).toBe('create');
  });

  it('verwendet einen laufenden Trial wieder, statt ihn zu verlängern', () => {
    expect(resolvePilotAction({ plan_key: 'starter', status: 'trialing' })).toBe('reuse');
  });

  it('stuft ein bezahltes Abo NIEMALS auf den Starter-Trial herab', () => {
    expect(resolvePilotAction({ plan_key: 'growth', status: 'active' })).toBe('preserve');
    expect(resolvePilotAction({ plan_key: 'enterprise', status: 'active' })).toBe('preserve');
    expect(resolvePilotAction({ plan_key: 'agency', status: 'past_due' })).toBe('preserve');
  });

  it('hebt eine Free-Audit-Zeile auf den Pilot', () => {
    expect(resolvePilotAction({ plan_key: 'free_audit', status: 'active' })).toBe('upgrade');
    expect(resolvePilotAction({ plan_key: 'starter', status: 'canceled' })).toBe('upgrade');
  });
});

describe('runPilotActivation — Ablauf und Absicherung', () => {
  const input = { auditId: AUDIT_ID, domain: 'example.com', analyticsConsent: false };
  const actor = { userId: USER_A, email: 'a@example.com' };

  it('aktiviert den Pilot vollständig und hinterlässt genau einen Zustand', async () => {
    const store = createMemoryStore();
    const result = await runPilotActivation(store, actor, input, 'req-1', NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tenantId).toBe(TENANT_A);
    expect(result.domain).toBe('example.com');
    expect(result.idempotentReplay).toBe(false);
    expect(result.monitoringEnrolled).toBe(true);
    expect(result.subscriptionAction).toBe('create');

    expect(store.state.audits[AUDIT_ID].tenant_id).toBe(TENANT_A);
    expect(store.state.audits[AUDIT_ID].user_id).toBe(USER_A);
    expect(store.state.audits[AUDIT_ID].claimed_at).not.toBeNull();
    expect(store.state.websites).toHaveLength(1);
    expect(store.state.websites[0].latest_audit_id).toBe(AUDIT_ID);
    expect(store.state.monitoring).toHaveLength(1);
    expect(store.state.subscriptions[TENANT_A].plan_key).toBe('starter');
    expect(store.state.subscriptions[TENANT_A].status).toBe('trialing');
  });

  it('akzeptiert die www-Schreibweise des gespeicherten Audits', async () => {
    const store = createMemoryStore({ auditDomain: 'www.example.com' });
    const result = await runPilotActivation(store, actor, input, 'req-www', NOW);
    expect(result.ok).toBe(true);
  });

  it('weist eine fremde Domain ab', async () => {
    const store = createMemoryStore();
    const result = await runPilotActivation(
      store, actor, { ...input, domain: 'angreifer.de' }, 'req-2', NOW,
    );
    expect(result).toMatchObject({ ok: false, status: 400, code: 'AUDIT_DOMAIN_MISMATCH' });
    // Kein Seiteneffekt bei einem abgelehnten Claim.
    expect(store.state.websites).toHaveLength(0);
    expect(store.state.subscriptions[TENANT_A]).toBeUndefined();
  });

  it('weist eine ungültige audit_id ab, bevor irgendetwas geladen wird', async () => {
    const store = createMemoryStore();
    const result = await runPilotActivation(
      store, actor, { ...input, auditId: 'nicht-uuid' }, 'req-3', NOW,
    );
    expect(result).toMatchObject({ ok: false, status: 400, code: 'INVALID_INPUT' });
    expect(store.calls.loadAudit).toBe(0);
  });

  it('weist eine ungültige Domain ab', async () => {
    const store = createMemoryStore();
    const result = await runPilotActivation(
      store, actor, { ...input, domain: 'localhost' }, 'req-4', NOW,
    );
    expect(result).toMatchObject({ ok: false, status: 400, code: 'INVALID_DOMAIN' });
  });

  it('meldet einen unbekannten Audit als AUDIT_NOT_FOUND', async () => {
    const store = createMemoryStore({ withAudit: false });
    const result = await runPilotActivation(store, actor, input, 'req-5', NOW);
    expect(result).toMatchObject({ ok: false, status: 404, code: 'AUDIT_NOT_FOUND' });
  });

  it('verweigert einen Audit, der älter als 14 Tage ist — ohne Nebenwirkungen', async () => {
    const store = createMemoryStore({ createdAt: new Date(NOW - 15 * DAY).toISOString() });
    const result = await runPilotActivation(store, actor, input, 'req-6', NOW);

    expect(result).toMatchObject({ ok: false, status: 410, code: 'AUDIT_EXPIRED' });
    expect(store.state.subscriptions[TENANT_A]).toBeUndefined();
    expect(store.state.websites).toHaveLength(0);
    expect(store.state.monitoring).toHaveLength(0);
    expect(store.state.audits[AUDIT_ID].claimed_at).toBeNull();
  });

  it('meldet TENANT_NOT_FOUND, wenn keine Mitgliedschaft existiert', async () => {
    const store = createMemoryStore({ memberships: {} });
    const result = await runPilotActivation(store, actor, input, 'req-7', NOW);
    expect(result).toMatchObject({ ok: false, status: 404, code: 'TENANT_NOT_FOUND' });
  });

  it('meldet TENANT_ACCESS_DENIED, wenn die Mitgliedschaft nicht trägt', async () => {
    const store = createMemoryStore({ denyMembership: true });
    const result = await runPilotActivation(store, actor, input, 'req-8', NOW);
    expect(result).toMatchObject({ ok: false, status: 403, code: 'TENANT_ACCESS_DENIED' });
    expect(store.state.websites).toHaveLength(0);
  });

  it('schreibt den Consent nur bei ausdrücklicher Zustimmung', async () => {
    const withoutConsent = createMemoryStore();
    await runPilotActivation(withoutConsent, actor, input, 'req-9', NOW);
    expect(withoutConsent.state.consents).toHaveLength(0);

    const withConsent = createMemoryStore();
    await runPilotActivation(withConsent, actor, { ...input, analyticsConsent: true }, 'req-10', NOW);
    expect(withConsent.state.consents).toHaveLength(1);
    expect(withConsent.state.consents[0]).toMatchObject({
      user_id: USER_A,
      scan_result_id: AUDIT_ID,
    });
  });

  it('schreibt Start- und Abschlussereignis in den Prüfpfad', async () => {
    const store = createMemoryStore();
    await runPilotActivation(store, actor, input, 'req-11', NOW);
    const actions = store.state.events.map((e) => e.action);
    expect(actions).toContain('pilot_activation_started');
    expect(actions).toContain('audit_claimed');
    expect(actions).toContain('domain_activated');
    expect(actions).toContain('pilot_activation_completed');
  });

  it('lässt die Aktivierung stehen, wenn nur das Monitoring scheitert', async () => {
    const store = createMemoryStore({ failMonitoring: true });
    const result = await runPilotActivation(store, actor, input, 'req-12', NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Der Fehler wird gemeldet, nicht verschluckt — und kippt nicht den Claim.
    expect(result.monitoringEnrolled).toBe(false);
    expect(store.state.audits[AUDIT_ID].tenant_id).toBe(TENANT_A);
    expect(store.state.websites).toHaveLength(1);
  });

  it('meldet DOMAIN_REGISTRATION_FAILED, wenn die Registry nicht schreibbar ist', async () => {
    const store = createMemoryStore({ failWebsite: true });
    const result = await runPilotActivation(store, actor, input, 'req-13', NOW);
    expect(result).toMatchObject({ ok: false, status: 500, code: 'DOMAIN_REGISTRATION_FAILED' });
    // Kein Pilot ohne Domain.
    expect(store.state.subscriptions[TENANT_A]).toBeUndefined();
  });

  it('meldet SUBSCRIPTION_CREATION_FAILED, wenn der Trial nicht anlegbar ist', async () => {
    const store = createMemoryStore({ failTrial: true });
    const result = await runPilotActivation(store, actor, input, 'req-14', NOW);
    expect(result).toMatchObject({ ok: false, status: 502, code: 'SUBSCRIPTION_CREATION_FAILED' });
  });

  it('stuft ein laufendes bezahltes Abo nicht herab, aktiviert aber die Domain', async () => {
    const store = createMemoryStore({
      subscription: {
        plan_key: 'growth', status: 'active',
        trial_start: null, trial_end: null,
      },
    });
    const result = await runPilotActivation(store, actor, input, 'req-15', NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subscriptionAction).toBe('preserve');
    expect(store.state.subscriptions[TENANT_A].plan_key).toBe('growth');
    expect(store.state.subscriptions[TENANT_A].status).toBe('active');
    // Der Kunde bekommt seine Runtime trotzdem — aus dem bestehenden Vertrag.
    expect(store.state.websites).toHaveLength(1);
    expect(store.state.monitoring).toHaveLength(1);
  });
});
