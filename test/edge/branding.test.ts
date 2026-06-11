/**
 * Tests für den Branding-Resolver aus supabase/functions/_shared/branding.ts.
 *
 * Mock-basiert — die Resolver-RPC tenant_branding_effective wird separat
 * via lokaler Postgres-Migration verifiziert (siehe CI's Migration-validation-Job).
 */
import { describe, it, expect } from 'vitest';
import { resolveBranding, DEFAULT_BRANDING } from '../../supabase/functions/_shared/branding';

interface RpcCall { name: string; args: Record<string, unknown> }

function mockAdmin(opts: {
  rpcResult?: { data: unknown; error: { message: string } | null };
  signedUrl?: string | null;
  storageError?: boolean;
}): { admin: any; rpcCalls: RpcCall[] } {
  const rpcCalls: RpcCall[] = [];
  return {
    rpcCalls,
    admin: {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args });
        return opts.rpcResult ?? { data: null, error: null };
      },
      storage: {
        from: () => ({
          createSignedUrl: async () => {
            if (opts.storageError) return { data: null, error: { message: 'boom' } };
            return { data: { signedUrl: opts.signedUrl ?? null }, error: null };
          },
        }),
      },
    },
  };
}

describe('resolveBranding', () => {
  it('liefert Default-Branding bei tenantId=null', async () => {
    const { admin, rpcCalls } = mockAdmin({});
    const b = await resolveBranding(admin, null);
    expect(b).toEqual(DEFAULT_BRANDING);
    expect(rpcCalls).toHaveLength(0); // kein RPC-Roundtrip bei fehlendem Tenant
  });

  it('liefert Default-Branding wenn RPC fehlschlägt', async () => {
    const { admin } = mockAdmin({
      rpcResult: { data: null, error: { message: 'rpc failed' } },
    });
    const b = await resolveBranding(admin, 'tenant-1');
    expect(b).toEqual(DEFAULT_BRANDING);
  });

  it('liefert Default-Branding wenn whitelabel_active=false', async () => {
    const { admin } = mockAdmin({
      rpcResult: {
        data: [{
          whitelabel_active: false,
          brand_name: 'Should Not Show',
          logo_storage_path: null,
          primary_color: '#FF0000',
          accent_color: null,
          footer_text: null,
          support_email: null,
        }],
        error: null,
      },
    });
    const b = await resolveBranding(admin, 'tenant-1');
    expect(b).toEqual(DEFAULT_BRANDING);
    expect(b.whiteLabelActive).toBe(false);
  });

  it('mapped Tenant-Branding-Felder wenn whitelabel_active=true', async () => {
    const { admin } = mockAdmin({
      rpcResult: {
        data: [{
          whitelabel_active: true,
          brand_name: 'Müller Compliance',
          logo_storage_path: null,
          primary_color: '#0052FF',
          accent_color: '#00CCFF',
          footer_text: 'Müller Compliance GmbH',
          support_email: 'support@mueller.de',
        }],
        error: null,
      },
    });
    const b = await resolveBranding(admin, 'tenant-1');
    expect(b.whiteLabelActive).toBe(true);
    expect(b.brandName).toBe('Müller Compliance');
    expect(b.primaryColor).toBe('#0052FF');
    expect(b.accentColor).toBe('#00CCFF');
    expect(b.footerText).toBe('Müller Compliance GmbH');
    expect(b.supportEmail).toBe('support@mueller.de');
    expect(b.headerTagline).toContain('MÜLLER COMPLIANCE');
    expect(b.logoUrl).toBeNull(); // kein Pfad konfiguriert
  });

  it('fällt für fehlende Felder auf Defaults zurück (partial branding)', async () => {
    const { admin } = mockAdmin({
      rpcResult: {
        data: [{
          whitelabel_active: true,
          brand_name: 'Acme Co',
          logo_storage_path: null,
          primary_color: null, // fehlt — soll DEFAULT primary_color erben
          accent_color: null,
          footer_text: null,   // fehlt — soll auf „... · powered by ..."
          support_email: null, // fehlt — soll auf RSD-default
        }],
        error: null,
      },
    });
    const b = await resolveBranding(admin, 'tenant-1');
    expect(b.brandName).toBe('Acme Co');
    expect(b.primaryColor).toBe(DEFAULT_BRANDING.primaryColor);
    expect(b.footerText).toContain('Acme Co');
    expect(b.footerText).toContain('powered by');
    expect(b.supportEmail).toBe(DEFAULT_BRANDING.supportEmail);
  });

  it('erzeugt eine signed URL für das Logo, wenn ein Pfad gesetzt ist', async () => {
    const { admin } = mockAdmin({
      rpcResult: {
        data: [{
          whitelabel_active: true,
          brand_name: 'Acme',
          logo_storage_path: 'branding/tenant-1/logo.png',
          primary_color: '#000000',
          accent_color: null,
          footer_text: null,
          support_email: null,
        }],
        error: null,
      },
      signedUrl: 'https://storage.example/signed/logo.png?token=abc',
    });
    const b = await resolveBranding(admin, 'tenant-1');
    expect(b.logoUrl).toBe('https://storage.example/signed/logo.png?token=abc');
  });

  it('toleriert Storage-Fehler beim Logo (logoUrl bleibt null)', async () => {
    const { admin } = mockAdmin({
      rpcResult: {
        data: [{
          whitelabel_active: true,
          brand_name: 'Acme',
          logo_storage_path: 'branding/tenant-1/logo.png',
          primary_color: null, accent_color: null, footer_text: null, support_email: null,
        }],
        error: null,
      },
      storageError: true,
    });
    const b = await resolveBranding(admin, 'tenant-1');
    expect(b.logoUrl).toBeNull();
    expect(b.whiteLabelActive).toBe(true); // Branding bleibt sonst aktiv
  });
});
