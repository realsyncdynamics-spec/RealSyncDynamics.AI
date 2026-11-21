import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWithRetry } from '../../../src/components/visual/sync-mascot/loadWithRetry';

type Outcome = 'ok' | 'fail';

/** Ladefunktion, die der Reihe nach die vorgegebenen Ergebnisse liefert. */
function scripted(outcomes: Outcome[]) {
  const load = vi.fn((onSuccess: (v: string) => void, onFailure: () => void) => {
    const next = outcomes.shift() ?? 'fail';
    if (next === 'ok') onSuccess('model');
    else onFailure();
  });
  return load;
}

describe('loadWithRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('meldet Erfolg beim ersten Versuch ohne Neuversuch', () => {
    const load = scripted(['ok']);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    loadWithRetry({ load, onSuccess, onError, isCancelled: () => false });
    expect(onSuccess).toHaveBeenCalledWith('model');
    expect(onError).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('versucht es nach einem Fehlschlag genau einmal erneut', () => {
    const load = scripted(['fail', 'ok']);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    loadWithRetry({ load, onSuccess, onError, isCancelled: () => false, retryDelayMs: 1000 });
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith('model');
    expect(onError).not.toHaveBeenCalled();
  });

  it('meldet den Fehler erst, wenn auch der Neuversuch scheitert', () => {
    const load = scripted(['fail', 'fail']);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    loadWithRetry({ load, onSuccess, onError, isCancelled: () => false });
    expect(onError).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(load).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('startet keinen Neuversuch, wenn die Bühne inzwischen abgebaut ist', () => {
    const load = scripted(['fail', 'ok']);
    let cancelled = false;
    const onError = vi.fn();
    loadWithRetry({ load, onSuccess: vi.fn(), onError, isCancelled: () => cancelled });
    cancelled = true;
    vi.runAllTimers();
    expect(load).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('räumt einen ausstehenden Neuversuch über die Rückgabe ab', () => {
    const load = scripted(['fail', 'ok']);
    const cancel = loadWithRetry({ load, onSuccess: vi.fn(), onError: vi.fn(), isCancelled: () => false });
    cancel();
    vi.runAllTimers();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('meldet einen spät geladenen Erfolg auch nach Abbruch, damit aufgeräumt werden kann', () => {
    let finish: ((v: string) => void) | null = null;
    const load = vi.fn((onSuccess: (v: string) => void) => {
      finish = onSuccess;
    });
    let cancelled = false;
    const onSuccess = vi.fn();
    loadWithRetry({ load, onSuccess, onError: vi.fn(), isCancelled: () => cancelled });
    cancelled = true;
    finish!('model');
    expect(onSuccess).toHaveBeenCalledWith('model');
  });
});
