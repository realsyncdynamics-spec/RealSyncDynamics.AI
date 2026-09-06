import { hashObject } from "../lib/hash";
import type {
  Command,
  EvaluatedPolicy,
  PolicyEvaluation,
  PolicyResult,
  PolicyRule,
  PolicyVersion,
} from "../types";

/**
 * Policy Engine — erzeugt ein vollständiges Evaluation Result, kein
 * bloßes „eine Policy hat angeschlagen". Jede aktive Policy-Version wird
 * bewertet (PASS / VIOLATION / NOT_APPLICABLE), das Gesamtergebnis wird
 * gehasht und bindet damit spätere Freigaben an genau diesen Payload.
 *
 * Deny by default, dreifach:
 *  1. Leeres Policy-Set → DENY. Eine Org ohne Regeln hat nichts erlaubt.
 *  2. Unbekannter Regeltyp → VIOLATION. Was die Engine nicht prüfen kann,
 *     gilt als nicht bestanden — nie als still übersprungen.
 *  3. Nicht verifizierbare Angaben (fremde Währung, unbekannte Zeitzone)
 *     → VIOLATION mit Begründung, nicht NOT_APPLICABLE.
 *
 * EU-AI-Act-Bezug: Die Evaluation ist der maschinelle Teil der
 * Aufzeichnungspflichten (Logging/Traceability); die juristische
 * Feinabstimmung auf Art. 12/26 wird vor Go-live separat verifiziert.
 */

interface RuleOutcome {
  status: PolicyResult;
  reason?: string;
}

/** Payload-Konventionen, auf die sich Regeln beziehen. Alles optional. */
interface RulePayloadView {
  budget?: { value?: unknown; currency?: unknown };
  recipients?: unknown;
  recipient_count?: unknown;
}

function recipientCount(payload: RulePayloadView): number | null {
  if (Array.isArray(payload.recipients)) return payload.recipients.length;
  if (typeof payload.recipient_count === "number" && Number.isFinite(payload.recipient_count)) {
    return payload.recipient_count;
  }
  return null;
}

function hourIn(tz: string, at: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: tz,
  }).format(at);
  return Number.parseInt(formatted, 10);
}

export function evaluateRule(
  rule: PolicyRule,
  command: Pick<Command, "intent" | "payload">,
  now: Date = new Date(),
): RuleOutcome {
  const payload = command.payload as RulePayloadView;

  switch (rule.type) {
    case "ALLOWED_INTENTS":
      return rule.intents.includes(command.intent)
        ? { status: "PASS" }
        : { status: "VIOLATION", reason: `Intent "${command.intent}" ist nicht in der Erlaubnisliste` };

    case "REQUIRE_APPROVAL_FOR_INTENT":
      return rule.intents.includes(command.intent)
        ? { status: "VIOLATION", reason: `Intent "${command.intent}" erfordert menschliche Freigabe` }
        : { status: "NOT_APPLICABLE" };

    case "MAX_BUDGET": {
      const budget = payload.budget;
      if (budget === undefined) return { status: "NOT_APPLICABLE" };
      if (typeof budget?.value !== "number" || typeof budget?.currency !== "string") {
        return { status: "VIOLATION", reason: "Budget-Angabe ist nicht prüfbar (value/currency fehlen)" };
      }
      if (budget.currency !== rule.currency) {
        // Fremde Währung ist nicht vergleichbar — unprüfbar heißt nicht bestanden.
        return {
          status: "VIOLATION",
          reason: `Budget in ${budget.currency} nicht prüfbar gegen Limit in ${rule.currency}`,
        };
      }
      return budget.value <= rule.value
        ? { status: "PASS" }
        : { status: "VIOLATION", reason: `Budget ${budget.value} ${budget.currency} über Limit ${rule.value}` };
    }

    case "MAX_RECIPIENTS": {
      const count = recipientCount(payload);
      if (count === null) return { status: "NOT_APPLICABLE" };
      return count <= rule.value
        ? { status: "PASS" }
        : { status: "VIOLATION", reason: `${count} Empfänger über Limit ${rule.value}` };
    }

    case "ALLOWED_RECIPIENT_DOMAINS": {
      if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
        return { status: "NOT_APPLICABLE" };
      }
      const allowed = new Set(rule.domains.map((d) => d.toLowerCase()));
      for (const recipient of payload.recipients) {
        const domain = typeof recipient === "string" ? recipient.split("@")[1]?.toLowerCase() : undefined;
        if (!domain || !allowed.has(domain)) {
          return { status: "VIOLATION", reason: `Empfänger-Domain nicht erlaubt: ${String(recipient)}` };
        }
      }
      return { status: "PASS" };
    }

    case "TIME_WINDOW": {
      let hour: number;
      try {
        hour = hourIn(rule.tz, now);
      } catch {
        return { status: "VIOLATION", reason: `Zeitzone "${rule.tz}" ist nicht prüfbar` };
      }
      const { from_hour: from, to_hour: to } = rule;
      // from === to bedeutet Ganztagesfenster; from > to ist ein Über-Nacht-Fenster.
      const inWindow =
        from === to ? true : from < to ? hour >= from && hour < to : hour >= from || hour < to;
      return inWindow
        ? { status: "PASS" }
        : { status: "VIOLATION", reason: `Außerhalb des Zeitfensters ${from}–${to} Uhr (${rule.tz})` };
    }

    default:
      // Deny by default: ein Regeltyp, den diese Engine-Version nicht kennt,
      // wird nie still übersprungen.
      return {
        status: "VIOLATION",
        reason: `Unbekannter Regeltyp "${(rule as { type?: string }).type ?? "?"}"`,
      };
  }
}

export async function evaluatePolicies(
  command: Pick<Command, "intent" | "payload" | "payload_hash">,
  policies: PolicyVersion[],
  now: Date = new Date(),
): Promise<PolicyEvaluation> {
  const evaluated: EvaluatedPolicy[] = [];
  const violations: EvaluatedPolicy[] = [];

  for (const policy of policies) {
    const outcome = evaluateRule(policy.rule, command, now);
    const entry: EvaluatedPolicy = {
      policy_id: policy.policy_id,
      policy_version_id: policy.id,
      version: policy.version,
      name: policy.name,
      rule_hash: policy.rule_hash,
      action: policy.action,
      result: outcome.status,
      reason: outcome.reason,
    };
    evaluated.push(entry);
    if (outcome.status === "VIOLATION") violations.push(entry);
  }

  let decision: PolicyEvaluation["decision"];
  if (policies.length === 0) {
    // Deny by default: ohne konfigurierte Policies ist nichts erlaubt.
    decision = "DENY";
  } else if (violations.some((v) => v.action === "DENY")) {
    decision = "DENY";
  } else if (violations.some((v) => v.action === "REQUIRE_APPROVAL")) {
    decision = "APPROVAL";
  } else {
    // Übrig bleiben höchstens WARN-Verstöße — sie blockieren nicht,
    // stehen aber vollständig in der Evidence.
    decision = "ALLOW";
  }

  const evaluation_hash = await hashObject({
    payload_hash: command.payload_hash,
    decision,
    evaluated,
  });

  return {
    decision,
    evaluated,
    violations,
    evaluation_hash,
    evaluated_at: now.toISOString(),
    policy_set_size: policies.length,
  };
}
