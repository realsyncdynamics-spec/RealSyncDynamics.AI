import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { useDashboardData } from '../features/supabase/useDashboardData';
import { useDashboardKpis } from '../hooks/useDashboardKpis';
import { LogOut, Home, Globe, BarChart3, Shield, Database } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { SidebarNav, type SidebarNavGroup } from '../components/navigation/SidebarNav';
import { KpiGrid } from '../components/dashboard/KpiGrid';
import { AiAssistantCard } from '../components/dashboard/AiAssistantCard';
import { PageTitle, BodyText, SubHeading, HintText } from '../components/dashboard/Typography';

/**
 * Refactored Governance Dashboard
 * Demonstrates Phase 2: Live Supabase Data Integration
 * - Uses useDashboardData hook for data fetching
 * - Uses useDashboardKpis hook for data transformation
 * - Fully integrated with new component library
 */
export function RefactoredGovernanceDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useSupabaseAuth();
  const { data: dashboardData, isLoading, error } = useDashboardData(user?.id);

  // Transform Supabase data to KPI format
  const { kpis } = useDashboardKpis({
    riskScore: dashboardData.riskScore,
    evidenceCount: dashboardData.evidenceCount,
    criticalRisks: Math.max(0, 100 - dashboardData.riskScore) > 20 ? 3 : 1,
    openActions: dashboardData.evidenceList.length,
    aiRecommendations: 12,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/demo-login', { replace: true });
  };

  // Sidebar navigation
  const navigationGroups: SidebarNavGroup[] = [
    {
      label: 'Operations',
      items: [
        { label: 'Home', href: '/dashboard/refactored', icon: <Home size={18} /> },
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

  // Header
  const headerContent = (
    <div className="flex items-center justify-between">
      <div>
        <PageTitle>Governance Dashboard (Refactored)</PageTitle>
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-display text-titanium mb-4">Loading dashboard...</div>
          <HintText>Fetching live data from Supabase</HintText>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="text-center text-red-400">
          <div className="text-2xl font-display mb-4">Error loading dashboard</div>
          <HintText>{error}</HintText>
        </div>
      </div>
    );
  }

  // Secondary sections
  const sections = [
    {
      title: 'Recent Evidence',
      span: 2 as const,
      content: (
        <div className="border border-titanium/10 rounded-none p-6 bg-obsidian-900 space-y-2">
          {dashboardData.evidenceList.length > 0 ? (
            <>
              {dashboardData.evidenceList.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-titanium/10 last:border-0"
                >
                  <div>
                    <SubHeading className="text-sm">{item.title}</SubHeading>
                    <HintText className="mt-1">{item.date}</HintText>
                  </div>
                  <span className="px-2 py-1 rounded-sm bg-green-950 text-green-400 text-xs font-mono">
                    Verified
                  </span>
                </div>
              ))}
              <button className="mt-4 text-security-blue hover:text-security-blue/80 text-sm font-medium">
                View all {dashboardData.evidenceCount} items →
              </button>
            </>
          ) : (
            <HintText>No evidence items collected yet</HintText>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout
      sidebar={<SidebarNav groups={navigationGroups} />}
      header={headerContent}
      kpiGrid={<KpiGrid items={kpis} columns={2} />}
      aiAssistant={
        <AiAssistantCard
          onActionClick={(action) => console.log(`Action: ${action}`)}
        />
      }
      sections={sections}
      footer={
        <div className="flex items-center justify-between text-xs text-titanium/50">
          <span>Live data from Supabase</span>
          <span className="font-mono">Updated: {new Date().toLocaleTimeString()}</span>
        </div>
      }
    />
  );
}
