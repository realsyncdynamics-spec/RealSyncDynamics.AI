/**
 * Lädt öffentliches White-Label-Branding über die gehärtete Edge Function
 * tenant-branding-get (nur ?domain=, ohne tenant_id).
 *
 * Nicht verwenden in angemeldeten Einstellungen: BrandingSettings liest
 * mandantenbezogen über die Sitzung aus public.tenants und schreibt über
 * tenant-branding-update. Dieser Loader ist nur für unauthentifizierte
 * Oberflächen auf einer eigenen Kundendomain.
 */
import { isSupabaseConfigured } from "../supabase";
import { getSupabaseAnonKey, getSupabaseUrl } from "../supabaseUrl";
import type { PublicBranding } from "../../../supabase/functions/_shared/public-branding";
import { hostnameForPublicBranding } from "../../../supabase/functions/_shared/public-branding";

export type { PublicBranding };
export { hostnameForPublicBranding, isPlatformHostname } from "../../../supabase/functions/_shared/public-branding";

export async function loadPublicBranding(
  host: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicBranding | null> {
  const domain = hostnameForPublicBranding(host);
  if (!domain) return null;
  if (!isSupabaseConfigured()) return null;

  const url = `${getSupabaseUrl()}/functions/v1/tenant-branding-get?domain=${encodeURIComponent(domain)}`;
  const resp = await fetchImpl(url, {
    method: "GET",
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${getSupabaseAnonKey()}`,
    },
  });
  if (!resp.ok) return null;
  const payload = await resp.json() as { ok?: boolean; branding?: PublicBranding };
  if (!payload?.ok || !payload.branding) return null;
  return payload.branding;
}

export function applyPublicBranding(branding: PublicBranding, doc: Document = document): void {
  const root = doc.documentElement;
  const colors = branding.brand_colors;
  if (colors) {
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--rsd-brand-${key}`, value);
    }
  }
  if (branding.favicon_url) {
    let link = doc.querySelector<HTMLLinkElement>("link[rel='icon'][data-rsd-public-branding='1']");
    if (!link) {
      link = doc.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-rsd-public-branding", "1");
      doc.head.appendChild(link);
    }
    link.href = branding.favicon_url;
  }
}
