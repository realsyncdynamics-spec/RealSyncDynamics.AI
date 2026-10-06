/**
 * Read-only hook: list voice sessions for the active tenant.
 * Does not fetch when tenantId is null/undefined.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listVoiceSessions, type VoiceSessionRow } from './voiceApi';

const PAGE_SIZE = 25;

export interface UseVoiceSessionsResult {
  sessions: VoiceSessionRow[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

export function useVoiceSessions(tenantId: string | null): UseVoiceSessionsResult {
  const [sessions, setSessions] = useState<VoiceSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const tenantRef = useRef(tenantId);
  tenantRef.current = tenantId;

  const fetchPage = useCallback(async (tid: string, pageOffset: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listVoiceSessions(tid, { limit: PAGE_SIZE, offset: pageOffset });
      if (tenantRef.current !== tid) return;
      setSessions((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(rows.length === PAGE_SIZE);
      setOffset(pageOffset + rows.length);
    } catch (e) {
      if (tenantRef.current !== tid) return;
      setError(e instanceof Error ? e.message : 'Voice-Sessions konnten nicht geladen werden.');
      if (!append) setSessions([]);
      setHasMore(false);
    } finally {
      if (tenantRef.current === tid) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setSessions([]);
      setError(null);
      setLoading(false);
      setHasMore(false);
      setOffset(0);
      return;
    }
    setOffset(0);
    void fetchPage(tenantId, 0, false);
  }, [tenantId, fetchPage]);

  const loadMore = useCallback(() => {
    if (!tenantId || loading || !hasMore) return;
    void fetchPage(tenantId, offset, true);
  }, [tenantId, loading, hasMore, offset, fetchPage]);

  const reload = useCallback(() => {
    if (!tenantId) return;
    setOffset(0);
    void fetchPage(tenantId, 0, false);
  }, [tenantId, fetchPage]);

  return { sessions, loading, error, hasMore, loadMore, reload };
}

export { PAGE_SIZE as VOICE_SESSION_PAGE_SIZE };
