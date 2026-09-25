import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateFixSnippet,
  generateRemediationPlan,
  type AuditFindingInput,
} from '../../../src/features/audit/auditCopilotApi';

// Vertrag #1591: eingeloggter Audit-Copilot → Nutzer-JWT + tenant_id;
// öffentliches /audit → ausdrücklich anonym mit Legacy-Anon-Key (JWT) als
// Bearer. `mode: 'audit_anon'` ist hier bewusst noch nicht verdrahtet.

// Form eines Legacy-Anon-Keys (JWT), kein echter Schlüssel.
const LEGACY_ANON_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl';
const URL_ = 'https://test.supabase.co';

const FINDING: AuditFindingInput = {
  id: 'F-001', severity: 'high', title: 'Google Fonts ohne Consent', detail: 'fonts.googleapis.com vor Consent.',
};

const OK = {
  ok: true, provider: 'lm_studio', model: 'm', profile: 'strict-json',
  output: { cms: 'wordpress', language: 'php', snippet: 'x', notes: 'y' }, trace_id: 't', latency_ms: 1,
};

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(OK), { status: 200 }));
});
afterEach(() => fetchSpy.mockRestore());

function sent(): { headers: Record<string, string>; body: Record<string, unknown> } {
  const init = fetchSpy.mock.calls[0]![1] as RequestInit;
  return { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
}

describe('auditCopilotApi — eingeloggt (Nutzer-Modus)', () => {
  it('sendet Sitzungs-JWT als Bearer und tenant_id des aktiven Workspace', async () => {
    await generateFixSnippet(FINDING, 'wordpress', {
      supabaseUrl: URL_, supabaseAnonKey: 'sb_publishable_x',
      auth: { mode: 'user', tenantId: 'tenant-3' }, getAccessToken: async () => 'user-jwt',
    });
    const { headers, body } = sent();
    expect(headers.authorization).toBe('Bearer user-jwt');
    expect(headers.apikey).toBe('sb_publishable_x');
    expect(body).toMatchObject({ tenant_id: 'tenant-3', feature: 'audit_copilot.fix_snippet', model_profile: 'strict-json' });
  });

  it('ohne Workspace: TENANT_REQUIRED, nichts gesendet', async () => {
    await expect(generateFixSnippet(FINDING, 'wordpress', {
      supabaseUrl: URL_, supabaseAnonKey: LEGACY_ANON_JWT,
      auth: { mode: 'user', tenantId: null }, getAccessToken: async () => 'user-jwt',
    })).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ohne Sitzung: UNAUTHORIZED, kein Rückfall auf anon', async () => {
    await expect(generateRemediationPlan([FINDING], {
      supabaseUrl: URL_, supabaseAnonKey: LEGACY_ANON_JWT,
      auth: { mode: 'user', tenantId: 'tenant-3' }, getAccessToken: async () => null,
    })).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('auditCopilotApi — öffentlich (ausdrücklich anonym)', () => {
  it('Standard ist anon: Legacy-Anon-Key als apikey und Bearer, kein tenant_id, kein audit_anon', async () => {
    await generateFixSnippet(FINDING, 'nginx', { supabaseUrl: URL_, supabaseAnonKey: LEGACY_ANON_JWT });
    const { headers, body } = sent();
    expect(headers.authorization).toBe(`Bearer ${LEGACY_ANON_JWT}`);
    expect(headers.apikey).toBe(LEGACY_ANON_JWT);
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('mode');
  });

  it('mit sb_publishable_-Key: AI_GATEWAY_NOT_CONFIGURED, nichts gesendet', async () => {
    await expect(generateFixSnippet(FINDING, 'nginx', {
      supabaseUrl: URL_, supabaseAnonKey: 'sb_publishable_x', auth: { mode: 'anon' },
    })).rejects.toMatchObject({ code: 'AI_GATEWAY_NOT_CONFIGURED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
