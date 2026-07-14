import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle2, AlertCircle, Loader2,
  Zap, Mail, Calendar, ChevronRight,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface Nis2Deadline {
  id: string;
  incident_id: string;
  incident_title?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  full_notification_deadline: string;
  full_notification_sent: boolean;
  hours_remaining: number;
  status: 'completed' | 'overdue' | 'critical' | 'urgent' | 'on_track';
  competent_authority: string;
  created_at: string;
}

export function Nis2IncidentsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [deadlines, setDeadlines] = useState<Nis2Deadline[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setDeadlines(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=nis2_deadline`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setDeadlines(data.deadlines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  const overdueCount = deadlines?.filter(d => d.status === 'overdue').length || 0;
  const criticalCount = deadlines?.filter(d => d.status === 'critical').length || 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-sm">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">NIS2-Incident-Fristen</div>
              <div className="text-[11px] text-titanium-400 font-medium">Richtlinie (EU) 2022/2555 · Meldepflichten</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Alert Boxes */}
        {overdueCount > 0 && (
          <div className="mb-4 flex items-start gap-3 text-sm bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
            <div>
              <div className="font-semibold text-red-300">{overdueCount} Meldung(en) überfällig!</div>
              <div className="text-red-200 text-xs mt-1">Melden Sie diese Vorfälle sofort der zuständigen Behörde.</div>
            </div>
          </div>
        )}

        {criticalCount > 0 && (
          <div className="mb-4 flex items-start gap-3 text-sm bg-amber-950/50 border border-amber-900 rounded-none p-3">
            <Zap className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <div className="font-semibold text-amber-300">{criticalCount} Vorfall(e) kritisch!</div>
              <div className="text-amber-200 text-xs mt-1">Weniger als 24 Stunden bis zur Frist. Handeln Sie sofort.</div>
            </div>
          </div>
        )}

        {/* Explanation */}
        <div className="mb-8 bg-obsidian-900 border border-titanium-900 rounded-none p-4">
          <h3 className="font-semibold text-titanium-50 mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> NIS2-Meldepflichten
          </h3>
          <p className="text-[12px] text-titanium-300 mb-3">
            Die NIS2-Richtlinie (RL 2022/2555) verpflichtet Betreiber kritischer Infrastrukturen, Sicherheitsvorfälle zu melden:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
            <div className="flex gap-2">
              <Calendar className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-300">6 Stunden</div>
                <div className="text-titanium-400">Erstbewertung nach Vorfall-Erkennung</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Mail className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-blue-300">24 Stunden</div>
                <div className="text-titanium-400">Vereinfachte Meldung (optional)</div>
              </div>
            </div>
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-300">72 Stunden</div>
                <div className="text-titanium-400">Vollständige Benachrichtigung der Behörde</div>
              </div>
            </div>
          </div>
        </div>

        {/* Deadlines List */}
        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : deadlines === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : deadlines.length === 0 ? (
          <div className="text-center py-12 bg-obsidian-900 border border-titanium-900 rounded-none">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <h3 className="font-semibold text-titanium-50 mb-1">Keine ausstehenden Meldungen</h3>
            <p className="text-titanium-400 text-sm">Alle NIS2-Meldepflichten sind erfüllt oder es liegen keine aktuellen Vorfälle vor.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deadlines.sort((a, b) => {
              const statusOrder = { overdue: 0, critical: 1, urgent: 2, on_track: 3, completed: 4 };
              return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
            }).map((deadline) => (
              <DeadlineCard key={deadline.id} deadline={deadline} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DeadlineCard({ deadline }: { deadline: Nis2Deadline }) {
  const statusConfig = {
    completed: { bg: 'bg-green-950', border: 'border-green-900', text: 'text-green-300', label: '✓ Meldung gesendet', icon: CheckCircle2 },
    overdue: { bg: 'bg-red-950', border: 'border-red-900', text: 'text-red-300', label: '✗ Überfällig', icon: AlertTriangle },
    critical: { bg: 'bg-red-900', border: 'border-red-800', text: 'text-red-100', label: '⚠ Kritisch (< 24h)', icon: Zap },
    urgent: { bg: 'bg-amber-900', border: 'border-amber-800', text: 'text-amber-100', label: '⚠ Dringend (< 48h)', icon: Clock },
    on_track: { bg: 'bg-blue-950', border: 'border-blue-900', text: 'text-blue-300', label: '⏳ Im Plan', icon: AlertCircle },
  }[deadline.status];

  const StatusIcon = statusConfig?.icon || AlertCircle;

  return (
    <div className={`${statusConfig?.bg} border ${statusConfig?.border} rounded-none p-4 hover:shadow-lg transition-shadow`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">
          <StatusIcon className={`h-5 w-5 ${statusConfig?.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h4 className="font-semibold text-titanium-50">{deadline.incident_title || `Incident #${deadline.incident_id.slice(0, 8)}`}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-none ${
                  deadline.severity === 'critical' ? 'bg-red-600 text-white' :
                  deadline.severity === 'high' ? 'bg-orange-600 text-white' :
                  deadline.severity === 'medium' ? 'bg-yellow-600 text-white' :
                  'bg-titanium-700 text-titanium-200'
                }`}>
                  {deadline.severity.toUpperCase()}
                </span>
                <span className={`text-[11px] ${statusConfig?.text}`}>
                  {statusConfig?.label}
                </span>
              </div>
            </div>

            <div className="text-right">
              {!deadline.full_notification_sent && (
                <div className="text-[12px]">
                  <div className={`font-mono font-bold ${
                    deadline.hours_remaining < 6 ? 'text-red-300' :
                    deadline.hours_remaining < 24 ? 'text-amber-300' :
                    'text-blue-300'
                  }`}>
                    {Math.round(deadline.hours_remaining)}h
                  </div>
                  <div className={`text-[11px] ${
                    deadline.hours_remaining < 6 ? 'text-red-400' :
                    deadline.hours_remaining < 24 ? 'text-amber-400' :
                    'text-titanium-400'
                  }`}>
                    bis Frist
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-[11px]">
              <Calendar className="h-3 w-3 text-titanium-500" />
              <span className="text-titanium-400">Frist:</span>
              <span className="font-mono text-titanium-200">{new Date(deadline.full_notification_deadline).toLocaleString('de-DE')}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <Mail className="h-3 w-3 text-titanium-500" />
              <span className="text-titanium-400">Behörde:</span>
              <span className="font-mono text-titanium-200">{deadline.competent_authority}</span>
            </div>
          </div>

          {/* Action */}
          <Link
            to={`/app/incidents/${deadline.incident_id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold hover:underline text-blue-400 hover:text-blue-300"
          >
            Vorfall-Details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Progress Bar for countdown */}
      {!deadline.full_notification_sent && deadline.hours_remaining > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-titanium-400">Countdown bis 72h-Frist:</span>
            <div className="flex-1 h-1 bg-white/10 rounded-none overflow-hidden">
              <div
                className={`h-full transition-all ${
                  deadline.hours_remaining < 6 ? 'bg-red-500' :
                  deadline.hours_remaining < 24 ? 'bg-amber-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (72 - deadline.hours_remaining) / 72 * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
