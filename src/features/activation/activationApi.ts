/**
 * Governance Activation persistence — Organization + Scope + AI-OS-Setup.
 * AI-OS-Setup lives in `organization.aiSetup` (JSONB, no migration).
 * Blueprint / extraction / Expert Review have no backend yet.
 */
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { asAiSetup, type AiSetup } from './aiSetupCatalog';

export interface ActivationOrganization {
  company: string;
  entities: string;
  locations: string;
  businessUnits: string;
  teamStructure: string;
  responsibilities: string;
  roles: string;
  /** Undefined = noch nie gespeichert. Beim Speichern ohne aiSetup bleibt der Bestand erhalten. */
  aiSetup?: AiSetup;
}

export interface GovernanceActivationRecord {
  tenantId: string;
  organization: ActivationOrganization;
  scopes: string[];
  status: 'draft' | 'scope_set' | 'org_saved' | 'activated';
  updatedAt: string | null;
}

export const EMPTY_ORGANIZATION: ActivationOrganization = {
  company: '',
  entities: '',
  locations: '',
  businessUnits: '',
  teamStructure: '',
  responsibilities: '',
  roles: '',
};

function asOrganization(raw: unknown): ActivationOrganization {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_ORGANIZATION };
  const o = raw as Record<string, unknown>;
  const aiSetup = asAiSetup(o.aiSetup);
  return {
    company: typeof o.company === 'string' ? o.company : '',
    entities: typeof o.entities === 'string' ? o.entities : '',
    locations: typeof o.locations === 'string' ? o.locations : '',
    businessUnits: typeof o.businessUnits === 'string' ? o.businessUnits : '',
    teamStructure: typeof o.teamStructure === 'string' ? o.teamStructure : '',
    responsibilities: typeof o.responsibilities === 'string' ? o.responsibilities : '',
    roles: typeof o.roles === 'string' ? o.roles : '',
    ...(aiSetup ? { aiSetup } : {}),
  };
}

function asJsonObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
}

/**
 * Merge vor Upsert: `upsert` ersetzt die JSONB-Spalte komplett. Ohne Merge würde
 * Org-Speichern ein zuvor gespeichertes `aiSetup` (und unbekannte Felder) löschen.
 * Ein übergebenes `aiSetup` ersetzt den Bestand, ein fehlendes lässt ihn stehen.
 */
export function mergeOrganizationForSave(
  existing: unknown,
  next: ActivationOrganization,
): Record<string, unknown> {
  const { aiSetup, ...orgFields } = next;
  return {
    ...asJsonObject(existing),
    ...orgFields,
    ...(aiSetup ? { aiSetup } : {}),
  };
}

export async function loadGovernanceActivation(
  tenantId: string,
): Promise<GovernanceActivationRecord | null> {
  if (!isSupabaseConfigured() || !tenantId) return null;
  const { data, error } = await getSupabase()
    .from('governance_activations')
    .select('tenant_id, organization, scopes, status, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    tenantId: data.tenant_id as string,
    organization: asOrganization(data.organization),
    scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : [],
    status: (data.status as GovernanceActivationRecord['status']) ?? 'draft',
    updatedAt: (data.updated_at as string) ?? null,
  };
}

export async function saveGovernanceActivation(input: {
  tenantId: string;
  organization: ActivationOrganization;
  scopes: string[];
  status?: GovernanceActivationRecord['status'];
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase ist nicht konfiguriert — Activation kann nicht gespeichert werden.');
  }
  if (!input.tenantId) {
    throw new Error('Kein aktiver Tenant — Activation speichern nicht möglich.');
  }
  const status =
    input.status ??
    (input.scopes.length > 0 && input.organization.company.trim()
      ? 'org_saved'
      : input.scopes.length > 0
        ? 'scope_set'
        : 'draft');

  const { data: existing, error: readError } = await getSupabase()
    .from('governance_activations')
    .select('organization')
    .eq('tenant_id', input.tenantId)
    .maybeSingle();
  // Ohne gelesenen Bestand nicht schreiben — sonst droht stilles Überschreiben von aiSetup.
  if (readError) throw new Error(readError.message);

  const { error } = await getSupabase().from('governance_activations').upsert(
    {
      tenant_id: input.tenantId,
      organization: mergeOrganizationForSave(
        (existing as { organization?: unknown } | null)?.organization,
        input.organization,
      ),
      scopes: input.scopes,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' },
  );
  if (error) throw new Error(error.message);

  // Mirror company name onto tenants when present (same pattern as onboarding-orchestrator).
  const company = input.organization.company.trim();
  if (company) {
    await getSupabase()
      .from('tenants')
      .update({ company_name: company, org_name: company })
      .eq('id', input.tenantId);
  }
}
