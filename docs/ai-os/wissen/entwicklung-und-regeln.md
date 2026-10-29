---
title: Entwicklung und Arbeitsregeln
owner: Plattform-Betrieb
reviewed: 2026-10-15
status: aktiv
---

# Entwicklung und Arbeitsregeln

## Git und Pull Requests

- Kein Direkt-Push auf `main`; ein Arbeitspaket = ein Branch = ein PR, Squash.
- Vor Merge, Close oder Rebase fremder PRs: `.github/PR_TRIAGE_POLICY.md`.
- Konflikte lokal lösen, Playbook `docs/MERGE_CONFLICT_CONCEPT.md`,
  `npm run merge:hygiene` (Exit 2 = harter Blocker, z. B. Migrationskollision).
- Merge und Deploy brauchen eine **separate Freigabe** — nie durch Agenten.

## Harte Verbote (aus `CLAUDE.md`)

Keine Secrets, keine Service-Role und keine Admin-Calls im Browser · keine
destruktiven Migrationen · `CLAUDE.md` kurz halten (`check:context`) · kein
`npm install` als Session-Hook · Lockfiles und `*.generated.ts` nicht einlesen.

## Qualität

- Keine Fake-KPIs: fehlt eine Quelle → Empty State oder Vorschau-Label
  (`check:fabrication`, `check:dashboard`).
- Status nur aus `implementation-status.ts`; verbotene Claims siehe
  [Compliance](compliance-und-prozesse.md).
- Tenant nur über JWT → `memberships`, nie aus URL, Body oder localStorage.
- Tests unter `test/` ablegen — Dateien unter `src/**/__tests__` laufen nicht.

## Agentenarbeit

Skills unter `.claude/skills/aios-*`; Arbeitspakete der Landing/Funnel-Arbeit
unter `.claude/commands/wp*.md`. Agenten bereiten vor (Branch, Draft-PR,
Bericht) — Entscheidungen über Merge, Deploy, Migration und Geld bleiben beim
Owner.

Verknüpft: [Technik und Infrastruktur](technik-und-infrastruktur.md)
