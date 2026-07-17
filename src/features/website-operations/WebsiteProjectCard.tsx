/**
 * Website Project Card
 * Displays project status, compliance score, and quick actions
 */

import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { WebsiteProject, WebsiteProjectStatus } from './types';
import './WebsiteProjectCard.css';

interface WebsiteProjectCardProps {
  project: WebsiteProject;
  onSelect: () => void;
}

export function WebsiteProjectCard({ project, onSelect }: WebsiteProjectCardProps) {
  const complianceColor = getComplianceColor(project.compliance_score);
  const formattedDate = new Date(project.created_at).toLocaleDateString('de-DE');

  return (
    <Card className="website-project-card" onClick={onSelect}>
      <div className="card-header">
        <div>
          <h3>{project.name}</h3>
          <p className="industry">{formatIndustry(project.industry)}</p>
        </div>
        <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
      </div>

      <div className="card-metrics">
        <div className="metric">
          <span className="label">Compliance</span>
          <div className={`score score--${complianceColor}`}>
            {project.compliance_score || 0}%
          </div>
        </div>

        {project.preview_url && (
          <div className="metric">
            <a href={project.preview_url} target="_blank" rel="noopener noreferrer" className="link">
              👁️ Preview
            </a>
          </div>
        )}

        {project.deployment_url && (
          <div className="metric">
            <a href={project.deployment_url} target="_blank" rel="noopener noreferrer" className="link">
              🌐 Live
            </a>
          </div>
        )}
      </div>

      {project.last_deployed_at && (
        <div className="card-footer">
          <small>
            Deployed: {new Date(project.last_deployed_at).toLocaleDateString('de-DE')}
          </small>
        </div>
      )}

      <small className="created-date">Created {formattedDate}</small>
    </Card>
  );
}

function formatIndustry(industry: string): string {
  const labels: Record<string, string> = {
    'tattoo-studio': '🎨 Tattoo Studio',
    'handwerker': '🔧 Handwerk',
    'dienstleister': '💼 Dienstleister',
    'einzelunternehmer': '👤 Einzelunternehmer',
  };
  return labels[industry] || industry;
}

function getStatusVariant(
  status: WebsiteProjectStatus
): 'default' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'live':
      return 'success';
    case 'preview':
      return 'warning';
    case 'archived':
      return 'error';
    default:
      return 'default';
  }
}

function getComplianceColor(score: number | undefined): 'green' | 'yellow' | 'red' {
  if (!score) return 'red';
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}
