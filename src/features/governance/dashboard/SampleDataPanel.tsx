/**
 * Beispieldaten laden/entfernen auf /app/dashboard (WP-4).
 *
 * Zeigt sich nur in der Beta und nur, wenn der Bestand bekannt ist. Ohne
 * Beispiel-Einträge: Angebot, fünf markierte Einträge zu laden. Mit
 * Einträgen: Hinweis + „entfernen“. Jede Aktion läuft über die Edge Function
 * `beta-sample-data` (Service-Role nur dort) und meldet die Änderung an alle
 * Dashboard-Loader (`notifyTenantDataChanged`), damit Score, Inventar und
 * Risikoverteilung ohne Reload nachziehen.
 *
 * Kein Mock im Frontend: Die Einträge sind echte `governance_assets`-Zeilen
 * mit `metadata.sample = true` und dem Namenspräfix „[Beispiel] “.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BETA } from '../../../config/beta';
import { useTenantDataVersion } from '../tenantDataEvents';
import { countSampleAssets, loadSampleData, removeSampleData } from '../../beta/sampleDataApi';

type Phase =
  | { status: 'unknown' }
  | { status: 'ready'; count: number }
  | { status: 'busy'; count: number; action: 'load' | 'remove' }
  | { status: 'error'; count: number; message: string };

export function SampleDataPanel({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const version = useTenantDataVersion(tenantId);
  const [phase, setPhase] = useState<Phase>({ status: 'unknown' });

  useEffect(() => {
    let cancelled = false;
    countSampleAssets(tenantId)
      .then((count) => { if (!cancelled) setPhase({ status: 'ready', count }); })
      .catch(() => { if (!cancelled) setPhase({ status: 'unknown' }); });
    return () => { cancelled = true; };
  }, [tenantId, version]);

  const run = useCallback(async (action: 'load' | 'remove') => {
    const count = phase.status === 'unknown' ? 0 : phase.count;
    setPhase({ status: 'busy', count, action });
    try {
      const res = action === 'load' ? await loadSampleData(tenantId) : await removeSampleData(tenantId);
      const next = action === 'load' ? (res.count ?? res.loaded ?? 0) : 0;
      setPhase({ status: 'ready', count: next });
    } catch (err) {
      setPhase({ status: 'error', count, message: (err as Error)?.message ?? String(err) });
    }
  }, [phase, tenantId]);

  if (!BETA.active || phase.status === 'unknown') return null;

  const busy = phase.status === 'busy';
  const count = phase.count;

  return (
    <div className="rs-start__account" data-testid="sample-data-panel" role="group" aria-label="Beispieldaten">
      {count === 0 ? (
        <>
          <span>
            Noch nichts zum Ansehen? Laden Sie fünf <strong>klar markierte Beispiel-Einträge</strong>
            {' '}(Chatbot, Recruiting-KI, CRM-Schnittstelle, Website, Workflow) – jederzeit wieder entfernbar.
          </span>
          {canManage ? (
            <button
              type="button"
              className="rs-start__step-link"
              onClick={() => void run('load')}
              disabled={busy}
              data-testid="sample-data-load"
            >
              {busy ? <><Loader2 className="inline h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Wird geladen …</> : 'Beispieldaten laden'}
            </button>
          ) : (
            <span className="opacity-70">Nur Inhaber oder Admins können Beispieldaten laden.</span>
          )}
        </>
      ) : (
        <>
          <span data-testid="sample-data-count">
            <strong>{count} Beispiel-Einträge</strong> aktiv (Name beginnt mit „[Beispiel]“). Score und Inventar
            enthalten sie – entfernen Sie sie, sobald eigene Daten da sind.
          </span>
          {canManage && (
            <button
              type="button"
              className="rs-start__step-link"
              onClick={() => void run('remove')}
              disabled={busy}
              data-testid="sample-data-remove"
            >
              {busy ? <><Loader2 className="inline h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Wird entfernt …</> : 'Beispieldaten entfernen'}
            </button>
          )}
        </>
      )}
      {phase.status === 'error' && (
        <span role="alert" className="rs-start__account--attention" data-testid="sample-data-error">
          {phase.message}
        </span>
      )}
    </div>
  );
}
