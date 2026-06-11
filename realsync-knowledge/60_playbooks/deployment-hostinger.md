---
title: Deployment Playbook — Hostinger VPS
owner: platform
status: draft
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-08-31
tags: [deployment, vps, hostinger, n8n, ollama, playbook]
---

# Deployment Playbook — Hostinger VPS

Operational playbook for the self-hosted RealSync VPS stack. The
stack hosts Ollama (local AI, `qwen3:4b`), n8n (workflow
engine), and Traefik (ingress / TLS). The stack is EU-hosted and
provides the EU-local AI boundary referenced in
`../30_compliance/gdpr/data-flow-map.md`.

## Scope

- Provisioning a Hostinger VPS for RealSync.
- Process management with PM2 for long-running services.
- Reverse proxy and TLS via nginx (or Traefik where used).
- Backup, logging, and SSL renewal.

Out of scope:
- SPA deployment (see `deployment-vercel.md`).
- Supabase Edge Functions (Supabase CLI deploy).

## VPS Setup

1. Provision Ubuntu LTS on a Hostinger plan sized per the stack
   profile in `deploy/`.
2. Create a non-root deploy user with SSH-key authentication.
3. Disable password SSH; restrict SSH to known IPs where
   operationally feasible.
4. Install required packages: `nginx`, `nodejs` (matching SPA
   engines), `pm2` (global), `certbot`, `docker` (if used for
   n8n/Ollama containers per `deploy/`).
5. Configure UFW to allow `22`, `80`, `443` only.
6. Apply OS updates and enable unattended upgrades.

## Process Management (PM2)

PM2 supervises Node services that are not containerised. Each
service has an entry in an `ecosystem.config.cjs` file under the
deploy user's home directory.

| Service        | PM2 name        | Restart policy        | Logs                                     |
|----------------|-----------------|-----------------------|------------------------------------------|
| worker         | `realsync-worker` | `max_restarts: 10`  | `~/.pm2/logs/realsync-worker-*.log`      |
| connector-bridge | `realsync-bridge` | `max_restarts: 10` | `~/.pm2/logs/realsync-bridge-*.log`      |

Standard operations:
- Status: `pm2 status`
- Reload (zero-downtime): `pm2 reload <name>`
- Restart: `pm2 restart <name>`
- Save state: `pm2 save` (after every change)
- Startup integration: `pm2 startup systemd` (once per host)

Container-based services (n8n, Ollama) are managed via their own
units defined under `deploy/`. PM2 does not supervise containers.

## nginx Configuration

- One server block per public hostname.
- TLS termination at nginx; upstream traffic over loopback.
- `proxy_pass` to the PM2-managed service or container port.
- Security headers: `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Content-Security-Policy` aligned with SPA needs.
- Access and error logs to `/var/log/nginx/`.

A change to the nginx configuration requires:
1. `nginx -t` to validate.
2. `systemctl reload nginx` (not restart) to apply.
3. Smoke test of the affected hostname.

## SSL Renewal

- Certificates are issued by Let's Encrypt via certbot.
- Renewal is automated by the certbot systemd timer.
- Validity: 90 days; renewal attempts begin at 30 days remaining.
- A failed renewal is an `S2` incident (see
  `../40_security/incident-response.md`) and produces a finding
  of category `security.config`.

Manual verification:
```bash
certbot certificates
certbot renew --dry-run
```

## Backups

| Target                | Frequency  | Retention | Location                  |
|-----------------------|------------|-----------|---------------------------|
| n8n workflow exports  | daily      | 30 days   | object storage (EU)       |
| Ollama model registry | on change  | indefinite| object storage (EU)       |
| nginx + PM2 configs   | on change  | git       | configuration repository  |
| OS-level snapshot     | weekly     | 4 weeks   | Hostinger snapshot        |

Backup integrity is verified monthly by restoring n8n exports
into a sandbox instance. A failed restore is a finding of
category `runtime.outage`.

## Logging

- nginx logs: `/var/log/nginx/` (rotated by logrotate).
- PM2 logs: `~/.pm2/logs/` (rotated by `pm2-logrotate` module).
- Container logs: driver-default; forwarded to a central
  collector when configured under `deploy/`.

Logs that may contain personal data are subject to the retention
defaults in `../30_compliance/gdpr/data-flow-map.md`. Logs MUST
NOT be exported to non-EU destinations without an explicit
review.

## Rollback

| Component        | Rollback mechanism                                              |
|------------------|-----------------------------------------------------------------|
| PM2 services     | `pm2 reload` to previous release directory; release directories are timestamped |
| nginx config     | Restore previous file from configuration repository; `nginx -t` then reload |
| n8n              | Restore last good export                                        |
| Ollama models    | Re-pull the previous model version tag                          |
| TLS certificates | Restore from certbot archive (`/etc/letsencrypt/archive/`)      |

## Open Items

- Central log collector specification.
- Automated configuration drift detection.
- Disaster-recovery runbook (full rebuild from backups).
