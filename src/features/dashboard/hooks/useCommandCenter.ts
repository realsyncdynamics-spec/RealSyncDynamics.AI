import { useCallback, useState } from 'react';
import { getSupabase } from '../../../lib/supabase';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  approveSession,
  openCommandSession,
  rejectSession,
  runUntilTerminal,
  type CommandSession,
} from '../../../core/realsync-os';
import { createSiteOsExecutor } from '../../siteos/commandExecutor';

export function useCommandCenter() {
  const supabase = getSupabase();
  const { activeTenantId } = useTenant();
  const [session, setSession] = useState<CommandSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useCallback((next: CommandSession) => {
    setSession(structuredClone(next));
  }, []);

  const open = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!activeTenantId) {
      setError('Kein aktiver Mandant. Command Center braucht einen Tenant.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const actorId = data.user?.id;
      if (!actorId) {
        setError('Keine angemeldete Identität. Command Center führt ohne Identity nicht aus.');
        return;
      }

      const next = openCommandSession({
        id: crypto.randomUUID(),
        text: trimmed,
        tenantId: activeTenantId,
        actorId,
        createdAt: new Date().toISOString(),
      });
      snapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intent konnte nicht geöffnet werden');
    } finally {
      setBusy(false);
    }
  }, [activeTenantId, snapshot, supabase]);

  const approve = useCallback(async () => {
    if (!session || !activeTenantId) return;
    setBusy(true);
    setError(null);
    try {
      approveSession(session, session.intent.actorId);
      snapshot(session);
      await runUntilTerminal(session, { executeStep: createSiteOsExecutor(activeTenantId) });
      snapshot(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan konnte nicht ausgeführt werden');
    } finally {
      setBusy(false);
    }
  }, [activeTenantId, session, snapshot]);

  const reject = useCallback((reason: string) => {
    if (!session) return;
    rejectSession(session, session.intent.actorId, reason);
    snapshot(session);
  }, [session, snapshot]);

  const reset = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  return { session, busy, error, open, approve, reject, reset };
}
