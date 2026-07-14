interface Score {
  score_overall: number;
  recorded_at: string;
}

interface TrendChartProps {
  data: Score[];
}

export function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-titanium-400">
        No data available
      </div>
    );
  }

  const maxScore = 100;
  const minScore = Math.min(...data.map((d) => d.score_overall));
  const range = maxScore - minScore || 1;

  // Create SVG points for polyline
  const width = 100 * (data.length - 1) || 100;
  const height = 200;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * (width - padding * 2) + padding;
    const y =
      height -
      ((d.score_overall - minScore) / range) * (height - padding * 2) -
      padding;
    return `${x},${y}`;
  });

  return (
    <div className="flex flex-col h-64">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="flex-1"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((percent) => (
          <line
            key={`grid-${percent}`}
            x1="0"
            y1={(height * (100 - percent)) / 100}
            x2={width}
            y2={(height * (100 - percent)) / 100}
            stroke="#3b3b3f"
            strokeWidth="0.5"
          />
        ))}

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((percent) => (
          <text
            key={`label-${percent}`}
            x="5"
            y={(height * (100 - percent)) / 100 + 4}
            fontSize="12"
            fill="#8a8a8f"
            dominantBaseline="middle"
          >
            {percent}
          </text>
        ))}

        {/* Trend line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#0f766e"
          strokeWidth="2"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const x = (i / Math.max(data.length - 1, 1)) * (width - padding * 2) + padding;
          const y =
            height -
            ((d.score_overall - minScore) / range) * (height - padding * 2) -
            padding;

          return (
            <circle
              key={`point-${i}`}
              cx={x}
              cy={y}
              r="3"
              fill="#0f766e"
              stroke="#e2e2e2"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {/* Date labels */}
      <div className="flex justify-between px-4 text-xs text-titanium-500 mt-2">
        <span>{new Date(data[0].recorded_at).toLocaleDateString()}</span>
        <span>{new Date(data[data.length - 1].recorded_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
