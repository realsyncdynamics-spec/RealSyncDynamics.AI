/**
 * Read-only hook: voice session detail (tools, executions, evidence).
 * Does not fetch without tenantId + sessionId.
 *
 * Request generations guard against A→B→A races where key alone would allow
 * a stale response for the same tenant/session to overwrite newer state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadVoiceSessionDetail, type VoiceSessionDetail } from './voiceApi';

export interface UseVoiceSessionDetailResult {
  detail: VoiceSessionDetail | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  reload: () => void;
}

export function useVoiceSessionDetail(
  tenantId: string | null,
  sessionId: string | undefined,
): UseVoiceSessionDetailResult {
  const [detail, setDetail] = useState<VoiceSessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const keyRef = useRef(`${tenantId ?? ''}:${sessionId ?? ''}`);
  keyRef.current = `${tenantId ?? ''}:${sessionId ?? ''}`;
  const requestGenerationRef = useRef(0);

  const load = useCallback(async (tid: string, sid: string) => {
    const key = `${tid}:${sid}`;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setDetail(null);
    try {
      const result = await loadVoiceSessionDetail(tid, sid);
      if (keyRef.current !== key || requestGenerationRef.current !== generation) return;
      if (!result) {
        setDetail(null);
        setNotFound(true);
      } else {
        setDetail(result);
        setNotFound(false);
      }
    } catch (e) {
      if (keyRef.current !== key || requestGenerationRef.current !== generation) return;
      setDetail(null);
      setError(e instanceof Error ? e.message : 'Session-Detail konnte nicht geladen werden.');
    } finally {
      if (keyRef.current === key && requestGenerationRef.current === generation) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!tenantId || !sessionId) {
      requestGenerationRef.current += 1;
      setDetail(null);
      setError(null);
      setLoading(false);
      setNotFound(false);
      return;
    }
    void load(tenantId, sessionId);
  }, [tenantId, sessionId, load]);

  const reload = useCallback(() => {
    if (!tenantId || !sessionId) return;
    void load(tenantId, sessionId);
  }, [tenantId, sessionId, load]);

  return { detail, loading, error, notFound, reload };
}
