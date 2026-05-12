import { Link } from 'react-router-dom';
import {
  ArrowRight, Activity, ShieldCheck, FileLock2, Network,
} from 'lucide-react';

/**
 * Discovery-layer panel surfaced via the Hero top-nav. Funnels
 * visitors from the public landing to the deeper Governance
 * Runtime experiences:
 *
 *   - /governance-runtime  → demo dashboard (no auth)
 *   - /docs/governance     → API reference for self-onboarding
 *   - /governance          → real tenant dashboard (auth-gated)
 */
export function GovernanceRuntimePanel() {
  return (
    <div className="space-y-6">
      <p className="text-base text-silver-200 leading-relaxed">
        Event-driven Compliance Runtime für AI-Systeme, Websites und Agents.
        Vier Pillars in einer Engine:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Pillar
          icon={<Activity className="h-4 w-4 text-gold-400" />}
          title="Runtime Telemetry"
          body="Events aus Browser-Extension, SDK, Agent-Runtime, GitHub und CI/CD landen in einem konsolidierten Stream."
        />
        <Pillar
          icon={<ShieldCheck className="h-4 w-4 text-gold-400" />}
          title="Policy Engine"
          body="JSON-Conditions, strengste Aktion gewinnt: block · require_approval · warn · log · allow."
        />
        <Pillar
          icon={<FileLock2 className="h-4 w-4 text-gold-400" />}
          title="Evidence Vault"
          body="Hash-verkettete Artefakte pro Event. Audits werden re-konstruierbar statt nachträglich dokumentiert."
        />
        <Pillar
          icon={<Network className="h-4 w-4 text-gold-400" />}
          title="Governance Graph"
          body="Asset ↔ Framework-Control-Mapping über GDPR, EU AI Act, ISO 27001, SOC 2. Lücken sichtbar."
        />
      </div>

      <div className="border border-silver-700/30 bg-obsidian-900/40 p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-gold-400 mb-2">
          End-to-end Stack
        </div>
        <ol className="space-y-1.5 text-sm text-silver-200">
          <li><span className="text-gold-400 mr-2">1.</span>Asset + Policy im Dashboard anlegen</li>
          <li><span className="text-gold-400 mr-2">2.</span>Ingest-Key minten (einmaliger Reveal)</li>
          <li><span className="text-gold-400 mr-2">3.</span>Extension / SDK / Agent-Runtime senden Events</li>
          <li><span className="text-gold-400 mr-2">4.</span>Policy-Engine stamped Decisions + Auto-Evidence</li>
          <li><span className="text-gold-400 mr-2">5.</span>Events + Evidence direkt im Tenant-Dashboard sichtbar</li>
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <Link
          to="/governance-runtime"
          className="surface-gold inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-bold rounded-none"
        >
          Live-Demo ansehen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/docs/governance"
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
        >
          API-Referenz
        </Link>
        <Link
          to="/contact-sales?intent=governance-pilot&source=hero-runtime-modal"
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
        >
          Pilot anfragen
        </Link>
      </div>
    </div>
  );
}

function Pillar({
  icon, title, body,
}: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="border border-silver-700/30 bg-obsidian-900/40 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <h3 className="font-display font-bold text-titanium-50 text-sm">{title}</h3>
      </div>
      <p className="text-[13px] text-silver-300 leading-relaxed">{body}</p>
    </div>
  );
}
