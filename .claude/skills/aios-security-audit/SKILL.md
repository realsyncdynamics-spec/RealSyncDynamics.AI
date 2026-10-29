---
name: aios-security-audit
description: AI-OS Infrastructure Agent — Sicherheitsprüfung einer Edge Function, Migration oder eines Features (RLS, JWT, Secrets, Guards). Bericht ohne Secrets und personenbezogene Daten.
---

# Security Audit

**Agent:** Infrastructure · **Routine:** `security-infra-check` (`.github/workflows/ai-os-security-infra.yml`)
**Rechte:** `github.actions.read`, `github.pulls.read`, `github.contents.read`

## Eingaben
- `scope` (Pflicht): Edge Function, Migration oder Feature-Pfad

## Ablauf
1. Guard-Lage aus dem letzten Routinebericht (CodeQL, Drift-Guards, Cron-Health).
2. Edge Function: `verify_jwt` in `supabase/config.toml`; bei `false` eigene Signatur-/Tokenprüfung nachweisen.
3. Autorisierung: Tenant nur über JWT → `memberships`; Plattformrechte nur über `is_platform_operator()` (ADR 0011 D5).
4. Service-Role nur serverseitig; kein Secret im Frontend-Bundle (`rg "SERVICE_ROLE|sk_live" src/`).
5. Migration: RLS aktiviert, Policies je Rolle, keine destruktiven Statements.
6. Offene Sicherheits-PRs mit Konfliktpotenzial nennen.

## Ausgaben
- `findings`: Schweregrad · Ausnutzungspfad · Fix
- `guards`: Status je Guard mit Laufdatum

## Qualität
- Keine Secrets, Tokens oder personenbezogenen Daten im Bericht.
- Sicherheitsfehler nie durch UI-Formulierungen abschwächen.
