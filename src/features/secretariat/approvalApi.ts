// KI-Sekretariat — Aufrufe der serverseitigen Freigabe
// (Migration 20261125183000_secretariat_bot_approval_gate).
//
// Rolle, Mandant, Pflichtangaben und Prüfgegenstand bestimmt die Datenbank.
// Hier wird nur die Bot-ID, der geprüfte Stand und der Aktivierungswunsch übergeben.

import { getSupabase } from '../../lib/supabase';
import type { ApprovalRequest, ServerApprovalStatus } from './secretariatBot';

interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

interface StatusRow {
  has_active_approval: boolean | null;
  valid: boolean | null;
  ever_approved: boolean | null;
  approved_at: string | null;
  approved_by: string | null;
}

/** Freigabestand laut Datenbank. Wirft bei Fehlern — der Aufrufer zeigt dann „nicht prüfbar“. */
export async function fetchApprovalStatus(botId: string, sb: RpcClient = getSupabase()): Promise<ServerApprovalStatus> {
  const { data, error } = await sb.rpc('secretariat_bot_approval_status', { p_bot_id: botId });
  if (error) throw new Error(`Freigabestand: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as StatusRow | null | undefined;
  if (!row || typeof row !== 'object') throw new Error('Freigabestand: keine Antwort.');
  return {
    hasActiveApproval: row.has_active_approval === true,
    valid: row.valid === true,
    everApproved: row.ever_approved === true,
    approvedAt: row.approved_at ?? null,
    approvedBy: row.approved_by ?? null,
  };
}

/** Freigabe durch Owner/Admin. Die Datenbank lehnt ab, wenn sich der Bot seit `expectedUpdatedAt` geändert hat. */
export async function approveSecretariatBot(req: ApprovalRequest, sb: RpcClient = getSupabase()): Promise<void> {
  const { error } = await sb.rpc('approve_secretariat_bot', {
    p_bot_id: req.botId,
    p_expected_updated_at: req.expectedUpdatedAt,
    p_activate: req.activate,
  });
  if (error) {
    if (/changed since review/i.test(error.message)) {
      throw new Error('Die Angaben wurden inzwischen geändert. Bitte erneut prüfen und freigeben.');
    }
    if (/not permitted|authentication required/i.test(error.message)) {
      throw new Error('Freigeben dürfen nur Inhaber und Administratoren des Betriebs.');
    }
    throw new Error(`Freigabe: ${error.message}`);
  }
}
