import React from 'react';
import { Shield, AlertCircle, CheckCircle, Database, Zap, FileText, Users, CreditCard, Home, Globe, BarChart3 } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { SidebarNav, type SidebarNavGroup } from '../components/navigation/SidebarNav';
import { KpiGrid, type KpiItem } from '../components/dashboard/KpiGrid';
import { AiAssistantCard } from '../components/dashboard/AiAssistantCard';
import { PageTitle, SectionHeading, SubHeading, GroupLabel, BodyText, HintText, MetricValue, BadgeText, MonoText } from '../components/dashboard/Typography';

/**
 * Component Showcase
 * Gallery of all new UX-improved components
 * Route: /showcase/components
 */
export function ComponentShowcase() {
  const navigationGroups: SidebarNavGroup[] = [
    {
      label: 'Components',
      items: [
        { label: 'All', href: '/showcase/components', icon: <Home size={18} /> },
        { label: 'Typography', href: '#typography', icon: <FileText size={18} /> },
        { label: 'KpiGrid', href: '#kpi-grid', icon: <BarChart3 size={18} /> },
        { label: 'AiAssistant', href: '#ai-assistant', icon: <Zap size={18} /> },
      ],
    },
  ];

  const showcaseKpis: KpiItem[] = [
    {
      id: 'example-1',
      label: 'Example Metric',
      value: '42',
      hint: 'This is a sample KPI',
      severity: 'passed',
      icon: <CheckCircle size={20} />,
      trend: { direction: 'up', value: 12 },
    },
    {
      id: 'example-2',
      label: 'Warning Metric',
      value: '7',
      hint: 'This shows a warning state',
      severity: 'high',
      icon: <AlertCircle size={20} />,
      trend: { direction: 'up', value: 3 },
    },
    {
      id: 'example-3',
      label: 'Critical Issue',
      value: '2',
      hint: 'Requires immediate action',
      severity: 'critical',
      icon: <AlertCircle size={20} />,
    },
  ];

  const header = (
    <div>
      <PageTitle>Component Showcase</PageTitle>
      <BodyText className="mt-2">
        Demonstrationen aller neuen UX-Komponenten für das RealSyncDynamics Dashboard
      </BodyText>
    </div>
  );

  const sidebar = <SidebarNav groups={navigationGroups} />;

  const content = (
    <div className="space-y-16">
      {/* Typography Section */}
      <section id="typography">
        <div className="mb-8">
          <SectionHeading>Typography System</SectionHeading>
          <HintText>Konsistente Typografie-Hierarchie für alle Dashboard-Seiten</HintText>
        </div>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
          {/* Headings */}
          <div className="border border-titanium/10 p-8 bg-obsidian-900 space-y-6">
            <SubHeading>Heading Styles</SubHeading>

            <div>
              <GroupLabel>Page Title</GroupLabel>
              <PageTitle className="text-3xl mt-2">Page Title Example</PageTitle>
            </div>

            <div>
              <GroupLabel>Section Heading</GroupLabel>
              <SectionHeading className="mt-2">Section Heading Example</SectionHeading>
            </div>

            <div>
              <GroupLabel>Sub Heading</GroupLabel>
              <SubHeading className="mt-2">Sub Heading Example</SubHeading>
            </div>

            <div>
              <GroupLabel>Group Label</GroupLabel>
              <GroupLabel className="mt-2">GROUP LABEL EXAMPLE</GroupLabel>
            </div>
          </div>

          {/* Body Text */}
          <div className="border border-titanium/10 p-8 bg-obsidian-900 space-y-6">
            <SubHeading>Body & Detail Text</SubHeading>

            <div>
              <GroupLabel>Body Text</GroupLabel>
              <BodyText className="mt-2">
                Dies ist normaler Body-Text, der für längere Erklärungen und Inhalte verwendet wird. Er hat eine angenehme Lesegröße und Zeilenhöhe.
              </BodyText>
            </div>

            <div>
              <GroupLabel>Hint Text</GroupLabel>
              <HintText className="mt-2">
                Das ist Hint-Text in Monospace. Wird für sekundäre Informationen verwendet.
              </HintText>
            </div>

            <div>
              <GroupLabel>Mono Text (Code)</GroupLabel>
              <MonoText className="mt-2">const example = "Technical text";</MonoText>
            </div>
          </div>

          {/* Values & Badges */}
          <div className="border border-titanium/10 p-8 bg-obsidian-900 space-y-6">
            <SubHeading>Values & Metrics</SubHeading>

            <div>
              <GroupLabel>Metric Value</GroupLabel>
              <MetricValue className="mt-2">92</MetricValue>
              <HintText className="mt-1">Große Zahlenwerte für KPIs</HintText>
            </div>

            <div>
              <GroupLabel>Badge Text</GroupLabel>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-1 rounded-sm bg-green-950 text-green-400">
                  <BadgeText>Passed</BadgeText>
                </span>
                <span className="px-2 py-1 rounded-sm bg-red-950 text-red-400">
                  <BadgeText>Critical</BadgeText>
                </span>
              </div>
            </div>
          </div>

          {/* Label Text */}
          <div className="border border-titanium/10 p-8 bg-obsidian-900 space-y-6">
            <SubHeading>Form & Labels</SubHeading>

            <div>
              <GroupLabel>Label Text (Form)</GroupLabel>
              <label className="block mt-2">
                <LabelText className="block mb-2">Example Form Label</LabelText>
                <input
                  type="text"
                  placeholder="Input field"
                  className="w-full px-3 py-2 bg-obsidian border border-titanium/10 text-titanium placeholder-titanium/30 rounded-none focus:outline-none focus:border-security-blue"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Grid Section */}
      <section id="kpi-grid">
        <div className="mb-8">
          <SectionHeading>KPI Grid Component</SectionHeading>
          <HintText>Verbesserte KPI-Anzeige mit Severity-Farben und Trends</HintText>
        </div>

        <div className="border border-titanium/10 p-8 bg-obsidian-900">
          <KpiGrid items={showcaseKpis} columns={3} />
        </div>

        <div className="mt-6 p-6 border border-titanium/10 bg-obsidian-900 rounded-none">
          <SubHeading className="mb-4">Features</SubHeading>
          <ul className="space-y-2">
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>Severity-Farben: Kritisch (Rot), Hoch (Orange), Mittel (Amber), Ok (Grün)</BodyText>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>Trend-Indikatoren mit Prozentangaben (↑↓→)</BodyText>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>Responsive Grid: 1 Col (Mobile) → 2 Cols (Tablet) → 4 Cols (Desktop)</BodyText>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>Hover-Effects und Icon-Unterstützung</BodyText>
            </li>
          </ul>
        </div>
      </section>

      {/* AI Assistant Section */}
      <section id="ai-assistant">
        <div className="mb-8">
          <SectionHeading>AI Assistant Card</SectionHeading>
          <HintText>Prominente KI-Assistentin mit Quick-Actions</HintText>
        </div>

        <div className="border border-titanium/10 p-8 bg-obsidian-900">
          <AiAssistantCard
            onActionClick={(action) => console.log(`Clicked: ${action}`)}
          />
        </div>

        <div className="mt-6 p-6 border border-titanium/10 bg-obsidian-900 rounded-none">
          <SubHeading className="mb-4">Features</SubHeading>
          <ul className="space-y-2">
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>Security-Blue Accent mit Glass-Morphism-Effekt</BodyText>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>4 vorkonfigurierte Quick-Actions (erweiterbar)</BodyText>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>Beschreibender Footer mit KI-Kontextinformation</BodyText>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-security-blue mt-1">✓</span>
              <BodyText>Responsive Button-Grid (2 Cols mobile, 4 Cols desktop)</BodyText>
            </li>
          </ul>
        </div>
      </section>

      {/* Design System Section */}
      <section>
        <div className="mb-8">
          <SectionHeading>Design System</SectionHeading>
          <HintText>Hard-Edge Industrial UI für Enterprise-Anwendungen</HintText>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Colors */}
          <div className="border border-titanium/10 p-8 bg-obsidian-900">
            <SubHeading className="mb-4">Colors</SubHeading>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-obsidian border border-titanium/20" />
                <div>
                  <div className="text-xs font-semibold">Obsidian</div>
                  <HintText>#0A0A0B</HintText>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-titanium border border-titanium/20" />
                <div>
                  <div className="text-xs font-semibold text-obsidian">Titanium</div>
                  <HintText>#E2E2E2</HintText>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-security-blue" />
                <div>
                  <div className="text-xs font-semibold">Security Blue</div>
                  <HintText>#0052FF</HintText>
                </div>
              </div>
            </div>
          </div>

          {/* Severity Colors */}
          <div className="border border-titanium/10 p-8 bg-obsidian-900">
            <SubHeading className="mb-4">Severity</SubHeading>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-600" />
                <div>
                  <div className="text-xs font-semibold">Critical</div>
                  <HintText>#DC2626</HintText>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500" />
                <div>
                  <div className="text-xs font-semibold">High</div>
                  <HintText>#F97316</HintText>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500" />
                <div>
                  <div className="text-xs font-semibold">Medium</div>
                  <HintText>#F59E0B</HintText>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500" />
                <div>
                  <div className="text-xs font-semibold">Passed</div>
                  <HintText>#10B981</HintText>
                </div>
              </div>
            </div>
          </div>

          {/* Spacing & Radius */}
          <div className="border border-titanium/10 p-8 bg-obsidian-900">
            <SubHeading className="mb-4">Design Tokens</SubHeading>
            <div className="space-y-3">
              <div>
                <GroupLabel>Border Radius</GroupLabel>
                <HintText className="mt-1">Hard-Edge (0px) für Dashboard</HintText>
              </div>
              <div>
                <GroupLabel>Spacing</GroupLabel>
                <HintText className="mt-1">8px, 16px, 24px, 32px</HintText>
              </div>
              <div>
                <GroupLabel>Typography</GroupLabel>
                <HintText className="mt-1">Plus Jakarta Sans (Display)</HintText>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <DashboardLayout
      sidebar={sidebar}
      header={header}
      sections={[
        {
          title: '',
          content,
          span: 2,
        },
      ]}
    />
  );
}

// Import helper for form labels
const LabelText = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`text-sm font-semibold text-titanium uppercase tracking-wide ${className}`}>
    {children}
  </span>
);
