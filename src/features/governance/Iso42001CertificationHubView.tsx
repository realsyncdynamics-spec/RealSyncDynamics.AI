import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Brain, Loader2, AlertTriangle, CheckCircle2, ArrowRight,
  Target, BookOpen, Shield, FileText, Zap, BarChart3, Clock, Calendar, Archive,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface CertificationStatus {
  overall_score: number;
  status: 'not_started' | 'in_progress' | 'ready_for_audit' | 'under_audit' | 'certified';
  last_updated: string;
  controls_count: {
    total: number;
    implemented: number;
    in_progress: number;
  };
  timeline_weeks: number;
}

const CERTIFICATION_MODULES = [
  {
    id: 'controls',
    title: 'Controls Library',
    description: 'Browse and manage all ISO 42001 controls with implementation guidance',
    icon: BookOpen,
    route: '/app/governance/iso42001-library',
    color: 'blue',
    badge: 'Library',
  },
  {
    id: 'implementation',
    title: 'Control Implementations',
    description: 'Track status and maturity of each ISO 42001 control implementation',
    icon: CheckCircle2,
    route: '/app/governance/iso42001',
    color: 'green',
    badge: 'Live',
  },
  {
    id: 'readiness',
    title: 'Readiness Assessment',
    description: 'Comprehensive certification readiness analysis with timeline estimates',
    icon: Target,
    route: '/app/governance/iso42001-readiness',
    color: 'purple',
    badge: 'Analytics',
  },
  {
    id: 'auditors',
    title: 'Auditor Engagement',
    description: 'Manage auditors, control assignments, and audit findings',
    icon: Shield,
    route: '/app/governance/iso42001-auditors',
    color: 'orange',
    badge: 'Active',
  },
  {
    id: 'reports',
    title: 'Report Generator',
    description: 'Generate professional certification reports in multiple formats',
    icon: FileText,
    route: '/app/governance/iso42001-reports',
    color: 'indigo',
    badge: 'Export',
  },
  {
    id: 'evidence',
    title: 'Evidence Vault',
    description: 'Upload, organize, and track compliance evidence artifacts',
    icon: Archive,
    route: '/app/governance/iso42001-evidence',
    color: 'emerald',
    badge: 'Storage',
  },
  {
    id: 'gaps',
    title: 'Gap Analysis',
    description: 'Identify compliance gaps and prioritize remediation efforts',
    icon: AlertCircle,
    route: '/app/governance/iso42001-gaps',
    color: 'red',
    badge: 'Analysis',
  },
  {
    id: 'remediation',
    title: 'Remediation Workflow',
    description: 'Track remediation tasks, assign owners, and monitor progress',
    icon: Wrench,
    route: '/app/governance/iso42001-remediation',
    color: 'amber',
    badge: 'Execution',
  },
  {
    id: 'timeline',
    title: 'Certification Timeline',
    description: 'Project timeline to certification with critical milestones',
    icon: Clock,
    route: '#timeline',
    color: 'cyan',
    badge: 'Planning',
    comingSoon: true,
  },
];

const QUICK_ACTIONS = [
  {
    title: 'Start New Control',
    description: 'Begin implementation of an unstarted control',
    icon: Zap,
    action: 'new-control',
  },
  {
    title: 'Schedule Audit',
    description: 'Plan and schedule the certification audit',
    icon: Calendar,
    action: 'schedule-audit',
  },
  {
    title: 'Review Findings',
    description: 'Check latest audit findings and remediation status',
    icon: AlertTriangle,
    action: 'review-findings',
  },
  {
    title: 'Generate Report',
    description: 'Create a certification report for stakeholders',
    icon: FileText,
    action: 'generate-report',
  },
];

function _Iso42001CertificationHubView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const Iso42001CertificationHubView = withPerformanceMonitoring(
  _Iso42001CertificationHubView,
  'Iso42001CertificationHubView',
  { threshold: 2000, maxRenders: 8 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [status, setStatus] = useState<CertificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/certification-readiness?tenant_id=${activeTenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load status');
      const data = await response.json();

      setStatus({
        overall_score: data.overall_score,
        status: 'in_progress',
        last_updated: new Date().toISOString(),
        controls_count: {
          total: data.total_controls,
          implemented: data.implemented_controls,
          in_progress: data.in_progress_controls,
        },
        timeline_weeks: data.resources.weeks_until_ready,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [activeTenantId]);

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Tenant wählen.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">ISO 42001 Hub</div>
              <div className="text-[11px] text-titanium-400 font-medium">AI Management System Zertifizierung</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Status Overview */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-titanium-500" />
            </div>
          ) : status ? (
            <StatusOverview status={status} />
          ) : null}

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold text-titanium-50 mb-4">Schnelleinstiege</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard key={action.action} action={action} />
              ))}
            </div>
          </div>

          {/* Certification Modules */}
          <div>
            <h2 className="text-lg font-semibold text-titanium-50 mb-4">Zertifizierungsmodule</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {CERTIFICATION_MODULES.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          </div>

          {/* Help & Resources */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h3 className="font-semibold text-titanium-50 mb-4 text-[12px] uppercase tracking-wide">
              Hilfe & Ressourcen
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-obsidian-800 border border-titanium-900 rounded-none">
                <h4 className="font-semibold text-titanium-50 text-[12px] mb-2">Dokumentation</h4>
                <p className="text-[11px] text-titanium-400 mb-3">
                  Umfassender Leitfaden zur ISO 42001 Implementierung
                </p>
                <a href="#" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">
                  Zum Wiki →
                </a>
              </div>

              <div className="p-3 bg-obsidian-800 border border-titanium-900 rounded-none">
                <h4 className="font-semibold text-titanium-50 text-[12px] mb-2">Support</h4>
                <p className="text-[11px] text-titanium-400 mb-3">
                  Fragen zur Zertifizierung? Kontaktieren Sie unser Team
                </p>
                <a href="mailto:certification@realsyncdynamics.ai" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">
                  E-Mail schreiben →
                </a>
              </div>

              <div className="p-3 bg-obsidian-800 border border-titanium-900 rounded-none">
                <h4 className="font-semibold text-titanium-50 text-[12px] mb-2">Status</h4>
                <p className="text-[11px] text-titanium-400 mb-3">
                  Sehen Sie den aktuellen Zertifizierungsstatus
                </p>
                <Link to="/app/governance/iso42001-readiness" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">
                  Zur Übersicht →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusOverview({ status }: { status: CertificationStatus }) {
  const statusColors = {
    not_started: 'from-gray-900 to-slate-900 border-gray-800',
    in_progress: 'from-yellow-900 to-orange-900 border-yellow-800',
    ready_for_audit: 'from-blue-900 to-cyan-900 border-blue-800',
    under_audit: 'from-purple-900 to-pink-900 border-purple-800',
    certified: 'from-green-900 to-emerald-900 border-green-800',
  };

  const statusLabel = {
    not_started: 'Nicht gestartet',
    in_progress: 'In Bearbeitung',
    ready_for_audit: 'Bereit zur Prüfung',
    under_audit: 'Unter Prüfung',
    certified: 'Zertifiziert',
  };

  return (
    <div className={`bg-gradient-to-r ${statusColors[status.status]} border rounded-none p-8`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <div className="text-[11px] text-white/80 uppercase font-semibold tracking-wide mb-2">
            Zertifizierungsstatus
          </div>
          <div className="text-3xl font-bold text-white mb-1">{statusLabel[status.status]}</div>
          <div className="text-[11px] text-white/70">
            Aktualisiert {new Date(status.last_updated).toLocaleDateString('de-DE')}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-white/80 uppercase font-semibold tracking-wide mb-2">
            Gesamtfortschritt
          </div>
          <div className="text-3xl font-bold text-white">{status.overall_score}%</div>
          <div className="h-2 bg-white/20 rounded-none mt-2 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: `${status.overall_score}%` }}
            />
          </div>
        </div>

        <div>
          <div className="text-[11px] text-white/80 uppercase font-semibold tracking-wide mb-2">
            Kontrollen
          </div>
          <div className="text-3xl font-bold text-white">{status.controls_count.implemented}</div>
          <div className="text-[11px] text-white/70">
            von {status.controls_count.total} implementiert
          </div>
        </div>

        <div>
          <div className="text-[11px] text-white/80 uppercase font-semibold tracking-wide mb-2">
            Geschätzte Timeline
          </div>
          <div className="text-3xl font-bold text-white">{status.timeline_weeks}</div>
          <div className="text-[11px] text-white/70">Wochen bis Fertigstellung</div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ action }: { action: (typeof QUICK_ACTIONS)[0] }) {
  const Icon = action.icon;

  return (
    <button className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 hover:border-titanium-700 hover:bg-obsidian-800/50 transition-all text-left group">
      <div className="flex items-start gap-3 mb-3">
        <Icon className="h-5 w-5 text-blue-400 group-hover:text-blue-300 shrink-0" />
      </div>
      <h4 className="font-semibold text-titanium-50 text-[12px] group-hover:text-white mb-1">
        {action.title}
      </h4>
      <p className="text-[11px] text-titanium-400">{action.description}</p>
    </button>
  );
}

function ModuleCard({ module }: { module: (typeof CERTIFICATION_MODULES)[0] }) {
  const Icon = module.icon;

  const colorMap = {
    blue: 'border-blue-900 hover:bg-blue-950/20 text-blue-400',
    green: 'border-green-900 hover:bg-green-950/20 text-green-400',
    purple: 'border-purple-900 hover:bg-purple-950/20 text-purple-400',
    orange: 'border-orange-900 hover:bg-orange-950/20 text-orange-400',
    indigo: 'border-indigo-900 hover:bg-indigo-950/20 text-indigo-400',
    cyan: 'border-cyan-900 hover:bg-cyan-950/20 text-cyan-400',
    red: 'border-red-900 hover:bg-red-950/20 text-red-400',
    amber: 'border-amber-900 hover:bg-amber-950/20 text-amber-400',
  };

  const BadgeColor = {
    blue: 'bg-blue-950 border-blue-800 text-blue-300',
    green: 'bg-green-950 border-green-800 text-green-300',
    purple: 'bg-purple-950 border-purple-800 text-purple-300',
    orange: 'bg-orange-950 border-orange-800 text-orange-300',
    indigo: 'bg-indigo-950 border-indigo-800 text-indigo-300',
    cyan: 'bg-cyan-950 border-cyan-800 text-cyan-300',
    red: 'bg-red-950 border-red-800 text-red-300',
    amber: 'bg-amber-950 border-amber-800 text-amber-300',
  };

  const content = (
    <div className={`bg-obsidian-900 border ${colorMap[module.color]} rounded-none p-4 transition-all h-full flex flex-col ${module.comingSoon ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <Icon className="h-6 w-6 shrink-0" />
        <span className={`text-[10px] px-2 py-1 border rounded-none font-semibold ${BadgeColor[module.color]}`}>
          {module.badge}
        </span>
      </div>

      <h3 className="font-semibold text-titanium-50 text-[13px] mb-2">{module.title}</h3>
      <p className="text-[11px] text-titanium-400 mb-4 flex-1">{module.description}</p>

      <div className="flex items-center gap-2 text-[11px] font-semibold">
        {module.comingSoon ? (
          <span className="text-titanium-500">Coming Soon</span>
        ) : (
          <>
            <span>Öffnen</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </>
        )}
      </div>
    </div>
  );

  if (module.comingSoon) {
    return content;
  }

  return (
    <Link to={module.route} className="group">
      {content}
    </Link>
  );
}
