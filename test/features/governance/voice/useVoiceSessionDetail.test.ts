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

  it('verwirft stale A→B→A Responses per Generation', async () => {
    const detailA1: VoiceSessionDetail = {
      session: {
        id: 'sess-1',
        bot_id: 'bot-1',
        provider: 'grok',
        model: 'm1',
        status: 'ended',
        disclosure_played_at: null,
        kill_switch: false,
        started_at: '2026-10-01T12:00:00Z',
        ended_at: null,
      },
      toolRequests: [],
      executionsByRequestId: {},
      evidence: [],
    };
    const detailA2: VoiceSessionDetail = {
      ...detailA1,
      session: { ...detailA1.session, model: 'm2-newer' },
    };

    let resolveFirstA: (v: VoiceSessionDetail | null) => void = () => {};
    const firstA = new Promise<VoiceSessionDetail | null>((resolve) => {
      resolveFirstA = resolve;
    });

    loadMock.mockImplementationOnce(() => firstA);
    loadMock.mockResolvedValueOnce(null); // B → not found
    loadMock.mockResolvedValueOnce(detailA2); // second A

    const { result, rerender } = renderHook(
      ({ tid, sid }: { tid: string | null; sid: string | undefined }) =>
        useVoiceSessionDetail(tid, sid),
      { initialProps: { tid: 'tenant-a' as string | null, sid: 'sess-1' as string | undefined } },
    );

    await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));
    rerender({ tid: 'tenant-b', sid: 'sess-1' });
    await waitFor(() => expect(result.current.notFound).toBe(true));
    rerender({ tid: 'tenant-a', sid: 'sess-1' });
    await waitFor(() => expect(result.current.detail?.session.model).toBe('m2-newer'));

    await act(async () => {
      resolveFirstA(detailA1);
      await Promise.resolve();
    });

    expect(result.current.detail?.session.model).toBe('m2-newer');
  });
});
