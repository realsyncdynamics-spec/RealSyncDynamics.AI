import { Activity, ArrowRight, CheckCircle2, CircleDot, FileCheck2, GitBranch, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const SIGNALS = [
  { label: 'DSGVO', icon: LockKeyhole, state: 'CONTROLLED', detail: 'Policies & processing' },
  { label: 'EU AI ACT', icon: ShieldCheck, state: 'READY', detail: 'Risk classification' },
  { label: 'POLICY', icon: GitBranch, state: 'ENFORCED', detail: 'Controls applied' },
  { label: 'EVIDENCE', icon: FileCheck2, state: 'TRACEABLE', detail: 'Audit trail' },
] as const;

const FLOW = ['DISCOVER', 'ASSESS', 'GOVERN', 'ENFORCE', 'EVIDENCE', 'AUDIT'] as const;

export function LandingGovernanceRuntimeSurface() {
  return (
    <section id="runtime-surface" aria-labelledby="runtime-surface-title" className="relative overflow-hidden border-y border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(232,201,138,.08),transparent_42%),rgb(3,7,18)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[.25em] text-[#e8c98a]">AI GOVERNANCE RUNTIME</p>
            <h2 id="runtime-surface-title" className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}>
              Governance wird zur <span className="text-[#e8c98a]">laufenden Runtime.</span>
            </h2>
            <p className="mt-5 leading-relaxed text-white/55">
              Eine operative Kontrollschicht verbindet Erkennung, Risikobewertung, Policies, Durchsetzung und Nachweise über den gesamten AI-Lifecycle.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-400/[.04] px-4 py-2.5 font-mono text-[9px] tracking-[.18em] text-emerald-300/80 lg:ml-auto" role="status" aria-label="Governance Runtime Beispielansicht">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>RUNTIME MODEL</span>
            <span className="h-1 w-1 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>BEISPIELANSICHT</span>
          </div>
        </div>

        <div className="mt-12 rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-2xl backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="grid gap-3 sm:grid-cols-2">
              {SIGNALS.slice(0, 2).map(({ label, icon: Icon, state, detail }) => (
                <SignalCard key={label} label={label} icon={Icon} state={state} detail={detail} />
              ))}
            </div>

            <div className="relative mx-auto grid h-40 w-40 place-items-center rounded-full border border-[#e8c98a]/30 bg-[radial-gradient(circle,rgba(232,201,138,.16),rgba(3,7,18,.92)_62%)] shadow-[0_0_70px_rgba(232,201,138,.10)] sm:h-48 sm:w-48" aria-label="Governance Runtime Core">
              <div className="absolute inset-3 rounded-full border border-white/10" aria-hidden="true" />
              <div className="absolute inset-7 rounded-full border border-[#e8c98a]/15 animate-[spin_18s_linear_infinite] motion-reduce:animate-none" aria-hidden="true" />
              <div className="relative text-center">
                <CircleDot className="mx-auto h-6 w-6 text-[#e8c98a]" aria-hidden="true" />
                <p className="mt-2 font-mono text-[9px] tracking-[.22em] text-white/45">CONTROL PLANE</p>
                <p className="mt-1 text-sm font-semibold text-white">GOVERNANCE OS</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SIGNALS.slice(2).map(({ label, icon: Icon, state, detail }) => (
                <SignalCard key={label} label={label} icon={Icon} state={state} detail={detail} />
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-0" aria-label="Governance Prozess">
              {FLOW.map((step, index) => (
                <div key={step} className="flex items-center">
                  <span className="rounded-full border border-white/10 bg-white/[.025] px-3 py-2 font-mono text-[9px] tracking-[.14em] text-white/55">{step}</span>
                  {index < FLOW.length - 1 && <span className="mx-1.5 hidden h-px w-5 bg-[#e8c98a]/25 sm:block" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <RuntimeStat label="POLICY" value="ACTIVE" detail="Kontrollen zentral definiert" />
          <RuntimeStat label="RISK" value="MONITORED" detail="Abweichungen bleiben sichtbar" />
          <RuntimeStat label="EVIDENCE" value="TRACEABLE" detail="Entscheidungen bleiben nachvollziehbar" />
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-[11px] leading-relaxed text-white/35">
            Beispielhafte Produktansicht. Echte Werte entstehen tenantbezogen nach Anmeldung und Scan — hier werden keine Live-Kundendaten behauptet.
          </p>
          <Link to="/runtime" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#e8c98a]/40 px-5 py-3 text-sm font-medium text-[#fff8ee] transition hover:bg-white/5">
            Governance Runtime ansehen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SignalCard({ label, icon: Icon, state, detail }: { label: string; icon: typeof LockKeyhole; state: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[.025] p-4 transition hover:border-[#e8c98a]/25 hover:bg-white/[.04]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#e8c98a]" aria-hidden="true" />
        <span className="font-mono text-[9px] tracking-[.16em] text-white/45">{label}</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
        <span className="text-sm font-semibold text-white/85">{state}</span>
      </div>
      <p className="mt-1 text-[11px] text-white/35">{detail}</p>
    </article>
  );
}

function RuntimeStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.02] px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[9px] tracking-[.18em] text-white/35">{label}</span>
        <span className="text-[10px] font-semibold tracking-wide text-emerald-300/80">{value}</span>
      </div>
      <p className="mt-2 text-xs text-white/40">{detail}</p>
    </div>
  );
}
