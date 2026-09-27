/**
 * Compliance KPI row — score_overall, riskTrend, criticalFindings, incidents/deadlines
 * + optional breakdown chips. Null → EmptyState "—"; measured 0 stays "0".
 */
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Minus,
  ShieldCheck,
  Siren,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  BREAKDOWN_CHIP_DEFS,
  formatComplianceMetric,
  formatRiskTrend,
  type ComplianceKpiSnapshot,
  type RiskTrendDirection,
} from './complianceTypes';

function TrendIcon({ direction }: { direction: RiskTrendDirection | null }) {
  if (direction === 'improving') return <TrendingUp className="h-5 w-5 text-emerald-400" />;
  if (direction === 'declining') return <TrendingDown className="h-5 w-5 text-rose-400" />;
  if (direction === 'stable') return <Minus className="h-5 w-5 text-titanium-400" />;
  return <Minus className="h-5 w-5 text-titanium-600" />;
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  emptyHint = 'Keine Messung',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  emptyHint?: string;
}) {
  const isEmpty = value === '—';
  return (
    <div className="bg-obsidian border border-titanium/20 rounded-none p-4 min-h-[112px]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-mono uppercase tracking-[0.14em] text-titanium-500">{label}</p>
        <div className="text-titanium-500">{icon}</div>
      </div>
      <p
        className={`font-display font-bold text-2xl tracking-tight ${
          isEmpty ? 'text-titanium-600' : 'text-titanium-50'
        }`}
        data-empty={isEmpty ? 'true' : 'false'}
      >
        {value}
      </p>
      <p className="text-xs text-titanium-500 mt-1.5">
        {isEmpty ? emptyHint : hint}
      </p>
    </div>
  );
}

function BreakdownChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const isEmpty = value === '—';
  return (
    <div
      className="inline-flex items-center gap-2 border border-titanium/15 bg-obsidian-900 px-3 py-1.5 rounded-none"
      data-empty={isEmpty ? 'true' : 'false'}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</span>
      <span className={`font-mono text-sm ${isEmpty ? 'text-titanium-600' : 'text-titanium-100'}`}>
        {value}
      </span>
    </div>
  );
}

export interface ComplianceKpiRowProps {
  compliance: ComplianceKpiSnapshot;
  className?: string;
  showBreakdown?: boolean;
}

export function ComplianceKpiRow({
  compliance,
  className = '',
  showBreakdown = true,
}: ComplianceKpiRowProps) {
  const incidentsHint =
    compliance.resolvedIncidents === null && compliance.upcomingDeadlines === null
      ? undefined
      : [
          compliance.resolvedIncidents !== null
            ? `${formatComplianceMetric(compliance.resolvedIncidents)} gelöst`
            : null,
          compliance.upcomingDeadlines !== null
            ? `${formatComplianceMetric(compliance.upcomingDeadlines)} Fristen`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined;

  return (
    <section className={`space-y-4 ${className}`} aria-label="Compliance KPI">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="score_overall"
          value={formatComplianceMetric(compliance.score_overall)}
          hint="compliance_score_history"
          emptyHint="Kein Score-Eintrag"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <KpiCard
          label="riskTrendDirection"
          value={formatRiskTrend(compliance.riskTrendDirection)}
          hint={compliance.riskTrendDirection ?? undefined}
          emptyHint="Trend unbekannt"
          icon={<TrendIcon direction={compliance.riskTrendDirection} />}
        />
        <KpiCard
          label="criticalFindings"
          value={formatComplianceMetric(compliance.criticalFindings)}
          hint="Letztes Audit"
          emptyHint="Kein Audit-Befund"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          label="newIncidents"
          value={formatComplianceMetric(compliance.newIncidents)}
          hint={incidentsHint ?? '24h geöffnet'}
          emptyHint="Incidents nicht belegbar"
          icon={
            compliance.upcomingDeadlines !== null
              ? <CalendarClock className="h-5 w-5" />
              : <Siren className="h-5 w-5" />
          }
        />
      </div>

      {showBreakdown && (
        <div className="flex flex-wrap gap-2" aria-label="Score Breakdown">
          {BREAKDOWN_CHIP_DEFS.map((chip) => (
            <BreakdownChip
              key={chip.key}
              label={chip.label}
              value={formatComplianceMetric(compliance.score_breakdown[chip.key])}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default ComplianceKpiRow;
