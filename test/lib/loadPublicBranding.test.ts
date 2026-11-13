// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
}));
vi.mock("../../src/lib/supabaseUrl", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabaseAnonKey: () => "anon-test-key",
}));

const { loadPublicBranding, hostnameForPublicBranding } = await import("../../src/lib/branding/loadPublicBranding");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadPublicBranding", () => {
  it("stellt auf Plattform-Hosts keinen Request", async () => {
    const fetchImpl = vi.fn();
    await expect(loadPublicBranding("www.realsyncdynamicsai.de", fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(hostnameForPublicBranding("www.realsyncdynamicsai.de")).toBeNull();
  });

  it("ruft die Function nur mit domain auf und ohne tenant_id", async () => {
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toBe("https://example.supabase.co/functions/v1/tenant-branding-get?domain=acme.example.com");
      expect(init?.method).toBe("GET");
      expect(input).not.toMatch(/tenant_id/);
      return new Response(JSON.stringify({
        ok: true,
        branding: { company_name: "Acme", brand_colors: { primary: "#0f766e" }, custom_logo_url: null, favicon_url: null, footer_text: null },
      }), { status: 200 });
    });
    const row = await loadPublicBranding("acme.example.com", fetchImpl as unknown as typeof fetch);
    expect(row?.company_name).toBe("Acme");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("liefert null bei 404, ohne zu werfen", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND" } }), { status: 404 }));
    await expect(loadPublicBranding("none.example.com", fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });
});
