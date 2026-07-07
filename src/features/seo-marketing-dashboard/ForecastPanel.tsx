import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../../supabase/SupabaseAuthContext';
import { useTenant } from '../../core/access/TenantProvider';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Loader,
  Calendar,
  Activity,
  Target,
} from 'lucide-react';

interface ForecastData {
  date: string;
  predicted: number;
  actual?: number;
  lower: number;
  upper: number;
}

interface ModelMetrics {
  modelType: string;
  accuracy: number;
  rmse: number;
  lastTrained: string;
  dataPoints: number;
}

interface Alert {
  id: string;
  alertType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  metric: string;
  impact: number;
  action: string;
}

export function ForecastPanel() {
  const { session } = useSupabaseAuth();
  const { activeTenantId } = useTenant();

  const [selectedModel, setSelectedModel] = useState<'churn_prediction' | 'revenue_forecast' | 'ltv_projection'>(
    'revenue_forecast'
  );
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForecastData();
  }, [selectedModel, activeTenantId]);

  async function loadForecastData() {
    if (!session?.access_token || !activeTenantId) return;

    setLoading(true);
    setError(null);

    try {
      // Load predictions
      const predResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_forecast_predictions?tenant_id=eq.${activeTenantId}&prediction_type=eq.${selectedModel}&order=prediction_date.asc&limit=30`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: 'application/json',
          },
        }
      );

      if (predResponse.ok) {
        const predictions = await predResponse.json();
        setForecastData(
          predictions.map((p: Record<string, unknown>) => ({
            date: new Date(p.prediction_date as string).toLocaleDateString('de-DE', {
              month: 'short',
              day: 'numeric',
            }),
            predicted: Number(p.predicted_value),
            lower: Number(p.confidence_lower_bound),
            upper: Number(p.confidence_upper_bound),
          }))
        );
      }

      // Load model metrics
      const modelResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_forecast_models?tenant_id=eq.${activeTenantId}&model_type=eq.${selectedModel}&select=*`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: 'application/json',
          },
        }
      );

      if (modelResponse.ok) {
        const models = await modelResponse.json();
        if (models.length > 0) {
          const model = models[0];
          setModelMetrics({
            modelType: selectedModel,
            accuracy: model.accuracy_score || 0,
            rmse: model.rmse || 0,
            lastTrained: model.last_trained_at || 'Never',
            dataPoints: model.training_data_points || 0,
          });
        }
      }

      // Load active alerts
      const alertResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_forecast_alerts?tenant_id=eq.${activeTenantId}&is_active=eq.true&order=severity.asc,created_at.desc&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: 'application/json',
          },
        }
      );

      if (alertResponse.ok) {
        const alertsData = await alertResponse.json();
        setAlerts(
          alertsData.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            alertType: a.alert_type as string,
            severity: a.severity as 'critical' | 'high' | 'medium' | 'low',
            metric: a.affected_metric as string,
            impact: Number(a.predicted_impact) || 0,
            action: a.recommended_action as string,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast data');
      console.error('Forecast load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function retrainModel() {
    if (!session?.access_token || !activeTenantId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/train-forecast-models`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            model_type: selectedModel,
            retrain: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Model training failed');
      }

      // Reload data after training
      await loadForecastData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setLoading(false);
    }
  }

  const modelLabels: Record<string, string> = {
    churn_prediction: 'Churn-Vorhersage',
    revenue_forecast: 'Umsatzprognose',
    ltv_projection: 'LTV-Projektion',
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-950 border-red-700 text-red-200';
      case 'high':
        return 'bg-orange-950 border-orange-700 text-orange-200';
      case 'medium':
        return 'bg-yellow-950 border-yellow-700 text-yellow-200';
      default:
        return 'bg-blue-950 border-blue-700 text-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
        <h3 className="text-titanium-200 font-mono text-sm mb-4">FORECAST-MODELL</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {(['churn_prediction', 'revenue_forecast', 'ltv_projection'] as const).map(model => (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              disabled={loading}
              className={`px-4 py-2 rounded-sm text-sm font-mono transition-colors ${
                selectedModel === model
                  ? 'bg-security-blue text-titanium-50 border border-security-blue'
                  : 'bg-obsidian-800 text-titanium-300 border border-obsidian-600 hover:border-obsidian-500'
              } disabled:opacity-50`}
            >
              {modelLabels[model]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950 border border-red-700 rounded-sm">
            <div className="flex gap-2 items-start">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-200 text-sm font-mono">{error}</span>
            </div>
          </div>
        )}

        <button
          onClick={retrainModel}
          disabled={loading}
          className="w-full bg-obsidian-800 text-titanium-300 border border-obsidian-600 px-4 py-2 rounded-sm text-sm font-mono hover:bg-obsidian-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader size={16} className="animate-spin" />
              Wird trainiert...
            </span>
          ) : (
            'Modell neu trainieren'
          )}
        </button>
      </div>

      {/* Model Metrics */}
      {modelMetrics && (
        <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
          <h3 className="text-titanium-200 font-mono text-sm mb-4">MODELL-METRIKEN</h3>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="p-3 bg-obsidian-800 border border-obsidian-700 rounded-sm">
              <div className="text-titanium-400 text-xs font-mono mb-1">Genauigkeit</div>
              <div className="text-titanium-50 text-lg font-mono">
                {(modelMetrics.accuracy * 100).toFixed(1)}%
              </div>
            </div>

            <div className="p-3 bg-obsidian-800 border border-obsidian-700 rounded-sm">
              <div className="text-titanium-400 text-xs font-mono mb-1">RMSE</div>
              <div className="text-titanium-50 text-lg font-mono">{modelMetrics.rmse.toFixed(2)}</div>
            </div>

            <div className="p-3 bg-obsidian-800 border border-obsidian-700 rounded-sm">
              <div className="text-titanium-400 text-xs font-mono mb-1">Trainings-Punkte</div>
              <div className="text-titanium-50 text-lg font-mono">{modelMetrics.dataPoints}</div>
            </div>

            <div className="p-3 bg-obsidian-800 border border-obsidian-700 rounded-sm">
              <div className="text-titanium-400 text-xs font-mono mb-1">Zuletzt trainiert</div>
              <div className="text-titanium-50 text-xs font-mono">
                {new Date(modelMetrics.lastTrained).toLocaleDateString('de-DE')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forecast Chart */}
      {forecastData.length > 0 && !loading && (
        <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
          <h3 className="text-titanium-200 font-mono text-sm mb-4">
            {modelLabels[selectedModel]} - 30 Tage
          </h3>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={forecastData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0052FF" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0052FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBounds" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F766E" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0a0b',
                  border: '1px solid #1f2937',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
                labelStyle={{ color: '#e2e2e2' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontFamily: 'monospace' }} />
              <Area
                type="monotone"
                dataKey="lower"
                stackId="1"
                stroke="none"
                fill="url(#colorBounds)"
                name="Untere Grenze"
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stackId="1"
                stroke="#0052FF"
                fill="url(#colorPredicted)"
                name="Vorhersage"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-yellow-500" />
            <h3 className="text-titanium-200 font-mono text-sm">AKTIVE WARNUNGEN ({alerts.length})</h3>
          </div>

          <div className="space-y-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 border rounded-sm ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-mono text-sm mb-1">
                      {alert.alertType.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div className="text-xs mb-2">
                      Metrik: {alert.metric} | Auswirkung: {(alert.impact * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs opacity-90">{alert.action}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && !forecastData.length && (
        <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-12 flex flex-col items-center justify-center gap-4">
          <Loader size={32} className="text-security-blue animate-spin" />
          <div className="text-titanium-400 font-mono text-sm">Forecast wird geladen...</div>
        </div>
      )}

      {!loading && forecastData.length === 0 && !error && (
        <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-8 flex flex-col items-center justify-center gap-4">
          <Activity size={32} className="text-titanium-500" />
          <div className="text-titanium-400 font-mono text-sm text-center">
            Keine Forecast-Daten verfügbar. Trainieren Sie das Modell, um Vorhersagen zu generieren.
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-sm p-4">
        <div className="flex gap-3 items-start">
          <Target size={16} className="text-titanium-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-titanium-200 text-sm font-mono mb-2">Forecast-Modelle</h4>
            <ul className="space-y-1 text-titanium-400 text-xs font-mono">
              <li>
                • <strong>Churn-Vorhersage:</strong> Prognostiziert Kundenabwanderungsrisiko basierend auf
                historischen Trends
              </li>
              <li>
                • <strong>Umsatzprognose:</strong> Lineares Regressionsmodell für Einnahmetrends über
                30 Tage
              </li>
              <li>
                • <strong>LTV-Projektion:</strong> Vorhersage des Lebenszeit-Wertes mit
                Wachstumsfaktoren
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
