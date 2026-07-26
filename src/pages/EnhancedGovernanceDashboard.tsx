import React from 'react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { SidebarNav, type SidebarNavGroup } from '../components/navigation/SidebarNav';
import { KpiGrid, type KpiItem } from '../components/dashboard/KpiGrid';
import { AiAssistantCard } from '../components/dashboard/AiAssistantCard';
import {
  BarChart3,
  Shield,
  AlertCircle,
  CheckCircle,
  Database,
  Zap,
  FileText,
  Users,
  CreditCard,
  Settings,
  Home,
  Globe,
} from 'lucide-react';

/**
 * Enhanced Governance Dashboard
 * Demonstrates the new UX improvements:
 * - Grouped sidebar navigation
 * - KPI-focused hierarchy
 * - Prominent AI assistant
 * - Enterprise spacing & styling
 */
export function EnhancedGovernanceDashboard() {
  // Sidebar navigation groups (Phase 2 improvement)
  const navigationGroups: SidebarNavGroup[] = [
    {
      label: 'Operations',
      items: [
        { label: 'Home', href: '/dashboard', icon: <Home size={18} /> },
        { label: 'Websites', href: '/governance/websites', icon: <Globe size={18} /> },
        { label: 'Monitoring', href: '/governance/monitoring', icon: <BarChart3 size={18} /> },
      ],
    },
    {
      label: 'Security & Compliance',
      items: [
        { label: 'Risiken', href: '/governance/risks', icon: <AlertCircle size={18} /> },
        { label: 'Compliance', href: '/governance/compliance', icon: <Shield size={18} /> },
        { label: 'Evidence Vault', href: '/governance/evidence', icon: <Database size={18} /> },
      ],
    },
    {
      label: 'AI',
      items: [
        { label: 'AI Use Cases', href: '/governance/ai-cases', icon: <Zap size={18} /> },
        { label: 'Agenten', href: '/governance/agents', icon: <Zap size={18} /> },
      ],
    },
    {
      label: 'Business',
      items: [
        { label: 'Reports', href: '/governance/reports', icon: <FileText size={18} /> },
        { label: 'Team', href: '/governance/team', icon: <Users size={18} /> },
        { label: 'Billing', href: '/governance/billing', icon: <CreditCard size={18} /> },
      ],
    },
  ];

  // KPI Items (Phase 3 improvement - hierarchy)
  const kpiItems: KpiItem[] = [
    {
      id: 'compliance-score',
      label: 'Compliance Score',
      value: '92',
      hint: 'Overall Governance Health',
      severity: 'passed',
      icon: <Shield size={20} />,
      trend: { direction: 'up', value: 5 },
    },
    {
      id: 'critical-risks',
      label: 'Kritische Risiken',
      value: '3',
      hint: 'Requires Immediate Action',
      severity: 'critical',
      icon: <AlertCircle size={20} />,
      trend: { direction: 'down', value: 2 },
    },
    {
      id: 'open-actions',
      label: 'Offene Maßnahmen',
      value: '12',
      hint: 'Pending Completion',
      severity: 'medium',
      icon: <CheckCircle size={20} />,
      trend: { direction: 'down', value: 8 },
    },
    {
      id: 'last-scan',
      label: 'Letzter Scan',
      value: '2h ago',
      hint: 'Realtime Compliance Monitoring',
      severity: 'passed',
      icon: <BarChart3 size={20} />,
    },
    {
      id: 'evidence-status',
      label: 'Evidence Status',
      value: '847',
      hint: 'Compliance Records Stored',
      severity: 'passed',
      icon: <Database size={20} />,
      trend: { direction: 'up', value: 12 },
    },
    {
      id: 'ai-recommendations',
      label: 'AI Empfehlungen',
      value: '24',
      hint: 'Actionable Insights',
      severity: 'high',
      icon: <Zap size={20} />,
      trend: { direction: 'up', value: 3 },
    },
  ];

  // Dashboard header
  const headerContent = (
    <div>
      <h1 className="text-3xl font-display font-bold text-white mb-2">
        Governance Control Center
      </h1>
      <p className="text-sm text-titanium/70">
        Zentrale Übersicht über KI-Systeme, Connectoren, Agent Policies, Risiken und Audit Events.
      </p>
    </div>
  );

  // Sidebar content
  const sidebarContent = <SidebarNav groups={navigationGroups} />;

  // KPI Grid
  const kpiGrid = <KpiGrid items={kpiItems} columns={3} />;

  // AI Assistant Card
  const aiAssistant = (
    <AiAssistantCard
      onActionClick={(action) => console.log(`AI Action clicked: ${action}`)}
    />
  );

  // Secondary sections
  const sections = [
    {
      title: 'KI-System-Registry',
      span: 1 as const,
      content: (
        <div className="space-y-3 border border-titanium/10 rounded-none p-6 bg-obsidian-900">
          <div className="text-sm text-titanium/70">
            3 connected AI systems detected
          </div>
          <div className="text-xs text-titanium/50 font-mono">
            Use the AI Assistant above to analyze and configure your systems.
          </div>
        </div>
      ),
    },
    {
      title: 'Connector Status',
      span: 1 as const,
      content: (
        <div className="space-y-3 border border-titanium/10 rounded-none p-6 bg-obsidian-900">
          <div className="text-sm text-titanium/70">
            5 connectors active
          </div>
          <div className="text-xs text-titanium/50 font-mono">
            All integrations are operating normally.
          </div>
        </div>
      ),
    },
    {
      title: 'Policy Compliance',
      span: 2 as const,
      content: (
        <div className="space-y-3 border border-titanium/10 rounded-none p-6 bg-obsidian-900">
          <div className="text-sm text-titanium/70">
            4 policies configured (DSGVO, EU AI Act, ISO 27001, Internal)
          </div>
          <div className="text-xs text-titanium/50 font-mono">
            Last updated 2 hours ago. All policies are active and monitored.
          </div>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout
      sidebar={sidebarContent}
      header={headerContent}
      kpiGrid={kpiGrid}
      aiAssistant={aiAssistant}
      sections={sections}
      footer={
        <div className="flex items-center justify-between text-xs text-titanium/50">
          <span>© 2026 RealSyncDynamics.AI</span>
          <span className="font-mono">v2.0.0 Enterprise</span>
        </div>
      }
    />
  );
}
