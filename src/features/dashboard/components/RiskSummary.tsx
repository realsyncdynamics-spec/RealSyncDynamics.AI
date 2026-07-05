import { AlertTriangle, AlertCircle, AlertOctagon, Info } from 'lucide-react';

interface RiskMetrics {
  critical_risks_count: number;
  high_risks_count: number;
  medium_risks_count: number;
  low_risks_count: number;
  open_incidents_count: number;
  overdue_remediations: number;
}

interface RiskSummaryProps {
  risks: RiskMetrics | null;
  totalRisks: number;
}

export function RiskSummary({ risks, totalRisks }: RiskSummaryProps) {
  if (!risks) {
    return (
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Summary</h3>
        <p className="text-titanium-400 text-sm">Loading risk data...</p>
      </div>
    );
  }

  const hasCriticalRisks = risks.critical_risks_count > 0;
  const hasHighRisks = risks.high_risks_count > 0;

  return (
    <div className={`${hasCriticalRisks ? 'bg-red-900/20 border-red-700' : hasHighRisks ? 'bg-orange-900/20 border-orange-700' : 'bg-obsidian-800 border-obsidian-700'} border rounded-lg p-6`}>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        Risk Summary
      </h3>

      {/* Risk Breakdown */}
      <div className="space-y-3 mb-6">
        {/* Critical */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <span className="text-sm text-titanium-300">Critical</span>
          </div>
          <span className="text-lg font-bold text-red-400">{risks.critical_risks_count}</span>
        </div>

        {/* High */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-titanium-300">High</span>
          </div>
          <span className="text-lg font-bold text-orange-400">{risks.high_risks_count}</span>
        </div>

        {/* Medium */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-titanium-300">Medium</span>
          </div>
          <span className="text-lg font-bold text-yellow-400">{risks.medium_risks_count}</span>
        </div>

        {/* Low */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-titanium-300">Low</span>
          </div>
          <span className="text-lg font-bold text-blue-400">{risks.low_risks_count}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-obsidian-700 py-4 my-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-titanium-400">Open Incidents</span>
          <span className="font-semibold text-titanium-200">{risks.open_incidents_count}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-titanium-400">Overdue Remediations</span>
          <span className="font-semibold text-red-400">{risks.overdue_remediations}</span>
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between bg-obsidian-900/50 rounded px-3 py-2 border border-obsidian-700">
        <span className="text-sm font-semibold text-titanium-300">Total Active Risks</span>
        <span className="text-2xl font-bold text-petrol-400">{totalRisks}</span>
      </div>
    </div>
  );
}
