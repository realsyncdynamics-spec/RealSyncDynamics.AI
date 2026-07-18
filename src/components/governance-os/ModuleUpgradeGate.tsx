import { Link } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { minimumPlanForModule, GOVERNANCE_MODULES } from './governanceModules';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth:  'Growth',
  agency:  'Agency',
  scale:   'Partner',
  enterprise: 'Enterprise',
};

interface ModuleUpgradeGateProps {
  moduleId: string;
}

export function ModuleUpgradeGate({ moduleId }: ModuleUpgradeGateProps) {
  const module = GOVERNANCE_MODULES.find((m) => m.id === moduleId);
  if (!module) return null;

  const minPlan = minimumPlanForModule(module);
  const planLabel = PLAN_LABELS[minPlan] ?? minPlan;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-obsidian-950 min-h-[320px]">
      <div className="max-w-sm text-center">
        <div className="w-10 h-10 bg-obsidian-800 border border-titanium-800 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-5 w-5 text-titanium-500" />
        </div>
        <h2 className="font-display font-bold text-titanium-50 text-lg mb-2">
          {module.label} ist gesperrt
        </h2>
        <p className="text-sm text-titanium-400 mb-2">
          {module.description}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-titanium-600 mb-6">
          Verfügbar ab {planLabel}
        </p>
        <Link
          to={`/pricing?highlight=${minPlan}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-400 text-obsidian-950 text-sm font-semibold hover:bg-cyan-300 transition-colors"
        >
          Plan upgraden <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
