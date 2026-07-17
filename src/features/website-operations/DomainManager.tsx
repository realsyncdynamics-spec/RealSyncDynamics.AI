/**
 * Domain Manager
 * Connect, validate, and manage domains for website projects
 */

import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import './DomainManager.css';

interface Domain {
  id: string;
  domain: string;
  domain_type: 'subdomain' | 'custom';
  cloudflare_status: string;
  ssl_status: string;
  is_primary: boolean;
  connected_at?: string;
}

interface DomainManagerProps {
  projectId: string;
  onDomainConnected?: (domain: Domain) => void;
}

export function DomainManager({ projectId, onDomainConnected }: DomainManagerProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    loadDomains();
  }, [projectId]);

  async function loadDomains() {
    try {
      const response = await fetch(`/api/website-projects/${projectId}/domains`);
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      }
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function connectDomain(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');

    if (!newDomain.trim()) {
      setValidationError('Domain is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/functions/v1/website-domain-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          tenant_id: localStorage.getItem('tenantId'),
          action: 'connect-domain',
          domain: newDomain,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setValidationError(error.message || 'Failed to connect domain');
        return;
      }

      const result = await response.json();
      await loadDomains();
      setNewDomain('');
      setShowAddDomain(false);

      if (onDomainConnected) {
        onDomainConnected(result.data);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function validateDomain(domain: string) {
    try {
      await fetch('/functions/v1/website-domain-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          tenant_id: localStorage.getItem('tenantId'),
          action: 'validate-domain',
          domain,
        }),
      });

      await loadDomains();
    } catch (err) {
      console.error('Validation failed:', err);
    }
  }

  async function disconnectDomain(domain: string) {
    if (!confirm(`Disconnect ${domain}?`)) return;

    try {
      await fetch('/functions/v1/website-domain-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          tenant_id: localStorage.getItem('tenantId'),
          action: 'disconnect-domain',
          domain,
        }),
      });

      await loadDomains();
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  }

  return (
    <div className="domain-manager">
      <div className="domain-header">
        <h3>Domains</h3>
        <button className="btn-secondary" onClick={() => setShowAddDomain(true)}>
          + Add Domain
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading domains...</div>
      ) : domains.length > 0 ? (
        <div className="domains-list">
          {domains.map((domain) => (
            <Card key={domain.id} className="domain-card">
              <div className="domain-info">
                <div>
                  <h4>{domain.domain}</h4>
                  <p className="type">
                    {domain.domain_type === 'subdomain' ? '🌐 Managed' : '🔗 Custom'}
                  </p>
                </div>
                {domain.is_primary && <Badge variant="success">Primary</Badge>}
              </div>

              <div className="domain-status">
                <div className="status-item">
                  <span className="label">DNS</span>
                  <span className={`status status--${domain.cloudflare_status}`}>
                    {getStatusIcon(domain.cloudflare_status)} {domain.cloudflare_status}
                  </span>
                </div>
                <div className="status-item">
                  <span className="label">SSL</span>
                  <span className={`status status--${domain.ssl_status}`}>
                    {getSSLIcon(domain.ssl_status)} {domain.ssl_status}
                  </span>
                </div>
              </div>

              {domain.cloudflare_status === 'validating' && (
                <div className="domain-actions">
                  <button
                    className="btn-small"
                    onClick={() => validateDomain(domain.domain)}
                  >
                    Retry Validation
                  </button>
                </div>
              )}

              {domain.cloudflare_status === 'active' && (
                <div className="domain-actions">
                  <a
                    href={`https://${domain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-small"
                  >
                    Visit Site
                  </a>
                  <button
                    className="btn-small btn-small--danger"
                    onClick={() => disconnectDomain(domain.domain)}
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {domain.connected_at && (
                <small className="connected-date">
                  Connected {new Date(domain.connected_at).toLocaleDateString('de-DE')}
                </small>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="empty-state">
          <p>No domains connected yet</p>
          <button className="btn-primary" onClick={() => setShowAddDomain(true)}>
            Connect your first domain
          </button>
        </Card>
      )}

      {/* Add Domain Modal */}
      {showAddDomain && (
        <div className="modal-overlay" onClick={() => setShowAddDomain(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Domain</h3>

            <form onSubmit={connectDomain}>
              <div className="input-group">
                <Input
                  label="Domain"
                  placeholder="example.com or subdomain.realsyncdynamics.ai"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>

              {validationError && (
                <div className="error-message">{validationError}</div>
              )}

              <div className="info-box">
                <p>
                  <strong>Subdomains:</strong> Use realsyncdynamics.ai subdomains for instant activation.
                </p>
                <p>
                  <strong>Custom domains:</strong> Bring your own domain (requires DNS update).
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddDomain(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Connecting...' : 'Connect Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'active':
      return '✅';
    case 'validating':
      return '⏳';
    case 'pending':
      return '⏸️';
    case 'failed':
      return '❌';
    default:
      return '•';
  }
}

function getSSLIcon(status: string): string {
  switch (status) {
    case 'active':
      return '🔒';
    case 'pending_validation':
      return '🔓';
    case 'expired':
      return '⚠️';
    default:
      return '•';
  }
}
