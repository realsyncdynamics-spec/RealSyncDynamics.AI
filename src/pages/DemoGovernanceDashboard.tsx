import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { useDashboardData } from '../features/supabase/useDashboardData';
import { ChevronRight, LogOut, AlertCircle, CheckCircle, Shield, Database, BarChart3, Home, Globe } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { SidebarNav, type SidebarNavGroup } from '../components/navigation/SidebarNav';
import { KpiGrid, type KpiItem } from '../components/dashboard/KpiGrid';
import { AiAssistantCard } from '../components/dashboard/AiAssistantCard';
import { PageTitle, SectionHeading, SubHeading, BodyText, HintText } from '../components/dashboard/Typography';

// Pulse animation component for monitoring status
function PulseIndicator() {
  return (
    <div className="relative inline-block">
      <div className="w-3 h-3 rounded-full bg-green-500"></div>
      <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
    </div>
  );
}

// Evidence list item
function EvidenceItem({
  id,
  title,
  date,
  status,
}: {
  id: string;
  title: string;
  date: string;
  status: 'verified' | 'pending' | 'expired';
}) {
  const statusConfig = {
    verified: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Verified' },
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pending' },
    expired: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Expired' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-3 border-b border-titanium-800/30 hover:bg-obsidian-800/30 px-3 rounded transition-colors">
      <div className="flex-1">
        <div className="text-titanium-100 text-sm font-medium">{title}</div>
        <div className="text-titanium-500 text-xs mt-1">{date}</div>
      </div>
      <div className={`${config.bg} ${config.color} px-2 py-1 rounded text-xs font-semibold`}>
        {config.label}
      </div>
    </div>
  );
}

export function DemoGovernanceDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useSupabaseAuth();
  const { data: dashboardData } = useDashboardData(user?.id);

  const handleLogout = async () => {
    await logout();
    navigate('/demo-login', { replace: true });
  };

  // Sidebar navigation groups
  const navigationGroups: SidebarNavGroup[] = [
    {
      label: 'Operations',
      items: [
        { label: 'Home', href: '/demo-governance', icon: <Home size={18} /> },
        { label: 'Websites', href: '/governance/websites', icon: <Globe size={18} /> },
        { label: 'Monitoring', href: '/governance/monitoring', icon: <BarChart3 size={18} /> },
      ],
    },
    {
      label: 'Security & Compliance',
      items: [
        { label: 'Compliance', href: '/governance/compliance', icon: <Shield size={18} /> },
        { label: 'Evidence Vault', href: '/governance/evidence', icon: <Database size={18} /> },
      ],
    },
  ];

  // KPI items from dashboard data
  const kpiItems: KpiItem[] = [
    {
      id: 'governance-score',
      label: 'Governance Score',
      value: `${dashboardData.riskScore}`,
      hint: 'Overall Compliance Health',
      severity: dashboardData.riskScore >= 80 ? 'passed' : dashboardData.riskScore >= 60 ? 'medium' : 'high',
      icon: <Shield size={20} />,
    },
    {
      id: 'evidence-count',
      label: 'Evidence Count',
      value: dashboardData.evidenceCount,
      hint: 'Compliance Artifacts Collected',
      severity: 'passed',
      icon: <Database size={20} />,
    },
  ];

  // Dashboard header
  const headerContent = (
    <div className="flex items-center justify-between">
      <div>
        <PageTitle>Governance Dashboard</PageTitle>
        <BodyText className="mt-2">Welcome, {user?.email}</BodyText>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-none text-red-400 text-sm font-medium transition-colors"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  );

  // Sidebar content
  const sidebarContent = <SidebarNav groups={navigationGroups} />;

  // KPI Grid
  const kpiGrid = <KpiGrid items={kpiItems} columns={2} />;

  // AI Assistant Card
  const aiAssistant = (
    <AiAssistantCard
      onActionClick={(action) => console.log(`Demo: ${action}`)}
    />
  );

  // Secondary sections
  const sections = [
    {
      title: 'Monitoring Status',
      span: 1 as const,
      content: (
        <div className="space-y-3 border border-titanium/10 rounded-none p-6 bg-obsidian-900">
          <div className="flex items-center gap-3 p-3 bg-obsidian-800/30">
            <PulseIndicator />
            <div>
              <SubHeading className="text-sm">System Monitoring</SubHeading>
              <HintText>Live</HintText>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-obsidian-800/30">
            <PulseIndicator />
            <div>
              <SubHeading className="text-sm">Evidence Sync</SubHeading>
              <HintText>Active</HintText>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-obsidian-800/30">
            <PulseIndicator />
            <div>
              <SubHeading className="text-sm">Compliance Alerts</SubHeading>
              <HintText>0 issues</HintText>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Recent Evidence',
      span: 1 as const,
      content: (
        <div className="border border-titanium/10 rounded-none p-6 bg-obsidian-900">
          <div className="space-y-0">
            {dashboardData.evidenceList.map((item) => (
              <EvidenceItem
                key={item.id}
                id={item.id}
                title={item.title}
                date={item.date}
                status="verified"
              />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between text-titanium-400 text-sm">
            <span>Showing 1-{dashboardData.evidenceList.length} of {dashboardData.evidenceCount}</span>
            <button className="text-security-blue hover:text-security-blue/80 flex items-center gap-1 text-sm transition-colors">
              View All <ChevronRight size={16} />
            </button>
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
          <span className="font-mono">Demo Dashboard v2.0</span>
        </div>
      }
    />
  );
}
