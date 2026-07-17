/**
 * Compliance Scoreboard
 * Shows DSGVO + EU AI Act compliance status
 */

import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import './ComplianceScoreboard.css';

interface ComplianceFinding {
  category: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
}

interface ComplianceReportData {
  overall_score: number;
  dsgvo_score: number;
  eu_ai_act_score: number;
  findings: ComplianceFinding[];
  status: string;
}

interface ComplianceScoreboardProps {
  projectId: string;
  score?: number;
}

export function ComplianceScoreboard({ projectId, score }: ComplianceScoreboardProps) {
  const [report, setReport] = useState<ComplianceReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCompliance();
  }, [projectId]);

  async function loadCompliance() {
    try {
      const response = await fetch(`/api/website-compliance/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      }
    } catch (err) {
      console.error('Failed to load compliance report:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const data = report || {
    overall_score: score || 0,
    dsgvo_score: 0,
    eu_ai_act_score: 0,
    findings: [],
    status: 'unknown',
  };

  const statusIcon = getStatusIcon(data.status);
  const statusColor = getStatusColor(data.overall_score);

  return (
    <div className="compliance-scoreboard">
      {/* Overall Score */}
      <Card className="score-card">
        <div className={`score-large score--${statusColor}`}>
          {data.overall_score}%
        </div>
        <p className="status-text">
          {statusIcon} {data.status === 'compliant' ? 'Compliant' : 'Review Needed'}
        </p>
      </Card>

      {/* Component Scores */}
      <div className="component-scores">
        <div className="score-component">
          <div className="score-bar">
            <div
              className="score-fill"
              style={{
                width: `${data.dsgvo_score}%`,
                backgroundColor: getScoreColor(data.dsgvo_score),
              }}
            />
          </div>
          <p className="label">DSGVO: {data.dsgvo_score}%</p>
        </div>

        <div className="score-component">
          <div className="score-bar">
            <div
              className="score-fill"
              style={{
                width: `${data.eu_ai_act_score}%`,
                backgroundColor: getScoreColor(data.eu_ai_act_score),
              }}
            />
          </div>
          <p className="label">EU AI Act: {data.eu_ai_act_score}%</p>
        </div>
      </div>

      {/* Findings */}
      {data.findings && data.findings.length > 0 && (
        <div className="findings-section">
          <h5>Findings ({data.findings.length})</h5>

          {/* Critical */}
          {data.findings.filter((f) => f.severity === 'critical').length > 0 && (
            <div className="findings-group">
              <h6>🔴 Critical ({data.findings.filter((f) => f.severity === 'critical').length})</h6>
              {data.findings
                .filter((f) => f.severity === 'critical')
                .map((finding, i) => (
                  <div key={i} className="finding critical">
                    <strong>{finding.title}</strong>
                    <p>{finding.description}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Warnings */}
          {data.findings.filter((f) => f.severity === 'warning').length > 0 && (
            <div className="findings-group">
              <h6>🟡 Warnings ({data.findings.filter((f) => f.severity === 'warning').length})</h6>
              {data.findings
                .filter((f) => f.severity === 'warning')
                .map((finding, i) => (
                  <div key={i} className="finding warning">
                    <strong>{finding.title}</strong>
                    <p>{finding.description}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Info */}
          {data.findings.filter((f) => f.severity === 'info').length > 0 && (
            <div className="findings-group">
              <h6>ℹ️ Info ({data.findings.filter((f) => f.severity === 'info').length})</h6>
              {data.findings
                .filter((f) => f.severity === 'info')
                .map((finding, i) => (
                  <div key={i} className="finding info">
                    <strong>{finding.title}</strong>
                    <p>{finding.description}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {isLoading && <div className="loading">Loading compliance report...</div>}

      {!isLoading && !report && (
        <div className="no-data">
          <p>No compliance report yet</p>
          <button className="btn-secondary">Run Compliance Check</button>
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'compliant':
      return '✅';
    case 'review_needed':
      return '⚠️';
    default:
      return '•';
  }
}

function getStatusColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#10b981'; // green
  if (score >= 50) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}
