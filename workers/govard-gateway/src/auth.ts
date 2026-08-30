/// <reference path="./cf.d.ts" />
import { sha256Hex } from "./lib/hash";
import { GovardError, type ApiRole, type Principal } from "./types";

/**
 * API-Key-Auth. Der Klartext-Key wird nie gespeichert — nur sein
 * SHA-256-Hash steht in `api_keys`. Ein Key gehört genau einer Org und
 * einem Actor; die Rolle trennt Agenten von Freigebenden, damit ein
 * Agent-Key sich nie selbst freigeben kann.
 *
 * Das ist die eine benannte Ausnahme von der Repository-Regel: Der Lookup
 * läuft VOR der Org-Auflösung, ein OrgRepository existiert hier noch nicht.
 */
export async function authenticate(db: D1Database, request: Request): Promise<Principal> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    throw new GovardError("UNAUTHENTICATED", "Authorization: Bearer <api-key> fehlt", 401);
  }

  const keyHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT org_id, actor_id, role FROM api_keys
        WHERE key_hash = ? AND enabled = 1`,
    )
    .bind(keyHash)
    .first<{ org_id: string; actor_id: string; role: ApiRole }>();

  if (!row) throw new GovardError("UNAUTHENTICATED", "API-Key unbekannt oder deaktiviert", 401);
  return { org_id: row.org_id, actor_id: row.actor_id, role: row.role };
}

const ROLE_RANK: Record<ApiRole, number> = { agent: 0, approver: 1, admin: 2 };

export function requireRole(principal: Principal, minimum: ApiRole): void {
  if (ROLE_RANK[principal.role] < ROLE_RANK[minimum]) {
    throw new GovardError("FORBIDDEN", `Rolle "${minimum}" erforderlich`, 403);
  }
}
