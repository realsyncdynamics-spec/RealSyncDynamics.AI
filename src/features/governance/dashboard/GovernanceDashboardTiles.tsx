import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Globe, Cpu, AlertTriangle, Archive, FileText,
  CheckSquare, Users, Plug, MessageSquare, Lock, ArrowRight, Zap,
} from 'lucide-react';
import { useEntitlements } from '../../../core/billing/useEntitlements';

interface DashboardTile {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  path?: string;
  feature: string;
  tier: 'free_tier' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';
  color: 'cyan' | 'emerald' | 'violet' | 'amber' | 'indigo';
}

const DASHBOARD_TILES: DashboardTile[] = [
  {
    id: 'governance-cockpit',
    icon: <Shield className="w-6 h-6" />,
    title: 'Governance Cockpit',
    description: 'Risiko-Übersicht, Audit-Readiness & KPIs',
    path: '/app',
    feature: 'governance.cockpit',
    tier: 'free_tier',
    color: 'cyan',
  },
  {
    id: 'website-scanner',
    icon: <Globe className="w-6 h-6" />,
    title: 'Website-Scanner',
    description: 'DSGVO-Compliance auf deiner Website',
    path: '/app/governance/website-scan',
    feature: 'website.scan_monthly_limit',
    tier: 'free_tier',
    color: 'emerald',
  },
  {
    id: 'ai-systems',
    icon: <Cpu className="w-6 h-6" />,
    title: 'KI-Systeme',
    description: 'Verzeichnis & EU AI Act-Klassifizierung',
    path: '/app/governance/ai-register',
    feature: 'governance.ai_register',
    tier: 'free_tier',
    color: 'violet',
  },
  {
    id: 'risk-findings',
    icon: <AlertTriangle className="w-6 h-6" />,
    title: 'Risiken & Findings',
    description: 'Compliance-Risiken & Remediation-Tasks',
    path: '/app/governance/findings',
    feature: 'governance.risk_findings',
    tier: 'starter',
    color: 'amber',
  },
  {
    id: 'evidence-vault',
    icon: <Archive className="w-6 h-6" />,
    title: 'Evidence Vault',
    description: 'Hash-verifizierte Compliance-Nachweise',
    path: '/app/evidence',
    feature: 'evidence.basic_vault',
    tier: 'free_tier',
    color: 'indigo',
  },
  {
    id: 'reports',
    icon: <FileText className="w-6 h-6" />,
    title: 'Dokumente & Reports',
    description: 'PDF-Exports, DSGVO-Verzeichnis & Audits',
    path: '/app/compliance',
    feature: 'reports.export',
    tier: 'starter',
    color: 'cyan',
  },
  {
    id: 'tasks',
    icon: <CheckSquare className="w-6 h-6" />,
    title: 'Aufgaben',
    description: 'Compliance-Tasks & Remediation-Tracking',
    path: '/app/governance/tasks',
    feature: 'governance.tasks',
    tier: 'growth',
    color: 'emerald',
  },
  {
    id: 'tenants',
    icon: <Users className="w-6 h-6" />,
    title: 'Mandanten',
    description: 'Workspace-Verwaltung & Invitations',
    path: '/app/settings/workspace',
    feature: 'workspace.management',
    tier: 'free_tier',
    color: 'violet',
  },
  {
    id: 'integrations',
    icon: <Plug className="w-6 h-6" />,
    title: 'Integrationen',
    description: 'Connectors für APIs & Datenquellen',
    path: '/app/integrations',
    feature: 'integrations.connectors',
    tier: 'starter',
    color: 'amber',
  },
  {
    id: 'ai-assistant',
    icon: <MessageSquare className="w-6 h-6" />,
    title: 'KI-Assistent',
    description: 'Claude-Compliance-Advisor & Automation',
    path: '/app/ai-assistant',
    feature: 'ai.assistant',
    tier: 'growth',
    color: 'indigo',
  },
];

const COLOR_CLASSES: Record<DashboardTile['color'], {
  border: string;
  bg: string;
  hoverBg: string;
  icon: string;
  badge: string;
  badgeText: string;
}> = {
  cyan: {
    border: 'border-ai-cyan-500/50',
    bg: 'bg-ai-cyan-500/5',
    hoverBg: 'hover:bg-ai-cyan-500/10',
    icon: 'text-ai-cyan-400',
    badge: 'bg-ai-cyan-500/20 text-ai-cyan-300',
    badgeText: 'text-ai-cyan-300',
  },
  emerald: {
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/5',
    hoverBg: 'hover:bg-emerald-500/10',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
    badgeText: 'text-emerald-300',
  },
  violet: {
    border: 'border-violet-500/50',
    bg: 'bg-violet-500/5',
    hoverBg: 'hover:bg-violet-500/10',
    icon: 'text-violet-400',
    badge: 'bg-violet-500/20 text-violet-300',
    badgeText: 'text-violet-300',
  },
  amber: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/5',
    hoverBg: 'hover:bg-amber-500/10',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
    badgeText: 'text-amber-300',
  },
  indigo: {
    border: 'border-indigo-500/50',
    bg: 'bg-indigo-500/5',
    hoverBg: 'hover:bg-indigo-500/10',
    icon: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300',
    badgeText: 'text-indigo-300',
  },
};

interface GovernanceDashboardTilesProps {
  layout?: 'grid' | 'compact';
}

export function GovernanceDashboardTiles({ layout = 'grid' }: GovernanceDashboardTilesProps) {
  const navigate = useNavigate();
  const { hasFeature, canAccess } = useEntitlements();

  const accessibleTiles = useMemo(() => {
    return DASHBOARD_TILES.map((tile) => ({
      ...tile,
      accessible: hasFeature(tile.feature),
      access: canAccess(tile.feature),
    }));
  }, [hasFeature, canAccess]);

  if (layout === 'compact') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {accessibleTiles.map((tile) => {
          const colors = COLOR_CLASSES[tile.color];
          return (
            <button
              key={tile.id}
              onClick={() => {
                if (tile.accessible && tile.path) {
                  navigate(tile.path);
                } else if (!tile.accessible && tile.access.upgradeUrl) {
                  navigate(tile.access.upgradeUrl);
                }
              }}
              disabled={!tile.accessible}
              className={`
                text-center p-3 rounded-none border transition-all
                ${tile.accessible
                  ? `${colors.bg} ${colors.border} ${colors.hoverBg} cursor-pointer`
                  : 'bg-obsidian-950 border-titanium-900 opacity-50 cursor-not-allowed'
                }
              `}
            >
              <div className={`flex justify-center mb-2 ${colors.icon}`}>
                {tile.icon}
              </div>
              <h3 className="text-[11px] font-semibold text-titanium-50 leading-tight">
                {tile.title}
              </h3>
              {!tile.accessible && (
                <Lock className="w-3 h-3 text-amber-600 mx-auto mt-1.5" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {accessibleTiles.map((tile) => {
        const colors = COLOR_CLASSES[tile.color];
        return (
          <button
            key={tile.id}
            onClick={() => {
              if (tile.accessible && tile.path) {
                navigate(tile.path);
              } else if (!tile.accessible && tile.access.upgradeUrl) {
                navigate(tile.access.upgradeUrl);
              }
            }}
            disabled={!tile.accessible}
            className={`
              text-left p-4 rounded-none border transition-all flex flex-col
              ${tile.accessible
                ? `${colors.bg} ${colors.border} ${colors.hoverBg} cursor-pointer`
                : 'bg-obsidian-950 border-titanium-900 opacity-50 cursor-not-allowed'
              }
            `}
          >
            <div className={`flex items-start justify-between mb-3 ${colors.icon}`}>
              {tile.icon}
              {!tile.accessible && <Lock className="w-4 h-4 text-amber-600" />}
            </div>

            <h3 className="text-sm font-semibold text-titanium-50 mb-1">
              {tile.title}
            </h3>

            <p className="text-xs text-titanium-400 mb-3 flex-1">
              {tile.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-titanium-800/50">
              <span className={`text-xs font-mono px-2 py-1 rounded-none ${colors.badge}`}>
                {tile.accessible ? 'Verfügbar' : `Ab ${tile.tier}`}
              </span>
              <ArrowRight className={`w-3.5 h-3.5 ${tile.accessible ? colors.badgeText : 'text-titanium-600'}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
