/// <reference path="../cf.d.ts" />
import {
  type Command,
  type CommandState,
  type PolicyAction,
  type PolicyRule,
  type PolicyVersion,
  type PolicyEvaluation,
  canTransition,
  GovardError,
} from "../types";
import { hashObject } from "../lib/hash";

/**
 * Jede Query in dieser Klasse ist per Konstruktion org-gebunden. D1 hat
 * kein RLS — Mandantentrennung lebt deshalb hier, auf Repository-Ebene,
 * damit sie nicht an einzelnen Queries vergessen werden kann.
 *
 * Regel für die Codebasis: kein roher env.DB-Zugriff außerhalb dieser
 * Datei, mit zwei benannten Ausnahmen: auth.ts (Key-Lookup VOR der
 * Org-Auflösung) und der Evidence Sequencer (D1-Projektion der Chain).
 */
export class OrgRepository {
  constructor(
    private readonly db: D1Database,
    readonly orgId: string,
  ) {}

  private now() {
    return new Date().toISOString();
  }

  /** Nur für den Cron (Seal + Approval-Verfall): bewusst org-übergreifend. */
  static async allOrgIds(db: D1Database): Promise<string[]> {
    const { results } = await db.prepare(`SELECT id FROM orgs`).all<{ id: string }>();
    return results.map((r) => r.id);
  }

  // -------------------------------------------------------------
  // Policies — immer aufgelöst auf ihre aktuelle unveränderliche Version
  // -------------------------------------------------------------
  async activePolicyVersions(): Promise<PolicyVersion[]> {
    const { results } = await this.db
      .prepare(
        `SELECT pv.id, pv.org_id, pv.policy_id, pv.version, pv.name,
                pv.rule, pv.action, pv.rule_hash
           FROM policies p
           JOIN policy_versions pv ON pv.id = p.current_version_id
          WHERE p.org_id = ? AND p.enabled = 1
          ORDER BY pv.name`,
      )
      .bind(this.orgId)
      .all<Record<string, string | number>>();

    return results.map((r) => ({
      id: r.id as string,
      org_id: r.org_id as string,
      policy_id: r.policy_id as string,
      version: r.version as number,
      name: r.name as string,
      rule: JSON.parse(r.rule as string),
      action: r.action as PolicyVersion["action"],
      rule_hash: r.rule_hash as string,
    }));
  }

  async listPolicies() {
    const { results } = await this.db
      .prepare(
        `SELECT p.id, p.name, p.enabled, p.created_at,
                pv.version, pv.rule, pv.action, pv.rule_hash
           FROM policies p
           LEFT JOIN policy_versions pv ON pv.id = p.current_version_id
          WHERE p.org_id = ?
          ORDER BY p.name`,
      )
      .bind(this.orgId)
      .all<Record<string, unknown>>();
    return results.map((r) => ({
      ...r,
      enabled: r.enabled === 1,
      rule: typeof r.rule === "string" ? JSON.parse(r.rule) : null,
    }));
  }

  /**
   * Legt eine Policy an oder versioniert eine bestehende. policy_versions
   * ist append-only — eine Regeländerung erzeugt immer eine neue Version,
   * auf die laufende Evaluationen per rule_hash verweisen.
   */
  async upsertPolicyVersion(p: {
    policy_id?: string;
    name: string;
    rule: PolicyRule;
    action: PolicyAction;
    created_by: string;
  }): Promise<{ policy_id: string; version_id: string; version: number; rule_hash: string }> {
    const ts = this.now();
    const rule_hash = await hashObject(p.rule);
    let policyId = p.policy_id;
    let version = 1;

    if (policyId) {
      const row = await this.db
        .prepare(
          `SELECT MAX(pv.version) AS v FROM policy_versions pv
            WHERE pv.org_id = ? AND pv.policy_id = ?`,
        )
        .bind(this.orgId, policyId)
        .first<{ v: number | null }>();
      if (row?.v == null) throw new GovardError("POLICY_NOT_FOUND", "Policy existiert nicht", 404);
      version = row.v + 1;
    } else {
      policyId = crypto.randomUUID();
      await this.db
        .prepare(
          `INSERT INTO policies (id, org_id, name, enabled, created_at)
           VALUES (?, ?, ?, 1, ?)`,
        )
        .bind(policyId, this.orgId, p.name, ts)
        .run();
    }

    const versionId = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO policy_versions
           (id, org_id, policy_id, version, name, rule, action, rule_hash, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(versionId, this.orgId, policyId, version, p.name,
            JSON.stringify(p.rule), p.action, rule_hash, ts, p.created_by)
      .run();

    await this.db
      .prepare(`UPDATE policies SET current_version_id = ?, name = ? WHERE id = ? AND org_id = ?`)
      .bind(versionId, p.name, policyId, this.orgId)
      .run();

    return { policy_id: policyId, version_id: versionId, version, rule_hash };
  }

  // -------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------
  async createCommand(c: {
    id: string;
    actor_id: string;
    source: string;
    intent: string;
    payload: Record<string, unknown>;
    payload_hash: string;
  }): Promise<void> {
    const ts = this.now();
    await this.db
      .prepare(
        `INSERT INTO commands
           (id, org_id, actor_id, source, intent, payload, payload_hash,
            state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?)`,
      )
      .bind(c.id, this.orgId, c.actor_id, c.source, c.intent,
            JSON.stringify(c.payload), c.payload_hash, ts, ts)
      .run();
  }

  async getCommand(id: string): Promise<Command | null> {
    const row = await this.db
      .prepare(`SELECT * FROM commands WHERE id = ? AND org_id = ?`)
      .bind(id, this.orgId)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return { ...row, payload: JSON.parse(row.payload as string) } as Command;
  }

  async attachEvaluation(commandId: string, evaluation: PolicyEvaluation): Promise<void> {
    await this.db
      .prepare(
        `UPDATE commands SET evaluation_hash = ?, updated_at = ?
          WHERE id = ? AND org_id = ? AND evaluation_hash IS NULL`,
      )
      .bind(evaluation.evaluation_hash, this.now(), commandId, this.orgId)
      .run();
  }

  /**
   * Bewachter Übergang. Das `AND state = ?` ist optimistische Nebenläufigkeit:
   * Von zwei Workern, die denselben Command bewegen wollen, gewinnt genau
   * einer — ein Command kann also nie doppelt ausgeführt werden.
   */
  async transition(
    commandId: string,
    from: CommandState,
    to: CommandState,
    opts: { actorId?: string; failureReason?: string } = {},
  ): Promise<void> {
    if (!canTransition(from, to)) {
      throw new GovardError("ILLEGAL_TRANSITION", `${from} -> ${to} ist nicht zulässig`, 409);
    }
    const ts = this.now();
    const terminal = to === "EXECUTED" || to === "FAILED" || to === "DENIED";

    const res = await this.db
      .prepare(
        `UPDATE commands
            SET state = ?, updated_at = ?,
                completed_at = CASE WHEN ? = 1 THEN ? ELSE completed_at END,
                failure_reason = COALESCE(?, failure_reason)
          WHERE id = ? AND org_id = ? AND state = ?`,
      )
      .bind(to, ts, terminal ? 1 : 0, ts, opts.failureReason ?? null,
            commandId, this.orgId, from)
      .run();

    if (res.meta.changes === 0) {
      throw new GovardError("STATE_CONFLICT", `Command ist nicht mehr im Zustand ${from}`, 409);
    }

    await this.db
      .prepare(
        `INSERT INTO command_transitions
           (id, org_id, command_id, from_state, to_state, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), this.orgId, commandId, from, to,
            opts.actorId ?? null, ts)
      .run();
  }

  async transitionsFor(commandId: string) {
    const { results } = await this.db
      .prepare(
        `SELECT from_state, to_state, actor_id, created_at
           FROM command_transitions
          WHERE org_id = ? AND command_id = ?
          ORDER BY created_at`,
      )
      .bind(this.orgId, commandId)
      .all();
    return results;
  }

  // -------------------------------------------------------------
  // Approvals
  // -------------------------------------------------------------
  async createApproval(a: {
    command_id: string;
    evaluation_hash: string;
    requested_by: string;
    ttlHours?: number;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const expires = new Date(Date.now() + (a.ttlHours ?? 72) * 3_600_000).toISOString();
    await this.db
      .prepare(
        `INSERT INTO approvals
           (id, org_id, command_id, evaluation_hash, status,
            requested_by, expires_at, created_at)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      )
      .bind(id, this.orgId, a.command_id, a.evaluation_hash,
            a.requested_by, expires, this.now())
      .run();
    return id;
  }

  /**
   * Beansprucht eine offene Freigabe atomar. Gibt null zurück, wenn sie
   * bereits entschieden oder verfallen ist — der Aufrufer darf auf null
   * nicht weitermachen.
   */
  async decideApproval(
    approvalId: string,
    decision: "APPROVED" | "DENIED",
    actorId: string,
    reason?: string,
  ): Promise<{ command_id: string; evaluation_hash: string } | null> {
    const ts = this.now();
    const res = await this.db
      .prepare(
        `UPDATE approvals
            SET status = ?, decided_by = ?, decided_at = ?, reason = ?
          WHERE id = ? AND org_id = ? AND status = 'PENDING'
            AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .bind(decision, actorId, ts, reason ?? null, approvalId, this.orgId, ts)
      .run();

    if (res.meta.changes === 0) return null;

    return this.db
      .prepare(`SELECT command_id, evaluation_hash FROM approvals WHERE id = ? AND org_id = ?`)
      .bind(approvalId, this.orgId)
      .first<{ command_id: string; evaluation_hash: string }>();
  }

  async inbox(limit = 50) {
    const { results } = await this.db
      .prepare(
        `SELECT a.id AS approval_id, a.created_at, a.expires_at,
                c.id AS command_id, c.intent, c.source, c.actor_id, c.payload,
                c.evaluation_hash
           FROM approvals a
           JOIN commands c ON c.id = a.command_id AND c.org_id = a.org_id
          WHERE a.org_id = ? AND a.status = 'PENDING'
          ORDER BY a.created_at DESC
          LIMIT ?`,
      )
      .bind(this.orgId, limit)
      .all<Record<string, unknown>>();
    return results.map((r) => ({
      ...r,
      payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
    }));
  }

  /**
   * Markiert verfallene offene Freigaben als EXPIRED und liefert die
   * betroffenen Commands, damit der Aufrufer sie ordentlich (Übergang +
   * Evidence) nach DENIED bewegt. RETURNING ist in D1/SQLite verfügbar.
   */
  async expireApprovals(): Promise<{ id: string; command_id: string }[]> {
    const ts = this.now();
    const { results } = await this.db
      .prepare(
        `UPDATE approvals
            SET status = 'EXPIRED'
          WHERE org_id = ? AND status = 'PENDING'
            AND expires_at IS NOT NULL AND expires_at <= ?
          RETURNING id, command_id`,
      )
      .bind(this.orgId, ts)
      .all<{ id: string; command_id: string }>();
    return results;
  }

  // -------------------------------------------------------------
  // Idempotenz — Reservieren vor der Verarbeitung, Ausfüllen danach.
  // Zwei gleichzeitige Requests mit demselben Key erzeugen so höchstens
  // EINEN Command; der Verlierer bekommt die gespeicherte Antwort.
  // -------------------------------------------------------------
  async reserveIdempotency(
    key: string,
    requestHash: string,
    commandId: string,
  ): Promise<boolean> {
    const res = await this.db
      .prepare(
        `INSERT OR IGNORE INTO idempotency_keys
           (org_id, key, request_hash, command_id, response, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(this.orgId, key, requestHash, commandId,
            JSON.stringify({ commandId, state: "PROCESSING" }), this.now())
      .run();
    return res.meta.changes === 1;
  }

  async replay(key: string, requestHash: string): Promise<unknown | null> {
    const row = await this.db
      .prepare(`SELECT request_hash, response FROM idempotency_keys WHERE org_id = ? AND key = ?`)
      .bind(this.orgId, key)
      .first<{ request_hash: string; response: string }>();
    if (!row) return null;
    if (row.request_hash !== requestHash) {
      throw new GovardError("IDEMPOTENCY_MISMATCH", "Key wurde bereits mit anderem Body benutzt", 422);
    }
    return JSON.parse(row.response);
  }

  async finalizeIdempotency(key: string, response: unknown): Promise<void> {
    await this.db
      .prepare(`UPDATE idempotency_keys SET response = ? WHERE org_id = ? AND key = ?`)
      .bind(JSON.stringify(response), this.orgId, key)
      .run();
  }

  // -------------------------------------------------------------
  // Evidence (Lesepfad — die Chain schreibt nur der Sequencer)
  // -------------------------------------------------------------
  async evidenceForCommand(commandId: string) {
    const { results } = await this.db
      .prepare(
        `SELECT sequence, event_type, payload, previous_hash, event_hash, created_at
           FROM evidence_events
          WHERE org_id = ? AND command_id = ?
          ORDER BY sequence`,
      )
      .bind(this.orgId, commandId)
      .all();
    return results;
  }
}
