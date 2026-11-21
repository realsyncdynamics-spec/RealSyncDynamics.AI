import { describe, expect, it } from "vitest";
import { TEST_HOST, bridgeKind, verdictFromGateway } from "../../extension-governance/gate.js";

const allow = {
  action_id: "act-1",
  decision: "ALLOW",
  browser_may_proceed: true,
  executes: false,
};

describe("verdictFromGateway", () => {
  it("ALLOW mit Kettenbeleg lässt genau diesen Aufruf zu", () => {
    expect(verdictFromGateway(201, allow)).toEqual({ proceed: true, action_id: "act-1" });
  });

  it("DENIED, Timeout-Status und 500 lassen nicht zu", () => {
    expect(verdictFromGateway(201, { ...allow, decision: "DENY", browser_may_proceed: false }).proceed).toBe(false);
    expect(verdictFromGateway(504, allow).proceed).toBe(false);
    expect(verdictFromGateway(500, { error: "INTERNAL" }).proceed).toBe(false);
  });

  it("eine Antwort, die serverseitig ausführen würde, ist kein ALLOW für den Browser", () => {
    expect(verdictFromGateway(201, { ...allow, executes: true }).proceed).toBe(false);
  });

  it("PROCESSING ohne action_id ist kein Ja", () => {
    expect(verdictFromGateway(200, { commandId: "act-1", state: "PROCESSING" }).proceed).toBe(false);
  });
});

describe("bridgeKind", () => {
  it("leitet decide und event, aber nie den Puffer", () => {
    expect(bridgeKind({ __rsdGovernance: true, decide: { id: "1" } })).toBe("decide");
    expect(bridgeKind({ __rsdGovernance: true, event: { event_type: "x" } })).toBe("event");
    expect(bridgeKind({ __rsdGovernance: true, type: "rsd:get_buffer" })).toBe("ignore");
    expect(bridgeKind({ type: "rsd:get_buffer" })).toBe("ignore");
  });

  it("der Test-Host ist nicht einer der Anbieter", () => {
    expect(TEST_HOST.endsWith("openai.com")).toBe(false);
  });
});
