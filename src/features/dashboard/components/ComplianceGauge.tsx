import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface ComplianceGaugeProps {
  score: number;
  trend?: 'improving' | 'stable' | 'declining';
  showBaseline?: boolean;
  baselineScore?: number;
}

export function ComplianceGauge({
  score,
  trend = 'stable',
  showBaseline = false,
  baselineScore = 65,
}: ComplianceGaugeProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <ArrowUp className="w-4 h-4 text-green-400" />;
      case 'declining':
        return <ArrowDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getTrendLabel = () => {
    switch (trend) {
      case 'improving':
        return 'Improving';
      case 'declining':
        return 'Declining';
      default:
        return 'Stable';
    }
  };

  const getScoreColor = (s: number) => {
    if (s >= 70) return '#10b981';
    if (s >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabelColor = (s: number) => {
    if (s >= 70) return 'text-green-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreCategory = (s: number) => {
    if (s >= 70) return 'Green';
    if (s >= 40) return 'Orange';
    return 'Red';
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const baselineStrokeDashoffset = circumference - (baselineScore / 100) * circumference;

  return (
    <div className="w-full space-y-6">
      {/* Circular Gauge */}
      <div className="flex justify-center">
        <div className="relative w-60 h-60">
          {/* Baseline Ring (if enabled) */}
          {showBaseline && (
            <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#374151"
                strokeWidth="3"
                opacity="0.3"
              />
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={baselineStrokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
          )}

          {/* Main Gauge */}
          <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background Circle */}
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="#1f2937"
              strokeWidth="6"
            />

            {/* Gauge Circle */}
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={getScoreColor(score)}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-5xl font-bold ${getScoreLabelColor(score)}`}>{score}</div>
            <div className="text-xs text-titanium-400 mt-1">/100</div>
            <div className={`text-xs font-semibold mt-3 px-2 py-1 rounded-full ${
              score >= 70
                ? 'bg-green-500/10 text-green-400'
                : score >= 40
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
            }`}>
              {getScoreCategory(score)}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-4 text-center">
        {/* Trend */}
        <div className="flex items-center justify-center gap-2">
          {getTrendIcon()}
          <span className="text-sm font-medium text-titanium-300">{getTrendLabel()} trend</span>
        </div>

        {/* Baseline Comparison */}
        {showBaseline && (
          <div className="text-xs text-titanium-400">
            <span className="text-amber-400 font-semibold">{baselineScore}</span> is baseline
            ({baselineScore > score ? 'above' : baselineScore < score ? 'below' : 'equal'} your score)
          </div>
        )}

        {/* Score Interpretation */}
        <div className="text-xs text-titanium-400 pt-2 border-t border-titanium-300/10">
          {score >= 70 && <span>Strong compliance posture. Continue monitoring for improvements.</span>}
          {score >= 40 && score < 70 && <span>Moderate compliance. Address identified gaps to strengthen posture.</span>}
          {score < 40 && <span>Low compliance. Immediate remediation required for critical findings.</span>}
        </div>
      </div>
    </div>
  );
}
