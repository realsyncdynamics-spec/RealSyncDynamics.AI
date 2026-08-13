import { Code2, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Shared bridge between the standalone Claude Code Optimizer and the
 * central Governance AI command experience.
 *
 * The optimizer remains a dedicated capability, while this bridge makes
 * the intended product architecture explicit: Governance AI is the single
 * entry point and Claude Code Optimizer is an execution capability.
 */
export function OptimizerGovernanceBridge() {
  return (
    <section className="border border-cyan-500/20 bg-cyan-500/[0.035] rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" /> Governance AI Capability
          </div>
          <h2 className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight">
            Claude Code Optimizer ist eine Fähigkeit von Governance AI.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Der zentrale KI-Assistent kann Code, Websites, SEO, DSGVO und EU AI Act
            gemeinsam bearbeiten. Der Optimizer übernimmt dabei die technische
            Code-Prüfung, Fix-Vorschläge und auditierbare Nachweise.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/55">
            {['Repository prüfen', 'Risiken klassifizieren', 'Fix-Code erzeugen', 'Evidence sichern'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5">
                <ShieldCheck className="h-3 w-3 text-cyan-400" /> {item}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-bold text-[rgb(3,7,18)] hover:bg-cyan-300"
          >
            <Sparkles className="h-4 w-4" /> Governance AI öffnen
          </Link>
          <Link
            to="/claude-code-optimizer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-cyan-400/40"
          >
            <Code2 className="h-4 w-4" /> Optimizer öffnen <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
