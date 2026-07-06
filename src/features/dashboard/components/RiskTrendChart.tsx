import { Download } from 'lucide-react';

interface RiskDataPoint {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  score: number;
}

interface RiskTrendChartProps {
  data: RiskDataPoint[];
  title?: string;
  showExportButton?: boolean;
}

export function RiskTrendChart({
  data,
  title = '30-Day Risk Trend',
  showExportButton = false,
}: RiskTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-titanium-400">
        No risk data available
      </div>
    );
  }

  const maxRisks = Math.max(
    ...data.map((d) => d.critical + d.high + d.medium + d.low)
  ) || 1;
  const height = 300;
  const width = 100 * data.length;
  const padding = 40;

  // Calculate stacked area points
  const getPoints = (property: keyof Omit<RiskDataPoint, 'date' | 'score'>) => {
    return data.map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * (width - padding * 2) + padding;
      let y = height - padding;

      // Add up all risks up to this severity level
      const baseRisks = d.critical + d.high + d.medium + d.low;
      const risksBelowThis =
        (property === 'critical' ? 0 :
         property === 'high' ? d.critical :
         property === 'medium' ? d.critical + d.high :
         d.critical + d.high + d.medium);

      const risksUpTo = risksBelowThis + d[property];
      y = height - padding - ((risksUpTo / maxRisks) * (height - padding * 2));

      return `${x},${y}`;
    });
  };

  const getCriticalPoints = () => getPoints('critical');
  const getHighPoints = () => getPoints('high');
  const getMediumPoints = () => getPoints('medium');
  const getLowPoints = () => getPoints('low');

  // Get x coordinates for data points
  const xCoordinates = data.map(
    (_, i) => (i / Math.max(data.length - 1, 1)) * (width - padding * 2) + padding
  );

  // Build SVG paths for stacked area
  const buildAreaPath = (topPoints: string[], bottomPoints: string[]) => {
    if (topPoints.length === 0) return '';
    const reversedBottom = bottomPoints.reverse();
    return `M${topPoints.join('L')}L${reversedBottom.join('L')}Z`;
  };

  // Calculate all cumulative points
  const criticalOnlyPoints = getCriticalPoints();
  const highPoints = data.map((d, i) => {
    const x = xCoordinates[i];
    const baseRisks = d.critical + d.high + d.medium + d.low;
    const risksUpTo = d.critical + d.high;
    const y = height - padding - ((risksUpTo / maxRisks) * (height - padding * 2));
    return `${x},${y}`;
  });
  const mediumPoints = data.map((d, i) => {
    const x = xCoordinates[i];
    const baseRisks = d.critical + d.high + d.medium + d.low;
    const risksUpTo = d.critical + d.high + d.medium;
    const y = height - padding - ((risksUpTo / maxRisks) * (height - padding * 2));
    return `${x},${y}`;
  });
  const lowPoints = data.map((d, i) => {
    const x = xCoordinates[i];
    const baseRisks = d.critical + d.high + d.medium + d.low;
    const y = height - padding - ((baseRisks / maxRisks) * (height - padding * 2));
    return `${x},${y}`;
  });

  const handleExport = () => {
    // Simple CSV export
    const csv = [
      ['Date', 'Critical', 'High', 'Medium', 'Low', 'Score'],
      ...data.map((d) => [
        d.date,
        d.critical.toString(),
        d.high.toString(),
        d.medium.toString(),
        d.low.toString(),
        d.score.toString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-trend-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-titanium-50">{title}</h3>
        {showExportButton && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-obsidian-800 border border-titanium-300/20 text-titanium-400 hover:text-titanium-50 hover:border-titanium-300/40 transition-colors text-xs font-medium"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="bg-obsidian-800/50 rounded-lg p-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ minWidth: `${Math.max(600, width)}px` }}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => (
            <line
              key={`grid-${percent}`}
              x1={padding}
              y1={(height * (100 - percent)) / 100}
              x2={width - padding}
              y2={(height * (100 - percent)) / 100}
              stroke="#1f2937"
              strokeWidth="0.5"
            />
          ))}

          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map((percent) => (
            <text
              key={`label-${percent}`}
              x={padding - 10}
              y={(height * (100 - percent)) / 100 + 4}
              fontSize="12"
              fill="#6b7280"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {Math.round((percent / 100) * maxRisks)}
            </text>
          ))}

          {/* Stacked area paths */}
          {/* Critical risks (red) */}
          <path
            d={buildAreaPath(criticalOnlyPoints, criticalOnlyPoints.map(() => `${padding},${height - padding}`))}
            fill="rgba(239, 68, 68, 0.2)"
            stroke="none"
          />

          {/* High risks (orange) */}
          <path
            d={`M${criticalOnlyPoints.join('L')}L${highPoints.reverse().join('L')}Z`}
            fill="rgba(245, 158, 11, 0.2)"
            stroke="none"
          />

          {/* Medium risks (yellow) */}
          <path
            d={`M${highPoints.join('L')}L${mediumPoints.reverse().join('L')}Z`}
            fill="rgba(250, 204, 21, 0.2)"
            stroke="none"
          />

          {/* Low risks (green) */}
          <path
            d={`M${mediumPoints.join('L')}L${lowPoints.reverse().join('L')}Z`}
            fill="rgba(34, 197, 94, 0.2)"
            stroke="none"
          />

          {/* Outline */}
          <polyline
            points={lowPoints.join(' ')}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-4 gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-titanium-400">Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-titanium-400">High</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-titanium-400">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-titanium-400">Low</span>
        </div>
      </div>
    </div>
  );
}
