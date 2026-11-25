// usage-increment: Rollen- und Key-Prüfung. Nur owner/admin dürfen Verbrauch
// melden, und nur für bekannte Keys, die nicht verbrauchsabhängig abgerechnet
// werden (metered/overage misst ausschließlich der Server).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  checkEntitlementKey,
  checkRole,
  isWellFormedKey,
} from '../../supabase/functions/usage-increment/policy.ts';

describe('usage-increment checkRole', () => {
  it('erlaubt owner und admin', () => {
    expect(checkRole('owner')).toEqual({ ok: true });
    expect(checkRole('admin')).toEqual({ ok: true });
  });

  it('lehnt alle anderen Rollen mit 403 ab', () => {
    for (const r of ['dpo', 'editor', 'viewer_auditor', 'OWNER', '', null, undefined, 1]) {
      const res = checkRole(r);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.status).toBe(403);
    }
  });
});

describe('usage-increment checkEntitlementKey', () => {
  it('erlaubt bekannte included-Keys', () => {
    expect(checkEntitlementKey('limit.bot_messages_monthly', { billing_mode: 'included' })).toEqual({ ok: true });
  });

  it('lehnt metered- und overage-Keys mit 403 ab', () => {
    for (const mode of ['metered', 'overage', 'none', null]) {
      const res = checkEntitlementKey('limit.bot_voice_minutes_monthly', { billing_mode: mode });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.status).toBe(403);
    }
  });

  it('lehnt unbekannte oder ungültige Keys mit 400 ab', () => {
    expect(checkEntitlementKey('limit.unknown_key', null)).toMatchObject({ ok: false, status: 400 });
    expect(checkEntitlementKey('limit.x', undefined)).toMatchObject({ ok: false, status: 400 });
    for (const k of ['bots', 'limit.', 'limit.A', 'limit.a b', "limit.a';--", 'x'.repeat(80), 42, null]) {
      expect(checkEntitlementKey(k, { billing_mode: 'included' })).toMatchObject({ ok: false, status: 400 });
    }
  });

  it('isWellFormedKey prüft das Schema limit.<snake_case>', () => {
    expect(isWellFormedKey('limit.team_seats')).toBe(true);
    expect(isWellFormedKey('limit.Team')).toBe(false);
    expect(isWellFormedKey('limit.' + 'a'.repeat(65))).toBe(false);
  });
});

describe('usage-increment Handler', () => {
  const src = readFileSync('supabase/functions/usage-increment/index.ts', 'utf8');

  it('prüft Rolle und Key vor dem Buchen', () => {
    expect(src).toContain(".select('id, role')");
    expect(src).toContain('checkRole(member.role)');
    expect(src).toContain("from('usage_limits_config')");
    expect(src).toContain('checkEntitlementKey(entitlementKey, keyConfig)');
    expect(src.indexOf('checkEntitlementKey(entitlementKey')).toBeLessThan(src.indexOf('consumeUsage('));
  });

  it('gibt keine DB-Fehlertexte an den Client zurück', () => {
    expect(src).not.toContain('memberErr.message');
    expect(src).not.toContain('keyErr.message');
  });
});
