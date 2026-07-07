import { useCallback } from 'react';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { useTenant } from '../../core/access/TenantProvider';

type OperationType = 'view' | 'export' | 'filter_apply' | 'sync_trigger' | 'integration_connect';
type ResourceType = 'dashboard' | 'metrics' | 'export' | 'integration' | 'tool_config';
type SensitivityLevel = 'high' | 'medium' | 'low';

interface AuditLogEntry {
  operationType: OperationType;
  resourceType: ResourceType;
  resourceId?: string;
  actionDetails?: Record<string, unknown>;
  sensitivityLevel?: SensitivityLevel;
}

interface UseAuditLogOptions {
  enabled?: boolean;
}

/**
 * Hook for logging user operations to audit trail for compliance reporting
 * Automatically captures IP, user agent, and timestamp
 */
export function useAuditLog(options: UseAuditLogOptions = { enabled: true }) {
  const { session } = useSupabaseAuth();
  const { activeTenantId } = useTenant();

  const logOperation = useCallback(
    async (entry: AuditLogEntry) => {
      if (!options.enabled || !session?.access_token || !activeTenantId) {
        return;
      }

      try {
        const logEntry = {
          tenant_id: activeTenantId,
          user_id: session.user?.id,
          operation_type: entry.operationType,
          resource_type: entry.resourceType,
          resource_id: entry.resourceId || null,
          action_details: entry.actionDetails || {},
          data_sensitivity_level: entry.sensitivityLevel || 'high',
          success: true,
          error_message: null,
        };

        // Insert into audit log via RPC
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/log_seo_dashboard_operation`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              p_tenant_id: logEntry.tenant_id,
              p_user_id: logEntry.user_id,
              p_operation_type: logEntry.operation_type,
              p_resource_type: logEntry.resource_type,
              p_resource_id: logEntry.resource_id,
              p_action_details: logEntry.action_details,
              p_data_sensitivity_level: logEntry.data_sensitivity_level,
            }),
          }
        );

        if (!response.ok) {
          console.error('Failed to log operation:', response.statusText);
        }
      } catch (error) {
        console.error('Audit logging error:', error);
      }
    },
    [session, activeTenantId, options.enabled]
  );

  const logDashboardView = useCallback(
    async (viewType: string = 'main') => {
      await logOperation({
        operationType: 'view',
        resourceType: 'dashboard',
        actionDetails: { view_type: viewType },
        sensitivityLevel: 'low',
      });
    },
    [logOperation]
  );

  const logExport = useCallback(
    async (exportType: 'csv' | 'json' | 'pdf', recordCount: number, classification: string = 'business') => {
      await logOperation({
        operationType: 'export',
        resourceType: 'export',
        resourceId: `export_${Date.now()}`,
        actionDetails: {
          export_type: exportType,
          record_count: recordCount,
          data_classification: classification,
        },
        sensitivityLevel: classification === 'sensitive' || classification === 'financial' ? 'high' : 'medium',
      });
    },
    [logOperation]
  );

  const logFilterApply = useCallback(
    async (filters: Record<string, unknown>) => {
      await logOperation({
        operationType: 'filter_apply',
        resourceType: 'dashboard',
        resourceId: `filter_${Date.now()}`,
        actionDetails: {
          filters: filters,
          filter_count: Object.keys(filters).length,
        },
        sensitivityLevel: 'low',
      });
    },
    [logOperation]
  );

  const logSyncTrigger = useCallback(
    async (integrationId: string, integrationProvider: string) => {
      await logOperation({
        operationType: 'sync_trigger',
        resourceType: 'integration',
        resourceId: integrationId,
        actionDetails: {
          provider: integrationProvider,
          timestamp: new Date().toISOString(),
        },
        sensitivityLevel: 'high',
      });
    },
    [logOperation]
  );

  const logIntegrationConnect = useCallback(
    async (provider: string, accountId: string) => {
      await logOperation({
        operationType: 'integration_connect',
        resourceType: 'integration',
        resourceId: accountId,
        actionDetails: {
          provider: provider,
          connected_at: new Date().toISOString(),
        },
        sensitivityLevel: 'high',
      });
    },
    [logOperation]
  );

  const logToolConfig = useCallback(
    async (toolId: string, configChanges: Record<string, unknown>) => {
      await logOperation({
        operationType: 'filter_apply',
        resourceType: 'tool_config',
        resourceId: toolId,
        actionDetails: {
          config_changes: configChanges,
          modified_fields: Object.keys(configChanges),
        },
        sensitivityLevel: 'high',
      });
    },
    [logOperation]
  );

  return {
    logOperation,
    logDashboardView,
    logExport,
    logFilterApply,
    logSyncTrigger,
    logIntegrationConnect,
    logToolConfig,
  };
}
