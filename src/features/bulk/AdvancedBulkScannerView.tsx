import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Zap, Activity, TrendingUp, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { Button } from '../../enterprise-os/components/Button';
import { useTenant } from '../../core/access/TenantProvider';
import type { BatchProgress } from './bulkApi';

interface AdvancedScanConfig {
  priority: 'normal' | 'high' | 'urgent';
  parallel_workers: number;
  timeout_per_domain: number; // seconds
  retry_failed: boolean;
  include_deep_scan: boolean;
  export_format: 'json' | 'csv' | 'pdf';
}

interface WorkerPoolStatus {
  total_workers: number;
  active_workers: number;
  idle_workers: number;
  avg_throughput: number; // domains per minute
  estimated_completion_time: string;
}

const DEFAULT_CONFIG: AdvancedScanConfig = {
  priority: 'normal',
  parallel_workers: 4,
  timeout_per_domain: 30,
  retry_failed: true,
  include_deep_scan: false,
  export_format: 'json',
};

const PRIORITY_CONFIGS = {
  normal: { workers: 4, cost_multiplier: 1.0 },
  high: { workers: 8, cost_multiplier: 1.2 },
  urgent: { workers: 16, cost_multiplier: 1.5 },
};

export interface AdvancedBulkScannerProps {
  batchId?: string;
  onProgress?: (progress: BatchProgress) => void;
}

export function AdvancedBulkScannerView({ batchId, onProgress }: AdvancedBulkScannerProps) {
  const { activeTenantId } = useTenant();
  const [config, setConfig] = useState<AdvancedScanConfig>(DEFAULT_CONFIG);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerPoolStatus | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const domainsRemaining = progress ? progress.total - progress.succeeded - progress.failed : 0;
  const completionRate = progress ? ((progress.succeeded + progress.failed) / progress.total * 100).toFixed(1) : 0;

  const costPerDomain = config.include_deep_scan ? 0.02 : 0.01;
  const multiplier = PRIORITY_CONFIGS[config.priority].cost_multiplier;

  useEffect(() => {
    if (!batchId) return;

    const pollProgress = async () => {
      try {
        // In real implementation, fetch from API
        // const newProgress = await getBatchProgress(batchId);
        // setProgress(newProgress);
        // if (onProgress) onProgress(newProgress);

        // Mock data for demo
        setProgress({
          total: 1000,
          queued: 200,
          running: 50,
          succeeded: 650,
          failed: 100,
          cancelled: 0,
        });

        setWorkerStatus({
          total_workers: config.parallel_workers,
          active_workers: Math.floor(config.parallel_workers * 0.7),
          idle_workers: Math.floor(config.parallel_workers * 0.3),
          avg_throughput: 45,
          estimated_completion_time: '12 minutes',
        });
      } catch (err) {
        console.error('Failed to poll progress:', err);
      }
    };

    pollProgress();
    pollingRef.current = setInterval(pollProgress, 3000); // Poll every 3 seconds

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [batchId, config.parallel_workers, onProgress]);

  useEffect(() => {
    const totalDomains = progress?.total || 0;
    const cost = totalDomains * costPerDomain * multiplier;
    setEstimatedCost(cost);
  }, [progress, costPerDomain, multiplier]);

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader title="Scan-Konfiguration" eyebrow="Erweiterte Optionen" />
        <CardBody>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Priority */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                <Zap className="inline h-3.5 w-3.5 mr-1" />
                Priorität
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['normal', 'high', 'urgent'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setConfig({ ...config, priority: p })}
                    className={`py-2 px-3 border text-sm font-semibold transition-all text-center ${
                      config.priority === p
                        ? 'border-security-500 bg-security-500/10 text-security-300'
                        : 'border-titanium-700 bg-obsidian-900 text-titanium-300 hover:border-titanium-600'
                    }`}
                  >
                    <div className="capitalize">{p}</div>
                    <div className="text-[10px] opacity-75">
                      {PRIORITY_CONFIGS[p].workers}W · {(PRIORITY_CONFIGS[p].cost_multiplier * 100).toFixed(0)}%
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Parallel Workers */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                <Activity className="inline h-3.5 w-3.5 mr-1" />
                Worker-Pool
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="32"
                  value={config.parallel_workers}
                  onChange={(e) => setConfig({ ...config, parallel_workers: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="font-mono text-sm text-titanium-300 min-w-[3rem] text-right">
                  {config.parallel_workers}
                </span>
              </div>
              <p className="text-[10px] text-titanium-500 mt-1">Höhere Werte = schneller aber kostenintensiver</p>
            </div>

            {/* Timeout */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                <Clock className="inline h-3.5 w-3.5 mr-1" />
                Timeout pro Domain
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={config.timeout_per_domain}
                  onChange={(e) => setConfig({ ...config, timeout_per_domain: parseInt(e.target.value) })}
                  className="flex-1 border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100"
                />
                <span className="text-sm text-titanium-500">Sekunden</span>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.retry_failed}
                  onChange={(e) => setConfig({ ...config, retry_failed: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-titanium-300">Fehlgeschlagene erneut versuchen</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.include_deep_scan}
                  onChange={(e) => setConfig({ ...config, include_deep_scan: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-titanium-300">Deep-Scan (2x Kosten)</span>
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Progress & Metrics */}
      {progress && (
        <>
          <Card>
            <CardHeader title="Scan-Fortschritt" eyebrow={`${completionRate}% abgeschlossen`} />
            <CardBody>
              <div className="space-y-6">
                {/* Progress Bar */}
                <div>
                  <div className="h-8 bg-obsidian-900 border border-titanium-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-security-600 to-security-400"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-center text-[10px]">
                    <div>
                      <div className="font-bold text-emerald-400">{progress.succeeded}</div>
                      <div className="text-titanium-500">✓ Erfolg</div>
                    </div>
                    <div>
                      <div className="font-bold text-amber-400">{progress.running}</div>
                      <div className="text-titanium-500">◆ Läuft</div>
                    </div>
                    <div>
                      <div className="font-bold text-titanium-400">{progress.queued}</div>
                      <div className="text-titanium-500">⊙ In Warteschlange</div>
                    </div>
                    <div>
                      <div className="font-bold text-risk-critical">{progress.failed}</div>
                      <div className="text-titanium-500">✗ Fehler</div>
                    </div>
                  </div>
                </div>

                {/* Worker Pool Status */}
                {workerStatus && (
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="border border-titanium-800 bg-obsidian-900 p-3">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Worker aktiv</div>
                      <div className="text-2xl font-bold text-security-400">
                        {workerStatus.active_workers}/{workerStatus.total_workers}
                      </div>
                    </div>
                    <div className="border border-titanium-800 bg-obsidian-900 p-3">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Durchsatz</div>
                      <div className="text-2xl font-bold text-emerald-400">{workerStatus.avg_throughput}<span className="text-sm">/min</span></div>
                    </div>
                    <div className="border border-titanium-800 bg-obsidian-900 p-3">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Verbleibend</div>
                      <div className="text-2xl font-bold text-amber-400">{domainsRemaining}</div>
                    </div>
                    <div className="border border-titanium-800 bg-obsidian-900 p-3">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">ETA</div>
                      <div className="text-lg font-bold text-titanium-300">{workerStatus.estimated_completion_time}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Cost Estimation */}
          <Card>
            <CardHeader title="Cost Estimation" eyebrow="Basierend auf Scan-Einstellungen" />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="border border-titanium-800 bg-obsidian-900 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">Kosten pro Domain</div>
                  <div className="text-2xl font-bold font-display">
                    ${(costPerDomain * multiplier).toFixed(4)}
                  </div>
                </div>
                <div className="border border-titanium-800 bg-obsidian-900 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">Gesamtkosten</div>
                  <div className="text-2xl font-bold font-display text-security-400">
                    <DollarSign className="inline h-5 w-5" />
                    {estimatedCost.toFixed(2)}
                  </div>
                </div>
                <div className="border border-titanium-800 bg-obsidian-900 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">Multiplikator</div>
                  <div className="text-2xl font-bold font-display">
                    {(multiplier * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button>
          <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
          Scan starten
        </Button>
        <Button variant="secondary">
          Exportieren (JSON)
        </Button>
      </div>
    </div>
  );
}
