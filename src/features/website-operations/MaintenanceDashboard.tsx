/**
 * Maintenance Dashboard
 * Displays health metrics, suggestions, and automated scan results
 */

import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import './MaintenanceDashboard.css';

interface HealthMetrics {
  performance_score: number;
  seo_score: number;
  security_score: number;
  accessibility_score: number;
  overall_health: number;
  lastScanned?: string;
}

interface Suggestion {
  title: string;
  description: string;
  estimated_impact: string;
  effort: 'low' | 'medium' | 'high';
}

interface Issue {
  category: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: string;
}

interface MaintenanceDashboardProps {
  projectId: string;
}

export function MaintenanceDashboard({ projectId }: MaintenanceDashboardProps) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    loadMaintenanceData();
    const interval = setInterval(loadMaintenanceData, 300000); // Poll every 5 minutes
    return () => clearInterval(interval);
  }, [projectId]);

  async function loadMaintenanceData() {
    try {
      const response = await fetch(`/api/website-projects/${projectId}/maintenance`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setSuggestions(data.suggestions || []);
        setIssues(data.issues || []);
        setLastScanTime(data.lastScanned);
      }
    } catch (err) {
      console.error('Failed to load maintenance data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function triggerScan() {
    setIsScanning(true);
    try {
      const response = await fetch('/functions/v1/website-maintenance-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          action: 'generate-suggestions',
        }),
      });

      if (response.ok) {
        await loadMaintenanceData();
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  }

  if (isLoading) {
    return <div className="maintenance-dashboard loading">Loading health metrics...</div>;
  }

  const defaultMetrics: HealthMetrics = {
    performance_score: 75,
    seo_score: 80,
    security_score: 85,
    accessibility_score: 70,
    overall_health: 78,
  };

  const data = metrics || defaultMetrics;

  return (
    <div className="maintenance-dashboard">
      {/* Header */}
      <div className="maintenance-header">
        <h2>Website Health & Maintenance</h2>
        <button
          className={`btn-scan ${isScanning ? 'scanning' : ''}`}
          onClick={triggerScan}
          disabled={isScanning}
        >
          {isScanning ? '⏳ Scanning...' : '🔍 Run Scan'}
        </button>
      </div>

      {lastScanTime && (
        <div className="last-scan">
          Last scanned: {new Date(lastScanTime).toLocaleString('de-DE')}
        </div>
      )}

      {/* Overall Health Score */}
      <Card className="health-card">
        <div className="overall-score">
          <div className={`score-circle score-${getHealthClass(data.overall_health)}`}>
            <div className="score-number">{Math.round(data.overall_health)}</div>
            <div className="score-label">Overall Health</div>
          </div>
          <div className="health-status">
            <p className={`status ${getHealthClass(data.overall_health)}`}>
              {getHealthStatus(data.overall_health)}
            </p>
            <p className="description">
              Your website is performing{' '}
              {data.overall_health >= 80 ? 'excellently' : data.overall_health >= 60 ? 'well' : 'needs attention'}.
            </p>
          </div>
        </div>
      </Card>

      {/* Category Scores */}
      <div className="scores-grid">
        <MetricCard
          title="Performance"
          score={data.performance_score}
          icon="⚡"
          tips={['Optimize images', 'Minimize CSS/JS', 'Enable caching']}
        />
        <MetricCard
          title="SEO"
          score={data.seo_score}
          icon="🔍"
          tips={['Add meta tags', 'Improve headings', 'Add structured data']}
        />
        <MetricCard
          title="Security"
          score={data.security_score}
          icon="🔒"
          tips={['Update SSL', 'Add CSP header', 'Enable HSTS']}
        />
        <MetricCard
          title="Accessibility"
          score={data.accessibility_score}
          icon="♿"
          tips={['Alt text on images', 'ARIA labels', 'Keyboard navigation']}
        />
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="issues-section">
          <h3>⚠️ Issues Found ({issues.length})</h3>

          {issues
            .filter((i) => i.severity === 'critical')
            .map((issue, i) => (
              <IssueCard key={i} issue={issue} />
            ))}

          {issues
            .filter((i) => i.severity === 'warning')
            .map((issue, i) => (
              <IssueCard key={i} issue={issue} />
            ))}

          {issues
            .filter((i) => i.severity === 'info')
            .map((issue, i) => (
              <IssueCard key={i} issue={issue} />
            ))}
        </div>
      )}

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="suggestions-section">
          <h3>💡 AI Suggestions</h3>
          <div className="suggestions-list">
            {suggestions.map((sugg, i) => (
              <Card key={i} className={`suggestion suggestion--${sugg.effort}`}>
                <div className="sugg-header">
                  <h4>{sugg.title}</h4>
                  <div className="sugg-meta">
                    <span className={`effort effort-${sugg.effort}`}>{sugg.effort}</span>
                    <span className="impact">{sugg.estimated_impact}</span>
                  </div>
                </div>
                <p className="sugg-description">{sugg.description}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Scan Info */}
      <Card className="info-card">
        <p>
          <strong>🤖 Automated Scans:</strong> Your website is scanned automatically every day at 2 AM UTC for
          performance, SEO, security, and broken links.
        </p>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  score: number;
  icon: string;
  tips: string[];
}

function MetricCard({ title, score, icon, tips }: MetricCardProps) {
  const className = getHealthClass(score);

  return (
    <Card className={`metric-card metric-${className}`}>
      <div className="metric-icon">{icon}</div>
      <h4>{title}</h4>
      <div className="metric-score">{Math.round(score)}</div>
      <div className="metric-bar">
        <div className="metric-fill" style={{ width: `${score}%` }} />
      </div>
      <div className="metric-tips">
        {tips.map((tip, i) => (
          <small key={i}>✓ {tip}</small>
        ))}
      </div>
    </Card>
  );
}

interface IssueCardProps {
  issue: Issue;
}

function IssueCard({ issue }: IssueCardProps) {
  const severityIcon = {
    critical: '🔴',
    warning: '🟡',
    info: 'ℹ️',
  };

  return (
    <Card className={`issue-card issue-${issue.severity}`}>
      <div className="issue-header">
        <h5>
          {severityIcon[issue.severity]} {issue.title}
        </h5>
      </div>
      <p className="issue-description">{issue.description}</p>
      <p className="issue-impact">
        <strong>Impact:</strong> {issue.impact}
      </p>
    </Card>
  );
}

function getHealthClass(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function getHealthStatus(score: number): string {
  if (score >= 90) return '✨ Excellent condition';
  if (score >= 80) return '✅ Good condition';
  if (score >= 60) return '⚠️ Needs some attention';
  if (score >= 40) return '⚠️ Multiple issues to fix';
  return '🚨 Critical issues';
}
