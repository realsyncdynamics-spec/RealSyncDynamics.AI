/**
 * useVoiceSessions — empty / error / no-fetch-without-tenant.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { VoiceSessionRow } from '@/src/features/governance/voice/voiceApi';

const listMock = vi.hoisted(() => vi.fn<() => Promise<VoiceSessionRow[]>>());

vi.mock('@/src/features/governance/voice/voiceApi', async (orig) => {
  const actual = await orig<typeof import('@/src/features/governance/voice/voiceApi')>();
  return { ...actual, listVoiceSessions: listMock };
});

import { useVoiceSessions } from '@/src/features/governance/voice/useVoiceSessions';

const sample: VoiceSessionRow = {
  id: 'sess-1',
  bot_id: 'bot-1',
  provider: 'grok',
  model: 'grok-voice',
  status: 'ended',
  disclosure_played_at: null,
  kill_switch: false,
  started_at: '2026-10-01T12:00:00Z',
  ended_at: '2026-10-01T12:05:00Z',
};

describe('useVoiceSessions', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('fetcht nicht ohne Tenant', async () => {
    const { result } = renderHook(() => useVoiceSessions(null));
    await act(async () => {
      await Promise.resolve();
    });
    expect(listMock).not.toHaveBeenCalled();
    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('setzt Tenant-Filter (listVoiceSessions mit tenantId)', async () => {
    listMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useVoiceSessions('tenant-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listMock).toHaveBeenCalledWith('tenant-a', { limit: 25, offset: 0 });
    expect(result.current.sessions).toEqual([]);
  });

  it('Empty-State-Daten bei 0 Rows', async () => {
    listMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useVoiceSessions('tenant-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('Fehler-State bei Load-Error — kein Fallback auf Beispieldaten', async () => {
    listMock.mockRejectedValueOnce(new Error('RLS blockiert'));
    const { result } = renderHook(() => useVoiceSessions('tenant-a'));
    await waitFor(() => expect(result.current.error).toBe('RLS blockiert'));
    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('lädt Sessions bei Erfolg', async () => {
    listMock.mockResolvedValueOnce([sample]);
    const { result } = renderHook(() => useVoiceSessions('tenant-a'));
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.sessions[0].id).toBe('sess-1');
    expect(result.current.error).toBeNull();
  });

  it('verwirft veraltete Antworten nach Tenant-Wechsel (Generation)', async () => {
    let resolveA: (rows: VoiceSessionRow[]) => void = () => {};
    const pendingA = new Promise<VoiceSessionRow[]>((resolve) => {
      resolveA = resolve;
    });
    listMock.mockImplementationOnce(() => pendingA);
    listMock.mockResolvedValueOnce([{ ...sample, id: 'sess-b', bot_id: 'bot-b' }]);

    const { result, rerender } = renderHook(
      ({ tid }: { tid: string | null }) => useVoiceSessions(tid),
      { initialProps: { tid: 'tenant-a' as string | null } },
    );

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    rerender({ tid: 'tenant-b' });
    await waitFor(() => expect(result.current.sessions[0]?.id).toBe('sess-b'));

    await act(async () => {
      resolveA([{ ...sample, id: 'sess-stale' }]);
      await Promise.resolve();
    });

    expect(result.current.sessions.map((s) => s.id)).toEqual(['sess-b']);
  });
});
