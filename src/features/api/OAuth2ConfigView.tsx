import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Copy, Trash2, CheckCircle2, AlertTriangle,
  Lock, Shield, Code, ExternalLink, RefreshCw,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { Button } from '../../enterprise-os/components/Button';

export interface OAuth2Application {
  id: string;
  client_id: string;
  client_secret_hash: string;
  name: string;
  description?: string;
  redirect_uris: string[];
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export interface RateLimitConfig {
  requests_per_minute: number;
  requests_per_day: number;
  plan_tier: 'free' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';
}

const RATE_LIMIT_DEFAULTS: Record<string, RateLimitConfig> = {
  free: { requests_per_minute: 10, requests_per_day: 100, plan_tier: 'free' },
  starter: { requests_per_minute: 60, requests_per_day: 5000, plan_tier: 'starter' },
  growth: { requests_per_minute: 300, requests_per_day: 50000, plan_tier: 'growth' },
  agency: { requests_per_minute: 1000, requests_per_day: 500000, plan_tier: 'agency' },
  scale: { requests_per_minute: 5000, requests_per_day: 5000000, plan_tier: 'scale' },
  enterprise: { requests_per_minute: 0, requests_per_day: 0, plan_tier: 'enterprise' }, // Unlimited
};

const AVAILABLE_SCOPES = [
  'provenance:read',
  'provenance:write',
  'compliance:read',
  'workflows:read',
  'workflows:write',
  'assets:read',
  'assets:write',
  'audit:read',
];

export function OAuth2ConfigView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId, hasFeature } = useTenant();
  const [applications, setApplications] = useState<OAuth2Application[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    redirect_uris: '',
    scopes: [] as string[],
  });

  // Determine plan tier based on features
  let planTier: keyof typeof RATE_LIMIT_DEFAULTS = 'starter';
  if (hasFeature('enterprise.tier')) planTier = 'enterprise';
  else if (hasFeature('scale.tier')) planTier = 'scale';
  else if (hasFeature('agency.tier')) planTier = 'agency';
  else if (hasFeature('growth.tier')) planTier = 'growth';

  const rateLimitConfig = RATE_LIMIT_DEFAULTS[planTier];

  useEffect(() => {
    loadApplications();
  }, [activeTenantId]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      // Mock: In reality, this would fetch from the backend
      setApplications([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApp = async () => {
    if (!formData.name.trim() || !formData.redirect_uris.trim()) {
      setError('Name und mindestens eine Redirect URI sind erforderlich');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Mock: In reality, this would call the backend
      const newApp: OAuth2Application = {
        id: Math.random().toString(),
        client_id: `oauth_${Date.now()}`,
        client_secret_hash: 'hidden',
        name: formData.name,
        description: formData.description,
        redirect_uris: formData.redirect_uris.split('\n').map((u) => u.trim()).filter(Boolean),
        scopes: formData.scopes,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setApplications([newApp, ...applications]);
      setFormData({ name: '', description: '', redirect_uris: '', scopes: [] });
      setShowNew(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erstellung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/settings" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-security-500 to-blue-600 flex items-center justify-center">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold text-titanium-50">OAuth2 Anwendungen</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Third-Party Integration & API-Zugriff</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowNew(!showNew)} disabled={!activeTenantId}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Neue Anwendung
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6 sm:px-6">
        {/* Rate Limit Info */}
        <Card>
          <CardHeader
            title="Rate Limiting"
            eyebrow={`Plan: ${planTier || 'Starter'}`}
            subtitle="Deine API-Limits basierend auf deinem Abonnement"
          />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border border-titanium-800 bg-obsidian-900 p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">Requests pro Minute</p>
                <p className="text-2xl font-bold font-display text-security-400">
                  {rateLimitConfig.requests_per_minute === 0 ? '∞' : rateLimitConfig.requests_per_minute}
                </p>
              </div>
              <div className="border border-titanium-800 bg-obsidian-900 p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">Requests pro Tag</p>
                <p className="text-2xl font-bold font-display text-security-400">
                  {rateLimitConfig.requests_per_day === 0 ? '∞' : rateLimitConfig.requests_per_day.toLocaleString()}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* New Application Form */}
        {showNew && (
          <Card>
            <CardHeader title="Neue OAuth2-Anwendung" />
            <CardBody>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                    Anwendungsname
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="z.B. Mobile App"
                    className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Wozu wird diese Anwendung verwendet?"
                    rows={2}
                    className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                    Redirect URIs (eine pro Zeile)
                  </label>
                  <textarea
                    value={formData.redirect_uris}
                    onChange={(e) => setFormData({ ...formData, redirect_uris: e.target.value })}
                    placeholder="https://example.com/callback"
                    rows={3}
                    className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                    Erforderliche Scopes
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.scopes.includes(scope)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...formData.scopes, scope]
                              : formData.scopes.filter((s) => s !== scope);
                            setFormData({ ...formData, scopes: updated });
                          }}
                          className="w-4 h-4"
                        />
                        <code className="text-xs text-titanium-300">{scope}</code>
                      </label>
                    ))}
                  </div>
                </div>

                {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>}

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateApp} disabled={loading}>
                    {loading ? 'Erstelle...' : 'Erstellen'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowNew(false)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Applications List */}
        <div className="space-y-3">
          {applications.length === 0 && !showNew ? (
            <Card>
              <CardBody>
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-titanium-700 mx-auto mb-3" />
                  <p className="text-titanium-300 mb-2">Keine OAuth2-Anwendungen registriert</p>
                  <p className="text-xs text-titanium-500">Erstelle deine erste Anwendung, um Third-Party-Integration zu aktivieren</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            applications.map((app) => (
              <Card key={app.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-titanium-100">{app.name}</h3>
                      {app.description && <p className="text-xs text-titanium-400 mt-1">{app.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-1 ${app.is_active ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40' : 'bg-risk-critical/10 text-risk-critical border border-risk-critical/40'}`}>
                          {app.is_active ? '✓ Aktiv' : '✗ Inaktiv'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Client ID</p>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-[11px] text-titanium-300 flex-1 break-all">{app.client_id}</code>
                        <button
                          onClick={() => copyToClipboard(app.client_id, `client_${app.id}`)}
                          className="p-1.5 text-titanium-500 hover:text-titanium-300"
                        >
                          {copied === `client_${app.id}` ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Scopes ({app.scopes.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {app.scopes.map((scope) => (
                          <span key={scope} className="text-[10px] bg-obsidian-800 text-titanium-400 px-2 py-1">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-titanium-800 pt-3 flex gap-2">
                    <Button variant="secondary" size="sm">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Credentials erneuern
                    </Button>
                    <button className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/40 text-sm font-semibold transition-colors">
                      <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                      Löschen
                    </button>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        {/* Documentation Card */}
        <Card>
          <CardHeader title="API-Dokumentation" />
          <CardBody className="space-y-2">
            <p className="text-sm text-titanium-300">
              Besuche unsere API-Dokumentation um zu erfahren wie du OAuth2 für die Integration nutzt.
            </p>
            <a
              href="/api-docs"
              className="inline-flex items-center gap-2 text-security-400 hover:text-security-300 text-sm font-semibold"
            >
              <Code className="h-4 w-4" />
              API-Dokumentation öffnen
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
