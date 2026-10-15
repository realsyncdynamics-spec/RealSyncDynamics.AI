// AI Command Center — Zugangs- und Datenzustände mit gemockter Edge Function.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: (s: unknown) => React.ReactNode }) =>
    <>{children({ user: { id: 'u1', email: 'op@example.test' } })}</>,
}));

import { AiOsCommandCenter } from '../../src/features/ai-os/AiOsCommandCenter';
import { __setAiOsInvoke } from '../../src/features/ai-os/aiOsApi';
import { buildSkillCommand } from '../../src/features/ai-os/sections/SkillLibrarySection';
import { outgoingLinks } from '../../src/features/ai-os/sections/KnowledgeCenterSection';
import { getSkill } from '../../packages/ai-os-core/src/index';

type Handler = (body: Record<string, unknown>) => { data?: unknown; status?: number; error?: Record<string, unknown> };

function mockServer(handler: Handler) {
  const calls: Array<Record<string, unknown>> = [];
  __setAiOsInvoke(async (body) => {
    calls.push(body);
    const r = handler(body);
    if (r.error) {
      const res = new Response(JSON.stringify(r.error), { status: r.status ?? 500 });
      return { data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: res }) };
    }
    return { data: r.data, error: null };
  });
  return calls;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/ai-os" element={<AiOsCommandCenter />} />
        <Route path="/admin/ai-os/:section" element={<AiOsCommandCenter />} />
      </Routes>
    </MemoryRouter>,
  );
}

const operatorSession = (over: Record<string, unknown> = {}) => ({
  operator: true, aal: 'aal1', githubConfigured: false, repo: 'o/r', ...over,
});

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => {
  __setAiOsInvoke(null);
  cleanup();
});

describe('Zugang', () => {
  it('zeigt Nicht-Operatoren „Kein Zugriff" und lädt keine Daten', async () => {
    const calls = mockServer(() => ({ status: 403, error: { operator: false } }));
    renderAt('/admin/ai-os');
    expect(await screen.findByRole('heading', { name: 'Kein Zugriff' })).toBeInTheDocument();
    expect(calls.map((c) => c.op)).toEqual(['session']);
  });

  it('zeigt Serverfehler als Fehler, nicht als leere Fläche', async () => {
    mockServer(() => ({ status: 503, error: { error: 'role_check_failed' } }));
    renderAt('/admin/ai-os');
    expect(await screen.findByText('Command Center nicht erreichbar')).toBeInTheDocument();
    expect(screen.getByText('role_check_failed')).toBeInTheDocument();
  });
});

describe('Übersicht', () => {
  it('ohne GitHub-Anbindung: ehrliche „nicht verbunden"-Werte statt Zahlen', async () => {
    mockServer((b) => {
      if (b.op === 'session') return { data: operatorSession() };
      if (b.op === 'costs') {
        return {
          data: {
            periodDays: 30, since: '2026-09-15T00:00:00Z', currency: 'USD',
            ledger: { available: true, rows: 3, truncated: false, totalUsd: 1.5, byVendor: [], byModel: [], byKind: [] },
            toolRuns: { available: false, error: 'x' },
            providerQuotas: { available: false, message: 'nicht angebunden' },
          },
        };
      }
      return { data: { configured: false, message: 'GitHub ist nicht verbunden.' } };
    });
    renderAt('/admin/ai-os');
    expect(await screen.findByRole('heading', { name: 'Übersicht' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('nicht verbunden').length).toBeGreaterThanOrEqual(3));
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.getByText('ohne 2FA: nur lesen')).toBeInTheDocument();
  });
});

describe('Routinen', () => {
  const routinesData = {
    configured: true,
    cronJobs: [{ name: 'dsr-erasure-sweep', schedule: '0 3 * * *', active: true }],
    routines: [{ id: 'daily-github-status', state: 'active', url: 'https://x', runs: [{ id: 9, event: 'schedule', status: 'completed', conclusion: 'success', createdAt: '2026-10-15T05:50:00Z', url: 'https://x/9' }] }],
  };

  it('sperrt Start/Pause ohne 2FA und begründet es', async () => {
    mockServer((b) => (b.op === 'session' ? { data: operatorSession({ githubConfigured: true }) } : { data: routinesData }));
    renderAt('/admin/ai-os/routinen');
    const heading = await screen.findByRole('heading', { name: 'Tägliche GitHub-Statusprüfung' });
    const panel = heading.closest('section')!;
    expect(within(panel).getByRole('button', { name: /Jetzt starten/ })).toBeDisabled();
    expect(within(panel).getAllByText(/erfordern 2FA/).length).toBeGreaterThan(0);
    expect(await screen.findByText('dsr-erasure-sweep')).toBeInTheDocument();
  });

  it('startet eine Routine erst nach Bestätigung und schickt confirmed:true', async () => {
    const calls = mockServer((b) => {
      if (b.op === 'session') return { data: operatorSession({ aal: 'aal2', githubConfigured: true }) };
      if (b.op === 'routine_dispatch') return { data: { ok: true } };
      return { data: routinesData };
    });
    renderAt('/admin/ai-os/routinen');
    const heading = await screen.findByRole('heading', { name: 'Tägliche GitHub-Statusprüfung' });
    const panel = heading.closest('section')!;
    await waitFor(() => expect(within(panel).getByRole('button', { name: /Jetzt starten/ })).toBeEnabled());
    fireEvent.click(within(panel).getByRole('button', { name: /Jetzt starten/ }));
    expect(calls.some((c) => c.op === 'routine_dispatch')).toBe(false);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Starten' }));
    await waitFor(() => expect(calls.find((c) => c.op === 'routine_dispatch')).toMatchObject({ routineId: 'daily-github-status', confirmed: true }));
    expect(await screen.findByText(/Lauf angefordert/)).toBeInTheDocument();
  });

  it('zeigt eine Server-Ablehnung verständlich an', async () => {
    mockServer((b) => {
      if (b.op === 'session') return { data: operatorSession({ aal: 'aal2', githubConfigured: true }) };
      if (b.op === 'routine_dispatch') return { status: 503, error: { error: 'audit_unavailable', message: 'x' } };
      return { data: routinesData };
    });
    renderAt('/admin/ai-os/routinen');
    const heading = await screen.findByRole('heading', { name: 'Tägliche GitHub-Statusprüfung' });
    const panel = heading.closest('section')!;
    await waitFor(() => expect(within(panel).getByRole('button', { name: /Jetzt starten/ })).toBeEnabled());
    fireEvent.click(within(panel).getByRole('button', { name: /Jetzt starten/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Starten' }));
    expect(await screen.findByText(/Aktionsprotokoll ist nicht erreichbar/)).toBeInTheDocument();
  });
});

describe('Design', () => {
  it('schaltet zwischen Dunkel und Hell um', async () => {
    mockServer(() => ({ status: 403, error: {} }));
    const { container } = renderAt('/admin/ai-os');
    const root = container.querySelector('.aios')!;
    const before = root.getAttribute('data-theme');
    fireEvent.click(screen.getByRole('button', { name: /Design/ }));
    expect(root.getAttribute('data-theme')).not.toBe(before);
  });
});

describe('Hilfsfunktionen', () => {
  it('buildSkillCommand setzt Eingaben und quotet Leerzeichen', () => {
    const skill = getSkill('aios-pr-review')!;
    expect(buildSkillCommand(skill, { pr: '1890', focus: 'Sicherheit und RLS' }))
      .toBe('/aios-pr-review pr=1890 focus="Sicherheit und RLS"');
    expect(buildSkillCommand(skill, {})).toBe('/aios-pr-review');
  });

  it('outgoingLinks löst relative Links auf und ignoriert externe', () => {
    expect(outgoingLinks({
      path: 'docs/ai-os/wissen/a.md',
      content: '[b](b.md) [r](../README.md#x) [e](https://example.com/x.md)',
    })).toEqual(['docs/ai-os/wissen/b.md', 'docs/ai-os/README.md']);
  });
});
