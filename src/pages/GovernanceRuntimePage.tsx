import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { GovernanceRuntimeDashboard } from "../features/governance/GovernanceRuntimeDashboard";
import { usePageMeta } from "../lib/usePageMeta";

/**
 * /governance-runtime — public preview of the Operational AI Governance
 * Infrastructure. Hero + dashboard + closing CTA, wrapped in the
 * mono-enterprise `bg-hero-only` surface.
 */
export function GovernanceRuntimePage() {
  usePageMeta({
    title: "Governance Runtime für AI, Web und Compliance",
    description:
      "Event-driven Compliance Runtime für AI-Systeme, Websites, Agents, Policies, Evidence Vault und Framework-Mapping.",
    url: "https://RealSyncDynamicsAI.de/governance-runtime",
  });

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      <header className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-silver-700/30">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-display font-bold tracking-tight text-titanium-50">
            RealSyncDynamics.AI
          </span>
        </Link>

        <Link
          to="/contact-sales?intent=governance-runtime"
          className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Founding Access starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="px-4 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 sm:pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-4">
            Operational Governance Infrastructure
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-6xl text-titanium-50 tracking-tight leading-[1.03] max-w-4xl">
            Jede AI-, Web- und Agent-Aktion wird zum Governance Event.
          </h1>

          <p className="mt-6 max-w-3xl text-base sm:text-xl text-silver-300 leading-relaxed">
            RealSyncDynamicsAI entwickelt sich von Website-Compliance zu einer
            event-driven Governance Runtime: Assets, Policies, Evidence,
            Framework Controls und spätere Auto-Remediation in einer Engine.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/contact-sales?intent=governance-runtime"
              className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Founding Access starten <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/audit?source=governance-runtime"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              Plattform ansehen
            </Link>
          </div>
        </div>
      </section>

      <GovernanceRuntimeDashboard />

      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-titanium-100 mb-5" />
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight">
            Compliance wird Runtime — nicht Dokument.
          </h2>
          <p className="mt-4 text-silver-300 leading-relaxed">
            Das Ziel ist eine Plattform, die reale Systeme überwacht, Policies
            anwendet, Evidence erzeugt und Remediation automatisiert.
          </p>
        </div>
      </section>
    </div>
  );
}
