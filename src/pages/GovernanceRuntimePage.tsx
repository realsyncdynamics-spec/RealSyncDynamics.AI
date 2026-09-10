import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, FlaskConical, ShieldCheck } from "lucide-react";
import { GovernanceRuntimeDashboard } from "../features/governance/GovernanceRuntimeDashboard";
import { usePageMeta } from "../lib/usePageMeta";
import { CTA } from "../content/runtimeVocab";
import { RUNTIME_PRODUCT } from "../content/runtimeProduct";

/**
 * `/governance-runtime` — operational demo of the live Governance OS.
 * Product marketing lives on `/runtime`. Scan lives on `/audit`.
 */
export function GovernanceRuntimePage() {
  usePageMeta({
    title: "Governance Runtime — operative Vorschau | RealSync Dynamics AI",
    description:
      "Operative Vorschau der Governance-OS-Runtime: Events, Policies, Assets, Evidence. Demo-Daten, keine Kundentelemetrie. Das Produkt ist RealSync Runtime.",
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

        <div className="flex items-center gap-3">
          <Link
            to="/runtime"
            className="hidden text-xs sm:text-sm text-silver-300 hover:text-titanium-50 sm:inline-flex"
          >
            {CTA.exploreRuntime}
          </Link>
          <Link
            to="/contact-sales?intent=governance-runtime"
            className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
          >
            {CTA.enterprise} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <div className="border-b border-silver-700/30 bg-obsidian-900/60">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 sm:px-6 lg:px-8">
          <FlaskConical className="h-3 w-3 shrink-0 text-titanium-500" aria-hidden="true" />
          <span className="select-none font-mono text-[9px] uppercase tracking-[0.2em] text-titanium-500">
            {RUNTIME_PRODUCT.demoLabel}
          </span>
        </div>
      </div>

      <section className="px-4 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 sm:pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-4">
            Operative Vorschau · Governance OS
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-6xl text-titanium-50 tracking-tight leading-[1.03] max-w-4xl">
            So sieht die laufende Governance-Schicht aus.
          </h1>

          <p className="mt-6 max-w-3xl text-base sm:text-xl text-silver-300 leading-relaxed">
            Events, Policies, Assets und Evidence des Governance OS — mit Demo-Daten.
            Das verkaufbare Produkt mit Control Loop und Richtpreisen ist RealSync Runtime.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/runtime"
              className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              {CTA.exploreRuntime} <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/contact-sales?intent=governance-runtime"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              {CTA.enterprise}
            </Link>
          </div>
        </div>
      </section>

      <GovernanceRuntimeDashboard />

      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-titanium-100 mb-5" />
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight">
            Vorschau des OS. Produkt ist die Runtime.
          </h2>
          <p className="mt-4 text-silver-300 leading-relaxed">
            Diese Seite zeigt die operative Oberfläche. Architektur, Domänen und
            Richtpreise stehen auf der Product Surface.
          </p>
          <Link
            to="/runtime"
            className="mt-8 inline-flex items-center justify-center gap-2 text-sm font-semibold text-titanium-50 hover:text-cyan-300"
          >
            {CTA.exploreRuntime} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
