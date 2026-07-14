import { AlertTriangle, CheckCircle2, TrendingDown, Clock, Lock, Eye } from 'lucide-react';

export interface ComplianceGap {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'chain_integrity' | 'signature_gap' | 'stale_audit' | 'access_control' | 'verification_failure';
  asset_ref: string;
  message: string;
  recommendation: string;
  affected_seq?: number;
  timestamp?: Date;
}

interface ComplianceGapReportProps {
  gaps: ComplianceGap[];
  assetRef: string;
}

export function ComplianceGapReport({ gaps, assetRef }: ComplianceGapReportProps) {
  const severityColor = {
    critical: 'bg-risk-critical/10 text-risk-critical border-risk-critical/40',
    high: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
    medium: 'bg-amber-500/5 text-amber-200 border-amber-500/30',
    low: 'bg-titanium-800/20 text-titanium-300 border-titanium-800/40',
  };

  const severityIcons = {
    critical: <AlertTriangle className="h-5 w-5" />,
    high: <AlertTriangle className="h-4 w-4" />,
    medium: <TrendingDown className="h-4 w-4" />,
    low: <CheckCircle2 className="h-4 w-4" />,
  };

  const categoryLabels = {
    chain_integrity: 'Kettenintegrität',
    signature_gap: 'Signaturlücke',
    stale_audit: 'Veraltete Prüfung',
    access_control: 'Zugriffskontrolle',
    verification_failure: 'Verifikationsfehler',
  };

  const categoryIcons = {
    chain_integrity: <Lock className="h-4 w-4" />,
    signature_gap: <Eye className="h-4 w-4" />,
    stale_audit: <Clock className="h-4 w-4" />,
    access_control: <Lock className="h-4 w-4" />,
    verification_failure: <AlertTriangle className="h-4 w-4" />,
  };

  const criticalGaps = gaps.filter((g) => g.severity === 'critical');
  const highGaps = gaps.filter((g) => g.severity === 'high');
  const otherGaps = gaps.filter((g) => g.severity === 'medium' || g.severity === 'low');

  const complianceScore = Math.max(0, 100 - gaps.reduce((sum, g) => sum + (g.severity === 'critical' ? 25 : g.severity === 'high' ? 15 : g.severity === 'medium' ? 5 : 0), 0));

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="border border-titanium-800 bg-obsidian-900 p-4 text-center">
          <div className={`text-3xl font-bold font-display ${complianceScore >= 80 ? 'text-emerald-400' : complianceScore >= 60 ? 'text-amber-400' : 'text-risk-critical'}`}>
            {complianceScore}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-2">Compliance-Score</p>
        </div>

        <div className="border border-titanium-800 bg-obsidian-900 p-4 text-center">
          <div className="text-3xl font-bold font-display text-risk-critical">{criticalGaps.length}</div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-2">Kritische Lücken</p>
        </div>

        <div className="border border-titanium-800 bg-obsidian-900 p-4 text-center">
          <div className="text-3xl font-bold font-display text-amber-400">{highGaps.length}</div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-2">Hohe Lücken</p>
        </div>
      </div>

      {/* Critical Gaps */}
      {criticalGaps.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-risk-critical flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Kritische Probleme
          </h3>
          <div className="space-y-2">
            {criticalGaps.map((gap) => (
              <GapCard key={gap.id} gap={gap} severityColor={severityColor} categoryIcons={categoryIcons} categoryLabels={categoryLabels} />
            ))}
          </div>
        </div>
      )}

      {/* High Gaps */}
      {highGaps.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Hohe Priorität
          </h3>
          <div className="space-y-2">
            {highGaps.map((gap) => (
              <GapCard key={gap.id} gap={gap} severityColor={severityColor} categoryIcons={categoryIcons} categoryLabels={categoryLabels} />
            ))}
          </div>
        </div>
      )}

      {/* Other Gaps */}
      {otherGaps.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-titanium-300">Weitere Hinweise</h3>
          <div className="space-y-2">
            {otherGaps.map((gap) => (
              <GapCard key={gap.id} gap={gap} severityColor={severityColor} categoryIcons={categoryIcons} categoryLabels={categoryLabels} />
            ))}
          </div>
        </div>
      )}

      {gaps.length === 0 && (
        <div className="border border-emerald-500/40 bg-emerald-500/5 px-4 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
          <p className="font-semibold text-emerald-300">Keine Compliance-Lücken erkannt</p>
          <p className="text-xs text-emerald-200 mt-1">{assetRef} erfüllt alle Compliance-Anforderungen</p>
        </div>
      )}
    </div>
  );
}

function GapCard({
  gap,
  severityColor,
  categoryIcons,
  categoryLabels,
}: {
  gap: ComplianceGap;
  severityColor: Record<string, string>;
  categoryIcons: Record<string, React.ReactNode>;
  categoryLabels: Record<string, string>;
}) {
  return (
    <div className={`border p-4 ${severityColor[gap.severity]}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{categoryIcons[gap.category]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{gap.message}</p>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-black/30 rounded">
              {categoryLabels[gap.category]}
            </span>
          </div>
          <p className="text-xs mt-2 opacity-90">{gap.recommendation}</p>
          {gap.affected_seq !== undefined && (
            <p className="text-[10px] mt-2 opacity-75 font-mono">Event-Seq: {gap.affected_seq}</p>
          )}
        </div>
      </div>
    </div>
  );
}
