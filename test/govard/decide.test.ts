import { describe, expect, it, vi } from "vitest";
import { decideOutcome, parseDecideBody, runDecide } from "../../workers/govard-gateway/src/decide";
import { GovardError, type PolicyEvaluation } from "../../workers/govard-gateway/src/types";

function evaluation(decision: PolicyEvaluation["decision"]): PolicyEvaluation {
  return {
    decision,
    evaluated: [],
    violations: [],
    evaluation_hash: "eval-1",
    evaluated_at: "2026-11-21T00:00:00.000Z",
    policy_set_size: 1,
  };
}

describe("decideOutcome", () => {
  it("ALLOW lässt den Browser zu und führt nichts aus", () => {
    expect(decideOutcome("ALLOW", null, "claude")).toEqual({
      decision: "ALLOW",
      browser_may_proceed: true,
      executes: false,
      reason: null,
    });
  });

  it("DENY und APPROVAL lassen den Browser nicht zu", () => {
    expect(decideOutcome("DENY", null, "claude").browser_may_proceed).toBe(false);
    expect(decideOutcome("APPROVAL", null, "claude")).toMatchObject({
      decision: "APPROVAL",
      browser_may_proceed: false,
      executes: false,
    });
  });

  it("abweichender Akteur im Body ist DENY, auch wenn die Engine ALLOW sagt", () => {
    expect(decideOutcome("ALLOW", "Grok", "claude")).toEqual({
      decision: "DENY",
      browser_may_proceed: false,
      executes: false,
      reason: "ACTOR_MISMATCH",
    });
  });

  it("gleicher Akteur wie der Key bleibt ALLOW", () => {
    expect(decideOutcome("ALLOW", "claude", "claude").browser_may_proceed).toBe(true);
  });
});

describe("parseDecideBody", () => {
  it("liest keinen Akteur, wenn das Feld fehlt", () => {
    const body = parseDecideBody({ intent: "browser.fetch", payload: { host: "gate.realsyncdynamics.test" } });
    expect(body.claimedActor).toBeNull();
    expect(body.source).toBe("extension");
  });

  it("lehnt einen leeren Akteur ab", () => {
    expect(() => parseDecideBody({ intent: "browser.fetch", actor: "" })).toThrow(GovardError);
  });
});

describe("runDecide", () => {
  it("schreibt die Entscheidung vor der Antwort und finalisiert erst danach", async () => {
    const append = vi.fn(async () => {});
    const finalize = vi.fn(async () => {});
    const result = await runDecide({
      reserved: true,
      actionId: "act-1",
      claimedActor: null,
      principalActorId: "claude",
      replay: async () => { throw new Error("kein Replay"); },
      evaluate: async () => evaluation("ALLOW"),
      append,
      finalize,
    });

    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      action_id: "act-1",
      decision: "ALLOW",
      browser_may_proceed: true,
      executes: false,
    });
    expect(append).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(append.mock.invocationCallOrder[0]).toBeLessThan(finalize.mock.invocationCallOrder[0]);
  });

  it("finalisiert nicht, wenn die Kette 500 wirft", async () => {
    const finalize = vi.fn(async () => {});
    await expect(runDecide({
      reserved: true,
      actionId: "act-1",
      claimedActor: null,
      principalActorId: "claude",
      replay: async () => { throw new Error("kein Replay"); },
      evaluate: async () => evaluation("ALLOW"),
      append: async () => { throw new Error("chain down"); },
      finalize,
    })).rejects.toThrow("chain down");
    expect(finalize).not.toHaveBeenCalled();
  });

  it("gleicher Key spielt die gespeicherte Antwort ab und schreibt nicht noch einmal", async () => {
    const append = vi.fn(async () => {});
    const stored = { action_id: "act-1", decision: "ALLOW", browser_may_proceed: true, executes: false };
    const result = await runDecide({
      reserved: false,
      actionId: "act-2",
      claimedActor: null,
      principalActorId: "claude",
      replay: async () => stored,
      evaluate: async () => { throw new Error("keine zweite Evaluation"); },
      append,
      finalize: async () => { throw new Error("kein zweites Finalize"); },
    });
    expect(result).toEqual({ status: 200, body: stored });
    expect(append).not.toHaveBeenCalled();
  });
});
