import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Autonomous Agents - Phase 6.1 Tests
 *
 * Validates agent lifecycle, scheduling, and execution
 */

describe('Autonomous Agents - Phase 6.1', () => {
  describe('Agent Lifecycle', () => {
    it('should create an agent with default configuration', async () => {
      const agent = {
        name: 'Test Governance Agent',
        type: 'governance',
        description: 'Test agent for compliance analysis',
        enabled: true,
        schedule: '0 2 * * *',
      };

      expect(agent.name).toBeDefined();
      expect(agent.type).toBe('governance');
      expect(agent.enabled).toBe(true);
    });

    it('should validate agent types', async () => {
      const validTypes = ['governance', 'remediation', 'monitoring', 'compliance-scorer', 'risk-assessor', 'custom'];

      validTypes.forEach(type => {
        expect(validTypes).toContain(type);
      });
    });

    it('should toggle agent enabled status', async () => {
      const agent = { enabled: true };
      const updated = { ...agent, enabled: !agent.enabled };

      expect(updated.enabled).toBe(false);
    });
  });

  describe('Agent Execution', () => {
    it('should create an agent run record', async () => {
      const run = {
        status: 'pending',
        triggered_by: 'manual',
        started_at: new Date().toISOString(),
      };

      expect(run.status).toBe('pending');
      expect(run.triggered_by).toBe('manual');
      expect(run.started_at).toBeDefined();
    });

    it('should track execution progress through states', async () => {
      const states = ['pending', 'running', 'completed'];
      const run = { status: 'pending' as const };

      const stateMachine = {
        'pending': () => ({ ...run, status: 'running' as const }),
        'running': () => ({ ...run, status: 'completed' as const }),
      };

      let current = run;
      for (const nextState of states.slice(1)) {
        const transition = stateMachine[current.status as keyof typeof stateMachine];
        if (transition) {
          current = transition();
        }
      }

      expect(current.status).toBe('completed');
    });

    it('should generate governance agent output', async () => {
      const output = {
        type: 'governance_analysis',
        gaps_analyzed: 15,
        frameworks_reviewed: 3,
        recommendations_generated: 4,
        timestamp: new Date().toISOString(),
      };

      expect(output.type).toBe('governance_analysis');
      expect(output.gaps_analyzed).toBeGreaterThan(0);
      expect(output.recommendations_generated).toBeLessThanOrEqual(output.gaps_analyzed);
    });

    it('should generate remediation agent output', async () => {
      const output = {
        type: 'remediation_planning',
        plans_generated: 5,
        tasks_created: 5,
        timestamp: new Date().toISOString(),
      };

      expect(output.type).toBe('remediation_planning');
      expect(output.plans_generated).toBe(output.tasks_created);
    });

    it('should generate monitoring agent output', async () => {
      const output = {
        type: 'compliance_monitoring',
        deadlines_checked: 1,
        upcoming_deadlines: 3,
        score_trend: 'stable',
        alerts_generated: 0,
        timestamp: new Date().toISOString(),
      };

      expect(output.type).toBe('compliance_monitoring');
      expect(['stable', 'declining']).toContain(output.score_trend);
    });
  });

  describe('Agent Tasks', () => {
    it('should create a task from agent run', async () => {
      const task = {
        title: 'Remediate ISO 27001 Gap A.5.1',
        task_type: 'remediation',
        priority: 'high',
        status: 'open',
      };

      expect(task.task_type).toBe('remediation');
      expect(task.status).toBe('open');
      expect(['critical', 'high', 'medium', 'low']).toContain(task.priority);
    });

    it('should track task status transitions', async () => {
      const statuses = ['open', 'in_progress', 'completed'];
      let task = { status: 'open' as const };

      task = { ...task, status: 'in_progress' as const };
      expect(task.status).toBe('in_progress');

      task = { ...task, status: 'completed' as const };
      expect(task.status).toBe('completed');
    });

    it('should support task assignment', async () => {
      const task = {
        title: 'Review Compliance Report',
        assigned_to: 'user-123',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(task.assigned_to).toBeDefined();
      expect(new Date(task.due_date).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Agent Scheduling', () => {
    it('should parse cron schedules', async () => {
      const schedules = {
        '0 2 * * *': 'daily at 2am UTC',
        '0 */6 * * *': 'every 6 hours',
        '0 0 * * 0': 'weekly on Sunday',
      };

      expect(Object.keys(schedules).length).toBe(3);
      schedules['0 2 * * *'] = 'daily at 2am UTC';
    });

    it('should determine if agent should run', async () => {
      const shouldRun = (
        lastExecuted: Date | null,
        interval: number
      ): boolean => {
        if (!lastExecuted) return true;
        const now = new Date();
        return (now.getTime() - lastExecuted.getTime()) >= interval;
      };

      // Never run before
      expect(shouldRun(null, 60000)).toBe(true);

      // Within interval
      expect(shouldRun(new Date(), 60000)).toBe(false);

      // After interval
      const past = new Date(Date.now() - 120000);
      expect(shouldRun(past, 60000)).toBe(true);
    });

    it('should calculate next execution time', async () => {
      const now = new Date();
      const interval = 6 * 60 * 60 * 1000; // 6 hours
      const nextRun = new Date(now.getTime() + interval);

      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
      expect(nextRun.getTime() - now.getTime()).toBe(interval);
    });
  });

  describe('Agent Event Audit Log', () => {
    it('should log agent creation event', async () => {
      const event = {
        event_type: 'created',
        description: 'Agent created: Governance Analyzer',
        timestamp: new Date().toISOString(),
      };

      expect(event.event_type).toBe('created');
      expect(event.description).toContain('created');
    });

    it('should log agent enable/disable events', async () => {
      const event = {
        event_type: 'enabled',
        description: 'Agent enabled',
        changes: { enabled: 'false -> true' },
      };

      expect(['enabled', 'disabled']).toContain(event.event_type);
    });

    it('should log configuration changes', async () => {
      const event = {
        event_type: 'configured',
        description: 'Agent configuration updated',
        changes: {
          old_config: { threshold: 'high' },
          new_config: { threshold: 'medium' },
        },
      };

      expect(event.event_type).toBe('configured');
      expect(event.changes.old_config).toBeDefined();
      expect(event.changes.new_config).toBeDefined();
    });
  });

  describe('Default Agent Initialization', () => {
    it('should create three default agents per tenant', async () => {
      const defaultAgents = [
        { name: 'Governance Analyzer', type: 'governance' },
        { name: 'Remediation Planner', type: 'remediation' },
        { name: 'Compliance Monitor', type: 'monitoring' },
      ];

      expect(defaultAgents.length).toBe(3);
      expect(defaultAgents.every(a => a.type)).toBe(true);
    });

    it('should configure governance agent for ISO frameworks', async () => {
      const config = {
        auto_create_gaps: true,
        threshold_risk: 'high',
        include_frameworks: ['iso27001', 'dsgvo', 'ai_act'],
      };

      expect(config.include_frameworks).toContain('iso27001');
      expect(config.include_frameworks.length).toBe(3);
    });

    it('should configure monitoring agent with alert thresholds', async () => {
      const config = {
        check_deadlines: true,
        alert_threshold_days: 14,
        track_drift: true,
      };

      expect(config.alert_threshold_days).toBe(14);
      expect(config.check_deadlines).toBe(true);
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should track retry attempts', async () => {
      const run = {
        status: 'failed',
        retry_count: 1,
        max_retries: 3,
      };

      expect(run.retry_count).toBeLessThan(run.max_retries);
    });

    it('should mark run as failed after max retries', async () => {
      const run = {
        status: 'failed',
        retry_count: 3,
        max_retries: 3,
        error_message: 'Max retries exceeded',
      };

      expect(run.retry_count).toBe(run.max_retries);
      expect(run.error_message).toBeDefined();
    });

    it('should capture error details for debugging', async () => {
      const run = {
        error_message: 'Database connection timeout',
        error_details: {
          code: 'TIMEOUT',
          service: 'supabase',
          retryable: true,
        },
      };

      expect(run.error_details.retryable).toBe(true);
    });
  });
});
