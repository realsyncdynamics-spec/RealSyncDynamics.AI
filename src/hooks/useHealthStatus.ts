import { useEffect, useRef, useState } from 'react';

/**
 * useHealthStatus — pollt den oeffentlichen /health-Edge-Endpoint und liefert
 * den Live-Runtime-Status fuer die Landing-Page (MONITORING-Karte).
 *
 * Der Endpoint laeuft mit verify_jwt=false (supabase/config.toml), ist also
 * anonym erreichbar — passend fuer die oeffentliche Marketing-Seite. Es wird
 * KEINE tenant-/governance-Aggregation gezogen (RLS-geschuetzt, nicht public),
 * sondern nur das ehrliche, plattformweite Up/Down-Signal.
 *
 * Best-effort: faellt der Fetch durch (kein Netz, CORS, Config fehlt), wird
 * der Status 'unknown' zurueckgegeben — niemals ein Render-Fehler.
 */

export type RuntimeHealth = 'live' | 'degraded' | 'offline' | 'unknown';

interface HealthState {
  /** Normalisierter Runtime-Status fuer die Anzeige. */
  health: RuntimeHealth;
  /** Anzeige-Label (DE) — z.B. 'LIVE', 'EINGESCHRÄNKT', 'OFFLINE'. */
  label: string;
  /** Soll der Puls-Indikator (grüner Punkt) animiert werden? */
  pulse: boolean;
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string;
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/health` : null;

// Alle 60s neu pruefen — haeufiger waere fuer eine Marketing-Seite Overkill.
const POLL_INTERVAL_MS = 60_000;

const LABELS: Record<RuntimeHealth, string> = {
  live: 'LIVE',
  degraded: 'EINGESCHRÄNKT',
  offline: 'OFFLINE',
  unknown: 'LIVE',
};

function toHealth(status: unknown): RuntimeHealth {
  if (status === 'ok') return 'live';
  if (status === 'degraded') return 'degraded';
  if (status === 'down') return 'offline';
  return 'unknown';
}

export function useHealthStatus(): HealthState {
  const [health, setHealth] = useState<RuntimeHealth>('unknown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ENDPOINT) return;
    let cancelled = false;

    async function ping() {
      try {
        const res = await fetch(ENDPOINT as string, {
          method: 'GET',
          headers: ANON_KEY
            ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
            : {},
        });
        // 503 => down, aber JSON liefert status:'down' — wir lesen den Body.
        const body = (await res.json().catch(() => null)) as { status?: string } | null;
        if (cancelled) return;
        setHealth(toHealth(body?.status ?? (res.ok ? 'ok' : 'down')));
      } catch {
        if (!cancelled) setHealth('unknown');
      }
    }

    void ping();
    timerRef.current = setInterval(() => void ping(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    health,
    label: LABELS[health],
    // Puls nur bei einem echten/angenommenen Live-Signal — nicht bei offline.
    pulse: health === 'live' || health === 'unknown',
  };
}
