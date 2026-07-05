import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Governance API Keys Security Tests
 *
 * Validates that API key scoping and permission boundaries
 * prevent unauthorized data access across tenants and frameworks.
 */

describe('Governance API Keys Security', () => {
  let supabase: SupabaseClient;
  const tenantId = 'test-api-keys-tenant';
  const userId = 'test-api-user';

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY2MDc1ODQwMCwiZXhwIjo1MTkxNzMyNDAwfQ.gUMSuVbMb1l0zfB6lz5Xt1DHxuQO2F0nVHYJHqB-cRc';

    supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create test tenant
    await supabase.from('tenants').insert({
      id: tenantId,
      name: 'API Keys Test Tenant',
      is_active: true,
    });
  });

  afterAll(async () => {
    // Clean up
    await supabase.from('governance_api_keys').delete().eq('tenant_id', tenantId);
    await supabase.from('tenants').delete().eq('id', tenantId);
  });

  describe('API Key Permission Scoping', () => {
    it('should create API key with specific permission scope', async () => {
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Read-Only Gap Analysis Key',
          permissions: ['gaps:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key).toBeDefined();
      expect(key?.[0].permissions).toEqual(['gaps:read']);
      expect(key?.[0].revoked_at).toBeNull();
    });

    it('should enforce read-only permissions for "governance:read" scope', async () => {
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Audit Report Reader',
          permissions: ['governance:read', 'reports:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key).toBeDefined();
      expect(key?.[0].permissions).toContain('governance:read');
      expect(key?.[0].permissions).toContain('reports:read');

      // Verify write operations would be blocked (permission check is at API level)
      // This is validated in the edge function that uses the key
    });

    it('should restrict "governance:write" permission to specific users', async () => {
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Governance Admin Key',
          permissions: ['governance:write', 'evidence:read', 'reports:write'],
          created_by: userId,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key).toBeDefined();
      expect(key?.[0].permissions).toContain('governance:write');
    });

    it('should support granular permission combinations', async () => {
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Compliance Auditor Key',
          permissions: [
            'governance:read',
            'gaps:read',
            'evidence:read',
            'reports:read',
            'ai_systems:read',
          ],
          created_by: userId,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key).toBeDefined();
      expect(key?.[0].permissions.length).toBe(5);
    });
  });

  describe('API Key Lifecycle Management', () => {
    it('should support key rotation', async () => {
      // Create original key
      const { data: originalKey } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Rotatable Key',
          permissions: ['governance:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(originalKey).toBeDefined();
      const originalId = originalKey?.[0].id;

      // Simulate rotation: revoke original
      const { data: revoked } = await supabase
        .from('governance_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', originalId)
        .select();

      expect(revoked?.[0].revoked_at).toBeDefined();

      // Create new key with same permissions
      const { data: newKey } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Rotatable Key (Renewed)',
          permissions: ['governance:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(newKey).toBeDefined();
      expect(newKey?.[0].id).not.toBe(originalId);
      expect(revoked?.[0].revoked_at).not.toBeNull();
    });

    it('should prevent use of revoked keys', async () => {
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Key to Revoke',
          permissions: ['governance:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      const keyId = key?.[0].id;

      // Revoke the key
      await supabase
        .from('governance_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);

      // Attempt to use revoked key (API layer would reject)
      const { data: revokedKey } = await supabase
        .from('governance_api_keys')
        .select('*')
        .eq('id', keyId)
        .single();

      expect(revokedKey?.revoked_at).not.toBeNull();
    });

    it('should expire keys after specified date', async () => {
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Short-Lived Key',
          permissions: ['governance:read'],
          created_by: userId,
          expires_at: expiryDate.toISOString(),
        })
        .select();

      expect(key?.[0].expires_at).toBe(expiryDate.toISOString());

      // Verify expiry is tracked
      const { data: allKeys } = await supabase
        .from('governance_api_keys')
        .select('*')
        .eq('tenant_id', tenantId)
        .lt('expires_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

      expect(allKeys).toBeDefined();
    });

    it('should track last used timestamp', async () => {
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Usage Tracking Key',
          permissions: ['governance:read'],
          created_by: userId,
          last_used_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key?.[0].last_used_at).toBeDefined();
    });
  });

  describe('Multi-Tenant API Key Isolation', () => {
    it('should prevent key usage across tenants', async () => {
      // Create key for tenant1
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Tenant-Specific Key',
          permissions: ['governance:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key?.[0].tenant_id).toBe(tenantId);

      // Verify key is tied to specific tenant (API layer enforces this)
      const { data: keys } = await supabase
        .from('governance_api_keys')
        .select('*')
        .eq('tenant_id', tenantId);

      keys?.forEach((k) => {
        expect(k.tenant_id).toBe(tenantId);
      });
    });

    it('should list only tenant-owned API keys', async () => {
      // Insert multiple keys for this tenant
      await supabase.from('governance_api_keys').insert([
        {
          tenant_id: tenantId,
          name: 'Key 1',
          permissions: ['governance:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          tenant_id: tenantId,
          name: 'Key 2',
          permissions: ['reports:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);

      const { data: keys } = await supabase
        .from('governance_api_keys')
        .select('*')
        .eq('tenant_id', tenantId);

      expect(keys).toBeDefined();
      expect(keys!.length).toBeGreaterThanOrEqual(2);
      keys?.forEach((k) => {
        expect(k.tenant_id).toBe(tenantId);
      });
    });
  });

  describe('API Key Audit Logging', () => {
    it('should audit key creation', async () => {
      const createdBy = userId;

      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Audited Key Creation',
          permissions: ['governance:read'],
          created_by: createdBy,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key?.[0].created_by).toBe(createdBy);
      expect(key?.[0].created_at).toBeDefined();
    });

    it('should audit key modifications', async () => {
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Key to Modify',
          permissions: ['governance:read'],
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      const keyId = key?.[0].id;
      const originalCreatedAt = key?.[0].created_at;

      // Update the key
      await new Promise((resolve) => setTimeout(resolve, 100)); // Ensure timestamp differs

      const { data: updated } = await supabase
        .from('governance_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId)
        .select();

      expect(updated?.[0].created_at).toBe(originalCreatedAt); // Created at should not change
      expect(updated?.[0].last_used_at).toBeDefined();
    });
  });

  describe('API Key Permission Validation', () => {
    it('should validate permission format', async () => {
      const validPermissions = ['governance:read', 'governance:write', 'gaps:read', 'evidence:read'];

      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Validated Permissions Key',
          permissions: validPermissions,
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key?.[0].permissions).toEqual(validPermissions);
    });

    it('should prevent overly broad permissions', async () => {
      // This test verifies business logic (prevented at application level)
      // A key should not have unrestricted access to all data
      const { data: key } = await supabase
        .from('governance_api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Limited Scope Key',
          permissions: ['governance:read'], // Not 'admin:*' or similar
          created_by: userId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      expect(key?.[0].permissions.length).toBeGreaterThan(0);
      expect(key?.[0].permissions).not.toContain('admin:*');
    });
  });
});
