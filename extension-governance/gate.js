/** Test-Host des Decision-only-Gates. Die acht KI-Anbieter bleiben bei warn. */
export const TEST_HOST = "gate.realsyncdynamics.test";

/** Timer sitzt in der Seite. Kürzer als ein menschliches Warten, lang genug für einen Roundtrip. */
export const PAGE_TIMEOUT_MS = 1500;

/**
 * Nur eine vollständige ALLOW-Antwort lässt den fetch zu.
 * 500, Timeout, PROCESSING, APPROVAL und executes !== false sind kein Ja.
 */
export function verdictFromGateway(status, body) {
  if (status !== 200 && status !== 201) return { proceed: false, reason: "http" };
  if (body === null || typeof body !== "object") return { proceed: false, reason: "body" };
  if (body.executes !== false) return { proceed: false, reason: "executes" };
  if (body.decision !== "ALLOW" || body.browser_may_proceed !== true) {
    return { proceed: false, reason: "decision" };
  }
  if (typeof body.action_id !== "string" || body.action_id.length === 0) {
    return { proceed: false, reason: "action" };
  }
  return { proceed: true, action_id: body.action_id };
}

/** Was die Seitenbrücke weiterleiten darf. get_buffer ist nie dabei. */
export function bridgeKind(data) {
  if (!data || data.__rsdGovernance !== true) return "ignore";
  if (data.type === "rsd:get_buffer") return "ignore";
  if (data.decide && typeof data.decide === "object" && typeof data.decide.id === "string") return "decide";
  if (data.event && typeof data.event === "object") return "event";
  return "ignore";
}
