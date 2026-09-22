# Edge isolate freeze
- `policy/opa/wrangler/kv.rego` blockiert neue `[[kv_namespaces]]`-Bindings außerhalb von `POLICY_CACHE` und `SESSION_CACHE`.
- Die IDs in `/home/runner/work/RealSyncDynamics.AI/RealSyncDynamics.AI/wrangler-workers.toml` bleiben Platzhalter; kein `wrangler kv create`, keine Live-Infrastruktur daraus ableiten.
- Wenn `kv_namespaces` vorhanden ist, muss `[vars].WORKER_POLICY_ROUTES_DEPLOY_FROZEN = "true"` gesetzt bleiben.
- `secrets_store_secrets` mit `SERVICE_ROLE` oder `JWT_SECRET` in `binding` oder `secret_name` werden defensiv verweigert.
- Die Runtime-`503` für den gefrorenen Route-Pfad bleibt separat in `#1510` geregelt.
