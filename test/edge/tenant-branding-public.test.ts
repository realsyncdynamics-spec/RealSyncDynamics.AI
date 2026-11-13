// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  hostnameForPublicBranding,
  isPlatformHostname,
  normalizeDomain,
  resolvePublicDomain,
  sanitizePublicBranding,
} from "../../supabase/functions/_shared/public-branding";

const here = dirname(fileURLToPath(import.meta.url));

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".archive") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) acc.push(full);
    else if (name === "index.ts") acc.push(full);
  }
  return acc;
}

describe("normalizeDomain / resolvePublicDomain", () => {
  it("akzeptiert eine bare Domain und normalisiert Großschreibung sowie Trailing-Dot", () => {
    expect(normalizeDomain("www.Kunde.example.com.")).toBe("www.kunde.example.com");
    expect(resolvePublicDomain(new URL("https://fn.example/x?domain=WWW.KUNDE.EXAMPLE.COM"))).toEqual({
      ok: true,
      domain: "www.kunde.example.com",
    });
  });

  it("zieht Schema, Pfad und Port ab", () => {
    expect(normalizeDomain("https://brand.kunde.de:443/pfad?x=1")).toBe("brand.kunde.de");
  });

  it("lehnt tenant_id in der Query ab, auch wenn domain gesetzt ist", () => {
    const res = resolvePublicDomain(new URL("https://fn.example/x?domain=kunde.example.com&tenant_id=11111111-1111-4111-8111-111111111111"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.message).toMatch(/tenant_id/);
    }
  });

  it("lehnt fehlende oder ungültige Domains ab", () => {
    expect(resolvePublicDomain(new URL("https://fn.example/x")).ok).toBe(false);
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("https://user:pass@evil.example.com")).toBe("evil.example.com");
    expect(normalizeDomain("-bad.example.com")).toBeNull();
    expect(normalizeDomain("example")).toBeNull();
  });
});

describe("sanitizePublicBranding", () => {
  const leaky = {
    tenant_id: "11111111-1111-4111-8111-111111111111",
    company_name: "<b>Acme</b> GmbH",
    custom_domain: "acme.example.com",
    brand_colors: { primary: "#0F766E", secondary: "red", accent: "#00f", background: "#F8FAFC", text: "#0F172A", extra: "#fff" },
    custom_logo_url: "https://cdn.acme.example.com/logo.png",
    favicon_url: "javascript:alert(1)",
    support_email: "help@acme.example.com",
    support_phone: "+49 111 222",
    support_url: "https://acme.example.com/help",
    footer_text: "© Acme",
    custom_css: "body{background:url('https://evil.example/x')}",
  };

  it("entfernt tenant_id, Support-Kontakte, custom_css und unsichere Werte", () => {
    const out = sanitizePublicBranding(leaky);
    expect(out).toEqual({
      company_name: "Acme GmbH",
      brand_colors: {
        primary: "#0f766e",
        accent: "#00f",
        background: "#f8fafc",
        text: "#0f172a",
      },
      custom_logo_url: "https://cdn.acme.example.com/logo.png",
      favicon_url: null,
      footer_text: "© Acme",
    });
    const dumped = JSON.stringify(out);
    expect(dumped).not.toMatch(/tenant_id/i);
    expect(dumped).not.toMatch(/support_/i);
    expect(dumped).not.toMatch(/custom_css/);
    expect(dumped).not.toMatch(/11111111-1111-4111-8111-111111111111/);
    expect(dumped).not.toMatch(/custom_domain/);
  });

  it("lehnt http- und data-URLs ab", () => {
    expect(sanitizePublicBranding({
      custom_logo_url: "http://cdn.acme.example.com/logo.png",
      favicon_url: "data:image/png;base64,aaaa",
    })).toEqual({
      company_name: null,
      brand_colors: null,
      custom_logo_url: null,
      favicon_url: null,
      footer_text: null,
    });
  });

  it("nimmt JSON-Strings der RPC entgegen und liefert null bei leerem Treffer", () => {
    expect(sanitizePublicBranding(null)).toBeNull();
    expect(sanitizePublicBranding(JSON.stringify({ company_name: "Acme" }))?.company_name).toBe("Acme");
  });
});

describe("isPlatformHostname", () => {
  it("erkennt Plattform-Hosts und lässt Kundendomains durch", () => {
    expect(isPlatformHostname("realsyncdynamicsai.de")).toBe(true);
    expect(isPlatformHostname("www.realsyncdynamicsai.de")).toBe(true);
    expect(isPlatformHostname("app.realsyncdynamicsai.de")).toBe(true);
    expect(isPlatformHostname("realsyncdynamics.pages.dev")).toBe(true);
    expect(isPlatformHostname("preview.realsyncdynamics.pages.dev")).toBe(true);
    expect(isPlatformHostname("localhost")).toBe(true);
    expect(isPlatformHostname("127.0.0.1")).toBe(true);
    expect(hostnameForPublicBranding("acme.example.com")).toBe("acme.example.com");
    expect(hostnameForPublicBranding("www.realsyncdynamicsai.de")).toBeNull();
  });
});

describe("keine RPC-Aufrufer und gehärtete Function-Quelle", () => {
  const repoCandidates = [
  resolve(here, "../../../../../../rsd-pr-p0"),
  resolve(process.cwd()),
  "/workspace/rsd-pr-p0",
];
const repoRoot = repoCandidates.find((candidate) => {
  try { return statSync(join(candidate, "src")).isDirectory(); } catch { return false; }
}) ?? repoCandidates[0];
  const draftFn = resolve(here, "../../supabase/functions/tenant-branding-get/index.ts");

  it("die gehärtete Function akzeptiert kein tenant_id und gibt custom_css nicht weiter", () => {
    const src = readFileSync(draftFn, "utf8");
    expect(src).toMatch(/resolvePublicDomain/);
    expect(src).toMatch(/sanitizePublicBranding/);
    expect(src).toMatch(/PUBLIC_BRANDING_RATE/);
    expect(src).toMatch(/get_tenant_branding_by_domain/);
    expect(src).not.toMatch(/searchParams\.get\(['"]tenant_id['"]\)/);
    expect(src).not.toMatch(/rpc\(['"]get_tenant_branding['"]/);
    const code = src.replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/custom_css/);
  });

  it("im Hauptrepo ruft src/ die RPC nicht auf und übergibt kein tenant_id an tenant-branding-get", () => {
    const srcRoot = join(repoRoot, "src");
    const files = walk(srcRoot);
    const rpcHits: string[] = [];
    const tenantIdHits: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (content.includes("get_tenant_branding_by_domain") || /rpc\(\s*['"]get_tenant_branding['"]/.test(content)) {
        rpcHits.push(file);
      }
      if (/tenant-branding-get[^\\n]{0,200}tenant_id/.test(content) || /tenant_id=[^\\n]*tenant-branding-get/.test(content)) {
        tenantIdHits.push(file);
      }
    }
    expect(rpcHits).toEqual([]);
    expect(tenantIdHits).toEqual([]);
  });
});
