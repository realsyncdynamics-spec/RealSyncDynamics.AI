// ISO 42001 Evidence Vault: Retrieve and manage evidence items
// GET:   List evidence for ISO 42001
// POST:  Upload new evidence and link to controls
// PATCH: Archive/unarchive an evidence item (setzt archived_at)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

// Der Default des Helfers deklariert nur 'POST, OPTIONS'. Ein PATCH-Preflight
// wuerde daran scheitern, sobald die Function nicht mehr same-origin ueber
// /functions/v1/... aufgerufen wird.
const corsHeaders = buildCorsHeaders('GET, POST, PATCH, OPTIONS');

interface EvidenceItem {
  [key: string]: unknown;
  created_by_name?: string;
}

const detectEvidenceType = (fileName: string, mimeType: string): string => {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (mime.includes('pdf')) return 'document';
  if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word')) return 'document';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('spreadsheet')) return 'document';
  if (mime.includes('image') || /\.(png|jpg|jpeg|gif|webp)$/i.test(name)) return 'screenshot';
  if (name.endsWith('.log') || mime.includes('text/plain') || mime.includes('log')) return 'log';
  if (name.includes('policy') || name.includes('policy') || mime.includes('policy')) return 'policy';
  if (name.includes('training') || name.includes('cert') || mime.includes('certificate')) return 'training_record';
  if (name.includes('audit') || name.includes('report')) return 'audit_report';
  if (name.includes('assess')) return 'assessment';

  return 'other';
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token', corsHeaders);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token', corsHeaders);
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required', corsHeaders);

  // Verify access
  const { data: member } = await userClient
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();

  if (!member) {
    return jsonError(403, 'FORBIDDEN', 'not a member of this tenant', corsHeaders);
  }

  // GET: List evidence items (with pagination support)
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

      const { data: evidenceItems, error, count } = await userClient
        .from('evidence_items')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Enrich with user names (mock for now)
      const enriched = (evidenceItems || []).map((item: EvidenceItem) => ({
        ...item,
        created_by_name: 'ISO Auditor',
      }));

      return jsonResponse({
        success: true,
        evidence_items: enriched,
        total_count: count,
        offset,
        limit,
      });
    } catch (err) {
      console.error('Evidence retrieval error:', err);
      return jsonError(500, 'ERROR', 'failed to retrieve evidence', corsHeaders);
    }
  }

  // POST: Upload evidence
  if (req.method === 'POST') {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const title = formData.get('title') as string;
      const description = formData.get('description') as string;
      const controlIdsStr = formData.get('control_ids') as string;
      const tagsStr = formData.get('tags') as string;

      if (!file || !title) {
        return jsonError(400, 'BAD_REQUEST', 'file and title required', corsHeaders);
      }

      const controlIds = controlIdsStr ? JSON.parse(controlIdsStr) : [];
      const tags = tagsStr ? JSON.parse(tagsStr) : [];

      // Generate file hash (simple mock)
      const fileHash = `sha256-${Date.now()}`;

      // Detect evidence type from file name and MIME type
      const evidenceType = detectEvidenceType(file.name, file.type);

      // Create evidence item
      const { data: newEvidence, error: insertError } = await userClient
        .from('evidence_items')
        .insert({
          tenant_id: tenantId,
          title,
          description: description || null,
          evidence_type: evidenceType,
          file_path: `evidence/${tenantId}/${file.name}`,
          file_hash: fileHash,
          file_size_bytes: file.size,
          mime_type: file.type,
          framework_codes: ['iso42001'],
          control_ids: controlIds,
          tags,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log audit action
      await audit(admin, {
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail,
        action: 'evidence_uploaded',
        resource_type: 'evidence_item',
        resource_id: newEvidence.id,
        changes: {
          title,
          file_name: file.name,
          file_size_bytes: file.size,
          control_count: controlIds.length,
        },
        severity: 'info',
      });

      return jsonResponse({
        success: true,
        message: `Evidence "${title}" uploaded successfully`,
        evidence: {
          id: newEvidence.id,
          title: newEvidence.title,
          file_path: newEvidence.file_path,
        },
      });
    } catch (err) {
      console.error('Evidence upload error:', err);
      return jsonError(500, 'ERROR', 'failed to upload evidence', corsHeaders);
    }
  }

  // PATCH: Archivieren bzw. Archivierung aufheben
  //
  // Bewusst kein DELETE: Evidence ist Nachweismaterial nach ISO 42001. Archivieren
  // blendet den Eintrag aus der Standardansicht aus (GET filtert auf
  // archived_at IS NULL), loescht aber nichts — die Hash-Kette und der Pruefpfad
  // bleiben unangetastet. Geschrieben wird ueber userClient, damit RLS greift und
  // ein fremder Tenant den Eintrag auch dann nicht trifft, wenn die
  // Mitgliedschaftspruefung oben je umgangen wuerde.
  if (req.method === 'PATCH') {
    try {
      const evidenceId = url.searchParams.get('evidence_id');
      if (!evidenceId) return jsonError(400, 'BAD_REQUEST', 'evidence_id required', corsHeaders);

      // Ohne Parameter wird archiviert; archived=false hebt es wieder auf.
      const archived = url.searchParams.get('archived') !== 'false';

      const { data: updated, error: updateError } = await userClient
        .from('evidence_items')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', evidenceId)
        .eq('tenant_id', tenantId)
        .select('id, title, archived_at')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) return jsonError(404, 'NOT_FOUND', 'evidence item not found', corsHeaders);

      await audit(admin, {
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail,
        action: archived ? 'evidence_archived' : 'evidence_unarchived',
        resource_type: 'evidence_item',
        resource_id: updated.id,
        changes: { title: updated.title, archived_at: updated.archived_at },
        severity: 'info',
      });

      return jsonResponse({
        success: true,
        message: archived
          ? `Evidence "${updated.title}" archived`
          : `Evidence "${updated.title}" restored`,
        evidence: updated,
      });
    } catch (err) {
      console.error('Evidence archive error:', err);
      return jsonError(500, 'ERROR', 'failed to update evidence', corsHeaders);
    }
  }

  return jsonError(405, 'BAD_REQUEST', 'GET, POST or PATCH only', corsHeaders);
});
