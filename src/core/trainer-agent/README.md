# TrainerAgent

Central trainer / coach / quality-reviewer for every other agent on the RealSync Agent OS. Observes outputs, scores them on 7 dimensions, blocks anything below 80/100, generates role-aware coaching sessions, brokers peer-help, rotates agents across roles for cross-domain learning, and stores learning notes.

**Hard safety rule (spec §12):** TrainerAgent **NEVER** makes binding business decisions. Every output is a `TrainerRecommendation` — a suggestion with reasoning, never an action. A downstream actor (orchestrator, human reviewer, designated DecisionAgent) chooses whether to apply.

---

## Cycle

```
observe → diagnose → coach → rotate → verify → store_learning
```

| Verb | Method | Output |
|---|---|---|
| observe + diagnose | `reviewOutput(output)` | `QualityReview` + `TrainerRecommendation` |
| coach | `trainAgent(args)` | `TrainingSession` |
| peer-help | `requestPeerHelp(args)` | `PeerHelpRequest` + `TrainerRecommendation` |
| rotate | `rotateAgentRole(args)` | `RotationLog` + `TrainerRecommendation` |
| store learning | `createLearningNote(args)` | `LearningNote` |
| one-shot pipeline | `reviewAndMaybeCoach(args)` | review + recommendation (+ training if blocked) |
| handoff broker | `prepareHandoff(args)` | `HandoffPacket` |

---

## Quality rubric — 7 dimensions

| Dimension | Weight | Direction |
|---|---|---|
| correctness | 22 | higher = better |
| completeness | 18 | higher = better |
| evidence_quality | 18 | higher = better |
| clarity | 10 | higher = better |
| actionability | 10 | higher = better |
| **risk_level** | 12 | **inverted** — lower raw = higher aggregate contribution |
| confidence | 10 | higher = better |

**Threshold:** aggregate ≥ 80/100 → approved. Anything below → blocked + retrain.

The default scorer in `qualityRubric.ts` uses pure heuristics (text length, evidence count, risk vocabulary, average word length). Phase B replaces it with LLM-graded scoring via `ai-gateway` — the `TrainerAgent` constructor accepts a custom `score` function for that swap.

---

## Storage model

In-memory by default (`TrainerStore`). A `setPersistHook()` exposes save callbacks per record type so a Phase-B DB-backed implementation only has to implement them. The spec's 5 tables map to:

| Spec table | TS shape |
|---|---|
| `agent_profiles` | `AgentProfile` |
| `agent_training_sessions` | `TrainingSession` |
| `agent_handoffs` | `HandoffPacket` |
| `agent_rotation_log` | `RotationLog` |
| `agent_quality_reviews` | `QualityReview` |

Plus two extras: `LearningNote` (cross-agent knowledge) and `PeerHelpRequest` (the trainer's broker queue).

---

## Example payloads

### Agent rotation

```json
{
  "id":              "rot_lm5yhd_8",
  "agent_name":      "promotion-agent",
  "original_role":   "PromotionAgent",
  "rotated_role":    "DecisionAgent",
  "task":            "Bewerte Risiko-Tonalität für Pre-Consent-Finding",
  "result":          "Vorschlag: weichere Formulierung, Quelle Erst-Audit",
  "trainer_feedback":"Rotation produced usable output. promotion-agent now understands DecisionAgent expectations.",
  "produced_usable_output": true,
  "created_at":      "2026-05-16T22:11:03.421Z"
}
```

### Agent-to-agent handoff

```json
{
  "id":              "handoff_lm5yhd_9",
  "source_agent":    "promotion-agent",
  "target_agent":    "research-agent",
  "task_id":         "task_42",
  "context_summary": "LinkedIn-Post braucht zwei unabhängige Quellen für die Tracker-Aussage.",
  "known_facts": [
    "Audit fand 3 GA-Tracker vor Consent.",
    "DSGVO Art. 6 + TTDSG §25 relevant."
  ],
  "open_questions": [
    "Gibt es eine Aufsichtsbehörden-Entscheidung als Präzedenzfall?"
  ],
  "recommended_next_step": "Pull last 12 months of LfDI / BfDI rulings on pre-consent GA.",
  "payload":         { "post_draft_id": "draft_001" },
  "status":          "pending",
  "created_at":      "2026-05-16T22:11:03.422Z"
}
```

### Trainer feedback (review)

```json
{
  "id":            "rev_lm5yhd_5",
  "agent_name":    "promotion-agent",
  "task_id":       "task_42",
  "scores": {
    "correctness":      45,
    "completeness":     30,
    "evidence_quality":  0,
    "clarity":          70,
    "actionability":    50,
    "risk_level":       80,
    "confidence":       20
  },
  "score":         32,
  "issues_found": [
    "correctness score below threshold — content may be wrong or empty",
    "output appears truncated or sparse",
    "insufficient evidence / sources backing the output",
    "elevated risk vocabulary without supporting evidence",
    "agent confidence is low — consider peer-help before approval"
  ],
  "approved":      false,
  "feedback":      "Output scored 32/100 (threshold 80). See improvement plan.",
  "created_at":    "2026-05-16T22:11:03.420Z"
}
```

The companion `TrainerRecommendation` for this review:

```json
{
  "id":               "rec_lm5yhd_6",
  "kind":             "block_output",
  "about_agent":      "promotion-agent",
  "task_id":          "task_42",
  "reason":           "aggregate score 32 < 80",
  "suggested_action": "Block the output and run trainAgent() on the producer.",
  "created_at":       "2026-05-16T22:11:03.420Z"
}
```

---

## Agent roles (9)

```
ResearchAgent      → fact-finding, source-grade
MemoryAgent        → structured retention + retrieval
PlanningAgent      → roadmaps with measurable next-step
SimulationAgent    → falsifiable scenarios
PromotionAgent     → framing with evidence-matched tone
MonitoringAgent    → continuous signal + alert
DecisionAgent      → reversible-class decisions + co-signer
OutputAgent        → format-fit packaging
TrainerAgent       → observer + coach (no business decisions)
```

Each role has a baseline `lesson` template in `coaching.ts`. The trainer combines it with per-review issues to produce a coaching session.

---

## Files

| File | Role |
|---|---|
| `types.ts` | All shared types — `AgentProfile`, `QualityReview`, `TrainingSession`, `HandoffPacket`, `RotationLog`, `LearningNote`, `PeerHelpRequest`, `TrainerRecommendation`, `AgentOutput`. |
| `qualityRubric.ts` | Pure scoring + threshold + issue-explanation. |
| `coaching.ts` | Role-aware lesson templates + improvement plan generator. |
| `handoff.ts` | Handoff packet creation + validation + state transitions. |
| `rotation.ts` | Adjacency map + rotation eligibility + log builder. |
| `store.ts` | In-memory store with persist-hook for Phase-B DB swap. |
| `trainer.ts` | The `TrainerAgent` class — the 6 spec verbs. |
| `../../../test/core/trainer-agent/trainer.test.ts` | 24 unit tests. |

---

## Out of scope (Phase B follow-ups)

- DB-backed `TrainerStore` (Postgres tables per the spec)
- LLM-graded scoring via `ai-gateway` (currently pure heuristics)
- An orchestrator that calls `reviewAndMaybeCoach()` automatically on every agent output
- A dashboard surface showing the trainer queue (recommendations / pending peer-help / pending reviews)
