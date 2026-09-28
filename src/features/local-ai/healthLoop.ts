/**
 * Lokaler Healthcheck-Loop.
 *
 * Bewusst **kein** autonomer Agent: der Loop prüft nur, ob Runtime und
 * Modell erreichbar sind, und läuft ausschließlich, solange diese Seite im
 * Browser geöffnet ist. Er führt keine Aufgaben aus.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { probeRuntime, type RuntimeClientOptions } from './runtimeClient';
import { isModelInstalled } from './roles';
import type { HealthLoopSnapshot } from './types';

export const HEALTH_LOOP_INTERVAL_MS = 60_000;

export async function runHealthCheck(
  runtimeUrl: string,
  model: string,
  opts: RuntimeClientOptions = {},
): Promise<HealthLoopSnapshot> {
  const probe = await probeRuntime(runtimeUrl, opts);
  const checkedAt = new Date().toISOString();
  if (!probe.ok) {
    return { checkedAt, runtimeReachable: false, modelReachable: false, latencyMs: null, errorCode: probe.error.code };
  }
  const modelReachable = isModelInstalled(model, probe.data.models);
  return {
    checkedAt,
    runtimeReachable: true,
    modelReachable,
    latencyMs: probe.data.latencyMs,
    errorCode: modelReachable ? null : 'MODEL_NOT_INSTALLED',
  };
}

export function useLocalHealthLoop(input: {
  running: boolean;
  runtimeUrl: string | null;
  model: string | null;
  intervalMs?: number;
  onSnapshot?: (snap: HealthLoopSnapshot) => void;
}) {
  const { running, runtimeUrl, model, intervalMs = HEALTH_LOOP_INTERVAL_MS, onSnapshot } = input;
  const [snapshot, setSnapshot] = useState<HealthLoopSnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  const checkNow = useCallback(async () => {
    if (!runtimeUrl || !model) return;
    setChecking(true);
    try {
      const snap = await runHealthCheck(runtimeUrl, model);
      setSnapshot(snap);
      onSnapshotRef.current?.(snap);
    } finally {
      setChecking(false);
    }
  }, [runtimeUrl, model]);

  useEffect(() => {
    if (!running || !runtimeUrl || !model) return;
    void checkNow();
    const id = setInterval(() => void checkNow(), intervalMs);
    return () => clearInterval(id);
  }, [running, runtimeUrl, model, intervalMs, checkNow]);

  return { snapshot, checking, checkNow };
}
