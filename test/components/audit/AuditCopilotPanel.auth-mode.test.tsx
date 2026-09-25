import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// Eingeloggt → Nutzer-Modus mit aktivem Workspace; ohne Sitzung →
// ausdrücklich anonym (Vertrag #1591). Entscheidung vor dem Aufruf.

vi.mock('../../../src/features/governance/AgentWidget/agentApi', () => ({
  sendChatAnon: vi.fn(async () => ({ kind: 'ok', data: { response: 'Erklärung', history: [] } })),
}));
vi.mock('../../../src/features/audit/auditCopilotApi', async (orig) => {
  const actual = await orig<typeof import('../../../src/features/audit/auditCopilotApi')>();
  return {
    ...actual,
    generateFixSnippet: vi.fn(async () => ({ cms: 'wordpress', language: 'php', snippet: 'x', notes: 'y' })),
  };
});

import { AuditCopilotPanel } from '../../../src/components/audit/AuditCopilotPanel';
import { generateFixSnippet } from '../../../src/features/audit/auditCopilotApi';
import { SupabaseAuthContext } from '../../../src/features/supabase/SupabaseAuthContext';

const ISSUE = { id: 'F-1', severity: 'high' as const, title: 'Fonts', detail: 'd' };

afterEach(() => { cleanup(); vi.mocked(generateFixSnippet).mockClear(); });

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

async function clickSnippet() {
  fireEvent.click(await screen.findByRole('button', { name: /Code-Snippet/ }));
  await waitFor(() => expect(generateFixSnippet).toHaveBeenCalled());
  return vi.mocked(generateFixSnippet).mock.calls[0]![2];
}

describe('AuditCopilotPanel — Ausweis für den Snippet-Aufruf', () => {
  it('ohne Sitzung: ausdrücklich anonym', async () => {
    render(<AuditCopilotPanel issue={ISSUE} domain="example.de" open onClose={() => {}} />);
    expect(await clickSnippet()).toEqual({ auth: { mode: 'anon' } });
  });

  it('mit Sitzung: Nutzer-Modus (tenantId aus TenantProvider, außerhalb null)', async () => {
    const ctx = { session: { access_token: 'jwt' } } as unknown as React.ContextType<typeof SupabaseAuthContext>;
    render(
      <SupabaseAuthContext.Provider value={ctx}>
        <AuditCopilotPanel issue={ISSUE} domain="example.de" open onClose={() => {}} />
      </SupabaseAuthContext.Provider>,
    );
    expect(await clickSnippet()).toEqual({ auth: { mode: 'user', tenantId: null } });
  });
});
