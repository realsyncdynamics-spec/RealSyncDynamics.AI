import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

interface WorkflowTask {
  description: string;
  dependsOn?: string[];
  owner?: string;
  dueDate?: string;
}

interface ExecutionPlan {
  phase: string;
  tasks: string[];
  estimatedDays: number;
  criticalPath: boolean;
}

export class WorkflowAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('workflow-agent');
    if (!definition) throw new Error('Workflow Agent definition missing');
    super(definition);
  }

  private generateExecutionPhases(steps: string[]): ExecutionPlan[] {
    if (steps.length === 0) return [];

    const plans: ExecutionPlan[] = [];

    if (steps.length <= 3) {
      return [
        {
          phase: 'immediate',
          tasks: steps,
          estimatedDays: 1,
          criticalPath: true,
        },
      ];
    }

    const criticalCount = Math.ceil(steps.length / 3);
    const criticalSteps = steps.slice(0, criticalCount);
    const implementationSteps = steps.slice(criticalCount, criticalCount * 2);
    const verificationSteps = steps.slice(criticalCount * 2);

    plans.push({
      phase: 'foundation',
      tasks: criticalSteps,
      estimatedDays: 2,
      criticalPath: true,
    });

    if (implementationSteps.length > 0) {
      plans.push({
        phase: 'implementation',
        tasks: implementationSteps,
        estimatedDays: 3,
        criticalPath: true,
      });
    }

    if (verificationSteps.length > 0) {
      plans.push({
        phase: 'verification',
        tasks: verificationSteps,
        estimatedDays: 2,
        criticalPath: false,
      });
    }

    return plans;
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const steps = Array.isArray(input.payload.steps)
      ? (input.payload.steps as unknown[]).map(String)
      : [];
    const workflowType = String(input.payload.workflowType || 'remediation');
    const priority = input.payload.priority || 'high';

    if (steps.length === 0) {
      return this.success(input, {
        summary: 'No workflow steps provided.',
        findings: [],
        recommendations: [],
        auditEvents: [
          {
            actor: input.actor || 'workflow-agent',
            action: 'workflow_empty',
            riskLevel: 'limited',
            metadata: { tenantId: input.tenantId },
          },
        ],
        metadata: { stepCount: 0 },
      });
    }

    const executionPhases = this.generateExecutionPhases(steps);
    const totalEstimatedDays = executionPhases.reduce((sum, p) => sum + p.estimatedDays, 0);
    const criticalPathPhases = executionPhases.filter((p) => p.criticalPath);

    const recommendations: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      requiresHumanApproval: boolean;
    }> = [];

    executionPhases.forEach((phase, phaseIdx) => {
      phase.tasks.forEach((task, taskIdx) => {
        recommendations.push({
          id: `${phase.phase}-${taskIdx}`,
          title: `[Phase ${phaseIdx + 1}: ${phase.phase}] ${task.substring(0, 50)}...`,
          description: task,
          priority:
            phase.criticalPath && (priority === 'urgent' || priority === 'high')
              ? ('high' as const)
              : ('medium' as const),
          requiresHumanApproval: true,
        });
      });
    });

    const findings = executionPhases.length > 0 ? [
      {
        id: 'workflow-execution-plan',
        title: `Execution plan: ${executionPhases.length} phases, ${totalEstimatedDays} days estimated`,
        description: `Organized into phases: ${executionPhases.map((p) => `${p.phase} (${p.estimatedDays}d)`).join(', ')}. Critical path includes ${criticalPathPhases.length} phase(s).`,
        severity: 'medium' as const,
        riskLevel: 'limited' as const,
        evidence: {
          phases: executionPhases.length,
          criticalPathLength: criticalPathPhases.length,
          totalEstimatedDays,
          workflowType,
        },
      },
    ] : [];

    return this.requiresApproval(input, {
      summary: `Workflow plan: ${steps.length} tasks in ${executionPhases.length} phases over ${totalEstimatedDays} days. Requires approval for execution.`,
      findings,
      recommendations,
      auditEvents: [
        {
          actor: input.actor || 'workflow-agent',
          action: 'workflow_plan_generated',
          riskLevel: priority === 'urgent' ? 'high' : 'limited',
          metadata: {
            stepCount: steps.length,
            phaseCount: executionPhases.length,
            estimatedDays: totalEstimatedDays,
            criticalPhases: criticalPathPhases.length,
            workflowType,
            priority,
            tenantId: input.tenantId,
          },
        },
      ],
      metadata: {
        stepCount: steps.length,
        phaseCount: executionPhases.length,
        executionPhases: executionPhases.map((p) => ({
          phase: p.phase,
          taskCount: p.tasks.length,
          estimatedDays: p.estimatedDays,
          criticalPath: p.criticalPath,
        })),
        totalEstimatedDays,
        workflowType,
      },
    });
  }
}
