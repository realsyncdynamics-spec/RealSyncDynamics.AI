/**
 * Deployment Status
 * Shows deployment logs and current status
 */

import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import './DeploymentStatus.css';

interface DeploymentLog {
  id: string;
  event_type: string;
  status: string;
  title: string;
  message: string;
  created_at: string;
}

interface DeploymentStatusProps {
  projectId: string;
  deploymentUrl?: string;
  previewUrl?: string;
}

export function DeploymentStatus({ projectId, deploymentUrl, previewUrl }: DeploymentStatusProps) {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [projectId]);

  async function loadLogs() {
    try {
      const response = await fetch(`/api/website-projects/${projectId}/deployment-logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load deployment logs:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const latestLog = logs[0];
  const statusIcon = getStatusIcon(latestLog?.status);
  const statusColor = getStatusColor(latestLog?.status);

  return (
    <div className="deployment-status">
      <div className="current-status">
        <div className={`status-indicator status--${statusColor}`}>
          {statusIcon}
        </div>
        <div>
          <h4>{latestLog?.title || 'No deployments yet'}</h4>
          {latestLog && <p>{latestLog.message}</p>}
        </div>
      </div>

      {(previewUrl || deploymentUrl) && (
        <div className="deployment-urls">
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="url-button">
              👁️ Preview: {previewUrl}
            </a>
          )}
          {deploymentUrl && (
            <a href={deploymentUrl} target="_blank" rel="noopener noreferrer" className="url-button">
              🌐 Live: {deploymentUrl}
            </a>
          )}
        </div>
      )}

      <div className="deployment-history">
        <h5>Recent Activity</h5>
        {isLoading ? (
          <div className="loading">Loading...</div>
        ) : logs.length > 0 ? (
          <div className="logs">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className={`log-entry log-entry--${log.status}`}>
                <div className="log-time">
                  {new Date(log.created_at).toLocaleTimeString('de-DE')}
                </div>
                <div className="log-content">
                  <strong>{log.title}</strong>
                  {log.message && <p>{log.message}</p>}
                </div>
                <div className="log-status">{log.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No deployment activity yet</p>
        )}
      </div>
    </div>
  );
}

function getStatusIcon(status?: string): string {
  switch (status) {
    case 'success':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'failed':
      return '❌';
    case 'pending':
      return '⏳';
    case 'running':
      return '🔄';
    default:
      return '•';
  }
}

function getStatusColor(status?: string): 'success' | 'warning' | 'error' | 'pending' | 'default' {
  switch (status) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'failed':
      return 'error';
    case 'pending':
    case 'running':
      return 'pending';
    default:
      return 'default';
  }
}
