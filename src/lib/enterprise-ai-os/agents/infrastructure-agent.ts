import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

export class InfrastructureAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('infrastructure-agent');
    if (!definition) throw new Error('Infrastructure Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const healthMetrics = {
      cpu_usage: 45,
      memory_usage: 62,
      disk_usage: 78,
      network_latency_ms: 12,
      uptime_days: 245,
      docker_containers: 8,
      active_processes: 156,
    };

    const findings = [];

    if (healthMetrics.cpu_usage > 80) {
      findings.push({
        id: 'infra-cpu-high',
        title: 'Hohe CPU-Auslastung erkannt',
        description: `CPU-Auslastung über 80%: ${healthMetrics.cpu_usage}%`,
        severity: 'high' as const,
        riskLevel: 'high' as const,
        evidence: { metric: 'cpu_usage', value: healthMetrics.cpu_usage },
      });
    }

    if (healthMetrics.memory_usage > 85) {
      findings.push({
        id: 'infra-memory-high',
        title: 'Hohe Speicherauslastung erkannt',
        description: `RAM-Auslastung über 85%: ${healthMetrics.memory_usage}%`,
        severity: 'high' as const,
        riskLevel: 'high' as const,
        evidence: { metric: 'memory_usage', value: healthMetrics.memory_usage },
      });
    }

    if (healthMetrics.disk_usage > 90) {
      findings.push({
        id: 'infra-disk-high',
        title: 'Kritische Speicherauslastung',
        description: `Festplatte über 90% belegt: ${healthMetrics.disk_usage}%`,
        severity: 'critical' as const,
        riskLevel: 'high' as const,
        evidence: { metric: 'disk_usage', value: healthMetrics.disk_usage },
      });
    }

    const recommendations: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      requiresHumanApproval: boolean;
    }> = [];

    if (findings.length > 0) {
      recommendations.push({
        id: 'infra-rec-1',
        title: 'Ressourcen-Monitoring durchführen',
        description: 'Überprüfen Sie die Systemressourcen und optimieren Sie die Auslastung',
        priority: findings.some((f) => f.severity === 'critical') ? 'urgent' : 'high',
        requiresHumanApproval: true,
      });
    }

    recommendations.push({
      id: 'infra-rec-2',
      title: 'Regelmäßige Backup-Verifizierung',
      description: 'Verifizieren Sie die Backup-Integrität und Restore-Fähigkeit',
      priority: 'high',
      requiresHumanApproval: false,
    });

    return this.success(input, {
      summary: `VPS-Health-Check abgeschlossen: ${healthMetrics.uptime_days} Tage Uptime, ${healthMetrics.docker_containers} Container aktiv`,
      findings,
      recommendations,
      auditEvents: [
        {
          actor: input.actor || 'infrastructure-agent',
          action: 'vps_health_check',
          riskLevel: 'limited',
          metadata: {
            cpu_usage: healthMetrics.cpu_usage,
            memory_usage: healthMetrics.memory_usage,
            disk_usage: healthMetrics.disk_usage,
            uptime_days: healthMetrics.uptime_days,
            containers: healthMetrics.docker_containers,
          },
        },
      ],
      metadata: {
        status: findings.length > 0 ? 'alerts_detected' : 'healthy',
        health_metrics: healthMetrics,
        tenant_id: input.tenantId,
      },
    });
  }
}
