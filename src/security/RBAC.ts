/**
 * RBAC — Role-Based Access Control for fine-grained permissions.
 * Supports roles, permissions, and resource-level access.
 */

export type Permission = string; // e.g., "governance:read", "policy:write"
export type Role = string; // e.g., "admin", "auditor", "viewer"

export interface RoleDefinition {
  name: Role;
  description: string;
  permissions: Set<Permission>;
}

export interface UserContext {
  userId: string;
  tenantId: string;
  roles: Set<Role>;
}

export interface ResourceContext {
  resourceType: string;
  resourceId: string;
  owner?: string;
}

/**
 * Core RBAC engine.
 */
export class RBAC {
  private roles: Map<Role, RoleDefinition> = new Map();
  private userRoles: Map<string, Set<Role>> = new Map();
  private customPermissions: Map<string, Set<Permission>> = new Map();

  /**
   * Define a role with permissions.
   */
  defineRole(role: Role, description: string, permissions: Permission[]): void {
    this.roles.set(role, {
      name: role,
      description,
      permissions: new Set(permissions)
    });
  }

  /**
   * Assign a role to a user.
   */
  assignRole(userId: string, role: Role): void {
    if (!this.roles.has(role)) {
      throw new Error(`Role not defined: ${role}`);
    }
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }
    this.userRoles.get(userId)!.add(role);
  }

  /**
   * Remove a role from a user.
   */
  removeRole(userId: string, role: Role): void {
    this.userRoles.get(userId)?.delete(role);
  }

  /**
   * Grant a custom permission to a user (overrides roles).
   */
  grantPermission(userId: string, permission: Permission): void {
    if (!this.customPermissions.has(userId)) {
      this.customPermissions.set(userId, new Set());
    }
    this.customPermissions.get(userId)!.add(permission);
  }

  /**
   * Revoke a custom permission from a user.
   */
  revokePermission(userId: string, permission: Permission): void {
    this.customPermissions.get(userId)?.delete(permission);
  }

  /**
   * Check if a user has a permission.
   */
  hasPermission(userId: string, permission: Permission): boolean {
    // Check custom permissions first
    if (this.customPermissions.get(userId)?.has(permission)) {
      return true;
    }

    // Check role permissions
    const userRoles = this.userRoles.get(userId) || new Set();
    for (const role of userRoles) {
      if (this.roles.get(role)?.permissions.has(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check multiple permissions (all must be true).
   */
  hasAllPermissions(userId: string, permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(userId, p));
  }

  /**
   * Check multiple permissions (any must be true).
   */
  hasAnyPermission(userId: string, permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(userId, p));
  }

  /**
   * Get all permissions for a user.
   */
  getPermissions(userId: string): Set<Permission> {
    const permissions = new Set<Permission>();

    // Add permissions from roles
    const userRoles = this.userRoles.get(userId) || new Set();
    for (const role of userRoles) {
      for (const perm of this.roles.get(role)?.permissions || []) {
        permissions.add(perm);
      }
    }

    // Add custom permissions
    for (const perm of this.customPermissions.get(userId) || []) {
      permissions.add(perm);
    }

    return permissions;
  }

  /**
   * Check permission and throw if denied.
   */
  requirePermission(userId: string, permission: Permission): void {
    if (!this.hasPermission(userId, permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  /**
   * Get a role definition.
   */
  getRole(role: Role): RoleDefinition | undefined {
    return this.roles.get(role);
  }

  /**
   * List all defined roles.
   */
  listRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }
}

/**
 * Default role definitions for governance platform.
 */
export function createDefaultRoles(): RBAC {
  const rbac = new RBAC();

  rbac.defineRole('admin', 'Full system access', [
    'governance:read',
    'governance:write',
    'policy:read',
    'policy:write',
    'policy:approve',
    'evidence:read',
    'evidence:write',
    'evidence:export',
    'audit:read',
    'audit:write',
    'user:manage',
    'tenant:manage'
  ]);

  rbac.defineRole('auditor', 'Audit and review access', [
    'governance:read',
    'policy:read',
    'evidence:read',
    'evidence:export',
    'audit:read'
  ]);

  rbac.defineRole('compliance-officer', 'Compliance management', [
    'governance:read',
    'governance:write',
    'policy:read',
    'policy:write',
    'evidence:read',
    'evidence:write',
    'audit:read',
    'audit:write'
  ]);

  rbac.defineRole('viewer', 'Read-only access', [
    'governance:read',
    'policy:read',
    'evidence:read',
    'audit:read'
  ]);

  return rbac;
}

/**
 * Permission checker middleware for Express/Hono.
 */
export function createPermissionMiddleware(rbac: RBAC) {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attach RBAC checker to request
    req.rbac = {
      hasPermission: (perm: string) => rbac.hasPermission(userId, perm),
      hasAllPermissions: (perms: string[]) =>
        rbac.hasAllPermissions(userId, perms),
      hasAnyPermission: (perms: string[]) =>
        rbac.hasAnyPermission(userId, perms),
      requirePermission: (perm: string) => rbac.requirePermission(userId, perm)
    };

    next();
  };
}
