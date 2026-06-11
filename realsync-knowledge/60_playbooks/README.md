---
title: Playbooks Folder Index
owner: platform
status: active
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-12-31
tags: [index, playbooks]
---

# 60_playbooks

Operational playbooks. Each document is a step-by-step procedure
intended to be followed during an operational event: deploying,
rolling back, recovering, rotating, restoring.

| Document                    | Procedure                                |
|-----------------------------|------------------------------------------|
| `deployment-vercel.md`      | SPA deployment to Vercel                 |
| `deployment-hostinger.md`   | VPS stack on Hostinger (PM2, nginx)      |

New playbooks start from
`../90_templates/deployment-template.md` (for deployment) or are
modelled after the existing playbooks (for non-deployment
procedures). The structure should remain consistent: scope,
environments, flow, rollback, verification.
