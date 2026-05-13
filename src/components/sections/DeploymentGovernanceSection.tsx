import { Link } from 'react-router-dom';
import { GitMerge, ShieldCheck, AlertTriangle, FileCheck2, ArrowRight, GitPullRequest } from 'lucide-react';

const FLOW = [
  { label: 'GitHub PR', icon: GitPullRequest, body: 'Push, PR oder Release löst den Hook' },
  { label: 'Governance Check', icon: ShieldCheck, body: 'Static analysis: neue Vendors, neue AI-Modelle, Tracker-Diff' },
  { label: 'Policy Evaluation', icon: FileCheck2, body: 'Tenant-Policies + Industry-Pack-Policies werden evaluiert' },
  { label: 'Risk Delta', icon: AlertTriangle, body: 'Pre/Post-Deploy Risk-Score Differenz wird berechnet' },
  { label: 'Approval / Block / Evidence', icon: GitMerge, body: 'Gate-Outcome wird zurück in den Check geschrieben + Evidence sealed' },
];

const EXAMPLE = {
  title: 'PR #482 introduces new analytics vendor',
  rows: [
    { key: 'new_vendor',         value: 'analytics-vendor.com', tone: 'amber' as const },
    { key: 'eu_transfer_risk',   value: 'medium',                tone: 'amber' as const },
    { key: 'consent_impact',     value: 'high',                  tone: 'rose'  as const },
    { key: 'ai_act_relevance',   value: 'not classified yet',    tone: 'silver' as const },
    { key: 'required_action',    value: 'DPO approval before merge', tone: 'amber' as const },
  ],
};

export function DeploymentGovernanceSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Deployment Governance
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Governance vor und nach jedem Deploy.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            Tracker, AI-APIs und Vendors landen nicht durch Zufall im Produktivsystem.
            RealSyncDynamics.AI erkennt sie an der CI/CD-Grenze und macht den Risiko-Delta
            sichtbar — bevor der Merge-Button gedrückt wird.
          </p>
        </div>

        {/* Flow */}
        <div className="bg-obsidian-900/60 border border-silver-700/30 p-6 sm:p-8 mb-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-100 mb-5">
            Pipeline Flow
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {FLOW.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="relative border border-silver-700/30 bg-obsidian-950/60 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-titanium-100" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-silver-400">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="font-display font-semibold text-sm text-titanium-50">{f.label}</div>
                  <p className="mt-1 text-[11px] text-silver-300 leading-relaxed">{f.body}</p>
                  {i < FLOW.length - 1 && (
                    <ArrowRight className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-silver-500 bg-obsidian-950 z-10" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Concrete example */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 mb-10">
          <div className="bg-obsidian-900/60 border border-silver-700/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <GitPullRequest className="h-4 w-4 text-amber-300" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300">
                example check result
              </span>
            </div>
            <h3 className="font-display font-bold text-lg text-titanium-50 mb-4">{EXAMPLE.title}</h3>
            <div className="space-y-2">
              {EXAMPLE.rows.map((r) => (
                <div
                  key={r.key}
                  className="grid grid-cols-2 gap-3 border-t border-silver-700/30 pt-2 font-mono text-xs"
                >
                  <span className="text-silver-500">{r.key}</span>
                  <span
                    className={
                      r.tone === 'rose'
                        ? 'text-rose-300'
                        : r.tone === 'amber'
                          ? 'text-amber-300'
                          : 'text-silver-200'
                    }
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-3 border-t border-silver-700/30 font-mono text-[10px] uppercase tracking-[0.18em] text-silver-500">
              gate result: <span className="text-amber-300">require_approval</span> · evidence sealed
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-obsidian-900/60 border border-silver-700/30 p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-100 mb-2">
                What gets caught
              </div>
              <ul className="space-y-2 text-sm text-silver-300 leading-relaxed">
                <li>· Neue Third-Party-Vendors (Tracker, AI-APIs, Mail-Provider)</li>
                <li>· Consent-Drift (neue Scripts vor consent.granted)</li>
                <li>· AI-Modell-Wechsel (Provider, Version, Region)</li>
                <li>· Dataset-Erweiterungen mit höherer PII-Klasse</li>
                <li>· Policy-Drift (Bypass von approve/block-Reglen)</li>
              </ul>
            </div>
            <div className="bg-obsidian-900/60 border border-silver-700/30 p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-100 mb-2">
                Outputs
              </div>
              <ul className="space-y-2 text-sm text-silver-300 leading-relaxed">
                <li>· Risk-Delta in der PR-Check-Box</li>
                <li>· Comment auf der PR mit Begründung</li>
                <li>· Optional Block bei `severity ≥ high`</li>
                <li>· Evidence-Record für jede Entscheidung</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border border-titanium-100/20 bg-titanium-100/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-silver-300">
            <span className="font-display font-semibold text-titanium-50">GitHub Actions Integration</span>{' '}
            — derzeit in Vorbereitung (Roadmap "CI/CD-Integrationen", In Entwicklung).
          </p>
          <Link
            to="/deployment-governance"
            className="inline-flex items-center gap-2 px-4 py-2 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors"
          >
            Deployment Governance Details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
