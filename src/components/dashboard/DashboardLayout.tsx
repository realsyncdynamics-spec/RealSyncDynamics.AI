import React from 'react';
import { SPACING } from '../../config/design-tokens';

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  kpiGrid?: React.ReactNode;
  aiAssistant?: React.ReactNode;
  sections?: {
    title: string;
    content: React.ReactNode;
    span?: 1 | 2;
  }[];
  footer?: React.ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  sidebar,
  header,
  kpiGrid,
  aiAssistant,
  sections = [],
  footer,
  className = '',
}) => {
  return (
    <div className={`min-h-screen bg-obsidian flex ${className}`}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-titanium/10 bg-obsidian-950 overflow-y-auto">
        <div className="sticky top-0 p-6 border-b border-titanium/10 bg-obsidian">
          {/* Logo placeholder */}
          <div className="h-8 bg-gradient-to-r from-security-blue to-security-blue/50 rounded-none" />
        </div>
        <nav className="p-4">{sidebar}</nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {header && (
          <header className="border-b border-titanium/10 bg-obsidian-950 px-8 py-6">
            {header}
          </header>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-12">
            {/* KPI Grid - Primary */}
            {kpiGrid && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-titanium/60 mb-4">
                  Key Performance Indicators
                </h2>
                {kpiGrid}
              </section>
            )}

            {/* AI Assistant - Prominent */}
            {aiAssistant && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-titanium/60 mb-4">
                  AI Compliance Assistant
                </h2>
                {aiAssistant}
              </section>
            )}

            {/* Secondary Sections */}
            {sections.length > 0 && (
              <section className="space-y-8">
                <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
                  {sections.map((section, idx) => (
                    <div
                      key={idx}
                      className={`${
                        section.span === 2
                          ? 'lg:col-span-2'
                          : ''
                      }`}
                    >
                      <h3 className="text-sm font-semibold text-titanium mb-4">
                        {section.title}
                      </h3>
                      {section.content}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <footer className="border-t border-titanium/10 bg-obsidian-950 px-8 py-4">
            {footer}
          </footer>
        )}
      </main>
    </div>
  );
};
