import { useEffect, useState } from 'react';
import { useTenant } from '../../core/access/TenantProvider';
import { Shield, Activity, CheckCircle2 } from 'lucide-react';
import { listWebsitesForTenant } from '../../features/governance/scans/scansApi';

export function GovernanceStatusBar() {
  const { tenants, activeTenantId } = useTenant();
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) {
      setPrimaryDomain(null);
      return;
    }
    let cancelled = false;
    listWebsitesForTenant(activeTenantId)
      .then((sites) => {
        if (!cancelled) setPrimaryDomain(sites[0]?.domain ?? null);
      })
      .catch(() => {
        if (!cancelled) setPrimaryDomain(null);
      });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  return (
    <div className="h-6 shrink-0 bg-obsidian-950 border-t border-titanium-900 flex items-center gap-4 px-3 overflow-x-auto scrollbar-none">
      <StatusItem icon={<CheckCircle2 className="h-3 w-3 text-emerald-400" />} label="Production" />
      <StatusItem icon={<Shield className="h-3 w-3 text-cyan-400" />} label="HTTPS Enforced" />
      <StatusItem icon={<CheckCircle2 className="h-3 w-3 text-emerald-400" />} label="Evidence Active" />
      <StatusItem icon={<Activity className="h-3 w-3 text-amber-400" />} label="Monitoring Beta" />
      <div className="h-3 w-px bg-titanium-800 shrink-0" />
      {activeTenant ? (
        <StatusItem label={`Mandant: ${activeTenant.name}`} />
      ) : (
        <StatusItem label="Nicht angemeldet" />
      )}
      <div className="h-3 w-px bg-titanium-800 shrink-0 hidden sm:block" />
      {primaryDomain ? (
        <StatusItem label={primaryDomain} className="hidden sm:flex" />
      ) : activeTenant ? (
        <StatusItem label="Keine Domain hinterlegt" className="hidden sm:flex" />
      ) : null}
    </div>
  );
}

function StatusItem({
  icon,
  label,
  accent,
  className = '',
}: {
  icon?: React.ReactNode;
  label: string;
  accent?: 'cyan';
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 shrink-0 ${className}`}>
      {icon}
      <span className={`font-mono text-[9px] uppercase tracking-wide ${accent === 'cyan' ? 'text-cyan-400' : 'text-titanium-600'}`}>
        {label}
      </span>
    </div>
  );
}
