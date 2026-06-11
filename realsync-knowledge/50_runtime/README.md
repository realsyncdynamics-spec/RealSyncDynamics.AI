---
title: Runtime Folder Index
owner: runtime
status: active
sensitivity: internal
review_cycle: monthly
valid_until: 2026-06-30
tags: [index, runtime]
---

# 50_runtime

Runtime specifications. Each document defines a runtime contract
that code must satisfy. A deviation between code and a runtime
specification is itself a finding (see `finding-model.md`).

| Document            | Contract                                          |
|---------------------|---------------------------------------------------|
| `evidence-chain.md` | Event creation, hashing, signature, replay        |
| `finding-model.md`  | Finding entity, severity, lifecycle, evidence linkage |

New runtime specifications start from
`../90_templates/runtime-spec-template.md`.

Runtime specifications carry the shortest review cycle in the
repository (`monthly`). Drift between specification and code is
detected by automated checks where possible and by review
otherwise.
