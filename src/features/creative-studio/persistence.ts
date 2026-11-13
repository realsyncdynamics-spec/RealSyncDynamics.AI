/**
 * Speichern in `social_designs`. Die Tabelle ist mandantenisoliert (RLS).
 * Diese Datei schreibt nur JSON. Kein Storage-Upload, kein Token, kein Publish.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrandKit } from './brandKit';
import { designJsonByteLength, MAX_DESIGN_JSON_BYTES, type SocialDesignDocument } from './model';

export interface SocialDesignRow {
  id: string;
  tenant_id: string;
  title: string;
  format_id: string;
  konva_json: SocialDesignDocument;
  brand_snapshot: BrandKit;
  preview_path: null;
  created_by: string;
}

export interface SavedDesignSummary {
  id: string;
  title: string;
  format_id: string;
  konva_json: unknown;
  updated_at: string;
}

export function toSocialDesignRow(
  doc: SocialDesignDocument,
  brand: BrandKit,
  tenantId: string,
  userId: string,
): SocialDesignRow {
  if (designJsonByteLength(doc) > MAX_DESIGN_JSON_BYTES) {
    throw new Error('Design-JSON ist zu groß zum Speichern');
  }
  return {
    id: doc.id,
    tenant_id: tenantId,
    title: doc.title.slice(0, 160),
    format_id: doc.formatId,
    konva_json: doc,
    brand_snapshot: brand,
    preview_path: null,
    created_by: userId,
  };
}

export async function insertSocialDesign(
  client: SupabaseClient,
  row: SocialDesignRow,
): Promise<void> {
  const { error } = await client.from('social_designs').insert(row);
  if (error) throw new Error(error.message);
}

export async function updateSocialDesign(
  client: SupabaseClient,
  row: SocialDesignRow,
): Promise<void> {
  const { error } = await client
    .from('social_designs')
    .update({
      title: row.title,
      format_id: row.format_id,
      konva_json: row.konva_json,
      brand_snapshot: row.brand_snapshot,
      preview_path: null,
    })
    .eq('id', row.id)
    .eq('tenant_id', row.tenant_id);
  if (error) throw new Error(error.message);
}

export async function listSocialDesigns(
  client: SupabaseClient,
  tenantId: string,
): Promise<SavedDesignSummary[]> {
  const { data, error } = await client
    .from('social_designs')
    .select('id, title, format_id, konva_json, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedDesignSummary[];
}
