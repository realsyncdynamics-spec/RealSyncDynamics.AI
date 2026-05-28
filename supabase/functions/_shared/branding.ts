// Branding-Resolver für White-Label-Reports.
//
// Liefert das effektive Branding für einen Tenant — Felder sind nur
// dann mit Tenant-Werten gefüllt, wenn:
//   - der Tenant das `whitelabel.reports`-Entitlement hat (Agency+),
//   - eine tenant_branding-Zeile existiert,
//   - diese Zeile `enabled = true` hat.
// Sonst fallen alle Felder auf die RealSyncDynamics-Defaults zurück.
//
// Aufruf:
//   const branding = await resolveBranding(admin, tenant_id);
//   const html = buildHtml(audit, reportUrl, branding);
//
// Caller müssen nicht prüfen, ob White-Label „aktiv" ist — die
// resolved-Struct enthält die korrekten Werte (Defaults oder
// Tenant-Overrides), das Template ist branding-agnostisch.

export interface Branding {
  /** Anzeigename im Report-Header */
  brandName:        string;
  /** Vollständige URL zum Logo (signed URL) oder null = kein Logo */
  logoUrl:          string | null;
  /** Hex-Code, z. B. „#FFB800" */
  primaryColor:     string;
  /** Hex-Code; meist gleich primary, aber konfigurierbar */
  accentColor:      string;
  /** Footer-Zeile unten im Report */
  footerText:       string;
  /** Support-Adresse, an die Kunden des Tenants verwiesen werden */
  supportEmail:     string;
  /** Slogan oben links im Header-Strip */
  headerTagline:    string;
  /** true wenn Tenant-Branding (statt Default) aktiv ist — für „powered by"-Hinweis */
  whiteLabelActive: boolean;
}

export const DEFAULT_BRANDING: Branding = {
  brandName:        'RealSyncDynamics.AI',
  logoUrl:          null,
  primaryColor:     '#FFB800',
  accentColor:      '#FFB800',
  footerText:       'RealSyncDynamics.AI · EU-gehostet · Made in Germany',
  supportEmail:     'privacy@realsyncdynamicsai.de',
  headerTagline:    'REALSYNCDYNAMICS.AI · EU-HOSTED COMPLIANCE ENGINE',
  whiteLabelActive: false,
};

// deno-lint-ignore no-explicit-any
type Admin = any;

interface BrandingRow {
  whitelabel_active: boolean;
  brand_name:        string | null;
  logo_storage_path: string | null;
  primary_color:     string | null;
  accent_color:      string | null;
  footer_text:       string | null;
  support_email:     string | null;
}

/**
 * Lädt das effektive Branding für einen Tenant. Robust gegen fehlende
 * Zeilen und gegen RPC-Fehler — fällt im Zweifel auf DEFAULT_BRANDING
 * zurück, sodass Reports nie wegen Branding scheitern.
 */
export async function resolveBranding(
  admin:     Admin,
  tenantId:  string | null | undefined,
): Promise<Branding> {
  if (!tenantId) return { ...DEFAULT_BRANDING };

  const { data, error } = await admin.rpc('tenant_branding_effective', {
    p_tenant_id: tenantId,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { ...DEFAULT_BRANDING };
  }

  const row = data[0] as BrandingRow;
  if (!row.whitelabel_active) return { ...DEFAULT_BRANDING };

  // Logo-Signed-URL erzeugen (24h Lebenszeit), wenn ein Pfad konfiguriert
  // ist. Bei Fehlern bleibt logoUrl null — das Template rendert dann
  // nur den brand_name als Text.
  let logoUrl: string | null = null;
  if (row.logo_storage_path) {
    try {
      const { data: signed } = await admin.storage
        .from('documents')
        .createSignedUrl(row.logo_storage_path, 60 * 60 * 24);
      logoUrl = signed?.signedUrl ?? null;
    } catch {
      logoUrl = null;
    }
  }

  const brandName = row.brand_name?.trim() || DEFAULT_BRANDING.brandName;
  return {
    brandName,
    logoUrl,
    primaryColor:     row.primary_color  ?? DEFAULT_BRANDING.primaryColor,
    accentColor:      row.accent_color   ?? row.primary_color ?? DEFAULT_BRANDING.accentColor,
    footerText:       row.footer_text    ?? `${brandName} · powered by RealSyncDynamics.AI`,
    supportEmail:     row.support_email  ?? DEFAULT_BRANDING.supportEmail,
    headerTagline:    `${brandName.toUpperCase()} · COMPLIANCE REPORT`,
    whiteLabelActive: true,
  };
}
