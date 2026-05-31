// KMU-Firmenprofil — Interim-Persistenz (Phase 0, client-only).
//
// WICHTIG: bewusst localStorage statt DB. Phase 0 fasst KEINE Datenbank an.
// In Phase 1 wird dies durch additive `tenants`-Spalten (industry/company_size/
// used_tools) + RLS ersetzt — gleiche Felder, gleiche Form, kein Daten-Lock-in.
// Schlüssel ist tenant-scoped, damit verschiedene Tenants sich nicht überschreiben.

export interface CompanyProfileDraft {
  industry: string | null;
  companySize: string | null;
  usedTools: string[];
}

const EMPTY: CompanyProfileDraft = { industry: null, companySize: null, usedTools: [] };

export const COMPANY_SIZES = ['1', '2-9', '10-49', '50-249', '250+'] as const;

function keyFor(tenantId: string | null): string {
  return `realsync.companyProfile.${tenantId ?? 'default'}`;
}

export function loadCompanyProfile(tenantId: string | null): CompanyProfileDraft {
  try {
    const raw = localStorage.getItem(keyFor(tenantId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<CompanyProfileDraft>;
    return {
      industry: parsed.industry ?? null,
      companySize: parsed.companySize ?? null,
      usedTools: Array.isArray(parsed.usedTools) ? parsed.usedTools : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveCompanyProfile(tenantId: string | null, draft: CompanyProfileDraft): void {
  try {
    localStorage.setItem(keyFor(tenantId), JSON.stringify(draft));
  } catch {
    /* localStorage nicht verfügbar → still ignorieren (interim) */
  }
}
