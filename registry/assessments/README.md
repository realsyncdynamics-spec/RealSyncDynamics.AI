# Assessment-Snapshots

Bleibt im Repo bewusst leer. Echte Snapshots entstehen im Evaluator (nächster Schritt) und liegen
append-only in `public.deployment_assessments`. Jeder Snapshot gilt nur für seine `inputs`, sein
`policy_profile`, seine `rule_version` und seinen `evidence_cutoff`.

Legt jemand hier eine Datei ab, prüfen alle Gates sie: Schema, Referenzen, Evidence-Regel mit
`inputs_hash` und Invarianten (a)–(e). Beispiele mit `is_example: true` liegen unter
`test/registry/fixtures/valid/assessments/`.
