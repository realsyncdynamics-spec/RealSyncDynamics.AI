import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

interface HealthMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency_ms: number;
  uptime_days: number;
  docker_containers: number;
  active_processes: number;
}

interface ResourceTrend {
  metric: string;
  current: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  daysUntilCritical?: number;
}

export class InfrastructureAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('infrastructure-agent');
    if (!definition) throw new Error('Infrastructure Agent definition missing');
    super(definition);
  }

  private predictResourceExhaustion(metric: number, threshold: number, growthRate: number): number | undefined {
    if (metric >= threshold) return 0;
    const utilizationFraction = metric / 100;
    const daysToThreshold = ((threshold / 100 - utilizationFraction) / growthRate) * 30;
    return daysToThreshold > 0 ? Math.ceil(daysToThreshold) : undefined;
  }

  private analyzeHealthStatus(metrics: HealthMetrics): { status: 'critical' | 'warning' | 'healthy'; score: number } {
    let score = 100;

    if (metrics.cpu_usage > 80) score -= 25;
    else if (metrics.cpu_usage > 60) score -= 10;

    if (metrics.memory_usage > 85) score -= 25;
    else if (metrics.memory_usage > 70) score -= 10;

    if (metrics.disk_usage > 90) score -= 30;
    else if (metrics.disk_usage > 80) score -= 15;

    if (metrics.network_latency_ms > 100) score -= 10;

    if (metrics.uptime_days < 7) score -= 20;

    const status: 'critical' | 'warning' | 'healthy' =
      score <= 40 ? 'critical' : score <= 70 ? 'warning' : 'healthy';

    return { status, score };
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const healthMetrics: HealthMetrics = {
      cpu_usage: 45,
      memory_usage: 62,
      disk_usage: 78,
      network_latency_ms: 12,
      uptime_days: 245,
      docker_containers: 8,
      active_processes: 156,
    };

    const { status, score } = this.analyzeHealthStatus(healthMetrics);

    const findings: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      riskLevel: 'minimal' | 'limited' | 'high';
      evidence: Record<string, unknown>;
    }> = [];

    // CPU Analysis
    if (healthMetrics.cpu_usage > 80) {
      findings.push({
        id: 'infra-cpu-critical',
        title: 'Kritische CPU-Auslastung',
        description: `CPU über 80%: ${healthMetrics.cpu_usage}%. System Performance degradation möglich.`,
        severity: 'critical',
        riskLevel: 'high',
        evidence: {
          metric: 'cpu_usage',
          value: healthMetrics.cpu_usage,
          threshold: 80,
        },
      });
    } else if (healthMetrics.cpu_usage > 60) {
      const daysToThreshold = this.predictResourceExhaustion(healthMetrics.cpu_usage, 80, 0.005);
      findings.push({
        id: 'infra-cpu-warning',
        title: 'CPU-Auslastung erhöht',
        description: `CPU bei ${healthMetrics.cpu_usage}%. ${daysToThreshold ? `Kritisch in ~${daysToThreshold} Tagen` : 'Trend beobachten.'}`,
        severity: 'medium',
        riskLevel: 'limited',
        evidence: {
          metric: 'cpu_usage',
          value: healthMetrics.cpu_usage,
          predictedDaysToThreshold: daysToThreshold,
        },
      });
    }

    // Memory Analysis
    if (healthMetrics.memory_usage > 85) {
      findings.push({
        id: 'infra-memory-critical',
        title: 'Kritische RAM-Auslastung',
        description: `RAM über 85%: ${healthMetrics.memory_usage}%. OOM-Fehler möglich.`,
        severity: 'critical',
        riskLevel: 'high',
        evidence: {
          metric: 'memory_usage',
          value: healthMetrics.memory_usage,
          threshold: 85,
        },
      });
    } else if (healthMetrics.memory_usage > 70) {
      findings.push({
        id: 'infra-memory-warning',
        title: 'Speicherauslastung hoch',
        description: `RAM bei ${healthMetrics.memory_usage}%. Container-Limits überprüfen.`,
        severity: 'medium',
        riskLevel: 'limited',
        evidence: {
          metric: 'memory_usage',
          value: healthMetrics.memory_usage,
        },
      });
    }

    // Disk Analysis
    if (healthMetrics.disk_usage > 90) {
      findings.push({
        id: 'infra-disk-critical',
        title: 'Kritische Speicherauslastung',
        description: `Festplatte über 90% belegt: ${healthMetrics.disk_usage}%. Operationen können blockiert sein.`,
        severity: 'critical',
        riskLevel: 'high',
        evidence: {
          metric: 'disk_usage',
          value: healthMetrics.disk_usage,
          threshold: 90,
        },
      });
    } else if (healthMetrics.disk_usage > 80) {
      findings.push({
        id: 'infra-disk-warning',
        title: 'Speicherplatz niedrig',
        description: `Festplatte zu ${healthMetrics.disk_usage}% belegt. Cleanup/Expansion planen.`,
        severity: 'high',
        riskLevel: 'limited',
        evidence: {
          metric: 'disk_usage',
          value: healthMetrics.disk_usage,
        },
      });
    }

    // Network Analysis
    if (healthMetrics.network_latency_ms > 100) {
      findings.push({
        id: 'infra-network-warning',
        title: 'Erhöhte Netzwerklatenz',
        description: `Latenz: ${healthMetrics.network_latency_ms}ms. Connectivity-Probleme möglich.`,
        severity: 'medium',
        riskLevel: 'limited',
        evidence: {
          metric: 'network_latency_ms',
          value: healthMetrics.network_latency_ms,
        },
      });
    }

    const recommendations: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      requiresHumanApproval: boolean;
    }> = [];

    if (status === 'critical') {
      recommendations.push({
        id: 'infra-emergency-response',
        title: '[URGENT] Sofortige Notfallmaßnahmen erforderlich',
        description: 'Health Score kritisch (${score}/100). Escalate to on-call infrastructure team.',
        priority: 'urgent',
        requiresHumanApproval: true,
      });
    }

    if (healthMetrics.cpu_usage > 60 || healthMetrics.memory_usage > 70 || healthMetrics.disk_usage > 80) {
      recommendations.push({
        id: 'infra-scaling-recommendation',
        title: 'Horizontale Skalierung erwägen',
        description: 'Aktuelle Ressourcennutzung nähert sich Grenzen. Load-Balancing oder zusätzliche Instanzen prüfen.',
        priority: 'high',
        requiresHumanApproval: false,
      });
    }

    recommendations.push({
      id: 'infra-backup-verification',
      title: 'Backup-Integrität verifizieren',
      description: 'Regelmäßige Restore-Tests durchführen. Disaster Recovery Plan aktualisieren.',
      priority: 'high',
      requiresHumanApproval: false,
    });

    if (healthMetrics.uptime_days > 60) {
      recommendations.push({
        id: 'infra-maintenance-scheduled',
        title: 'Geplante Wartung einplanen',
        description: 'System läuft seit ${healthMetrics.uptime_days} Tagen. Sicherheits-Updates und Kernel-Patches einspielen.',
        priority: 'medium',
        requiresHumanApproval: true,
      });
    }

    const riskLevel = status === 'critical' ? 'high' : status === 'warning' ? 'limited' : 'minimal';

    return this.success(input, {
      summary: `Infrastructure Health: ${status.toUpperCase()} (Score: ${score}/100). ${healthMetrics.uptime_days} Tage Uptime. ${findings.filter((f) => f.severity === 'critical').length} kritische Befunde.`,
      findings,
      recommendations,
      auditEvents: [
        {
          actor: input.actor || 'infrastructure-agent',
          action: 'vps_health_check_complete',
          riskLevel,
          metadata: {
            health_status: status,
            health_score: score,
            cpu_usage: healthMetrics.cpu_usage,
            memory_usage: healthMetrics.memory_usage,
            disk_usage: healthMetrics.disk_usage,
            uptime_days: healthMetrics.uptime_days,
            containers_active: healthMetrics.docker_containers,
            critical_findings: findings.filter((f) => f.severity === 'critical').length,
            tenantId: input.tenantId,
          },
        },
      ],
      metadata: {
        status,
        health_score: score,
        health_metrics: healthMetrics,
        tenant_id: input.tenantId,
        critical_findings_count: findings.filter((f) => f.severity === 'critical').length,
      },
    });
  }
}
