import { useState, useMemo } from 'react';
import { Calculator, Info, ArrowRight, TrendingDown } from 'lucide-react';
import { PUBLIC_PRICING_TIERS, type TierId } from '../../config/pricing';

interface CalculatorParams {
  websites: number;
  reviewFrequency: 'monthly' | 'quarterly' | 'annual';
  hourlyRate: number;
}

export function CostCalculator() {
  const [params, setParams] = useState<CalculatorParams>({
    websites: 10,
    reviewFrequency: 'quarterly',
    hourlyRate: 85,
  });

  const handleWebsitesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParams({ ...params, websites: Math.max(1, parseInt(e.target.value, 10) || 1) });
  };

  const handleHourlyRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParams({ ...params, hourlyRate: Math.max(40, parseInt(e.target.value, 10) || 40) });
  };

  const calculations = useMemo(() => {
    const reviewsPerYear = {
      monthly: 12,
      quarterly: 4,
      annual: 1,
    };

    const hoursPerWebsitePerReview = 3;
    const totalManualHoursPerYear =
      params.websites * hoursPerWebsitePerReview * reviewsPerYear[params.reviewFrequency];
    const totalManualCostPerYear = totalManualHoursPerYear * params.hourlyRate;
    const totalManualCostPerMonth = totalManualCostPerYear / 12;

    return { totalManualHoursPerYear, totalManualCostPerYear, totalManualCostPerMonth };
  }, [params.websites, params.reviewFrequency, params.hourlyRate]);

  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Kostenkalkulator
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-3">
            Welchen Plan brauche ich?
          </h2>
          <p className="text-sm sm:text-base text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Schätzen Sie Ihren aktuellen manuellen Governance-Aufwand — dann zeigen wir,
            wie unsere Automatisierung ihn reduziert.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-obsidian-900/60 border border-silver-700/30 rounded-none p-6 sm:p-7 space-y-6">
            <h3 className="font-display font-bold text-titanium-50 text-lg mb-5">
              Ihr aktueller Setup
            </h3>

            {/* Websites Slider */}
            <div>
              <label htmlFor="websites" className="block text-sm font-semibold text-titanium-50 mb-2">
                Anzahl Websites/Domains
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="websites"
                  type="range"
                  min="1"
                  max="100"
                  value={params.websites}
                  onChange={(e) => setParams({ ...params, websites: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="flex-1 h-2 bg-obsidian-800 rounded-none appearance-none cursor-pointer accent-cyan-400"
                />
                <input
                  type="number"
                  min="1"
                  value={params.websites}
                  onChange={handleWebsitesChange}
                  className="w-16 px-3 py-1.5 bg-obsidian-800 border border-titanium-700 rounded-none text-titanium-50 text-sm font-mono text-center"
                />
              </div>
              <p className="text-xs text-silver-400 mt-1">typisch: 5–50</p>
            </div>

            {/* Review Frequency */}
            <div>
              <label className="block text-sm font-semibold text-titanium-50 mb-2">
                Prüfhäufigkeit
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'annual' as const, label: 'Jährlich' },
                    { value: 'quarterly' as const, label: 'Quartalsweise' },
                    { value: 'monthly' as const, label: 'Monatlich' },
                  ] as const
                ).map((freq) => (
                  <button
                    key={freq.value}
                    onClick={() => setParams({ ...params, reviewFrequency: freq.value })}
                    className={`px-3 py-2 text-xs font-semibold rounded-none border transition-colors ${
                      params.reviewFrequency === freq.value
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                        : 'border-titanium-700 text-titanium-300 hover:border-titanium-600'
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hourly Rate */}
            <div>
              <label htmlFor="hourly-rate" className="block text-sm font-semibold text-titanium-50 mb-2">
                Stundensatz (intern/Kanzlei)
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="hourly-rate"
                  type="range"
                  min="40"
                  max="300"
                  step="5"
                  value={params.hourlyRate}
                  onChange={(e) => setParams({ ...params, hourlyRate: parseInt(e.target.value, 10) })}
                  className="flex-1 h-2 bg-obsidian-800 rounded-none appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="w-20 flex items-center gap-1">
                  <input
                    type="number"
                    min="40"
                    step="5"
                    value={params.hourlyRate}
                    onChange={handleHourlyRateChange}
                    className="flex-1 px-2 py-1.5 bg-obsidian-800 border border-titanium-700 rounded-none text-titanium-50 text-sm font-mono text-right"
                  />
                  <span className="text-xs text-silver-400">€/h</span>
                </div>
              </div>
              <p className="text-xs text-silver-400 mt-1">40–300 €/h</p>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-obsidian-950 border border-silver-700/30 border-l-2 border-l-titanium-200 rounded-none">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-titanium-100 mt-0.5 shrink-0" />
                <p className="text-xs text-silver-400 leading-relaxed">
                  Annahme: je Website ~3 Stunden Prüfaufwand pro Review. RealSync kann diesen Aufwand
                  durch Automatisierung und Continuous Monitoring deutlich reduzieren.
                </p>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {/* Current Cost */}
            <div className="bg-obsidian-900/60 border border-silver-700/30 rounded-none p-6 sm:p-7">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-4 w-4 text-titanium-100" />
                <h3 className="font-display font-bold text-titanium-50">Ihr aktueller Aufwand</h3>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-silver-400 mb-1">Stunden pro Jahr</p>
                    <p className="font-display font-bold text-2xl text-titanium-100 tabular-nums">
                      {calculations.totalManualHoursPerYear.toLocaleString()}
                      <span className="text-sm text-silver-400"> h</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">Kosten pro Jahr</p>
                    <p className="font-display font-bold text-2xl text-titanium-100 tabular-nums">
                      {calculations.totalManualCostPerYear.toLocaleString()}
                      <span className="text-sm text-silver-400"> €</span>
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-silver-700/30">
                  <p className="text-xs text-silver-400 mb-1">Monatlich (ohne RealSync)</p>
                  <p className="font-display font-bold text-xl text-titanium-100 tabular-nums">
                    {Math.round(calculations.totalManualCostPerMonth).toLocaleString()}
                    <span className="text-sm text-silver-400"> €/Mo</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Plan Comparison */}
            <div className="bg-obsidian-900/60 border border-silver-700/30 rounded-none p-6 sm:p-7">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display font-bold text-titanium-50">Mit RealSync</h3>
              </div>
              <div className="space-y-2">
                {PUBLIC_PRICING_TIERS.filter(
                  (tier) => tier.id !== 'free' && !tier.id.includes('yearly'),
                ).map((tier) => {
                  const yearlyCost = (tier.priceEur || 0) * 12;
                  const savings = calculations.totalManualCostPerYear - yearlyCost;
                  const savingsPercent = calculations.totalManualCostPerYear > 0
                    ? Math.round((savings / calculations.totalManualCostPerYear) * 100)
                    : 0;
                  const isSavings = savings > 0;

                  return (
                    <div
                      key={tier.id}
                      className={`p-3 rounded-none border transition-colors ${
                        isSavings
                          ? 'bg-emerald-950/30 border-emerald-800'
                          : 'bg-obsidian-800 border-titanium-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-display font-semibold text-titanium-50">{tier.name}</div>
                        <div className="text-sm font-mono font-bold text-titanium-100">
                          {tier.priceEur}
                          <span className="text-xs text-silver-400"> €/Mo</span>
                        </div>
                      </div>
                      {isSavings && (
                        <div className="text-xs text-emerald-300">
                          💰 Einsparungen: {savings.toLocaleString()} €/Jahr ({savingsPercent}%)
                        </div>
                      )}
                      {!isSavings && (
                        <div className="text-xs text-silver-400">
                          Zusätzliche Kosten: {Math.abs(savings).toLocaleString()} €/Jahr
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-cyan-400/10 to-cyan-400/5 border border-cyan-400/30 rounded-none p-5">
              <p className="text-xs text-silver-300 mb-3 leading-relaxed">
                Diese Rechnung ist illustrativ. Konkrete Einsparungen hängen von Audit-Tiefe,
                Automatisierungspotenzial und vorhandenen Prozessen ab.
              </p>
              <a
                href="#pricing-tiers"
                className="inline-flex items-center gap-2 surface-mono px-4 py-2 text-sm font-bold hover:opacity-90"
              >
                Zum Plan wechseln <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
