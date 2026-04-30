# Kodee VPS Server Actions — v1

Endpoint: `POST /functions/v1/kodee`

Read-only SSH/network actions Kodee can run against a user's VPS:
`vps.status`, `vps.logs.tail`, `vps.disk`, `vps.dns_check`, `vps.tls_check`.

## Setup

### 1. Apply migration

```bash
supabase db push
```

### 2. Set the wrapping key for SSH private keys

```bash
KEY=$(openssl rand -base64 32)
supabase secrets set KODEE_SECRETS_KEY="$KEY"
```

Store `$KEY` somewhere safe — without it, encrypted SSH keys cannot be decrypted.

### 3. Deploy the function

```bash
supabase functions deploy kodee --no-verify-jwt=false
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-injected
by the Supabase runtime; no manual config needed.

### 4. Add a connection (server-side; never from the browser)

Insert a row into `vps_connections` (RLS allows the authenticated user), then
encrypt the SSH private key and insert into `vps_ssh_keys` using the service role.
A small admin/onboarding flow can do this — see `encryptPrivateKey()` in
`secrets.ts`.

## Request shape

```jsonc
POST /functions/v1/kodee
Authorization: Bearer <user JWT>
Content-Type: application/json

{
  "v": 1,
  "connection_id": "uuid",
  "action": "vps.logs.tail",
  "args": { "unit": "nginx", "lines": 200, "grep": "error" }
}
```

## Response shape

```jsonc
// success
{ "ok": true,  "v": 1, "action": "vps.logs.tail",
  "data": { "source": "journalctl", "target": "nginx", "lines": ["..."] },
  "duration_ms": 412 }

// error
{ "ok": false, "v": 1, "action": "vps.logs.tail",
  "error": { "code": "EXEC_TIMEOUT", "message": "command timed out after 20000ms" },
  "duration_ms": 20003 }
```

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONNECTION_FAILED`, `AUTH_FAILED`, `HOST_KEY_MISMATCH`, `EXEC_TIMEOUT`,
`EXEC_ERROR`, `UNKNOWN_ACTION`, `INTERNAL`.

## Action contracts

See `types.ts` for typed argument and response shapes per action.

| Action            | Args                                          | Returns                          |
| ----------------- | --------------------------------------------- | -------------------------------- |
| `vps.status`      | `{ units?: string[] }`                        | uptime, load, memory, failed units |
| `vps.logs.tail`   | `{ unit?, container?, lines?, grep? }`        | log lines (journalctl or docker)  |
| `vps.disk`        | `{ top_dirs?: number }`                        | df + optional top-N largest dirs  |
| `vps.dns_check`   | `{ domain, types? }`                          | A/AAAA/etc. records, match-vs-VPS |
| `vps.tls_check`   | `{ domain?, port? }`                          | issuer, validity window, SAN match |

## Security model

- **RLS** on `vps_connections`, `vps_action_log`: owner-only.
- **Default-deny RLS** on `vps_ssh_keys`: only the service role used inside the
  edge function can read it.
- **Encrypted at rest**: SSH keys are AES-GCM enveloped with `KODEE_SECRETS_KEY`.
- **Defense in depth**: even with the service role, the function double-checks
  `owner_id = auth.uid()` before loading the connection.
- **Command injection**: every value coming from request args is `shellQuote()`-ed
  before being concatenated into a remote command.
- **Resource caps**: per-call timeout, max output bytes, line cap on log tails.
- **Host-key pinning**: optional via `vps_connections.known_host_fingerprint`.

## Audit

Every dispatch (success or failure) is recorded in `vps_action_log` and visible
to the connection owner via RLS.
