---
title: Internes AI-OS — Einstieg
owner: Plattform-Betrieb
reviewed: 2026-10-15
status: aktiv
---

# Internes AI-OS — Einstieg

Das AI-OS unterstützt den **Betrieb** von RealSyncDynamics.AI: Entwicklung,
Qualitätssicherung, Infrastruktur, Compliance-Nachweise und Geschäftsberichte.
Es ist **kein Teil der Kundenplattform** und verarbeitet keine Mandantendaten.

| Baustein | Ort | Zweck |
|---|---|---|
| Register (Agenten, Skills, Aktionen, Routinen) | `packages/ai-os-core/src/` | eine Quelle für UI, Server und Routinen |
| Skills | `.claude/skills/aios-*/SKILL.md` | in Claude Code mit `/aios-…` aufrufbar |
| Routinen | `.github/workflows/ai-os-*.yml` + `scripts/ai-os/routine.mjs` | serverseitig, deterministisch, nur lesend |
| Gateway | `supabase/functions/ai-os-control/` | einzige Server-Schnittstelle des Command Center |
| Prüfpfad | Tabelle `ai_os_action_log` | append-only, nur Operatoren lesen |
| Command Center | `/admin/ai-os` (`src/features/ai-os/`) | Steuerung und Live-Zustand |
| Wissen | `docs/ai-os/` (dieser Ordner) | versioniert über Git, Obsidian-kompatibel |

Architektur, Bestandsaufnahme und Sicherheitsgrenzen: [architektur.md](architektur.md).

## Wissensbasis

- [Unternehmen und Produkt](wissen/unternehmen-und-produkt.md)
- [Technik und Infrastruktur](wissen/technik-und-infrastruktur.md)
- [Entwicklung und Arbeitsregeln](wissen/entwicklung-und-regeln.md)
- [Compliance und Geschäftsprozesse](wissen/compliance-und-prozesse.md)

Regeln:

1. **Verlinken statt kopieren.** Quelle der Wahrheit bleibt Code, ADR oder `PLAN.md`.
2. **Frontmatter** `title`, `owner`, `reviewed` (Datum) — die Routine
   `docs-control` meldet fehlende Felder und Notizen, die älter als 90 Tage sind.
3. **Nie ins Repository:** private Dokumente, personenbezogene Fallakten,
   Passwörter, Schlüssel, Kundendaten. `docs-control` und das Gateway prüfen auf
   Zugangsdaten-Muster; GitHub Push Protection bleibt maßgeblich.
4. **Änderungen nur per Pull Request** — aus dem Command Center (Wissen →
   Bearbeiten → Draft-PR), aus Claude Code (`/aios-knowledge-update`) oder lokal.
5. **Kontextbudget:** `docs/` ist gedeckelt (`npm run check:context`). Neue
   Notiz nur, wenn kein bestehendes Thema passt.

**Obsidian:** Ordner `docs/ai-os` als Vault öffnen. Normale Markdown-Links
funktionieren; Änderungen wie jede Repo-Änderung committen und als PR einreichen
(Synchronisierung = Git, keine Obsidian-Sync-Dienste).

## Zugangsdaten (einmalig, durch den Owner)

| Secret | Ablage | Rechte | Wofür |
|---|---|---|---|
| `AI_OS_GITHUB_TOKEN` | Supabase Function Secret (`supabase secrets set`) | fein granularer Token, **nur dieses Repository**: Metadata read, Actions read, Checks read, Pull requests read, Contents read. Für Schreibaktionen zusätzlich Actions write, Contents write, Pull requests write | Command Center: PRs, CI, Routinen, Wissen |
| `AI_OS_GITHUB_REPO` (optional) | Supabase Function Secret | — | Standard `realsyncdynamics-spec/RealSyncDynamics.AI` |
| `GITHUB_TOKEN` | automatisch in GitHub Actions | je Workflow `permissions` (nur read) | Routinen |

Empfehlung: zuerst nur mit Leserechten starten. Schreibaktionen schlagen dann
mit 403 fehl und werden als `failed` protokolliert. Vor Schreibrechten
sicherstellen, dass `main` per Ruleset nur über Pull Requests änderbar ist.

**Operatoren:** Zugang hat, wer in `public.platform_operators` aktiv ist
(Vergabe nur per service_role, ADR 0011 D5). Schreibaktionen verlangen zusätzlich
eine Anmeldung mit zweitem Faktor (AAL2, `/settings/security`).

## Status

| Teil | Status | Voraussetzung für live |
|---|---|---|
| Register, Gateway-Logik, Skills | Preview | Merge |
| Routinen (6 Workflows) | Preview | Merge auf main (dann laufen Zeitpläne) |
| Command Center `/admin/ai-os` | Preview | Merge + Deploy, `AI_OS_GITHUB_TOKEN` |
| Prüfpfad `ai_os_action_log` | Preview | Migration `20261015190000` mit GO anwenden |
| LLM-Ausführung ohne Sitzung (Claude Code Action in CI) | Geplant | Entscheidung zu #1706, API-Key, Kostenlimit |
| Business-Kostenquellen (Software-Abos) | Geplant | strukturierte Quelle fehlt |
