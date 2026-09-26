/**
 * Test fixtures for Supabase and runtime services.
 * Provides utilities for integration and E2E tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import type { ExecutorDeps } from '../../src/core/runtime/executor';
import { Executor } from '../../src/core/runtime/executor';
import type { ApprovalGateService } from '../../src/core/runtime/approvals';
import { PostgresApprovalGateService } from '../../src/core/runtime/approvals/postgres-implementation';
import { SkillRegistry } from '../../src/core/runtime/registry';
import { HandlerRegistry } from '../../src/core/runtime/handlers';
import type { PermissionChecker } from '../../src/core/runtime/permissions';
import type { EventBus } from '../../src/core/runtime/events';
import { InMemoryEventBus } from '../../src/core/runtime/events';
import type { ExecutionTracer } from '../../src/core/runtime/observability';
import { InMemoryExecutionTracer } from '../../src/core/runtime/observability';

/**
 * Create a test Supabase client pointing to local dev instance.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */
export async function createTestSupabaseClient(): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL || 'http://localhost:54321';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify connection
  const { error } = await supabase.from('runtime_approval_gates').select('id').limit(1);
  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to connect to Supabase: ${error.message}`);
  }

  return supabase;
}

/**
 * Create a test Executor with all dependencies wired up.
 */
export async function createTestExecutor(options: {
  supabase: SupabaseClient;
  approvalService?: ApprovalGateService;
  skillRegistry?: SkillRegistry;
  handlers?: HandlerRegistry;
  permissions?: PermissionChecker;
  tracer?: ExecutionTracer;
  eventBus?: EventBus;
  tenantId?: string;
}): Promise<Executor> {
  const supabase = options.supabase;

  // Default approval service (Postgres-backed)
  const approvalService = options.approvalService || new PostgresApprovalGateService(supabase, options.tenantId);

  // Default event bus (in-memory for tests)
  const eventBus = options.eventBus || new InMemoryEventBus();

  // Default tracer (in-memory for tests)
  const tracer = options.tracer || new InMemoryExecutionTracer();

  // Default registries (empty for tests; override as needed)
  const registry = options.skillRegistry || createTestSkillRegistry();
  const handlers = options.handlers || createTestHandlerRegistry();
  const permissions = options.permissions || createTestPermissionChecker();

  const deps: ExecutorDeps = {
    registry,
    handlers,
    permissions,
    tracer,
    events: eventBus,
    gates: approvalService,
  };

  return new Executor(deps);
}

/**
 * Create a test skill registry with common skills pre-registered.
 */
export function createTestSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();

  registry.register({
    id: 'builder.publish',
    version: 1,
    title: 'Publish Website',
    description: 'Publish a website to production',
    capabilities: ['write:website', 'network:external'],
    risk_level: 'high',
    auto_approve: false, // Requires approval
    pii_class: 'none',
    idempotent: true,
  });

  registry.register({
    id: 'builder.update',
    version: 1,
    title: 'Update Website',
    description: 'Update website content',
    capabilities: ['write:website'],
    risk_level: 'medium',
    auto_approve: false,
    pii_class: 'none',
    idempotent: true,
  });

  registry.register({
    id: 'test.read',
    version: 1,
    title: 'Read Test',
    description: 'Test read-only action',
    capabilities: ['read:data'],
    risk_level: 'low',
    auto_approve: true, // No approval needed
    pii_class: 'none',
    idempotent: true,
  });

  return registry;
}

/**
 * Create a test handler registry with no-op handlers.
 */
export function createTestHandlerRegistry(): HandlerRegistry {
  const registry = new HandlerRegistry();

  // Register simple no-op handlers for test skills
  registry.register('builder.publish', async () => ({
    output_hash: 'hash-builder-publish',
    output: { success: true, published: true },
  }));

  registry.register('builder.update', async () => ({
    output_hash: 'hash-builder-update',
    output: { success: true, updated: true },
  }));

  registry.register('test.read', async () => ({
    output_hash: 'hash-test-read',
    output: { success: true, data: [] },
  }));

  return registry;
}

/**
 * Create a test permission checker that allows everything by default.
 */
export function createTestPermissionChecker(): PermissionChecker {
  return {
    check: async () => {
      return { outcome: 'granted' };
    },
  };
}

/**
 * Cleanup helper: delete all test records for a tenant.
 */
export async function cleanupTestTenant(supabase: SupabaseClient, tenantId: string): Promise<void> {
  await Promise.all([
    supabase.from('runtime_approval_gates').delete().eq('tenant_id', tenantId),
    supabase.from('runtime_approval_events').delete().match({ gate_id: tenantId }),
    supabase.from('runtime_execution_records').delete().eq('tenant_id', tenantId),
  ]);
}
