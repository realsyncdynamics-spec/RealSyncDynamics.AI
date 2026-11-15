// Browser Guardian · Policy Enforcement Point + Executor-Tor.
//
// Ablauf je Aktion:  Vorschlag → Policy (jetzt, nicht aus dem Vorschlag
// übernommen) → ggf. Freigabe verbrauchen → Treiber mit Egress-Wächter →
// Ergebnis prüfen → Nachweis. Der Treiber (Chromium) ist nur hier
// erreichbar; Planer/Modell bekommen ihn nie.
//
// Fail-closed: Lässt sich ein Nachweis nicht schreiben, wird die Sitzung
// angehalten und jede weitere Aktion abgelehnt.

import { actionFingerprint, ApprovalLedger, effectiveTtlSeconds, type ApprovalRecord, type Approver, type ConsumeOutcome } from './approval.ts';
import { classifyOrigin, classifyText, isOriginBlocked, stricterClass } from './classify.ts';
import type { EvidenceLog, EvidenceRecord } from './evidence.ts';
import { evaluate, isPrivateHostLiteral, mayForwardToModel, originOf, parseAction } from './policy.ts';
import { redactAction, redactResult, type DriverResult } from './redact.ts';
import type { ActionRequest, BrowserAction, GuardianContext, GuardianDecision, GuardianPolicy, SessionState, TargetClass } from './types.ts';

/** Vom Guardian je Ausführung gesetzt; der Treiber fragt bei jeder Dokument-Anfrage. */
export interface EgressGuard {
  /** Hauptdokument: Navigation, Weiterleitung, Formular-Absenden. */
  document(url: string): boolean;
}

export interface BrowserDriver {
  readonly kind: 'playwright' | 'simulation';
  run(action: BrowserAction, guard: EgressGuard): Promise<DriverResult>;
  close(): Promise<void>;
}

export interface Proposal {
  decision: GuardianDecision;
  approval: ApprovalRecord | null;
}

export type ExecutionStatus =
  | 'executed'
  | 'denied'
  | 'approval_required'
  | 'approval_invalid'
  | 'executor_failed'
  | 'evidence_failed'
  | 'executed_unrecorded';

export interface ExecutionOutcome {
  status: ExecutionStatus;
  decision: GuardianDecision;
  approval_outcome?: ConsumeOutcome;
  /** Rohergebnis nur für den lokalen Nutzer; nie in den Nachweis. */
  result?: DriverResult;
  /** Darf das Ergebnis als Kontext an ein Sprachmodell? */
  forward_to_model: boolean;
}

export interface GuardianOptions {
  policy: GuardianPolicy;
  context: GuardianContext;
  driver: BrowserDriver;
  evidence: EvidenceLog;
  key: CryptoKey;
  approvals?: ApprovalLedger;
}

export class BrowserGuardian {
  #policy: GuardianPolicy;
  #context: GuardianContext;
  #driver: BrowserDriver;
  #evidence: EvidenceLog;
  #key: CryptoKey;
  #approvals: ApprovalLedger;
  #session: SessionState = { current_url: null, current_class: 'unclassified', tainted: false, halted: false, step_count: 0 };

  constructor(opts: GuardianOptions) {
    this.#policy = opts.policy;
    this.#context = opts.context;
    this.#driver = opts.driver;
    this.#evidence = opts.evidence;
    this.#key = opts.key;
    this.#approvals = opts.approvals ?? new ApprovalLedger();
  }

  get session(): SessionState {
    return { ...this.#session };
  }

  get approvals(): ApprovalLedger {
    return this.#approvals;
  }

  #record(kind: EvidenceRecord['kind'], fields: Record<string, unknown>): EvidenceRecord {
    return {
      kind,
      tenant_id: this.#context.tenant_id,
      session_id: this.#context.session_id,
      actor_id: this.#context.actor_id,
      policy_id: typeof this.#policy?.policy_id === 'string' && this.#policy.policy_id ? this.#policy.policy_id : 'invalid',
      policy_version: typeof this.#policy?.version === 'string' && this.#policy.version ? this.#policy.version : 'invalid',
      executor: this.#driver.kind,
      ...fields,
    };
  }

  /** false ⇒ Sitzung angehalten. */
  async #write(kind: EvidenceRecord['kind'], fields: Record<string, unknown>): Promise<boolean> {
    try {
      await this.#evidence.append(this.#record(kind, fields));
      return true;
    } catch {
      this.#session.halted = true;
      return false;
    }
  }

  #decisionFields(stage: string, request: ActionRequest, d: GuardianDecision): Record<string, unknown> {
    return {
      stage,
      source: request.source,
      channel: request.channel,
      action: redactAction(request.action),
      decision: d.decision,
      review: d.review,
      reasons: d.reasons.map((r) => r.code),
      effects: d.effects,
      target_origin: d.target_origin,
      target_class: d.target_class,
      engine: d.engine,
    };
  }

  #evaluate(request: ActionRequest): GuardianDecision {
    return evaluate({ policy: this.#policy, context: this.#context, session: this.#session, request });
  }

  async #fingerprint(request: ActionRequest, d: GuardianDecision): Promise<string> {
    const parsed = parseAction(request.action);
    return actionFingerprint(this.#key, this.#context, parsed.kind === 'ok' ? parsed.action : null, d);
  }

  /** Neue Richtlinie: offene Freigaben passen danach nicht mehr (Version im Fingerprint). */
  async setPolicy(policy: GuardianPolicy): Promise<void> {
    this.#policy = policy;
    await this.#write('session', { stage: 'policy_changed' });
  }

  async propose(request: ActionRequest): Promise<Proposal> {
    const decision = this.#evaluate(request);
    if (!(await this.#write('decision', this.#decisionFields('propose', request, decision)))) {
      return { decision: this.#haltedDecision(decision), approval: null };
    }
    if (decision.decision !== 'require_approval') return { decision, approval: null };

    const approval = this.#approvals.request({
      fingerprint: await this.#fingerprint(request, decision),
      review: decision.review,
      summary_de: decision.reasons.filter((r) => r.decision === 'require_approval').map((r) => r.text_de).join(' '),
      requested_by: this.#context.actor_id,
      ttl_seconds: effectiveTtlSeconds(this.#policy),
    });
    await this.#write('approval', { stage: 'requested', approval_id: approval.id, review: approval.review, expires_at: new Date(approval.expires_at).toISOString() });
    return { decision, approval };
  }

  async decideApproval(id: string, approver: Approver, approve: boolean): Promise<ApprovalRecord> {
    const r = this.#approvals.decide(id, approver, approve);
    await this.#write('approval', { stage: approve ? 'approved' : 'rejected', approval_id: id, decided_by: approver.id });
    return r;
  }

  #haltedDecision(d: GuardianDecision): GuardianDecision {
    return { ...d, decision: 'deny', review: 'none', reasons: [{ code: 'SESSION_HALTED', decision: 'deny', text_de: 'Nachweis konnte nicht geschrieben werden; Sitzung angehalten.' }] };
  }

  /** Dokument-Anfragen außerhalb des geprüften Ziels werden geblockt (Weiterleitungen, Absenden). */
  #guardFor(decision: GuardianDecision): EgressGuard {
    const allowedOrigin = decision.target_origin;
    const tainted = this.#session.tainted;
    const policy = this.#policy;
    return {
      document: (raw: string): boolean => {
        let url: URL;
        try { url = new URL(raw); } catch { return false; }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
        if (url.username || url.password || isPrivateHostLiteral(url.hostname)) return false;
        if (isOriginBlocked(policy, url.origin)) return false;
        if (url.origin === allowedOrigin) return true;
        return !tainted && classifyOrigin(policy, url.origin) === 'public';
      },
    };
  }

  async execute(request: ActionRequest, approvalId?: string): Promise<ExecutionOutcome> {
    // Neu bewerten — der Vorschlag von vorhin ist kein Freibrief.
    const decision = this.#evaluate(request);
    const denied = (status: ExecutionStatus, extra: Partial<ExecutionOutcome> = {}): ExecutionOutcome =>
      ({ status, decision, forward_to_model: false, ...extra });

    if (!(await this.#write('decision', this.#decisionFields('execute', request, decision)))) {
      return { status: 'evidence_failed', decision: this.#haltedDecision(decision), forward_to_model: false };
    }
    if (decision.decision === 'deny') return denied('denied');

    if (decision.decision === 'require_approval') {
      if (!approvalId) return denied('approval_required');
      const outcome = this.#approvals.consume(approvalId, await this.#fingerprint(request, decision));
      if (!(await this.#write('approval', { stage: 'consume', approval_id: approvalId, outcome }))) {
        return { status: 'evidence_failed', decision: this.#haltedDecision(decision), forward_to_model: false };
      }
      if (outcome !== 'consumed') return denied('approval_invalid', { approval_outcome: outcome });
    }

    const parsed = parseAction(request.action);
    if (parsed.kind !== 'ok') return denied('denied'); // durch evaluate bereits ausgeschlossen
    const action = parsed.action;

    this.#session.step_count += 1;
    const guard = this.#guardFor(decision);
    const previousUrl = this.#session.current_url;
    let result: DriverResult;
    try {
      result = await this.#driver.run(action, guard);
    } catch (e) {
      result = { ok: false, url: previousUrl, error: e instanceof Error ? e.message : 'driver error' };
    }
    // Nachprüfung: Ist die Seite trotz Wächter auf einem nicht geprüften Ziel
    // gelandet (z. B. Weiterleitung), gilt die Aktion als fehlgeschlagen.
    let outsideDecision = false;
    if (result.url && result.url !== previousUrl && !guard.document(result.url)) {
      outsideDecision = true;
      this.#session.tainted = true;
      result = { ...result, ok: false, error: 'LANDED_OUTSIDE_DECISION', text: undefined, screenshot_png: undefined };
    }

    // Sitzungszustand aus dem tatsächlichen Ergebnis (Weiterleitungen!), nicht aus dem Plan.
    const finalUrl = result.url; // null = keine Seite (z. B. Fehlerseite nach Blockade)
    const finalClass: TargetClass = classifyOrigin(this.#policy, originOf(finalUrl));
    this.#session.current_url = finalUrl;
    this.#session.current_class = finalClass;
    let resultClass: TargetClass = finalClass;
    if (typeof result.text === 'string') {
      resultClass = stricterClass(resultClass, classifyText(result.text, finalClass === 'unclassified' ? 'confidential' : finalClass).data_class);
    }
    const inputClass = action.type === 'type' ? classifyText(action.text).data_class : 'public';
    if (resultClass !== 'public' || inputClass !== 'public') this.#session.tainted = true;

    const written = await this.#write('execution', {
      stage: result.ok ? 'executed' : 'failed',
      action: redactAction(action),
      approval_id: approvalId ?? null,
      result: await redactResult(result),
      result_class: resultClass,
      landed_outside_decision: outsideDecision,
      session_tainted: this.#session.tainted,
    });
    if (!written) return { status: 'executed_unrecorded', decision, result, forward_to_model: false };

    return {
      status: result.ok ? 'executed' : 'executor_failed',
      decision,
      result,
      forward_to_model: result.ok && !this.#session.tainted && mayForwardToModel(resultClass),
    };
  }

  async close(): Promise<void> {
    await this.#write('session', { stage: 'closed', steps: this.#session.step_count });
    await this.#driver.close();
  }
}
