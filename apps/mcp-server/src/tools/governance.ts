import { supabase } from '../services/supabase.js';
import { logAuditEvent } from '../services/audit.js';
import { ComplianceStatus, GovernanceControl } from '../types/index.js';

export async function getGovernanceStatus(
  tenantId: string,
  frameworkId: string = 'iso-42001',
): Promise<ComplianceStatus> {
  await logAuditEvent({
    tenantId,
    action: 'governance.get_status',
    subject: frameworkId,
    actor: 'mcp-server',
  });

  // Phase 1: Simplified. Phase 2: Query ai_policies, governance_controls for real data
  return {
    tenantId,
    frameworkId,
    score: 0,
    compliantControls: 0,
    totalControls: 0,
    criticalIssues: 0,
    lastUpdated: new Date(),
  };
}

export async function listControls(
  tenantId: string,
  frameworkId: string = 'iso-42001',
): Promise<GovernanceControl[]> {
  await logAuditEvent({
    tenantId,
    action: 'governance.list_controls',
    subject: frameworkId,
    actor: 'mcp-server',
  });

  // TODO: Query ai_policies / governance_controls from Supabase
  return [];
}

export async function checkComplianceStatus(
  tenantId: string,
  controlId: string,
): Promise<{ compliant: boolean; evidence_count: number; last_verified: Date | null }> {
  await logAuditEvent({
    tenantId,
    action: 'governance.check_compliance',
    subject: controlId,
    actor: 'mcp-server',
  });

  // Phase 2: Count evidence items linked to this control
  return {
    compliant: false,
    evidence_count: 0,
    last_verified: null,
  };
}
