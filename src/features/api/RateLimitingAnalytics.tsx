import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, Zap, Clock, Activity, Settings } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface RateLimitConfig {
  api_key_id: string;
  requests_per_minute: number;
  requests_per_hour: number;
  burst_limit: number;
  created_at: string;
}

interface RateLimitViolation {
  id: string;
  api_key_id: string;
  violation_type: 'per_minute' | 'per_hour' | 'burst';
  requests_count: number;
  limit_value: number;
  violated_at: string;
}

interface RateLimitStatus {
  api_key_id: string;
  api_key_name: string;
  requests_last_minute: number;
  requests_last_hour: number;
  current_burst: number;
  status: 'healthy' | 'warning' | 'critical';
}

const DEFAULT_LIMITS = {
  FREE: { per_minute: 10, per_hour: 100, burst: 20 },
  STARTER: { per_minute: 100, per_hour: 5000, burst: 200 },
  GROWTH: { per_minute: 500, per_hour: 50000, burst: 1000 },
  AGENCY: { per_minute: 1000, per_hour: 100000, burst: 2000 },
};

export function RateLimitingAnalytics() {
  const { activeTenantId } = useTenant();
  const [rateLimitConfigs, setRateLimitConfigs] = useState<RateLimitConfig[]>([]);
  const [rateLimitStatuses, setRateLimitStatuses] = useState<RateLimitStatus[]>([]);
  const [violations, setViolations] = useState<RateLimitViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApiKey, setSelectedApiKey] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newLimits, setNewLimits] = useState({
    requests_per_minute: 100,
    requests_per_hour: 5000,
    burst_limit: 200,
  });

  useEffect(() => {
    if (!activeTenantId) return;
    fetchRateLimitingData();
  }, [activeTenantId]);

  const fetchRateLimitingData = async () => {
    try {
      const sb = getSupabase();

      // Fetch rate limit configurations
      const { data: configData } = await sb
        .from('api_rate_limit_configs')
        .select('*')
        .eq('tenant_id', activeTenantId);

      setRateLimitConfigs((configData || []) as RateLimitConfig[]);

      // Fetch recent violations (last 24 hours)
      const { data: violationData } = await sb
        .from('api_rate_limit_violations')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .gte('violated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('violated_at', { ascending: false })
        .limit(100);

      setViolations((violationData || []) as RateLimitViolation[]);

      // Calculate current rate limit statuses
      const { data: apiKeysData } = await sb
        .from('api_keys')
        .select('id, name')
        .eq('tenant_id', activeTenantId);

      if (apiKeysData) {
        const statuses: RateLimitStatus[] = apiKeysData.map(key => {
          const config = configData?.find(c => c.api_key_id === key.id);
          const keyViolations = violationData?.filter(v => v.api_key_id === key.id) || [];

          // Calculate health status
          let status: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (keyViolations.filter(v => v.violation_type === 'per_minute').length > 0) {
            status = 'critical';
          } else if (keyViolations.filter(v => v.violation_type === 'burst').length > 0) {
            status = 'warning';
          }

          return {
            api_key_id: key.id,
            api_key_name: key.name || 'Unnamed Key',
            requests_last_minute: keyViolations
              .filter(v => v.violation_type === 'per_minute')
              .reduce((sum, v) => sum + v.requests_count, 0),
            requests_last_hour: keyViolations
              .filter(v => v.violation_type === 'per_hour')
              .reduce((sum, v) => sum + v.requests_count, 0),
            current_burst: keyViolations
              .filter(v => v.violation_type === 'burst')
              .reduce((sum, v) => sum + v.requests_count, 0),
            status,
          };
        });

        setRateLimitStatuses(statuses);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rate limiting data');
      setLoading(false);
    }
  };

  const handleUpdateLimits = async () => {
    if (!selectedApiKey) return;

    try {
      const sb = getSupabase();
      const { error: updateError } = await sb
        .from('api_rate_limit_configs')
        .update({
          requests_per_minute: newLimits.requests_per_minute,
          requests_per_hour: newLimits.requests_per_hour,
          burst_limit: newLimits.burst_limit,
        })
        .eq('api_key_id', selectedApiKey)
        .eq('tenant_id', activeTenantId);

      if (updateError) throw updateError;

      setShowConfigModal(false);
      await fetchRateLimitingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rate limits');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-titanium-400">Lade Rate-Limiting-Daten...</div>;
  }

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'bg-security-900 text-security-300';
      case 'warning':
        return 'bg-yellow-900 text-yellow-300';
      case 'critical':
        return 'bg-red-900 text-red-300';
    }
  };

  const getStatusLabel = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'Gesund';
      case 'warning':
        return 'Warnung';
      case 'critical':
        return 'Kritisch';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Rate Limit Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-security-400" />
            <p className="text-xs text-titanium-400 uppercase">API-Schlüssel</p>
          </div>
          <p className="text-2xl font-bold text-titanium-50">{rateLimitStatuses.length}</p>
        </div>
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <p className="text-xs text-titanium-400 uppercase">Warnungen (24h)</p>
          </div>
          <p className="text-2xl font-bold text-yellow-300">
            {violations.filter(v => v.violation_type !== 'per_minute').length}
          </p>
        </div>
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-xs text-titanium-400 uppercase">Überschreitungen (24h)</p>
          </div>
          <p className="text-2xl font-bold text-red-300">
            {violations.filter(v => v.violation_type === 'per_minute').length}
          </p>
        </div>
      </div>

      {/* Rate Limit Status Table */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-security-400" />
            <h3 className="text-lg font-bold text-titanium-50">Rate-Limit-Status</h3>
          </div>
        </div>

        {rateLimitStatuses.length === 0 ? (
          <p className="text-titanium-400 text-sm">Keine API-Schlüssel vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-titanium-700">
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Name</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Status</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Anfragen/Min</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Anfragen/Std</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Burst</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rateLimitStatuses.map((status) => (
                  <tr key={status.api_key_id} className="border-b border-obsidian-700 hover:bg-obsidian-700">
                    <td className="py-2 px-2 text-titanium-300 font-mono text-xs">{status.api_key_name}</td>
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStatusColor(status.status)}`}>
                        {getStatusLabel(status.status)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-titanium-300">{status.requests_last_minute}</td>
                    <td className="py-2 px-2 text-titanium-300">{status.requests_last_hour}</td>
                    <td className="py-2 px-2 text-titanium-300">{status.current_burst}</td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => {
                          setSelectedApiKey(status.api_key_id);
                          setShowConfigModal(true);
                        }}
                        className="text-titanium-400 hover:text-security-400 hover:bg-security-900 px-2 py-1 rounded text-xs"
                      >
                        <Settings className="h-3 w-3 inline mr-1" />
                        Konfigurieren
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Violations */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-titanium-50">Letzte Überschreitungen (24h)</h3>
        </div>

        {violations.length === 0 ? (
          <p className="text-titanium-400 text-sm">Keine Überschreitungen in den letzten 24 Stunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-titanium-700">
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">API-Schlüssel</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Typ</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Anfragen</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Limit</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400">Zeitpunkt</th>
                </tr>
              </thead>
              <tbody>
                {violations.slice(0, 20).map((violation) => (
                  <tr key={violation.id} className="border-b border-obsidian-700 hover:bg-obsidian-700">
                    <td className="py-2 px-2 text-titanium-300 font-mono text-xs">{violation.api_key_id.substring(0, 8)}</td>
                    <td className="py-2 px-2 text-titanium-300 text-xs">
                      <span className={violation.violation_type === 'per_minute' ? 'text-red-300' : 'text-yellow-300'}>
                        {violation.violation_type === 'per_minute' ? 'Pro Minute' : violation.violation_type === 'per_hour' ? 'Pro Stunde' : 'Burst'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-titanium-300">{violation.requests_count}</td>
                    <td className="py-2 px-2 text-titanium-300">{violation.limit_value}</td>
                    <td className="py-2 px-2 text-titanium-300 text-xs">
                      {new Date(violation.violated_at).toLocaleString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {showConfigModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-obsidian-900 border border-titanium-700 rounded p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-titanium-50">Rate-Limit-Konfiguration</h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-titanium-400 hover:text-titanium-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-titanium-300 mb-2">Anfragen pro Minute</label>
                <input
                  type="number"
                  value={newLimits.requests_per_minute}
                  onChange={(e) =>
                    setNewLimits({
                      ...newLimits,
                      requests_per_minute: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-600 rounded text-titanium-50 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-titanium-300 mb-2">Anfragen pro Stunde</label>
                <input
                  type="number"
                  value={newLimits.requests_per_hour}
                  onChange={(e) =>
                    setNewLimits({
                      ...newLimits,
                      requests_per_hour: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-600 rounded text-titanium-50 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-titanium-300 mb-2">Burst-Limit</label>
                <input
                  type="number"
                  value={newLimits.burst_limit}
                  onChange={(e) =>
                    setNewLimits({
                      ...newLimits,
                      burst_limit: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-600 rounded text-titanium-50 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleUpdateLimits}
                  className="flex-1 px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600 rounded"
                >
                  Speichern
                </button>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-4 py-2 bg-obsidian-700 text-titanium-100 font-bold border border-titanium-700 rounded hover:bg-obsidian-600"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
