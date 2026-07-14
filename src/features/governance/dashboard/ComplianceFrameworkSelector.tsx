import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Shield, AlertTriangle, CheckCircle2, ArrowRight, Lock,
} from 'lucide-react';
import { useEntitlements } from '../../../core/billing/useEntitlements';

interface Framework {
  id: string;
  name: string;
  shortCode: string;
  description: string;
  icon: React.ComponentType<{ className: string }>;
  path: string;
  tier: string;
  status: 'available' | 'locked' | 'in-progress';
  completionPercent: number;
}

const FRAMEWORKS: Framework[] = [
  {
    id: 'dsgvo',
    name: 'DSGVO / GDPR',
    shortCode: 'GDPR',
    description: 'Datenschutz-Grundverordnung - Basis für alle EU-Organisationen',
    icon: Shield,
    path: '/app/governance/dsgvo-directory',
    tier: 'free_tier',
    status: 'available',
    completionPercent: 45,
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    shortCode: 'ISO27001',
    description: 'Informationssicherheits-Management System',
    icon: BarChart3,
    path: '/app/governance/iso-27001',
    tier: 'starter',
    status: 'available',
    completionPercent: 28,
  },
  {
    id: 'iso42001',
    name: 'ISO 42001',
    shortCode: 'ISO42001',
    description: 'AI Management System - Künstliche Intelligenz Compliance',
    icon: AlertTriangle,
    path: '/app/governance/iso-42001',
    tier: 'growth',
    status: 'in-progress',
    completionPercent: 12,
  },
  {
    id: 'nis2',
    name: 'NIS2 Directive',
    shortCode: 'NIS2',
    description: 'Netzwerk- und Informationssicherheitsrichtlinie (EU)',
    icon: Shield,
    path: '/app/governance/nis2',
    tier: 'growth',
    status: 'in-progress',
    completionPercent: 0,
  },
  {
    id: 'dora',
    name: 'DORA',
    shortCode: 'DORA',
    description: 'Digital Operational Resilience Act - Finanzsektor',
    icon: Shield,
    path: '/app/governance/dora',
    tier: 'agency',
    status: 'in-progress',
    completionPercent: 0,
  },
  {
    id: 'euaiact',
    name: 'EU AI Act',
    shortCode: 'AI-ACT',
    description: 'Regulierung von Künstlicher Intelligenz in der EU',
    icon: AlertTriangle,
    path: '/app/governance/ai-act-assessment',
    tier: 'growth',
    status: 'in-progress',
    completionPercent: 8,
  },
];

export function ComplianceFrameworkSelector() {
  const navigate = useNavigate();
  const { tier, hasFeature, canAccess } = useEntitlements();
  const [hoveredFramework, setHoveredFramework] = useState<string | null>(null);

  const isAccessible = (framework: Framework): boolean => {
    return hasFeature(`governance.${framework.id}`);
  };

  const handleFrameworkClick = (framework: Framework) => {
    if (isAccessible(framework)) {
      navigate(framework.path);
    } else {
      const access = canAccess(`governance.${framework.id}`);
      if (access.upgradeUrl) {
        navigate(access.upgradeUrl);
      } else {
        navigate('/pricing');
      }
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-titanium-50 mb-2">
            Compliance-Frameworks
          </h1>
          <p className="text-titanium-400 max-w-2xl">
            Verwalte deine Compliance mit verschiedenen Frameworks und Standards.
            Jeder Workspace hat Zugriff auf unterschiedliche Frameworks je nach Plan.
          </p>
        </div>

        {/* Framework Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FRAMEWORKS.map((framework) => {
            const accessible = isAccessible(framework);
            const Icon = framework.icon;

            return (
              <button
                key={framework.id}
                onClick={() => handleFrameworkClick(framework)}
                onMouseEnter={() => setHoveredFramework(framework.id)}
                onMouseLeave={() => setHoveredFramework(null)}
                disabled={!accessible}
                className={`
                  text-left p-5 rounded-none border transition-all
                  ${accessible
                    ? 'bg-obsidian-900 border-titanium-700 hover:border-ai-cyan-400 hover:bg-obsidian-800 cursor-pointer'
                    : 'bg-obsidian-950 border-titanium-900 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-none flex items-center justify-center shrink-0 ${
                      accessible
                        ? 'bg-ai-cyan-500/10 border border-ai-cyan-500/30'
                        : 'bg-amber-500/10 border border-amber-500/30'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        accessible ? 'text-ai-cyan-400' : 'text-amber-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-titanium-500 font-mono mb-1">
                        {framework.shortCode}
                      </p>
                      <h3 className="text-sm font-semibold text-titanium-50">
                        {framework.name}
                      </h3>
                    </div>
                  </div>
                  {!accessible && (
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                </div>

                <p className="text-xs text-titanium-400 mb-4">
                  {framework.description}
                </p>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-titanium-500 font-mono">
                      COMPLETION
                    </span>
                    <span className="text-xs font-semibold text-titanium-300">
                      {framework.completionPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-titanium-900 rounded-none h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${framework.completionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {framework.status === 'available' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-none font-mono">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    )}
                    {framework.status === 'in-progress' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-none font-mono">
                        <AlertTriangle className="w-3 h-3" />
                        In Progress
                      </span>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-titanium-500" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
          <h3 className="text-lg font-semibold text-titanium-50 mb-3">
            Frameworks nach Plan
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-titanium-500 font-mono text-xs mb-2">FREE TIER</p>
              <p className="text-titanium-300">DSGVO</p>
            </div>
            <div>
              <p className="text-titanium-500 font-mono text-xs mb-2">STARTER</p>
              <p className="text-titanium-300">ISO 27001</p>
            </div>
            <div>
              <p className="text-titanium-500 font-mono text-xs mb-2">GROWTH+</p>
              <p className="text-titanium-300">ISO 42001, NIS2, EU AI Act</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
