import { useEnvironment, ENV_CLS, ENV_LABEL, type GovernanceEnvironment } from './EnvironmentContext';
import { Layers } from 'lucide-react';

const ENVS: GovernanceEnvironment[] = ['production','staging','development','testing'];

/**
 * Compact pill-style environment switcher for governance views.
 * Persists choice in localStorage via EnvironmentProvider.
 */
export function EnvironmentSwitcher() {
  const { environment, setEnvironment } = useEnvironment();
  return (
    <div className="inline-flex items-center gap-1.5">
      <Layers className="h-3.5 w-3.5 text-titanium-500" />
      <select
        value={environment}
        onChange={(e) => setEnvironment(e.target.value as GovernanceEnvironment)}
        className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 border rounded-none outline-none cursor-pointer ${ENV_CLS[environment]}`}
      >
        {ENVS.map((e) => <option key={e} value={e} className="bg-obsidian-950 text-titanium-100">{ENV_LABEL[e]}</option>)}
      </select>
    </div>
  );
}

export function EnvironmentBanner() {
  const { environment } = useEnvironment();
  if (environment === 'production') return null;
  return (
    <div className={`border-b px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider text-center ${ENV_CLS[environment]}`}>
      Du siehst {ENV_LABEL[environment]}-Daten — Schreiboperationen werden ebenfalls hier zugeordnet.
    </div>
  );
}
