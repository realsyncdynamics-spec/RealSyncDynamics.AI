# Playwright Scanner / Governed Browser Executor — Production Deployment

Canonical production runtime for `scanner.realsyncdynamicsai.de`.

## Architecture

```text
Authenticated browser user
  → Supabase browser-execute (JWT + membership + approval)
  → PLAYWRIGHT_SCANNER_URL / PLAYWRIGHT_SCANNER_KEY
  → scanner.realsyncdynamicsai.de
  → Traefik TLS + rate limit
  → Playwright Chromium
```

The scanner accepts the shared scanner credential through either
`Authorization: Bearer <key>` or `x-api-key: <key>`.

There is **no second BasicAuth credential** in the canonical path. This keeps
existing Supabase callers (`cookie-scan-deep`, monitoring and
`browser-execute`) on one authenticated service contract.

## Canonical deployment

GitHub Actions workflow:

`.github/workflows/deploy-playwright-scanner.yml`

It runs automatically when scanner deployment files change on `main`, and can
also be run manually from GitHub Actions.

The workflow:

1. typechecks and builds the scanner,
2. verifies VPS SSH connectivity before mutation,
3. creates a new 32-byte scanner credential,
4. syncs `deploy/playwright-scanner/` to
   `/opt/RealSyncDynamics.AI/deploy/playwright-scanner`,
5. writes the rotated credential only to the VPS `.env`,
6. builds and restarts the Docker container,
7. verifies authenticated local health,
8. stores `PLAYWRIGHT_SCANNER_URL` and `PLAYWRIGHT_SCANNER_KEY` as
   **Supabase Edge Function Secrets**,
9. verifies public authenticated health,
10. smoke-tests `/execute` with `example.com`.

Required GitHub repository/environment secrets:

- `VPS_SSH_HOST`
- `VPS_SSH_PORT` (optional; defaults to 22)
- `VPS_SSH_USER`
- `VPS_SSH_KEY`
- `VPS_SSH_KNOWN_HOST`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

The scanner credential itself is rotated during deployment and is not stored in
GitHub or source control.

## Supabase secrets

`PLAYWRIGHT_SCANNER_URL` and `PLAYWRIGHT_SCANNER_KEY` are **Edge Function
environment secrets**, not Postgres Vault rows.

Canonical values:

```text
PLAYWRIGHT_SCANNER_URL=https://scanner.realsyncdynamicsai.de
PLAYWRIGHT_SCANNER_KEY=<rotated scanner credential>
```

They are read in Edge Functions via `Deno.env.get(...)`.

Do not put the scanner key into `public` tables, browser environment variables,
or source control.

## Supported endpoints

### GET /health

Requires scanner credential.

### POST /scan/full

Existing deep compliance scan.

### POST /scan/consent-timing

Existing consent-timing analysis.

### POST /scan/screenshot

Existing screenshot scan.

### POST /execute

Governed low-level browser executor.

Supported actions:

- `navigate`
- `scroll`
- `click`
- `type`
- `select`
- `extract`
- `wait`
- `screenshot`

The scanner itself does not decide policy. `browser-execute` performs identity,
tenant, risk and human-approval checks before forwarding governed actions.

## Security boundaries

- Scanner startup fails when `SCANNER_API_KEY` is missing.
- Browser sessions are ephemeral and expire after inactivity.
- Session IDs received from the Edge Function are namespaced by tenant.
- Private/local network destinations are blocked both on initial navigation and
  through a context-wide request guard.
- The scanner has a bounded action count, wait duration, selector length and
  input length.
- `click`, `type` and `select` require human approval in
  `browser-execute`.
- Typed values and selected values are redacted from governance event payloads.
- Inline screenshot base64 is not persisted in evidence metadata.
- Autonomous agent planning is not part of this runtime yet.

## Manual fallback

Only use this if the GitHub workflow is unavailable.

```bash
cd /opt/RealSyncDynamics.AI
git pull --ff-only origin main
cd deploy/playwright-scanner

# Existing .env must contain a real SCANNER_API_KEY.
test -s .env

docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
docker compose build --pull playwright-scanner
docker compose up -d --remove-orphans playwright-scanner
```

Local VPS health:

```bash
set -a
. ./.env
set +a

curl -fsS \
  -H "Authorization: Bearer $SCANNER_API_KEY" \
  http://127.0.0.1:3001/health
```

Public health:

```bash
curl -fsS \
  -H "Authorization: Bearer $SCANNER_API_KEY" \
  https://scanner.realsyncdynamicsai.de/health
```

Governed executor smoke:

```bash
curl -fsS \
  -H "Authorization: Bearer $SCANNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"manual-smoke","actions":[{"type":"navigate","url":"https://example.com"},{"type":"extract","selector":"h1"}]}' \
  https://scanner.realsyncdynamicsai.de/execute
```

## Troubleshooting

### SSH preflight fails

No VPS mutation has occurred. Verify the Hostinger firewall, SSH daemon and
`VPS_SSH_PORT`.

### Public health fails after local health succeeds

Check DNS for `scanner.realsyncdynamicsai.de`, Traefik discovery, TLS
certificate issuance and the external `proxy` Docker network.

### browser-execute returns EXECUTOR_NOT_CONFIGURED

The Supabase Edge Function environment is missing
`PLAYWRIGHT_SCANNER_URL` or `PLAYWRIGHT_SCANNER_KEY`. The deployment workflow
sets both after the VPS service becomes healthy.

### browser-execute returns APPROVAL_REQUIRED

Expected for `click`, `type` and `select`. Resolve the generated approval
through the Governance approval queue, then retry the exact same action with the
returned `approval_id`.

### 429 / capacity

Increase `MAX_CONCURRENT` only after checking VPS memory/CPU headroom. Chromium
sessions are intentionally resource bounded.
