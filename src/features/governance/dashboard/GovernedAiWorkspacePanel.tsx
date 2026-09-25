import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Cloud,
  Code2,
  Cpu,
  Globe2,
  HardDrive,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

type LaneState = 'existing' | 'mixed' | 'target';

const WORK_MODES = [
  {
    id: 'research',
    title: 'Browse & Research',
    detail: 'Comet-/Perplexity-Prinzip: Web-Kontext, Recherche und Browser-Arbeit als kontrollierte Capability.',
    href: '/app/websites',
    Icon: Search,
  },
  {
    id: 'code',
    title: 'Code & Build',
    detail: 'Claude-Code-/Codex-Prinzip: Repo, Dateien, Builder und Tool-Aufrufe — Writes bleiben governance-gated.',
    href: '/build',
    Icon: Code2,
  },
  {
    id: 'agents',
    title: 'Agent Mesh',
    detail: 'Planner, spezialisierte Agents und Subtasks. Kein Agent erteilt sich selbst Berechtigungen.',
    href: '/app/agents',
    Icon: Bot,
  },
  {
    id: 'governance',
    title: 'Govern & Prove',
    detail: 'EU-AI-Act-/DSGVO-Kontext, Risiko, Freigaben, Verification und Evidence im selben Arbeitsfluss.',
    href: '/app/evidence',
    Icon: ShieldCheck,
  },
] as const;

const LANES: ReadonlyArray<{
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  providers: readonly string[];
  state: LaneState;
  Icon: typeof Cpu;
}> = [
  {
    id: 'local',
    title: 'Device / Local',
    subtitle: 'sensitiv · offline-fähig',
    detail: 'Lokale Inferenz ist die bevorzugte Zone für vertrauliche Inhalte, wenn die benötigte Capability lokal verfügbar ist.',
    providers: ['Ollama', 'LM Studio', 'Mistral / Open Models'],
    state: 'existing',
    Icon: HardDrive,
  },
  {
    id: 'eu-private',
    title: 'EU Private',
    subtitle: 'dediziert · kontrolliertes Netz',
    detail: 'Private EU-Runtime für stärkere Modelle oder größere Workloads, ohne einen pauschalen Cloud-Zwang einzuführen.',
    providers: ['Mistral Private', 'eigene GPU/VPS', 'OpenAI-kompatible Runtime'],
    state: 'target',
    Icon: Cpu,
  },
  {
    id: 'cloud',
    title: 'Governed Cloud',
    subtitle: 'nur nach Policy',
    detail: 'Frontier-Fähigkeiten bleiben nutzbar, aber Providerwahl folgt Datenklasse, Tenant-Policy, Risiko und Freigabe.',
    providers: ['Claude', 'GPT', 'Gemini', 'xAI / Grok', 'Perplexity'],
    state: 'mixed',
    Icon: Cloud,
  },
];

const STATE_LABEL: Record<LaneState, string> = {
  existing: 'Pfad vorhanden',
  mixed: 'bestehend + Zieladapter',
  target: 'Ausbauziel',
};

const STATE_CLASS: Record<LaneState, string> = {
  existing: 'border-cyan-700/40 bg-cyan-950/20 text-cyan-300',
  mixed: 'border-amber-700/40 bg-amber-950/20 text-amber-300',
  target: 'border-titanium-700 bg-obsidian-800 text-titanium-400',
};

/**
 * Governed AI Workspace — capability-first shell for the canonical /app dashboard.
 *
 * This surface is intentionally NOT a provider switcher. It documents and links the
 * work modes while preserving the authority boundary:
 * provider/model choice is subordinate to tenant, residency, policy and approval.
 *
 * No provider card claims live availability. Runtime truth stays in the gateway,
 * residency policy, provider health and evidence paths.
 */
export function GovernedAiWorkspacePanel() {
  return (
    <section
      aria-label="Governed AI Workspace"
      data-testid="governed-ai-workspace-panel"
      className="mt-4 overflow-hidden border border-titanium-800 bg-obsidian-900"
    >
      <div className="border-b border-titanium-900 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
              Browse · Research · Code · Agents · Governance
            </p>
            <h2 className="mt-1 text-base font-semibold text-titanium-50">
              Governed AI Workspace
            </h2>
            <p className="mt-1 text-xs leading-5 text-titanium-400">
              Ein Workspace statt acht Chatfenster: Fähigkeiten werden geroutet, Provider bleiben austauschbar.
              Lokal wenn Sensitivität es verlangt, Cloud nur wenn Policy und Capability es erlauben.
            </p>
          </div>
          <Link
            to="/app/assistant"
            className="inline-flex items-center gap-2 border border-cyan-800/60 bg-cyan-950/20 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-500 hover:text-cyan-50"
          >
            Workspace öffnen <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-titanium-900 lg:grid-cols-4">
        {WORK_MODES.map(({ id, title, detail, href, Icon }) => (
          <Link
            key={id}
            to={href}
            className="group bg-obsidian-900 px-5 py-4 transition-colors hover:bg-obsidian-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <div className="flex items-center justify-between gap-3">
              <Icon className="h-5 w-5 text-cyan-300" />
              <ArrowRight className="h-4 w-4 text-titanium-600 transition-colors group-hover:text-cyan-300" />
            </div>
            <p className="mt-4 text-sm font-semibold text-titanium-50">{title}</p>
            <p className="mt-1 text-xs leading-5 text-titanium-400">{detail}</p>
          </Link>
        ))}
      </div>

      <div className="border-t border-titanium-900 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
              Execution zones
            </p>
            <p className="mt-1 text-xs text-titanium-400">
              Keine Modell-Rangliste: Datenklasse und Governance bestimmen die zulässige Lane.
            </p>
          </div>
          <Link
            to="/settings/ai-residency"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#e4cfa2] hover:text-titanium-50"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Residency Policy
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {LANES.map(({ id, title, subtitle, detail, providers, state, Icon }) => (
            <div key={id} className="border border-titanium-800 bg-obsidian-950/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-titanium-300" />
                  <div>
                    <p className="text-sm font-semibold text-titanium-50">{title}</p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-titanium-600">
                      {subtitle}
                    </p>
                  </div>
                </div>
                <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${STATE_CLASS[state]}`}>
                  {STATE_LABEL[state]}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-titanium-400">{detail}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {providers.map((provider) => (
                  <span
                    key={provider}
                    className="border border-titanium-800 bg-obsidian-900 px-2 py-1 text-[10px] text-titanium-300"
                  >
                    {provider}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-titanium-900 bg-[#0a0f15] px-5 py-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e4cfa2]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#e4cfa2]">
              Authority boundary
            </p>
            <p className="mt-1 text-xs leading-5 text-titanium-400">
              Request → Identity → Tenant → Data class → Capability → Policy → Risk → Approval →
              Execution → Verification → Evidence. Die Oberfläche erteilt keine Berechtigung und
              ein Modell darf seine eigene Freigabe nicht erzeugen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
