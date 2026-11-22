// Spike Laufzeit-Vorschau — Browser-Seite. Gegen einen Fake-Client, kein echter Anbieter.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { isSandboxPreviewEnabled, APP_BUILDER_SANDBOX_PREVIEW_DEFAULT } from '@/src/config/featureFlags';
import {
  SandboxPreviewPanel,
  SANDBOX_RUNTIME_FRAME_TOKENS,
} from '@/src/features/app-builder/preview-runtime/SandboxPreviewPanel';
import type { SandboxPreviewClient, SandboxResult } from '@/src/features/app-builder/preview-runtime/client';
import { hasForbiddenSandboxCombination } from '@/src/lib/preview-sandbox';

function fakeClient() {
  const ok = (state: 'running' | 'stopped'): SandboxResult => ({
    kind: 'ok',
    session: {
      sessionId: 's1',
      state,
      previewUrl: state === 'running' ? 'https://5173-fake.preview.fake-sandbox.invalid/?token=t' : null,
      hardDeadline: Date.now() + 900_000,
      stopReason: state === 'stopped' ? 'user' : null,
    },
  });
  const client: SandboxPreviewClient & { calls: Record<string, unknown[][]> } = {
    calls: { start: [], heartbeat: [], stop: [] },
    async start(...a) { client.calls.start.push(a); return ok('running'); },
    async heartbeat(...a) { client.calls.heartbeat.push(a); return ok('running'); },
    async stop(...a) { client.calls.stop.push(a); return ok('stopped'); },
  };
  return client;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Feature-Flag Laufzeit-Vorschau', () => {
  it('ist standardmäßig aus', () => {
    expect(APP_BUILDER_SANDBOX_PREVIEW_DEFAULT).toBe(false);
    expect(isSandboxPreviewEnabled()).toBe(false);
  });

  it('schaltet nur mit exakt "true" ein', () => {
    vi.stubEnv('VITE_APP_BUILDER_SANDBOX_PREVIEW', '1');
    expect(isSandboxPreviewEnabled()).toBe(false);
    vi.stubEnv('VITE_APP_BUILDER_SANDBOX_PREVIEW', 'true');
    expect(isSandboxPreviewEnabled()).toBe(true);
  });

  it('der Workbench rendert das Panel nur mit Flag; srcDoc-Vorschau bleibt Standard', () => {
    const src = readFileSync(resolve(__dirname, '../../src/features/app-builder/BoltWorkbench.tsx'), 'utf8');
    expect(src).toMatch(/sandboxPreview && pane === 'runtime'/);
    expect(src).toMatch(/useState<Pane>\('preview'\)/);
    expect(src).toMatch(/sandboxPreview \? 'grid-cols-4' : 'grid-cols-3'/);
  });
});

describe('SandboxPreviewPanel', () => {
  it('startet, zeigt die Vorschau in opaker Origin und stoppt beim Schließen', async () => {
    const client = fakeClient();
    const view = render(<SandboxPreviewPanel tenantId="tenant-a" projectId="p1" client={client} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sandbox starten' }));
    });
    expect(client.calls.start).toEqual([['tenant-a', 'p1']]);
    const frame = screen.getByTitle('Laufzeit-Vorschau (Sandbox)');
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/5173-fake/);
    expect(frame.getAttribute('sandbox')).toBe(SANDBOX_RUNTIME_FRAME_TOKENS);
    expect(hasForbiddenSandboxCombination(SANDBOX_RUNTIME_FRAME_TOKENS)).toBe(false);
    expect(SANDBOX_RUNTIME_FRAME_TOKENS).not.toContain('allow-same-origin');

    view.unmount();
    expect(client.calls.stop).toEqual([['tenant-a', 's1', 'closed']]);
  });

  it('stoppt beim Verlassen der Seite (pagehide)', async () => {
    const client = fakeClient();
    render(<SandboxPreviewPanel tenantId="tenant-a" projectId="p1" client={client} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sandbox starten' }));
    });
    window.dispatchEvent(new Event('pagehide'));
    expect(client.calls.stop).toEqual([['tenant-a', 's1', 'closed']]);
  });

  it('startet ohne gespeichertes Projekt nichts', () => {
    const client = fakeClient();
    render(<SandboxPreviewPanel tenantId="tenant-a" projectId={null} client={client} />);
    const btn = screen.getByRole('button', { name: 'Sandbox starten' });
    expect(btn).toHaveProperty('disabled', true);
    fireEvent.click(btn);
    expect(client.calls.start).toEqual([]);
  });
});
