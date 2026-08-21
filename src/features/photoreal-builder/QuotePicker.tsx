import { AGENCY_COMPARE, LADDER, firstInvoice, monthlyCents, type RungKey } from './quote';
import { cn, formatEuro } from './uid';

export function QuotePicker({
  selected,
  onChange,
}: {
  selected: RungKey;
  onChange: (next: RungKey) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-[.18em] text-white/40">
        Erst die Vorschau. Dann eine Zahl. Agentur-Relaunch {AGENCY_COMPARE}.
      </p>
      <ul className="grid gap-2">
        {LADDER.map((r) => {
          const on = selected === r.key;
          const month = monthlyCents(r.abo);
          const today = firstInvoice(r.key);
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onChange(r.key)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-4 text-left transition',
                  on
                    ? 'border-cyan-400/50 bg-cyan-400/10'
                    : 'border-white/10 bg-white/[.03] hover:border-white/25',
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
                      {r.highlighted ? 'Die meisten starten hier' : `Dazu · Stufe ${r.rung}`}
                    </span>
                    <span className="mt-0.5 block text-xl font-medium">{r.name}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-2xl tabular-nums">{formatEuro(today)}</span>
                    <span className="text-[11px] text-white/45">heute</span>
                  </span>
                </span>
                <span className="mt-1 block text-sm text-white/55">{r.want}</span>
                <span className="mt-2 block text-xs text-white/40">
                  {formatEuro(r.cents)} einmalig · danach {formatEuro(month)}/M · {r.includes.join(' · ')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
