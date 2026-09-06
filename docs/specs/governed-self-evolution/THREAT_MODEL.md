# Governed Self-Evolution — Threat Model

## Security Objective

Prevent autonomous evolution from becoming an unauthorized control plane or bypassing existing RSD governance.

## Assets

- Governance policies and enforcement
- Safety baselines and guardrails
- Tenant isolation
- Identity and authorization controls
- Production infrastructure and release privileges
- Critical data and schemas
- Evidence and audit integrity
- Rollback and kill-switch mechanisms
- Evolution registry and candidate provenance

## Trust Boundaries

1. **Observation boundary:** read-only access to observable system state.
2. **Analysis boundary:** produces non-authoritative analysis artifacts.
3. **Candidate boundary:** isolated proposal data with declared scope.
4. **Evaluation boundary:** controlled execution in non-production environments.
5. **Governance boundary:** authoritative policy and risk decision.
6. **Human approval boundary:** attributable authorization for effective change.
7. **Promotion boundary:** versioned artifact transition.
8. **Runtime boundary:** executes only approved artifacts.
9. **Evidence boundary:** append-only/manipulation-resistant record of decisions and transitions.

## Primary Threats

| Threat | Required Control |
|---|---|
| Candidate directly changes production | Isolated candidate path + mandatory Gate + approval |
| Candidate escalates privileges | Immutable authorization boundary |
| Candidate expands its scope | Technically fixed scope and deny-by-default validation |
| Candidate weakens safety rules | Safety baseline outside autonomous scope |
| Cross-tenant data leakage | Explicit tenant scope and isolation enforcement |
| Registry mutation causes activation | Registry is non-authoritative until promotion |
| Evaluation result bypasses review | Evaluation has no promotion authority |
| Approval is detached from reviewed artifact | Approval binds exact candidate/version/evidence digest |
| Evidence is altered after the fact | Append-only/integrity-protected evidence |
| Rollback is unavailable | Mandatory rollback plan and promotion linkage |
| Evolution modifies itself | Evolution mechanism is human-governed |
| External tool bypasses boundary | No direct write access to governance-critical paths |
| External runtime dependency becomes trusted | No fork/embed/vendor/runtime dependency |
| Governance Gate is weakened | Gate and criteria are outside autonomous scope |

## Fail-Closed Requirements

The system must fail closed when:

- candidate scope is missing or invalid;
- tenant scope is ambiguous;
- required evaluation is incomplete;
- regression checks fail;
- blast radius cannot be established;
- evidence is incomplete or integrity cannot be verified;
- Governance Gate decision is missing, unknown or denied;
- required human approval is missing or stale;
- candidate version differs from the approved version;
- rollback readiness cannot be demonstrated.

## Self-Modification Threat

The evolution mechanism must not be able to modify:

- its own Governance Gate;
- approval requirements;
- blast-radius limits;
- safety baselines;
- privilege model;
- evidence integrity controls;
- kill-switch or rollback mechanisms;
- its own trust boundary.

Any such change is human-only and requires a separate governed architecture change.
