import { supabase } from './supabase.js';
import { AuditEvent } from '../types/index.js';

export interface AuditLogEntry {
  tenantId: string;
  action: string;
  subject: string;
  actor: string;
  details?: Record<string, unknown>;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  // Phase 1: Log to console. Phase 2: Log to Supabase audit_evidence table.
  console.log(`[AUDIT] ${entry.action} | Subject: ${entry.subject} | Actor: ${entry.actor}`, {
    tenant: entry.tenantId,
    details: entry.details,
  });

  // TODO: Write to supabase.from('audit_evidence').insert({...})
  // Wird in Phase 2 implementiert, wenn audit_evidence table final ist.
}

export async function getAuditEvents(
  tenantId: string,
  limit: number = 100,
): Promise<AuditEvent[]> {
  // TODO: Fetch from audit_evidence table with RLS
  // For now, return empty
  return [];
}
