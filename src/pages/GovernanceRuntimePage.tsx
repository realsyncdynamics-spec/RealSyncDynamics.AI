import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { GovernanceRuntimeDashboard } from "../features/governance/GovernanceRuntimeDashboard";
import { LandingHeader, SCAN_CTA } from "../components/landing/LandingShell";
import { usePageMeta } from "../lib/usePageMeta";
import { CTA } from '../content/runtimeVocab';

/**
 * /governance-runtime — öffentliche Produktseite der Governance Runtime.
 *
 * Status laut `src/product/implementation-status.ts`: `governance-runtime-core`,
 * `policy-engine`, `ai-gateway`, `evidence-surfaces` = live; laufendes
 * Domain-Monitoring = Beta. Der eingebettete Dashboard-Ausschnitt nutzt
 * ausschließlich Beispieldaten und ist deshalb sichtbar als Demo gekennzeichnet.
 */
const STEPS: Array<{ k: string; t: string; d: string; beta?: boolean }> = [
  { k: "DISCOVER", t: "Erfassen", d: "Websites, KI-Systeme und Agents als Assets im Inventar." },
  { k: "ASSESS", t: "Bewerten", d: "Risikoklasse nach EU AI Act, Befunde mit DSGVO-Paragraphenbezug." },
  { k: "GOVERN", t: "Richtlinien", d: "Policy Packs und eigene Policies (allow · log · warn · block · require_approval)." },
  { k: "ENFORCE", t: "Durchsetzen", d: "Policy-Entscheidung je Runtime-Event, Beobachtungsmodus als Standard. Laufendes Monitoring: Beta.", beta: true },
  { k: "EVIDENCE", t: "Nachweisen", d: "Automatische Evidence-Einträge, SHA-256-verkettet, EU-Datenhaltung." },
  { k: "AUDIT", t: "Berichten", d: "Prüffähige Berichte und nachvollziehbarer Prüfpfad." },
];

export function GovernanceRuntimePage() {
  usePageMeta({
    title: "Governance Runtime — Risiken, Policies und Nachweise in einer Ebene",
    description:
      "Die Governance Runtime von RealSyncDynamics.AI: Runtime-Events aus KI-Systemen, Websites und Agents gegen Policies prüfen und als verkettete Nachweise ablegen. DSGVO & EU AI Act, Datenhaltung in Frankfurt.",
    url: "https://realsyncdynamicsai.de/governance-runtime",
  });

  return (
    <div className="rs-paper bg-hero-only min-h-screen flex flex-col text-titanium-50">
      <LandingHeader />

      <section className="px-4 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 sm:pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-4">
            AI Governance Runtime · Teil des Governance OS
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-6xl text-titanium-50 tracking-tight leading-[1.03] max-w-4xl">
            Jede AI-, Web- und Agent-Aktion wird zum Governance Event.
          </h1>

          <p className="mt-6 max-w-3xl text-base sm:text-xl text-silver-300 leading-relaxed">
            Die Runtime nimmt Ereignisse aus Website-Scans, KI-Systemen, Agents und
            SDK entgegen, prüft sie gegen Ihre Policies und legt jede Entscheidung als
            verketteten Nachweis im Evidence Vault ab — eine Governance-Ebene für
            DSGVO und EU AI Act.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to={SCAN_CTA.replace("landing-scan", "governance-runtime")}
              className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Kostenlosen Governance Scan starten <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/docs/governance"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              API-Referenz ansehen
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Ablauf der Governance Runtime" className="px-4 sm:px-6 lg:px-8 pb-12">
        <ol className="max-w-5xl mx-auto grid gap-px bg-silver-700/30 border border-silver-700/30 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.k} className="bg-[var(--brand-bg-0,#0b0d10)] p-5 flex flex-col gap-2">
              <span className="font-mono text-[11px] tracking-[0.2em] text-titanium-100">
                {String(i + 1).padStart(2, "0")} — {s.k}
                {s.beta ? <span className="ml-2 border border-silver-500 px-1.5 py-0.5 text-[10px] text-silver-300">BETA</span> : null}
              </span>
              <span className="font-display text-lg text-titanium-50">{s.t}</span>
              <span className="text-sm text-silver-300 leading-relaxed">{s.d}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="px-4 sm:px-6 lg:px-8">
        <p
          role="note"
          data-testid="runtime-demo-label"
          className="max-w-5xl mx-auto border border-silver-500/60 px-4 py-3 text-sm text-silver-200"
        >
          <strong className="text-titanium-50">Demo · Beispieldaten.</strong>{" "}
          Der folgende Ausschnitt zeigt erfundene Assets, Events und Policies zur
          Veranschaulichung — keine Kundendaten, kein Live-Stream. Ihre eigene Runtime
          entsteht nach dem Login aus Ihren Systemen.
        </p>
      </div>

      <GovernanceRuntimeDashboard />

      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-titanium-100 mb-5" />
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight">
            Compliance wird Runtime — nicht Dokument.
          </h2>
          <p className="mt-4 text-silver-300 leading-relaxed">
            Starten Sie mit dem kostenlosen Governance Scan Ihrer Domain. Pläne ab
            Starter schalten Evidence Vault, Policy Packs und Prüfpfad frei; für
            Konzern-Setups gibt es Enterprise auf Anfrage.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={SCAN_CTA.replace("landing-scan", "governance-runtime-footer")}
              className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Kostenlosen Governance Scan starten <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 text-silver-100 text-base font-semibold rounded-none"
            >
              Pläne vergleichen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
