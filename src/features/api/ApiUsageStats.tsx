/**
 * API Usage Statistics Dashboard
 *
 * Displays real-time usage metrics from api_monthly_usage view
 * Shows remaining quota, reset date, and call history
 */

import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface UsageStats {
  total_calls: number;
  failed_calls: number;
  avg_response_time_ms: number;
  max_response_time_ms: number;
  month: string;
}

interface ApiCall {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  called_at: string;
}

const TIER_LIMITS: Record<string, number> = {
  agency: 1000,
  scale: 10000,
  enterprise: 100000,
  free: 0,
};

export function ApiUsageStats() {
  const { activeTenantId } = useTenant();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [tier, setTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchUsageData();
  }, [activeTenantId]);

  const fetchUsageData = async () => {
    try {
      const sb = getSupabase();

      // Fetch tenant subscription tier
      const { data: tenantData } = await sb
        .from('tenants')
        .select('subscription_tier')
        .eq('id', activeTenantId)
        .single();

      if (tenantData) {
        setTier(tenantData.subscription_tier || 'free');
      }

      // Fetch monthly usage stats
      const { data: statsData } = await sb
        .from('api_monthly_usage')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('month', { ascending: false })
        .limit(1)
        .single();

      if (statsData) {
        setStats(statsData);
      }

      // Fetch recent API calls
      const { data: callsData } = await sb
        .from('api_calls')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('called_at', { ascending: false })
        .limit(10);

      if (callsData) {
        setCalls(callsData);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-titanium-400">Lade Nutzungsdaten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 border border-red-700 rounded p-4">
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  const limit = TIER_LIMITS[tier.toLowerCase()] || 0;
  const used = stats?.total_calls || 0;
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isWarning = percentage >= 80;
  const isExceeded = percentage >= 100;

  // Calculate reset date (first day of next month)
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return (
    <div className="space-y-6">
      {/* Quota Status Card */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-titanium-50">Monatliches Kontingent</h2>
            <p className="text-sm text-titanium-400 mt-1">
              {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
            </p>
          </div>
          {isExceeded && <AlertTriangle className="h-6 w-6 text-red-500" />}
          {!isExceeded && !isWarning && <CheckCircle className="h-6 w-6 text-security-400" />}
          {isWarning && !isExceeded && <AlertTriangle className="h-6 w-6 text-yellow-500" />}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-titanium-300">
              {used.toLocaleString()} / {limit.toLocaleString()} Aufrufe
            </span>
            <span className="text-sm font-bold text-titanium-50">{percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-obsidian-900 rounded h-3 overflow-hidden border border-titanium-600">
            <div
              className={`h-full transition-all ${
                isExceeded ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-security-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Status Message */}
        {isExceeded && (
          <div className="bg-red-950 border border-red-700 rounded p-3">
            <p className="text-red-300 text-sm">
              ⚠️ Kontingent überschritten. Upgrade erforderlich für weitere API-Aufrufe.
            </p>
          </div>
        )}
        {isWarning && !isExceeded && (
          <div className="bg-yellow-950 border border-yellow-700 rounded p-3">
            <p className="text-yellow-300 text-sm">
              ⚠️ 80% des Kontingents aufgebraucht. Verbrauchte Aufrufe werden im nächsten Monat zurückgesetzt.
            </p>
          </div>
        )}

        {/* Reset Date */}
        <div className="mt-4 pt-4 border-t border-titanium-700">
          <p className="text-xs text-titanium-400">
            Kontingent wird zurückgesetzt am: <span className="font-mono text-titanium-300">{resetDate.toLocaleDateString('de-DE')}</span>
          </p>
        </div>
      </div>

      {/* Statistics Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 uppercase tracking-wider mb-1">Fehlerhafte Aufrufe</p>
            <p className="text-2xl font-bold text-titanium-50">
              {stats.failed_calls}
              <span className="text-sm text-titanium-400 ml-1">
                ({stats.total_calls > 0 ? ((stats.failed_calls / stats.total_calls) * 100).toFixed(1) : 0}%)
              </span>
            </p>
          </div>
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 uppercase tracking-wider mb-1">Durchschn. Antwortzeitwert</p>
            <p className="text-2xl font-bold text-titanium-50">
              {stats.avg_response_time_ms?.toFixed(0)}
              <span className="text-sm text-titanium-400 ml-1">ms</span>
            </p>
          </div>
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 uppercase tracking-wider mb-1">Max. Antwortzeitwert</p>
            <p className="text-2xl font-bold text-titanium-50">
              {stats.max_response_time_ms?.toFixed(0)}
              <span className="text-sm text-titanium-400 ml-1">ms</span>
            </p>
          </div>
          <div className="bg-obsidian-800 border border-titanium-700 rounded p-4">
            <p className="text-xs text-titanium-400 uppercase tracking-wider mb-1">Verfügbar</p>
            <p className="text-2xl font-bold text-security-400">
              {remaining.toLocaleString()}
              <span className="text-sm text-titanium-400 ml-1">Aufrufe</span>
            </p>
          </div>
        </div>
      )}

      {/* Recent API Calls */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-security-400" />
          <h3 className="text-lg font-bold text-titanium-50">Letzte 10 API-Aufrufe</h3>
        </div>

        {calls.length === 0 ? (
          <p className="text-titanium-400 text-sm">Noch keine API-Aufrufe getätigt.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-titanium-700">
                  <th className="text-left py-2 px-2 text-xs text-titanium-400 font-mono">Endpoint</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400 font-mono">Methode</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400 font-mono">Status</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400 font-mono">Zeit (ms)</th>
                  <th className="text-left py-2 px-2 text-xs text-titanium-400 font-mono">Uhrzeit</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b border-obsidian-700 hover:bg-obsidian-700 transition-colors">
                    <td className="py-2 px-2 text-titanium-300 font-mono text-xs">{call.endpoint}</td>
                    <td className="py-2 px-2 text-titanium-300 font-mono text-xs">{call.method}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                          call.status_code >= 400 ? 'bg-red-900 text-red-300' : 'bg-security-900 text-security-300'
                        }`}
                      >
                        {call.status_code}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-titanium-300 font-mono text-xs">{call.response_time_ms || '—'}</td>
                    <td className="py-2 px-2 text-titanium-300 font-mono text-xs">
                      {new Date(call.called_at).toLocaleString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
