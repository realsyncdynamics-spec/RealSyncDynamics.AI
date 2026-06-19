/**
 * LiveEarthHud — dezentes „Command Center"-Telemetrie-Overlay über der Erde.
 *
 * Vermittelt den „Live Earth"-Eindruck: pulsierender LIVE-Indikator, tickende
 * UTC-Uhr (Echtzeit) und Standort-Koordinaten (Mitteleuropa). Reine Deko über
 * der Canvas — `pointer-events-none`, respektiert reduced-motion.
 */
import { useEffect, useState } from 'react';

function useUtcClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toISOString().slice(11, 19); // HH:MM:SS
}

export function LiveEarthHud() {
  const utc = useUtcClock();
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 hidden lg:block">
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-obsidian-900/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-300 backdrop-blur-xl">
        <span className="inline-flex items-center gap-1.5 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)] motion-safe:animate-pulse" />
          Live
        </span>
        <span className="text-titanium-500">·</span>
        <span className="tabular-nums text-titanium-200">{utc} UTC</span>
        <span className="text-titanium-500">·</span>
        <span className="text-titanium-400">EU-CENTRAL 51.16°N 10.45°E</span>
      </div>
    </div>
  );
}

export default LiveEarthHud;
