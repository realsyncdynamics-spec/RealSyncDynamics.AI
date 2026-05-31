// CompanyView — KMU-Sicht „Mein Unternehmen" (/app/company, Phase 0).
//
// Rendert INNERHALB der WorkspaceShell (via WorkspaceEmbed in App.tsx). Reine
// Präsentations-/Konfigurationsschicht: Branche + Größe + Tools wählen
// (Interim-localStorage, KEINE DB), dann branchenspezifische Risiken + nächste
// Schritte als Deep-Links in BESTEHENDE Engines. Keine neue Funktionalität.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { INDUSTRY_PROFILES, findIndustry } from '../../content/industryProfiles';
import {
  loadCompanyProfile, saveCompanyProfile, COMPANY_SIZES,
  type CompanyProfileDraft,
} from './companyProfileLocal';

export function CompanyView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [draft, setDraft] = useState<CompanyProfileDraft>(() => loadCompanyProfile(activeTenantId));

  const industry = useMemo(() => findIndustry(draft.industry), [draft.industry]);

  function update(next: Partial<CompanyProfileDraft>) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    saveCompanyProfile(activeTenantId, merged);
  }

  function toggleTool(tool: string) {
    const has = draft.usedTools.includes(tool);
    update({ usedTools: has ? draft.usedTools.filter((t) => t !== tool) : [...draft.usedTools, tool] });
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto space-y-8 text-titanium-100">
      <header className="flex items-start gap-3">
        <Building2 className="h-7 w-7 text-cyan-300 shrink-0" />
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-titanium-50">Mein Unternehmen</h1>
          <p className="text-sm text-titanium-400 mt-1">
            Branche und genutzte Tools wählen — wir zeigen die passenden Datenschutz-Themen
            und die nächsten Schritte. Selbst erledigen, ohne Anwalt.
          </p>
        </div>
      </header>

      {/* Branche */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-titanium-50 text-sm uppercase tracking-wider text-titanium-300">Branche</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INDUSTRY_PROFILES.map((p) => {
            const active = draft.industry === p.key;
            return (
              <button
                key={p.key}
                onClick={() => update({ industry: p.key })}
                className={`text-left p-3 border rounded-none transition-colors ${
                  active
                    ? 'border-cyan-400 bg-obsidian-800'
                    : 'border-titanium-800 bg-obsidian-900 hover:border-titanium-600'
                }`}
              >
                <div className="font-semibold text-sm text-titanium-50 flex items-center gap-1.5">
                  {active && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" />} {p.label}
                </div>
                <div className="text-[11px] text-titanium-500 mt-0.5 leading-snug">{p.blurb}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Unternehmensgröße */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-titanium-300">Mitarbeiterzahl</h2>
        <div className="flex flex-wrap gap-2">
          {COMPANY_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => update({ companySize: s })}
              className={`px-3 py-1.5 text-sm border rounded-none font-mono ${
                draft.companySize === s
                  ? 'border-cyan-400 bg-obsidian-800 text-titanium-50'
                  : 'border-titanium-800 bg-obsidian-900 text-titanium-400 hover:border-titanium-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Branchenspezifische Risiken + Tools + nächste Schritte */}
      {industry ? (
        <>
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-titanium-300">Genutzte Tools</h2>
            <div className="flex flex-wrap gap-2">
              {industry.suggestedTools.map((tool) => (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool)}
                  className={`px-3 py-1.5 text-sm border rounded-none ${
                    draft.usedTools.includes(tool)
                      ? 'border-cyan-400 bg-obsidian-800 text-titanium-50'
                      : 'border-titanium-800 bg-obsidian-900 text-titanium-400 hover:border-titanium-600'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-titanium-300">Typische Risiken in Ihrer Branche</h2>
            <ul className="space-y-2">
              {industry.risks.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-titanium-200 border border-titanium-900 bg-obsidian-900 p-3">
                  <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> {r}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-titanium-300">Nächste Schritte</h2>
            <div className="space-y-2">
              {industry.tasks.map((t) => (
                <Link
                  key={t.href + t.label}
                  to={t.href}
                  className="flex items-center justify-between gap-2 p-3 border border-titanium-800 bg-obsidian-900 hover:border-cyan-400 rounded-none group"
                >
                  <span className="text-sm text-titanium-100">{t.label}</span>
                  <ArrowRight className="h-4 w-4 text-titanium-500 group-hover:text-cyan-300" />
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-titanium-500 border border-titanium-900 bg-obsidian-900 p-4">
          Wählen Sie oben Ihre Branche, um passende Risiken und nächste Schritte zu sehen.
        </p>
      )}
    </div>
  );
}
