import { Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Deadline {
  id: string;
  name: string;
  dueDate: string;
  type: 'audit' | 'dpia' | 'review' | 'assessment';
  status: 'upcoming' | 'overdue' | 'completed';
}

interface IncidentDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ProgressPanelProps {
  incidents: IncidentDistribution;
  deadlines: Deadline[];
  totalIncidents?: number;
}

export function ProgressPanel({
  incidents,
  deadlines,
  totalIncidents = 0,
}: ProgressPanelProps) {
  const total = incidents.critical + incidents.high + incidents.medium + incidents.low || 1;
  const percentages = {
    critical: Math.round((incidents.critical / total) * 100),
    high: Math.round((incidents.high / total) * 100),
    medium: Math.round((incidents.medium / total) * 100),
    low: Math.round((incidents.low / total) * 100),
  };

  // Simple pie chart segments
  const pieSegments = [];
  let currentDegree = 0;

  if (incidents.critical > 0) {
    const segment = (incidents.critical / total) * 360;
    pieSegments.push({
      color: '#ef4444',
      start: currentDegree,
      size: segment,
      label: `Critical (${incidents.critical})`,
    });
    currentDegree += segment;
  }

  if (incidents.high > 0) {
    const segment = (incidents.high / total) * 360;
    pieSegments.push({
      color: '#f59e0b',
      start: currentDegree,
      size: segment,
      label: `High (${incidents.high})`,
    });
    currentDegree += segment;
  }

  if (incidents.medium > 0) {
    const segment = (incidents.medium / total) * 360;
    pieSegments.push({
      color: '#eab308',
      start: currentDegree,
      size: segment,
      label: `Medium (${incidents.medium})`,
    });
    currentDegree += segment;
  }

  if (incidents.low > 0) {
    const segment = (incidents.low / total) * 360;
    pieSegments.push({
      color: '#22c55e',
      start: currentDegree,
      size: segment,
      label: `Low (${incidents.low})`,
    });
  }

  const getDurationUntilDue = (dueDate: string): string => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays < 7) return `${diffDays}d left`;
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks}w ${diffDays % 7}d left`;
  };

  const upcomingDeadlines = deadlines
    .filter((d) => d.status === 'upcoming')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Incident Distribution */}
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-titanium-50 mb-6">Open Incidents by Severity</h3>

        {total === 0 ? (
          <div className="flex items-center justify-center h-48 text-titanium-400">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No open incidents</p>
            </div>
          </div>
        ) : (
          <>
            {/* Pie Chart SVG */}
            <div className="flex justify-center mb-6">
              <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-lg">
                {pieSegments.map((segment, idx) => {
                  const startRad = (segment.start * Math.PI) / 180;
                  const sizeRad = (segment.size * Math.PI) / 180;
                  const x1 = 100 + 70 * Math.cos(startRad);
                  const y1 = 100 + 70 * Math.sin(startRad);
                  const x2 = 100 + 70 * Math.cos(startRad + sizeRad);
                  const y2 = 100 + 70 * Math.sin(startRad + sizeRad);

                  const largeArcFlag = segment.size > 180 ? 1 : 0;

                  const pathData = [
                    `M 100 100`,
                    `L ${x1} ${y1}`,
                    `A 70 70 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                    'Z',
                  ].join(' ');

                  return (
                    <path
                      key={idx}
                      d={pathData}
                      fill={segment.color}
                      stroke="#0a0a0b"
                      strokeWidth="2"
                    />
                  );
                })}

                {/* Center circle for donut effect */}
                <circle cx="100" cy="100" r="45" fill="#0a0a0b" />
                <text
                  x="100"
                  y="105"
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="bold"
                  fill="#e2e2e2"
                >
                  {total}
                </text>
              </svg>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {incidents.critical > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-titanium-400">Critical</span>
                  </div>
                  <span className="font-semibold text-titanium-50">{incidents.critical} ({percentages.critical}%)</span>
                </div>
              )}
              {incidents.high > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span className="text-titanium-400">High</span>
                  </div>
                  <span className="font-semibold text-titanium-50">{incidents.high} ({percentages.high}%)</span>
                </div>
              )}
              {incidents.medium > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-titanium-400">Medium</span>
                  </div>
                  <span className="font-semibold text-titanium-50">{incidents.medium} ({percentages.medium}%)</span>
                </div>
              )}
              {incidents.low > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-titanium-400">Low</span>
                  </div>
                  <span className="font-semibold text-titanium-50">{incidents.low} ({percentages.low}%)</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-titanium-50 mb-6">Upcoming Deadlines</h3>

        {upcomingDeadlines.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-titanium-400">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No upcoming deadlines</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingDeadlines.map((deadline) => {
              const daysUntil = Math.ceil(
                (new Date(deadline.dueDate).getTime() - new Date().getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              const isUrgent = daysUntil <= 7;

              return (
                <div
                  key={deadline.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    isUrgent
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-obsidian-700/50 border-titanium-300/10'
                  }`}
                >
                  <Calendar size={16} className={`mt-0.5 flex-shrink-0 ${
                    isUrgent ? 'text-red-400' : 'text-titanium-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-titanium-50 truncate">
                      {deadline.name}
                    </div>
                    <div className={`text-xs mt-0.5 ${
                      isUrgent ? 'text-red-400 font-semibold' : 'text-titanium-400'
                    }`}>
                      {getDurationUntilDue(deadline.dueDate)}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-obsidian-700 text-titanium-300 flex-shrink-0 capitalize">
                    {deadline.type}
                  </span>
                </div>
              );
            })}

            {/* Quick Actions */}
            <div className="pt-4 border-t border-titanium-300/10 space-y-2">
              <button className="w-full px-3 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-600/30 transition-colors text-sm font-medium">
                Start Risk Assessment
              </button>
              <button className="w-full px-3 py-2 rounded-lg bg-obsidian-700 border border-titanium-300/20 text-titanium-400 hover:text-titanium-50 transition-colors text-sm font-medium">
                Schedule Audit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
