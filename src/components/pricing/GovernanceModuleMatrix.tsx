import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { GOVERNANCE_MODULES, canAccessModule } from '../governance-os/governanceModules';

type TierId = 'free' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';

const MATRIX_TIERS: { id: TierId; label: string }[] = [
  { id: 'free',       label: 'Free' },
  { id: 'starter',    label: 'Starter' },
  { id: 'growth',     label: 'Growth' },
  { id: 'agency',     label: 'Agency' },
  { id: 'scale',      label: 'Scale' },
  { id: 'enterprise', label: 'Enterprise' },
];

export function GovernanceModuleMatrix() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/20">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-2">
            Governance OS Browser
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
            Welche Module sind in welchem Plan?
          </h2>
          <p className="text-sm text-titanium-400 max-w-2xl">
            Alle Module im Überblick — von der kostenlosen Übersicht bis zur
            vollständigen Governance-Runtime.
          </p>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-titanium-700/50 hover:border-titanium-400 text-titanium-300 hover:text-titanium-50 transition-colors rounded-none"
        >
          <span>{isExpanded ? 'Module ausblenden' : 'Alle Module anzeigen'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Matrix-Tabelle */}
        {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-titanium-900">
                <th className="text-left py-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-600 w-40">
                  Modul
                </th>
                {MATRIX_TIERS.map((t) => (
                  <th key={t.id} className="text-center py-3 px-3 font-mono text-[10px] uppercase tracking-widest text-titanium-400 whitespace-nowrap">
                    {t.label}
                  </th>
                ))}
                <th className="text-left py-3 pl-4 font-mono text-[10px] uppercase tracking-widest text-titanium-600">
                  Beschreibung
                </th>
              </tr>
            </thead>
            <tbody>
              {GOVERNANCE_MODULES.map((mod, i) => (
                <tr
                  key={mod.id}
                  className={`border-b border-titanium-900 ${i % 2 === 0 ? 'bg-obsidian-950' : 'bg-obsidian-900'}`}
                >
                  <td className="py-2.5 pr-4 font-medium text-titanium-100 whitespace-nowrap">
                    {mod.label}
                  </td>
                  {MATRIX_TIERS.map((t) => {
                    const ok = canAccessModule(mod, t.id as string);
                    return (
                      <td key={t.id} className="text-center py-2.5 px-3">
                        {ok
                          ? <span className="text-emerald-400 text-base leading-none">✓</span>
                          : <span className="text-titanium-800 text-base leading-none">—</span>
                        }
                      </td>
                    );
                  })}
                  <td className="py-2.5 pl-4 text-xs text-titanium-500 leading-relaxed">
                    {mod.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <div className={`${isExpanded ? 'mt-6' : 'mt-0'} flex flex-wrap gap-3`}>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Governance OS öffnen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/audit?source=pricing-matrix"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-200 px-4 py-2 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            Kostenlosen Audit starten
          </Link>
        </div>
      </div>
    </section>
  );
}
