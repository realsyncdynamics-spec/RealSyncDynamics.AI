/**
 * Pageview-Tracking erst nach Analytics-Consent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const CONSENT_KEY = 'realsync.cookie-consent.v1';
const CONSENT_EVENT = 'realsync:consent-changed';

describe('useTrackPageview consent gate', () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(null, { status: 204 }),
  );

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    vi.stubEnv('PROD', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('does not call track-pageview before analytics consent', async () => {
    vi.resetModules();
    // PROD must be true inside the module at import time.
    vi.stubEnv('MODE', 'production');
    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, PROD: true, MODE: 'production' },
      configurable: true,
    });

    const { useTrackPageview } = await import('../../src/lib/track');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    );
    renderHook(() => useTrackPageview(), { wrapper });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends track-pageview after analytics consent is granted', async () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        version: 1,
        decided_at: new Date().toISOString(),
        necessary: true,
        analytics: true,
        marketing: false,
      }),
    );

    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, PROD: true, MODE: 'production' },
      configurable: true,
    });
    vi.resetModules();
    const { useTrackPageview } = await import('../../src/lib/track');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/welcome']}>{children}</MemoryRouter>
    );
    renderHook(() => useTrackPageview(), { wrapper });

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/track-pageview');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body)).path).toBe('/welcome');
  });

  it('fires after consent-changed when analytics becomes true', async () => {
    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, PROD: true, MODE: 'production' },
      configurable: true,
    });
    vi.resetModules();
    const { useTrackPageview } = await import('../../src/lib/track');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    );
    renderHook(() => useTrackPageview(), { wrapper });
    expect(fetchMock).not.toHaveBeenCalled();

    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        version: 1,
        decided_at: new Date().toISOString(),
        necessary: true,
        analytics: true,
        marketing: false,
      }),
    );
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
    expect(fetchMock).toHaveBeenCalled();
  });
});
