/**
 * Domain Manager
 * Connect, validate, and manage domains for website projects.
 *
 * Calls website-domain-manager Edge Function with JWT + tenant membership.
 * Lists domains from website_domains (RLS). Never fakes "active".
 *
 * Live Cloudflare DNS for custom domains still depends on Vault / ops —
 * this UI ships as Preview and must not claim a live custom domain.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { getSupabase } from '../../lib/supabase';
import { getSupabaseUrl } from '../../lib/supabaseUrl';
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
  tenantId: string;
  /** When true, show Preview banner — custom domain DNS is not claimed live. */
  previewMode?: boolean;
  onDomainConnected?: (domain: Domain) => void;
}

async function callDomainManager(body: Record<string, unknown>): Promise<{
  success?: boolean;
  data?: Domain & { instructions?: string; status?: string };
  error?: { message?: string };
  message?: string;
}> {
  const sb = getSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('Nicht angemeldet — Domain-Bindung erfordert Check-in.');
  }

  const response = await fetch(`${getSupabaseUrl()}/functions/v1/website-domain-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      payload?.error?.message ||
      payload?.message ||
      payload?.error ||
      `Domain-Operation fehlgeschlagen (${response.status})`;
    throw new Error(typeof msg === 'string' ? msg : 'Domain-Operation fehlgeschlagen');
  }
  return payload;
}

export function DomainManager({
  projectId,
  tenantId,
  previewMode = true,
  onDomainConnected,
}: DomainManagerProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [lastInstructions, setLastInstructions] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    setListError(null);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('website_domains')
        .select('id, domain, domain_type, cloudflare_status, ssl_status, is_primary, connected_at')
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        setDomains([]);
        setListError(error.message);
        return;
      }
      setDomains((data ?? []) as Domain[]);
    } catch (err) {
      setDomains([]);
      setListError(err instanceof Error ? err.message : 'Domains konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tenantId]);

  useEffect(() => {
    setIsLoading(true);
    void loadDomains();
  }, [loadDomains]);

  async function connectDomain(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');
    setLastInstructions(null);

    if (!newDomain.trim()) {
      setValidationError('Domain is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await callDomainManager({
        project_id: projectId,
        tenant_id: tenantId,
        action: 'connect-domain',
        domain: newDomain.trim().toLowerCase(),
      });

      await loadDomains();
      setNewDomain('');
      setShowAddDomain(false);

      if (result.data?.instructions) {
        setLastInstructions(String(result.data.instructions));
      }

      if (onDomainConnected && result.data) {
        onDomainConnected(result.data as Domain);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function validateDomain(domain: string) {
    try {
      await callDomainManager({
        project_id: projectId,
        tenant_id: tenantId,
        action: 'validate-domain',
        domain,
      });
      await loadDomains();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  async function disconnectDomain(domain: string) {
    if (!confirm(`Disconnect ${domain}?`)) return;

    try {
      await callDomainManager({
        project_id: projectId,
        tenant_id: tenantId,
        action: 'disconnect-domain',
        domain,
      });
      await loadDomains();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }

  return (
    <div className="domain-manager">
      <div className="domain-header">
        <h3>Kunden-Domain</h3>
        <button type="button" className="btn-secondary" onClick={() => setShowAddDomain(true)}>
          + Domain verbinden
        </button>
      </div>

      {previewMode && (
        <div
          className="info-box"
          style={{ marginBottom: '1rem' }}
          data-testid="domain-bind-preview-banner"
        >
          <p>
            <strong>Preview:</strong> Domain-Eintrag und DNS-Anweisungen werden gespeichert.
            Live-Cloudflare/Custom-DNS bleibt ops-seitig (Vault / Migration) — kein Fake-„active“.
          </p>
        </div>
      )}

      {listError && (
        <div className="error-message" role="status">
          Preview / Lesefehler: {listError}. Edge Function kann trotzdem versucht werden.
        </div>
      )}

      {lastInstructions && (
        <div className="info-box" style={{ marginBottom: '1rem' }}>
          <p className="font-mono text-xs">{lastInstructions}</p>
        </div>
      )}

      {validationError && !showAddDomain && (
        <div className="error-message">{validationError}</div>
      )}

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
                    {domain.domain_type === 'subdomain' ? 'Managed Subdomain' : 'Custom Domain'}
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

              {(domain.cloudflare_status === 'validating' || domain.cloudflare_status === 'pending') && (
                <div className="domain-actions">
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => void validateDomain(domain.domain)}
                  >
                    Retry Validation
                  </button>
                  <button
                    type="button"
                    className="btn-small btn-small--danger"
                    onClick={() => void disconnectDomain(domain.domain)}
                  >
                    Disconnect
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
                    type="button"
                    className="btn-small btn-small--danger"
                    onClick={() => void disconnectDomain(domain.domain)}
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
          <p>Noch keine Kunden-Domain verbunden</p>
          <button type="button" className="btn-primary" onClick={() => setShowAddDomain(true)}>
            Domain verbinden
          </button>
        </Card>
      )}

      {showAddDomain && (
        <div className="modal-overlay" onClick={() => setShowAddDomain(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Domain verbinden</h3>

            <form onSubmit={(e) => void connectDomain(e)}>
              <div className="input-group">
                <Input
                  label="Domain"
                  placeholder="example.com oder subdomain.realsyncdynamicsai.de"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>

              {validationError && <div className="error-message">{validationError}</div>}

              <div className="info-box">
                <p>
                  <strong>Subdomains:</strong> *.realsyncdynamicsai.de für schnelle Aktivierung.
                </p>
                <p>
                  <strong>Custom domains:</strong> DNS-Update erforderlich. Status bleibt
                  validating, bis Cloudflare bestätigt — kein Fake-Connected. Preview bis
                  Vault/ops live ist.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddDomain(false)}
                >
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Verbinden…' : 'Domain verbinden'}
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
      return '✓';
    case 'validating':
      return '…';
    case 'pending':
      return '·';
    case 'failed':
      return '✕';
    default:
      return '•';
  }
}

function getSSLIcon(status: string): string {
  switch (status) {
    case 'active':
      return 'OK';
    case 'pending_validation':
      return '…';
    case 'expired':
      return '!';
    default:
      return '•';
  }
}
