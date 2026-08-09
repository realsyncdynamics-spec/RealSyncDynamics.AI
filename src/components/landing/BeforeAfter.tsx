import { Check, X } from 'lucide-react';
import { BEFORE_AFTER } from './complianceDemoData';

/**
 * BeforeAfter — Kontrast zwischen manueller Compliance-Arbeit und laufender
 * Governance. Enthält bewusst keine Zahlen: die Aussage ist qualitativ, und
 * eine erfundene Ersparnis („spart 80 % Zeit") wäre ein unbelegter Claim.
 */
export function BeforeAfter() {
  return (
    <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
      <Column
        title="Ohne Runtime"
        items={BEFORE_AFTER.before}
        tone="muted"
      />
      <Column
        title="Mit RealSyncDynamics.AI"
        items={BEFORE_AFTER.after}
        tone="accent"
      />
    </div>
  );
}

function Column({ title, items, tone }: { title: string; items: readonly string[]; tone: 'muted' | 'accent' }) {
  const accent = tone === 'accent';
  const Icon = accent ? Check : X;

  return (
    <div className="p-6 sm:p-8 bg-[rgb(3,7,18)]">
      <p className={`font-mono text-[10px] tracking-widest uppercase mb-5 ${accent ? 'text-cyan-400' : 'text-white/40'}`}>
        {title}
      </p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            {/* Das Icon doppelt die Aussage der Spaltenüberschrift — Farbe ist
                nie der alleinige Träger der Zuordnung. */}
            <Icon
              className={`w-4 h-4 shrink-0 mt-0.5 ${accent ? 'text-emerald-400' : 'text-white/30'}`}
              strokeWidth={accent ? 3 : 2}
              aria-hidden="true"
            />
            <span className={`text-sm leading-relaxed ${accent ? 'text-white/80' : 'text-white/50'}`}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
