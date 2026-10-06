/**
 * useVoiceSessionDetail — no fetch without tenant/session; error & notFound.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { VoiceSessionDetail } from '@/src/features/governance/voice/voiceApi';

const loadMock = vi.hoisted(() => vi.fn<() => Promise<VoiceSessionDetail | null>>());

vi.mock('@/src/features/governance/voice/voiceApi', async (orig) => {
  const actual = await orig<typeof import('@/src/features/governance/voice/voiceApi')>();
  return { ...actual, loadVoiceSessionDetail: loadMock };
});

import { useVoiceSessionDetail } from '@/src/features/governance/voice/useVoiceSessionDetail';

describe('useVoiceSessionDetail', () => {
  beforeEach(() => {
    loadMock.mockReset();
  });

  it('fetcht nicht ohne Tenant oder Session-ID', async () => {
    const { result: a } = renderHook(() => useVoiceSessionDetail(null, 'sess-1'));
    const { result: b } = renderHook(() => useVoiceSessionDetail('tenant-a', undefined));
    await act(async () => {
      await Promise.resolve();
    });
    expect(loadMock).not.toHaveBeenCalled();
    expect(a.current.detail).toBeNull();
    expect(b.current.detail).toBeNull();
  });

  it('setzt notFound wenn keine Zeile', async () => {
    loadMock.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useVoiceSessionDetail('tenant-a', 'sess-missing'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadMock).toHaveBeenCalledWith('tenant-a', 'sess-missing');
    expect(result.current.notFound).toBe(true);
    expect(result.current.detail).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('Fehler-State ohne Fake-Detail', async () => {
    loadMock.mockRejectedValueOnce(new Error('timeout'));
    const { result } = renderHook(() => useVoiceSessionDetail('tenant-a', 'sess-1'));
    await waitFor(() => expect(result.current.error).toBe('timeout'));
    expect(result.current.detail).toBeNull();
    expect(result.current.notFound).toBe(false);
  });
});
