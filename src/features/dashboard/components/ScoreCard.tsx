import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface ScoreCardProps {
  score: number;
  trend?: 'improving' | 'stable' | 'declining';
  frameworks?: {
    gdpr?: number;
    nis2?: number;
    dsa?: number;
    aiAct?: number;
  };
}

export function ScoreCard({ score, trend = 'stable', frameworks = {} }: ScoreCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <ArrowUp className="w-5 h-5 text-green-500" />;
      case 'declining':
        return <ArrowDown className="w-5 h-5 text-red-500" />;
      default:
        return <Minus className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBgColor = () => {
    if (score >= 80) return 'bg-green-900/20 border-green-700';
    if (score >= 60) return 'bg-yellow-900/20 border-yellow-700';
    return 'bg-red-900/20 border-red-700';
  };

  return (
    <div className={`${getScoreBgColor()} border rounded-lg p-8`}>
      {/* Score Display */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-titanium-400 text-sm font-semibold mb-2">Overall Compliance Score</h2>
          <div className="flex items-baseline gap-3">
            <span className={`text-6xl font-bold ${getScoreColor()}`}>{score}</span>
            <span className="text-2xl text-titanium-400">/100</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon()}
            <span className="text-sm font-semibold text-titanium-300 capitalize">{trend}</span>
          </div>
          <div className="text-xs text-titanium-500">vs. last assessment</div>
        </div>
      </div>

      {/* Framework Scores */}
      {Object.keys(frameworks).length > 0 && (
        <div className="grid grid-cols-2 gap-4 border-t border-obsidian-700 pt-6">
          {frameworks.gdpr !== undefined && (
            <div>
              <div className="text-xs text-titanium-500 mb-1">GDPR</div>
              <div className="text-2xl font-bold text-petrol-400">{frameworks.gdpr}</div>
            </div>
          )}
          {frameworks.nis2 !== undefined && (
            <div>
              <div className="text-xs text-titanium-500 mb-1">NIS2</div>
              <div className="text-2xl font-bold text-petrol-400">{frameworks.nis2}</div>
            </div>
          )}
          {frameworks.dsa !== undefined && (
            <div>
              <div className="text-xs text-titanium-500 mb-1">DSA</div>
              <div className="text-2xl font-bold text-petrol-400">{frameworks.dsa}</div>
            </div>
          )}
          {frameworks.aiAct !== undefined && (
            <div>
              <div className="text-xs text-titanium-500 mb-1">AI Act</div>
              <div className="text-2xl font-bold text-petrol-400">{frameworks.aiAct}</div>
            </div>
          )}
        </div>
      )}

      {/* Score Gauge */}
      <div className="mt-6 pt-6 border-t border-obsidian-700">
        <div className="w-full bg-obsidian-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-full transition-all duration-500"
            style={{ width: `${score}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
