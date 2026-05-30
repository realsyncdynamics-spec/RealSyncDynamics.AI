import { describe, it, expect } from 'vitest';
import {
  isValidRole, checkSetRole, checkRemove, TENANT_ROLES,
} from '../../src/features/tenants/memberGuards';

describe('tenant member guards (P0b, ADR 0005)', () => {
  it('role whitelist = exactly the 5 ADR-0005 roles', () => {
    expect([...TENANT_ROLES]).toEqual(['owner', 'admin', 'dpo', 'editor', 'viewer_auditor']);
    expect(isValidRole('dpo')).toBe(true);
    expect(isValidRole('superuser')).toBe(false);
    expect(isValidRole('')).toBe(false);
  });

  describe('checkSetRole', () => {
    const base = { callerRole: 'owner', targetExists: true, targetCurrentRole: 'editor', newRole: 'admin', ownerCount: 2, isSelf: false };

    it('owner may promote editor → admin', () => {
      expect(checkSetRole(base).allowed).toBe(true);
    });
    it('rejects unknown role', () => {
      expect(checkSetRole({ ...base, newRole: 'root' })).toEqual({ allowed: false, code: 'BAD_ROLE' });
    });
    it('editor/viewer caller forbidden', () => {
      expect(checkSetRole({ ...base, callerRole: 'editor' })).toEqual({ allowed: false, code: 'FORBIDDEN' });
      expect(checkSetRole({ ...base, callerRole: null })).toEqual({ allowed: false, code: 'FORBIDDEN' });
    });
    it('admin may NOT grant owner', () => {
      expect(checkSetRole({ ...base, callerRole: 'admin', newRole: 'owner' })).toEqual({ allowed: false, code: 'FORBIDDEN' });
    });
    it('admin may NOT change an existing owner', () => {
      expect(checkSetRole({ ...base, callerRole: 'admin', targetCurrentRole: 'owner', newRole: 'admin' })).toEqual({ allowed: false, code: 'FORBIDDEN' });
    });
    it('last-owner cannot be demoted', () => {
      expect(checkSetRole({ ...base, targetCurrentRole: 'owner', newRole: 'admin', ownerCount: 1 })).toEqual({ allowed: false, code: 'LAST_OWNER' });
    });
    it('owner among several may be demoted', () => {
      expect(checkSetRole({ ...base, targetCurrentRole: 'owner', newRole: 'admin', ownerCount: 2 }).allowed).toBe(true);
    });
    it('last owner cannot self-demote', () => {
      expect(checkSetRole({ ...base, targetCurrentRole: 'owner', newRole: 'admin', ownerCount: 1, isSelf: true })).toEqual({ allowed: false, code: 'LAST_OWNER' });
    });
    it('target must exist', () => {
      expect(checkSetRole({ ...base, targetExists: false })).toEqual({ allowed: false, code: 'NOT_FOUND' });
    });
  });

  describe('checkRemove', () => {
    const base = { callerRole: 'owner', targetExists: true, targetCurrentRole: 'editor', ownerCount: 2, isSelf: false };

    it('owner may remove editor', () => {
      expect(checkRemove(base).allowed).toBe(true);
    });
    it('admin caller may remove non-owner', () => {
      expect(checkRemove({ ...base, callerRole: 'admin' }).allowed).toBe(true);
    });
    it('editor caller forbidden', () => {
      expect(checkRemove({ ...base, callerRole: 'editor' })).toEqual({ allowed: false, code: 'FORBIDDEN' });
    });
    it('admin may NOT remove an owner', () => {
      expect(checkRemove({ ...base, callerRole: 'admin', targetCurrentRole: 'owner' })).toEqual({ allowed: false, code: 'FORBIDDEN' });
    });
    it('last owner cannot be removed', () => {
      expect(checkRemove({ ...base, targetCurrentRole: 'owner', ownerCount: 1 })).toEqual({ allowed: false, code: 'LAST_OWNER' });
    });
    it('owner among several may be removed', () => {
      expect(checkRemove({ ...base, targetCurrentRole: 'owner', ownerCount: 2 }).allowed).toBe(true);
    });
    it('last owner cannot self-remove', () => {
      expect(checkRemove({ ...base, targetCurrentRole: 'owner', ownerCount: 1, isSelf: true })).toEqual({ allowed: false, code: 'LAST_OWNER' });
    });
    it('non-existent target', () => {
      expect(checkRemove({ ...base, targetExists: false })).toEqual({ allowed: false, code: 'NOT_FOUND' });
    });
  });
});
