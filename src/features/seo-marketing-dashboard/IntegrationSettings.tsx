import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader, Plus, Trash2 } from 'lucide-react';

interface Integration {
  id: string;
  provider: string;
  provider_account_id: string;
  status: 'active' | 'error' | 'inactive';
  last_sync_at: string | null;
  sync_enabled: boolean;
  error_message: string | null;
}

interface IntegrationSettingsProps {
  tenantId: string;
  accessToken: string;
}

export function IntegrationSettings({ tenantId, accessToken }: IntegrationSettingsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [tenantId, accessToken]);

  const fetchIntegrations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/integrations?tenant_id=eq.${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        },
      );

      if (!response.ok) throw new Error('Failed to fetch integrations');
      const data = await response.json();
      setIntegrations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    try {
      // Redirect to Stripe OAuth flow
      const state = Math.random().toString(36).substring(7);
      sessionStorage.setItem('stripe_oauth_state', state);

      window.location.href = `https://connect.stripe.com/oauth/authorize?client_id=${import.meta.env.VITE_STRIPE_CONNECT_ID}&state=${state}&stripe_user[email]=${encodeURIComponent(tenantId)}&response_type=code`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe');
    }
  };

  const handleConnectGoogleAnalytics = async () => {
    try {
      // Redirect to Google OAuth flow
      const state = Math.random().toString(36).substring(7);
      sessionStorage.setItem('ga_oauth_state', state);

      const scope = encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly');
      const redirectUri = `${window.location.origin}/integrations/google-analytics/callback`;

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${import.meta.env.VITE_GOOGLE_OAUTH_ID}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Google Analytics');
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!window.confirm('Diesen Integration wirklich löschen?')) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/integrations?id=eq.${integrationId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) throw new Error('Failed to delete integration');
      setIntegrations(integrations.filter((i) => i.id !== integrationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete integration');
    }
  };

  const handleManualSync = async (integrationId: string, provider: string) => {
    try {
      const syncEndpoint = provider === 'stripe' ? 'sync-stripe-metrics' : 'sync-ga-metrics';
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${syncEndpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            start_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
          }),
        },
      );

      if (!response.ok) throw new Error('Sync failed');
      await fetchIntegrations(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync data');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Datenquellen-Integration</h3>
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">Datenquellen-Integration</h3>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {integrations.length === 0 ? (
          <p className="text-slate-600 text-center py-8">Keine Integrationen konfiguriert</p>
        ) : (
          integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-slate-900 capitalize">
                    {integration.provider.replace('_', ' ')}
                  </p>
                  {integration.status === 'active' ? (
                    <span className="flex items-center gap-1 text-green-700 text-sm">
                      <CheckCircle size={14} /> Verbunden
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-700 text-sm">
                      <AlertCircle size={14} /> Fehler
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  Konto: {integration.provider_account_id}
                </p>
                {integration.last_sync_at && (
                  <p className="text-xs text-slate-500">
                    Letzte Synchronisierung: {new Date(integration.last_sync_at).toLocaleString('de-DE')}
                  </p>
                )}
                {integration.error_message && (
                  <p className="text-xs text-red-600 mt-1">{integration.error_message}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleManualSync(integration.id, integration.provider)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  <Loader size={14} className="inline mr-1" />
                  Sync
                </button>
                <button
                  onClick={() => handleDeleteIntegration(integration.id)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {!integrations.some((i) => i.provider === 'stripe') && (
          <button
            onClick={handleConnectStripe}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100"
          >
            <Plus size={16} />
            Stripe verbinden
          </button>
        )}

        {!integrations.some((i) => i.provider === 'google_analytics') && (
          <button
            onClick={handleConnectGoogleAnalytics}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100"
          >
            <Plus size={16} />
            Google Analytics verbinden
          </button>
        )}
      </div>
    </div>
  );
}
