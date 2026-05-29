import { Calculator, Info } from 'lucide-react';

// PricingRoiExampleSection — vorsichtige Beispiel-Kostenrechnung als
// Conversion-Anker für Procurement-Gespräche. Bewusst KEINE Garantien,
// KEINE Einsparversprechen, KEINE Payback-Zusagen.
//
// Tonalität (Enterprise / DSB-tauglich):
//   - „Beispielhafte operative Kostenrechnung"
//   - „kann repetitive Governance- und Audit-Prozesse reduzieren"
//   - „Payback abhängig von Website-Anzahl, Review-Frequenz, Stundensätzen"
//
// Die konkreten Zahlen (50 Websites · 1.800 h · 80 €/h · 144.000 €) sind
// als Beispielbasis dargestellt, nicht als Versprechen. Disclaimer steht
// VOR den Zahlen, nicht im Kleingedruckten danach.

interface Row {
  label: string;
  value: string;
  note:  string;
}

const ROWS: readonly Row[] = [
  {
    label: 'Websites im Portfolio',
    value: '50',
    note:  'Beispielannahme — Multi-Domain-Setup typischer Mittelstand / Agentur',
  },
  {
    label: 'Manuelle Prüfungsstunden pro Jahr',
    value: '1.800 h',
    note:  '~36 h je Domain bei vierteljährlichem Review — variiert je nach Tiefe',
  },
  {
    label: 'Interner Stundensatz (Beispiel)',
    value: '80 €/h',
    note:  'Mischsatz Compliance/IT — bei DSB-Kanzleien typischerweise höher',
  },
  {
    label: 'Interne Aufwandsbasis',
    value: '144.000 €',
    note:  'Rechenwert, keine Einsparzusage — Vergleichsgröße für Investitionsentscheidung',
  },
];

export function PricingRoiExampleSection() {
  return (
    <section
      id="kostenbeispiel"
      aria-label="Beispielhafte operative Kostenrechnung"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Kostenbeispiel · keine Einsparzusage
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-3">
            Beispielhafte operative Kostenrechnung
          </h2>
          <p className="text-sm sm:text-base text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Für Procurement und CFO-Gespräche — eine transparent gerechnete Vergleichsgröße,
            keine Garantie und keine Payback-Zusage.
          </p>
        </div>

        {/* Disclaimer ZUERST — damit niemand die Zahl ohne Kontext sieht. */}
        <div className="mb-6 p-5 bg-obsidian-900/60 border border-silver-700/30 border-l-2 border-l-titanium-200 rounded-none">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-titanium-100 mt-0.5 shrink-0" />
            <p className="text-sm text-silver-300 leading-relaxed">
              Diese Rechnung ist <strong className="text-titanium-200">ausschließlich illustrativ</strong>.
              RealSync ersetzt nicht jede manuelle Tätigkeit, kann aber repetitive Prüf-, Monitoring-
              und Evidence-Prozesse deutlich reduzieren. Konkrete Payback-Zeiträume hängen von
              Website-Anzahl, Review-Frequenz, internen Stundensätzen und Audit-Tiefe ab.
            </p>
          </div>
        </div>

        <div className="bg-obsidian-900/60 border border-silver-700/30 rounded-none">
          <header className="flex items-center gap-2.5 px-5 py-3 border-b border-silver-700/30">
            <Calculator className="h-4 w-4 text-titanium-100" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-silver-300">
              Beispielrechnung · 50 Websites
            </span>
          </header>
          <ul className="divide-y divide-silver-700/30">
            {ROWS.map((r) => (
              <li key={r.label} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1 sm:gap-6 items-baseline">
                <div>
                  <div className="text-sm font-display font-semibold text-titanium-50">
                    {r.label}
                  </div>
                  <div className="text-[12px] text-silver-400 leading-relaxed mt-0.5">
                    {r.note}
                  </div>
                </div>
                <div className="font-display font-bold text-xl sm:text-2xl text-titanium-100 tabular-nums sm:text-right">
                  {r.value}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-[12px] text-silver-400 leading-relaxed max-w-3xl">
          Was RealSync leisten kann: kontinuierliche Runtime-Beobachtung, kryptographisch
          überprüfbare Evidence und priorisierte Befunde — was den manuellen Prüfaufwand
          deutlich senken kann, ohne Rechtsbewertung oder DSB-Verantwortung zu ersetzen.
        </p>

        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-silver-500">
          Keine Garantie · keine Rechtsberatung · keine Payback-Zusage
        </p>
      </div>
    </section>
  );
}
