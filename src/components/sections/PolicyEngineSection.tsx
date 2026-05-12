import {
  ShieldOff,
  ShieldCheck,
  ShieldAlert,
  FileSearch,
  ArrowRight,
} from 'lucide-react';

/**
 * PolicyEngineSection — zeigt die 4 moeglichen Policy-Actions und 3
 * konkrete Beispiel-Policies, die seit dieser PR Out-of-the-Box laufen.
 *
 * Eingebettet auf /ai-governance unter der BrowserExtensionSection.
 */

const ACTIONS = [
  {
    icon: FileSearch,
    label: 'log',
    title: 'Log',
    detail:
      'Default. Event wird in ai_runtime_events festgehalten — kein Eingriff, voller Audit-Trail.',
    tone: 'border-silver-700/40 text-silver-300',
  },
  {
    icon: ShieldAlert,
    label: 'warn',
    title: 'Warn',
    detail:
      'Event durchgelassen, aber im Evidence-Vault als "warned" markiert. Dashboard zeigt Counter, DSB sieht es im Audit.',
    tone: 'border-amber-900/50 text-amber-300',
  },
  {
    icon: ShieldCheck,
    label: 'require_approval',
    title: 'Require Approval',
    detail:
      'Event wartet auf dokumentierte menschliche Pruefung — Human-Override-Workflow startet, bis dahin "requires_approval".',
    tone: 'border-orange-900/50 text-orange-300',
  },
  {
    icon: ShieldOff,
    label: 'block',
    title: 'Block',
    detail:
      'Event wird im Vault als "blocked" markiert. Browser-Extension reagiert per Toast/UI-Stopp (kommt in Folge-PR).',
    tone: 'border-red-900/50 text-red-300',
  },
];

const EXAMPLE_POLICIES = [
  {
    name: 'Keine personenbezogenen Daten an externe LLMs',
    severity: 'critical',
    action: 'block',
    actionTone: 'bg-red-900/40 text-red-200',
    rule_type: 'data_transfer',
    body: 'Wenn data_class ∈ { personal_data, special_category } UND Vendor extern (OpenAI / Anthropic / Google / Perplexity) → blocked.',
  },
  {
    name: 'Human Review für High-Risk-AI-Output',
    severity: 'high',
    action: 'require_approval',
    actionTone: 'bg-orange-900/40 text-orange-200',
    rule_type: 'human_review',
    body: 'Wenn risk_level ∈ { high, critical } → Workflow wartet auf dokumentierte menschliche Pruefung.',
  },
  {
    name: 'Audit-Log für Agent-Actions',
    severity: 'medium',
    action: 'warn',
    actionTone: 'bg-amber-900/40 text-amber-200',
    rule_type: 'logging_required',
    body: 'Wenn event_type ∈ { agent_action, tool_call } → Markierung im Audit-Trail (warn, kein Block).',
  },
];

export interface PolicyEngineSectionProps {
  eyebrow?: string;
  headline?: string;
  subline?: string;
}

export function PolicyEngineSection({
  eyebrow = 'Policy Engine · Verdicts',
  headline = 'Vier Aktionen pro Policy. Schärfste gewinnt.',
  subline = 'Jedes Runtime-Event durchläuft die Policy-Engine vor Insert. Bei mehreren Treffern setzt sich die schärfste Action durch (Block > Approval > Warn > Log). Drei Policies sind Out-of-the-Box aktiv — abschaltbar oder ersetzbar.',
}: PolicyEngineSectionProps = {}) {
  return (
    <section
      id="policy-engine"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-950/50"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl">
            {headline}
          </h2>
          <p className="mt-4 max-w-3xl text-silver-300 text-sm sm:text-base leading-relaxed">
            {subline}
          </p>
        </div>

        {/* 4 Action-Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-silver-700/30 mb-10">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.label}
                className={`bg-obsidian-900 p-5 sm:p-6 border-l-2 ${a.tone}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-5 w-5" />
                  <div className="font-mono text-[10px] uppercase tracking-wider">
                    action: {a.label}
                  </div>
                </div>
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2">
                  {a.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed">{a.detail}</p>
              </div>
            );
          })}
        </div>

        {/* 3 Example-Policies */}
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-wider text-silver-300 mb-4">
            Drei Policies seit dieser Iteration aktiv (global)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {EXAMPLE_POLICIES.map((p) => (
              <article
                key={p.name}
                className="bg-obsidian-900/60 border border-silver-700/30 p-5"
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span
                    className={`inline-block font-mono uppercase tracking-wider text-[10px] px-2 py-0.5 ${p.actionTone}`}
                  >
                    {p.action}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-silver-500">
                    {p.rule_type} · {p.severity}
                  </span>
                </div>
                <h3 className="font-display font-bold text-titanium-50 text-sm sm:text-base mb-2 leading-snug">
                  {p.name}
                </h3>
                <p className="text-xs sm:text-sm text-silver-300 leading-relaxed">{p.body}</p>
              </article>
            ))}
          </div>
        </div>

        {/* Tech-Trust */}
        <div className="bg-obsidian-900/60 border-l-2 border-l-gold-400 border border-silver-700/30 p-5 sm:p-6 mb-8">
          <p className="text-sm text-silver-200 leading-relaxed">
            <strong className="text-titanium-50">Engine-Architektur:</strong> Pure-ESM-TypeScript
            ohne externe Imports unter <code className="font-mono text-xs text-titanium-100">supabase/functions/_shared/policy-engine.ts</code>.
            Laeuft sowohl in der Telemetry-Edge-Function als auch in 15 Vitest-Unit-Tests gegen
            denselben Code. 5 Rule-Types: <span className="font-mono text-xs">data_transfer</span>,{' '}
            <span className="font-mono text-xs">model_usage</span>,{' '}
            <span className="font-mono text-xs">human_review</span>,{' '}
            <span className="font-mono text-xs">logging_required</span>,{' '}
            <span className="font-mono text-xs">vendor_restriction</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/contact-sales?intent=policy-customization"
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            Custom Policies definieren <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/ai-act-faq"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
          >
            EU AI Act FAQ
          </a>
        </div>
      </div>
    </section>
  );
}
