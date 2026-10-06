# Agent Runtime — VPS deploy path

This directory is the smallest host-local production path for `apps/agent-runtime`.
It does **not** select a VPS, configure DNS/reverse proxy, create telephony resources,
seed voice configuration, or contain secret values.

The repository's current frontend deployment runbook documents `187.77.89.1` as
the VPS target, but this deploy path deliberately has no remote SSH automation.
Run it only after the target host has been independently verified.

## Hard boundary

This step provides only:

- Docker build of `apps/agent-runtime/Dockerfile`
- host-local bind on `127.0.0.1:8787`
- `GET /health` container healthcheck
- exactly the four Voice runtime values required for the governed session path:
  `AGENT_RUNTIME_API_TOKEN`, `XAI_API_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`

It does **not** add Telnyx/Twilio/SIP, a Worker, public routing, DNS, migration,
or rows in `voice_bot_configs` / `voice_number_bindings`.

## Preflight on the verified VPS

From the repository root:

```bash
docker --version
docker compose version

# Do not destroy or replace an existing runtime blindly.
docker ps -a --filter "name=^/realsync-agent-runtime$" \
  --format '{{.Names}} {{.Status}} {{.Ports}}'

# 8787 must either be free or belong to the runtime you intentionally replace.
ss -ltnp | grep ':8787' || true
```

If an existing `realsync-agent-runtime` is present, inspect it first. This runbook
contains no automatic `docker rm`, `docker compose down`, firewall change, or
port takeover.

## Configure secrets on the host

```bash
cd deploy/agent-runtime-vps
cp .env.example .env
chmod 600 .env
$EDITOR .env
```

Fill the four required values in `.env`. Never commit that file and never put the
service-role key in browser, frontend, GitHub Pages, Cloudflare Pages, or client code.

Validate interpolation before starting:

```bash
docker compose --env-file .env config >/dev/null
```

A missing required value must make this command fail.

## Start

```bash
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
```

## Verify locally on the VPS

```bash
curl -fsS http://127.0.0.1:8787/health

# Auth must fail without the Bearer token.
test "$(curl -sS -o /dev/null -w '%{http_code}' \
  http://127.0.0.1:8787/agents)" = "401"

# Authenticated route must answer. The token stays inside the container env.
docker compose --env-file .env exec -T agent-runtime sh -c \
  'wget -qO- --header="Authorization: Bearer $AGENT_RUNTIME_API_TOKEN" \
  http://127.0.0.1:8787/agents >/dev/null'
```

Only after these checks pass is the host side ready for Voice configuration.

## Voice data gate

A real Voice start still requires both of these production rows:

1. one active `voice_bot_configs` row for a real Voice bot;
2. one active `voice_number_bindings` row for the real E.164 number/provider.

Do not reuse a disabled chat/test bot and do not invent a phone number or provider
reference. Until both rows exist, `POST /voice-sessions` must remain fail-closed.

## Public exposure

None is configured here. `127.0.0.1:8787` is intentional. If a public or
telephony-facing endpoint is later required, add the reverse proxy/DNS step
separately after the local health/auth checks are proven.
