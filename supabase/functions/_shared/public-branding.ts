// Öffentliche White-Label-Antwort: nur Domain, keine internen IDs.
// Rein, ohne Deno/jsr — Vitest kann das Modul direkt laden.
//
// Die RPC public.get_tenant_branding_by_domain liefert heute tenant_id,
// Support-Kontakte und custom_css an den Aufrufer. Diese Helfer entfernen
// genau diese Felder und lassen nur darstellbare, streng geprüfte Werte durch.
// custom_css wird niemals zurückgegeben (kein ungefiltertes Markup/CSS).

export type PublicBranding = {
  company_name: string | null;
  brand_colors: Record<string, string> | null;
  custom_logo_url: string | null;
  favicon_url: string | null;
  footer_text: string | null;
};

export type DomainResolution =
  | { ok: true; domain: string }
  | { ok: false; status: 400; code: string; message: string };

const MAX_DOMAIN_LEN = 253;
const MAX_LABEL = 63;
const MAX_TEXT = 200;
const MAX_FOOTER = 400;
const COLOR_KEYS = new Set(["primary", "secondary", "accent", "background", "text"]);
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const DOMAIN_BODY = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const FORBIDDEN_QUERY = ["tenant_id", "tenantId", "p_tenant_id"];

export function resolvePublicDomain(url: URL): DomainResolution {
  for (const key of FORBIDDEN_QUERY) {
    if (url.searchParams.has(key)) {
      return {
        ok: false,
        status: 400,
        code: "BAD_REQUEST",
        message: "tenant_id is not accepted; provide domain only",
      };
    }
  }
  const raw = url.searchParams.get("domain");
  if (raw == null || !raw.trim()) {
    return {
      ok: false,
      status: 400,
      code: "BAD_REQUEST",
      message: "provide domain query parameter",
    };
  }
  const domain = normalizeDomain(raw);
  if (!domain) {
    return {
      ok: false,
      status: 400,
      code: "BAD_REQUEST",
      message: "invalid domain",
    };
  }
  return { ok: true, domain };
}

export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const at = value.lastIndexOf("@");
  if (at >= 0) value = value.slice(at + 1);
  value = value.split("/")[0] ?? value;
  value = value.split("\\")[0] ?? value;
  value = value.replace(/\.$/, "");
  const host = value.split(":")[0] ?? value;
  if (!host || host.length > MAX_DOMAIN_LEN) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (host.includes("..") || host.startsWith(".") || host.startsWith("-")) return null;
  const labels = host.split(".");
  if (labels.some((label) => !label || label.length > MAX_LABEL)) return null;
  if (!DOMAIN_BODY.test(host)) return null;
  return host;
}

export function sanitizePublicBranding(raw: unknown): PublicBranding | null {
  if (raw == null) return null;
  const obj = unwrap(raw);
  if (!obj) return null;
  return {
    company_name: asPlainText(obj.company_name, MAX_TEXT),
    brand_colors: sanitizeColors(obj.brand_colors),
    custom_logo_url: asHttpsUrl(obj.custom_logo_url),
    favicon_url: asHttpsUrl(obj.favicon_url),
    footer_text: asPlainText(obj.footer_text, MAX_FOOTER),
  };
}

export function assertNoInternalIds(branding: PublicBranding): void {
  const dumped = JSON.stringify(branding);
  if (/tenant_id/i.test(dumped) || /"id"\s*:/.test(dumped)) {
    throw new Error("public branding payload leaked an internal id");
  }
}

function unwrap(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function asPlainText(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const stripped = value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return null;
  return stripped.slice(0, max);
}

function asHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > 2000) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (!normalizeDomain(parsed.hostname)) return null;
  return parsed.href;
}

function sanitizeColors(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!COLOR_KEYS.has(key)) continue;
    if (typeof raw !== "string") continue;
    const color = raw.trim();
    if (!HEX.test(color)) continue;
    out[key] = color.toLowerCase();
  }
  return Object.keys(out).length > 0 ? out : null;
}

const PLATFORM_HOST_SUFFIXES = [
  "realsyncdynamicsai.de",
  "realsyncdynamics.pages.dev",
  "pages.dev",
  "localhost",
];

/** Plattform-eigene Hosts: hier kein öffentlicher Branding-Lookup. */
export function isPlatformHostname(host: string): boolean {
  const normalized = (host.split(":")[0] ?? host).trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) return true;
  if (normalized === "127.0.0.1" || normalized === "::1" || normalized === "0.0.0.0") return true;
  return PLATFORM_HOST_SUFFIXES.some((suffix) => (
    normalized === suffix || normalized.endsWith(`.${suffix}`)
  ));
}

/** Domain für den öffentlichen Lookup, oder null auf Plattform-Hosts. */
export function hostnameForPublicBranding(host: string): string | null {
  if (isPlatformHostname(host)) return null;
  return normalizeDomain(host);
}
