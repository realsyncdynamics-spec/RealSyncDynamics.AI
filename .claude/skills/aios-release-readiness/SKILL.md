---
name: aios-release-readiness
description: AI-OS Infrastructure Agent — Go/No-Go für main: CI, Drift-Guards, offene Sicherheits-PRs, Migrationen. Deploy bleibt ein separater menschlicher Schritt.
---

# Release Readiness Check

**Agent:** Infrastructure · **Routine:** `security-infra-check`
**Rechte:** `github.actions.read`, `github.pulls.read`, `cloudflare.deploy.read`

## Eingaben
- `ref` (optional): Commit oder Branch, Standard `main`

## Ablauf
1. CI und E2E auf `ref` grün? (Command Center → Development Operations)
2. Guards: CodeQL, Migration/Edge/ACL/Entitlement-Drift, Cron-Health (Routinebericht).
3. `npm run merge:hygiene` und `npm run check:production` lokal.
4. Neue Migrationen seit letztem Deploy auflisten → je Migration eigener Freigabepunkt.
5. Offene Sicherheits-PRs, die vor dem Release gemergt sein sollten.

## Ausgaben
- `checklist`: Kriterium · Go/No-Go · Beleg (Lauf-URL, Befehl)

## Qualität
- Kein Merge, kein Deploy, keine Migration durch den Agenten.
