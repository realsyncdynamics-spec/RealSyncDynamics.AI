import React from 'react';
import { Construction } from 'lucide-react';
import { EmptyState } from '../components/States';

// These routes historically pointed at this placeholder shell even though
// production-ready Governance surfaces already exist elsewhere in the app.
// Keep the legacy route stable, but render the real surface instead of a
// "coming soon" state. The fallback remains for genuinely future pages.
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
  const surface = <FunctionalSurface title={title} />;

  if (surface.props.children) {
    return (
      <div className="flex flex-col gap-4" data-functional-surface={title}>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
          Live Surface · legacy route
        </div>
        {surface}
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
