# AGENTS.md — Globale Agentenregeln (Ebene 1)

Gilt für jeden Agenten in diesem Repo (Claude Code, Codex, Copilot, Subagenten).
Claude Code lädt diese Datei über den Import in `CLAUDE.md`. Profile und Policies
dürfen diese Regeln verschärfen, nie lockern.

**Produkt:** EU-souveräne AI-Governance-Runtime (DSGVO, EU AI Act). Governance-Schicht
zwischen Mensch, Firma, Agenten und Daten. Kein Chatbot.

## Regelhierarchie

1. Diese Datei
2. `CLAUDE.md` — Claude-Arbeitskontext (Stack, Befehle, Kontextregeln)
3. Genau ein Aufgabenprofil aus `docs/claude/profiles/` (Tabelle unten)
4. `.github/PR_TRIAGE_POLICY.md` — PRs, Freigaben, Merge, Rebase, Deploy
5. Nachweise nach `.github/pull_request_template.md`

Bei Widerspruch gehen Sicherheitsregeln und ausdrückliche Einzel-Freigaben vor.
Technische Wahrheit ist der Code, kein Dokument (Startseite = Element von
`<Route path="/">` in `src/App.tsx`). Widerspricht ein Dokument dem Code: melden, nicht befolgen.

| Aufgabe | Profil |
|---|---|
| Landing, SEO, UI, Performance | `docs/claude/profiles/website.md` |
| Voice-Sessions, Tool-Gateway, Provider | `docs/claude/profiles/voice-runtime.md` |
| Auth, Policy, Tenant-Isolation, Tool-Rechte | `docs/claude/profiles/security.md` |
| Supabase, RLS, Migrationen, Edge Functions | `docs/claude/profiles/database.md` |
| CI, Build, Deploy, Monitoring | `docs/claude/profiles/devops.md` |
| Tests, Regressionen, E2E | `docs/claude/profiles/qa.md` |

## Sicherheit — ausnahmslos

- Keine Secrets in Code, Logs, PR-Texten oder Browser-Bundle (`VITE_*` ist öffentlich).
- Service-Role und Admin-Calls nur serverseitig (Edge Functions, Runtime), nie im Browser.
- Autorisierung serverseitig. Mandant, Rechte, Kill-Switch und Einwilligung nie aus dem Request-Body übernehmen.
- Tenant-Isolation bei jedem Datenzugriff (RLS oder serverseitige Prüfung).
- Fail-closed bei Fehlern in Auth, Policy, Kill-Switch oder Einwilligung.
- Keine Datenweitergabe an Dritte oder externe Dienste ohne Auftrag.
- Keine Umgehung von Zugriffsrechten, Permission-Sperren oder Hooks, auch nicht über Shell, `npx`, Scratchpad oder globale Pakete.
- Keine destruktiven Migrationen. Jede Migration nur mit Einzel-Freigabe.

## Freigaben

- Ohne Einzel-Freigabe nie: Merge mit Produktionswirkung, Produktionsdeploy, Rebase, Force-Push, PR schließen, Migration, Merge eines Security-PRs, Preise/Steuer-/Rechtstexte/Landing-Claims, Änderung an Deploy-Workflows, Berechtigungen oder Sicherheitskontrollen.
- Merge-Freigabe ist keine Deploy-Freigabe. Ein Push auf `main` kann heute automatisch deployen (`docs/claude/DEPLOYMENT_GOVERNANCE_PLAN.md`).
- Eine Freigabe gilt nur für die genannte Aktion und den genannten PR.
- Agenten setzen kein `automerge`-Label. Ein Label ersetzt keine Freigabe.

**Autonom** (im eigenen Arbeitsbranch und Profil): lesen, analysieren, nichtdestruktive lokale Prüfungen, Diff-Reviews, Befunde dokumentieren, Commits und Pushes auf den eigenen Branch, Draft-PRs unter Beachtung des WIP-Stopps.

## Nachweise

- Nur ausgeführte Prüfungen melden: Befehl, Umgebung, Ergebnis.
- Gefilterter Typecheck, Stubs, abweichende oder fehlende Abhängigkeiten → `TEILWEISE`, zählt nicht als grün. Maßgeblich ist die CI auf dem aktuellen Head.
- Eine Cloudflare-Preview belegt nur den Frontend-Build, nicht Runtime, Edge Functions oder DB.
- Abschluss: Branch, voller Commit-SHA, Dateien, Prüfungen, Security-Befunde, offene Risiken, nötige Entscheidungen. Kurz, keine Wiederholung früherer Berichte.

Sprache: Deutsch, präzise. „Prüfpfad“ statt „Audit Trail“, „Herkunftsnachweis“ statt „Provenance“, technische Bezeichner in `Monospace`.
