import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import {
  EVIDENCE_CHAIN_CONTROL,
  EVIDENCE_CHAIN_STEPS,
  DEMO_BADGE,
  DEMO_EXPLAINER,
} from './complianceDemoData';

/**
 * EvidenceChain — macht das Kernversprechen „Prove" sichtbar: von der
 * ausgeführten Kontrolle über Ergebnis, Evidenz-ID, Hash und Zeitstempel bis
 * zur Verifizierung.
 *
 * ⚠️ Evidenz-ID und Hash sind Beispielwerte (`complianceDemoData`), keine
 * echten Produktionsnachweise — deshalb die DEMO-Kennzeichnung im Kopf. Eine
 * erfundene, aber echt aussehende Nachweis-ID wäre genau die Art von Claim,
 * die dieses Produkt nicht führen darf.
 *
 * Semantik: `<ol>`, weil die Kette eine Reihenfolge hat — Screenreader lesen
 * sie als nummerierte Abfolge, die Pfeile sind rein dekorativ.
 */
export function EvidenceChain() {
  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-white/10 bg-white/[0.03]">
        <p className="font-mono text-[10px] sm:text-xs tracking-widest text-white/70 uppercase">
          {EVIDENCE_CHAIN_CONTROL.id} · {EVIDENCE_CHAIN_CONTROL.title}
        </p>
        <p
          className="inline-flex items-center gap-1.5 font-mono text-[9px] sm:text-[10px] tracking-widest uppercase text-amber-300 border border-amber-300/30 bg-amber-300/10 rounded px-2 py-0.5"
          title={DEMO_EXPLAINER}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300" aria-hidden="true" />
          {DEMO_BADGE}
          <span className="sr-only"> — {DEMO_EXPLAINER}</span>
        </p>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-px bg-white/10">
        {EVIDENCE_CHAIN_STEPS.map(({ stage, value, mono }, i) => {
          const isFinal = i === EVIDENCE_CHAIN_STEPS.length - 1;
          return (
            <li key={stage} className="relative p-4 bg-[rgb(3,7,18)]">
              <p className="font-mono text-[9px] tracking-widest text-white/40 uppercase mb-1.5">
                {String(i + 1).padStart(2, '0')} · {stage}
              </p>
              <p
                className={`flex items-center gap-1.5 text-sm font-bold ${
                  isFinal || value === 'BESTANDEN' ? 'text-emerald-400' : 'text-white'
                } ${mono ? 'font-mono text-xs break-all' : ''}`}
              >
                {(isFinal || value === 'BESTANDEN') && (
                  <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />
                )}
                {value}
              </p>
              {/* Verbindungspfeil zwischen den Stufen — nur auf breiten Rastern,
                  rein dekorativ (die Nummerierung trägt die Reihenfolge). */}
              {!isFinal && (
                <span
                  className="hidden lg:block absolute top-1/2 -right-px translate-x-1/2 -translate-y-1/2 text-cyan-400/50 text-xs z-10 bg-[rgb(3,7,18)] px-0.5"
                  aria-hidden="true"
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="px-4 sm:px-5 py-3 border-t border-white/10 bg-white/[0.03] flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-white/50 leading-relaxed">
          Jede Kontrolle erzeugt einen verketteten, prüfbaren Nachweis — exportierbar als PDF oder JSON.
        </p>
        <Link
          to="/evidence"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          Evidence Vault ansehen<ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
