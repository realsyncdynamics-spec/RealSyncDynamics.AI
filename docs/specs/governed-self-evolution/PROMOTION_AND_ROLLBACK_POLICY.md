# Governed Self-Evolution — Promotion and Rollback Policy

## Promotion Rule

No evolution artifact becomes runtime-effective unless all required gates have succeeded for the exact immutable candidate version.

Mandatory sequence:

1. Candidate generated with bounded scope.
2. Isolated evaluation completed.
3. Regression requirements passed.
4. Blast-radius assessment passed.
5. Governance Gate approved.
6. Required human approval recorded.
7. Exact artifact version staged.
8. Promotion recorded with evidence.
9. Runtime activation occurs only through the approved promotion path.

## Promotion Preconditions

Promotion MUST fail closed if any of the following is absent, invalid or stale:

- candidate identity/version;
- tenant scope;
- evaluation result;
- regression result;
- blast-radius assessment;
- Governance Decision;
- required Approval Record;
- rollback plan;
- evidence references and integrity metadata.

## Staging

Approved artifacts must first enter a versioned staged state. Staging does not grant permission to alter governance or bypass monitoring.

## Monitoring

Promoted changes require observable post-promotion outcomes appropriate to their risk classification. Monitoring must be able to trigger the defined rollback mechanism.

## Rollback

Every promotion must have a deterministic rollback target before activation.

Rollback MUST:

- identify the promotion being reversed;
- identify the restored artifact version;
- preserve evidence of the trigger and decision;
- avoid mutating historical evidence;
- restore the last known approved state;
- remain available independently of the candidate's own logic.

## Kill Switch

Kill-switch mechanisms are privileged safety controls and are outside autonomous evolution scope. Evolution cannot disable, rewrite or redefine them.

## Post-Rollback

A rolled-back candidate is not automatically eligible for re-promotion. A new reviewable candidate/version and fresh evidence are required.

## Governance Changes

Changes to this promotion/rollback policy, the Governance Gate, approval requirements or safety boundaries are not normal evolution candidates. They require a separately governed architecture change and explicit human authorization.
