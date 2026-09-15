import React from 'react';
import { Construction } from 'lucide-react';
import { EmptyState } from '../components/States';

// These legacy /os/app/* routes historically pointed at a placeholder shell
// even though functional Governance surfaces already exist in the main app.
// Keep the legacy routes stable while rendering the real implementation.
import { AiSystemRegistryView } from '@/features/governance/ai-registry/AiSystemRegistryView';
import { GovernanceAgentsCenterView } from '@/features/governance/agents/AgentsCenterView';
import { GovernanceAuditExportView } from '@/features/governance/audit/AuditExportView';
import { TenantAdminConsole } from '@/features/tenants/TenantAdminConsole';
import { BillingView } from '@/features/billing/BillingView';
import { SettingsView } from '@/features/settings/SettingsView';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export const LIVE_SURFACES = [
  'AI Use Case Registry',
  'Agenten',
  'Audit Reports',
  'Team & Rollen',
  'Billing',
  'Einstellungen',
] as const;

export function isLiveLegacySurface(title: string): boolean {
  return (LIVE_SURFACES as readonly string[]).includes(title);
}

function FunctionalSurface({ title }: { title: string }) {
  switch (title) {
    case 'AI Use Case Registry':
      return <AiSystemRegistryView />;
    case 'Agenten':
      return <GovernanceAgentsCenterView />;
    case 'Audit Reports':
      return <GovernanceAuditExportView />;
    case 'Team & Rollen':
      return <TenantAdminConsole />;
    case 'Billing':
      return <BillingView />;
    case 'Einstellungen':
      return <SettingsView />;
    default:
      return null;
  }
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  if (isLiveLegacySurface(title)) {
    return (
      <div className="flex flex-col gap-4" data-functional-surface={title}>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
          Live Surface · legacy route
        </div>
        <FunctionalSurface title={title} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Governance OS</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">{title}</h1>
      </div>
      <EmptyState
        icon={<Construction className="h-5 w-5" />}
        title="Modul folgt in Phase 2/3"
        description={description}
      />
    </div>
  );
}
