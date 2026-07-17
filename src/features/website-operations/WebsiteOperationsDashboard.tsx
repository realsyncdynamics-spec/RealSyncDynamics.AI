/**
 * Website Operations Dashboard
 * Master view for website projects, deployments, and compliance
 */

import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CreateWebsiteWizard } from './CreateWebsiteWizard';
import { WebsiteProjectCard } from './WebsiteProjectCard';
import { DeploymentStatus } from './DeploymentStatus';
import { ComplianceScoreboard } from './ComplianceScoreboard';
import type { WebsiteProject, WebsiteProjectStatus } from './types';
import './WebsiteOperationsDashboard.css';

export function WebsiteOperationsDashboard() {
  const { user } = useSupabaseAuth();
  const [projects, setProjects] = useState<WebsiteProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<WebsiteProject | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'preview' | 'live'>('all');

  useEffect(() => {
    loadProjects();
  }, [user?.id]);

  async function loadProjects() {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/website-projects', {
        headers: { Authorization: `Bearer ${user.id}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredProjects = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

  const stats = {
    total: projects.length,
    live: projects.filter((p) => p.status === 'live').length,
    preview: projects.filter((p) => p.status === 'preview').length,
    draft: projects.filter((p) => p.status === 'draft').length,
    avgCompliance: projects.length
      ? (projects.reduce((sum, p) => sum + (p.compliance_score || 0), 0) / projects.length).toFixed(0)
      : 0,
  };

  return (
    <div className="website-ops-dashboard">
      {/* Header */}
      <div className="header-section">
        <div>
          <h1>Website Operations</h1>
          <p className="subtitle">AI-powered website creation and deployment for your business</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Website
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard label="Total Websites" value={stats.total} icon="📊" />
        <StatCard label="Live" value={stats.live} icon="🚀" highlight="green" />
        <StatCard label="Preview" value={stats.preview} icon="👁️" highlight="blue" />
        <StatCard label="Draft" value={stats.draft} icon="📝" highlight="gray" />
        <StatCard label="Avg Compliance" value={`${stats.avgCompliance}%`} icon="✅" highlight="green" />
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {(['all', 'draft', 'preview', 'live'] as const).map((status) => (
          <button
            key={status}
            className={`tab ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      <div className="projects-grid">
        {isLoading ? (
          <div className="loading">Loading projects...</div>
        ) : filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <WebsiteProjectCard
              key={project.id}
              project={project}
              onSelect={() => setSelectedProject(project)}
            />
          ))
        ) : (
          <div className="empty-state">
            <p>No websites yet</p>
            <button className="btn-link" onClick={() => setShowCreateModal(true)}>
              Create your first website
            </button>
          </div>
        )}
      </div>

      {/* Create Website Modal */}
      {showCreateModal && (
        <Modal open title="Neue Website erstellen" onClose={() => setShowCreateModal(false)}>
          <CreateWebsiteWizard
            onSuccess={(newProject) => {
              setProjects([...projects, newProject]);
              setShowCreateModal(false);
            }}
            onClose={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* Project Detail Panel */}
      {selectedProject && (
        <Modal open title={selectedProject.name} onClose={() => setSelectedProject(null)}>
          <div className="project-detail">
            <h2>{selectedProject.name}</h2>
            <Badge variant={getStatusVariant(selectedProject.status)}>{selectedProject.status}</Badge>

            <div className="detail-sections">
              <section>
                <h3>Compliance Status</h3>
                <ComplianceScoreboard
                  projectId={selectedProject.id}
                  score={selectedProject.compliance_score}
                />
              </section>

              <section>
                <h3>Deployment</h3>
                <DeploymentStatus
                  projectId={selectedProject.id}
                  deploymentUrl={selectedProject.deployment_url}
                  previewUrl={selectedProject.preview_url}
                />
              </section>

              {selectedProject.status === 'draft' && (
                <section>
                  <button className="btn-primary">
                    Generate Website Content
                  </button>
                </section>
              )}

              {selectedProject.status === 'preview' && (
                <section>
                  <button className="btn-success">
                    Deploy to Production
                  </button>
                </section>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  highlight?: 'green' | 'blue' | 'gray';
}

function StatCard({ label, value, icon, highlight }: StatCardProps) {
  return (
    <Card className={`stat-card stat-card--${highlight || 'default'}`}>
      {icon && <div className="icon">{icon}</div>}
      <div>
        <div className="label">{label}</div>
        <div className="value">{value}</div>
      </div>
    </Card>
  );
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
