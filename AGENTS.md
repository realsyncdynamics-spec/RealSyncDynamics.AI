# AGENTS.md — Globale Agentenregeln (Ebene 1)

Gilt für jeden Agenten (Claude Code, Codex, Copilot, Subagenten); `CLAUDE.md` importiert sie.
Profile und Policies dürfen verschärfen, nie lockern.

**Produkt (K4, 27.10.2026, `docs/PRODUCT_PRIORITIZATION.md`):** Plattform für **KI-Mitarbeiter
mit eingebauter Governance** für KMU mit Kundenkontakt, zuerst Handwerk. Erster Ablauf:
AI Receptionist (Anfrage, Kontakt, Terminwunsch, Übergabe an Menschen). DSGVO/EU AI Act,
Freigaben und Nachweise sind Infrastruktur, nicht Hero-Botschaft.

## Regelhierarchie

1. Diese Datei · 2. `CLAUDE.md` · 3. genau ein Profil aus `docs/claude/CONTEXT_POLICY.md`
→ „Aufgabenprofile“ (website, voice-runtime, security, database, devops, qa) ·
4. `.github/PR_TRIAGE_POLICY.md` · 5. Nachweise nach `.github/pull_request_template.md`

Sicherheitsregeln und Einzel-Freigaben gehen vor. Technische Wahrheit ist der Code
(Startseite = `<Route path="/">` in `src/App.tsx`). Widerspruch Doku/Code: melden, nicht befolgen.

## Sicherheit — ausnahmslos

- Keine Secrets in Code, Logs, PRs oder Bundle (`VITE_*` ist öffentlich).
- Service-Role/Admin-Calls nur serverseitig. Autorisierung serverseitig; Mandant, Rechte,
  Kill-Switch, Einwilligung nie aus dem Request-Body.
- Tenant-Isolation bei jedem Zugriff. Fail-closed bei Auth-, Policy- oder Kill-Switch-Fehlern.
- Keine Umgehung von Rechten oder Hooks (auch nicht per Shell/`npx`). Keine destruktiven Migrationen.

## Claims und Preise

Keine erfundenen Kennzahlen, SLAs, Referenzen; Status aus `src/product/implementation-status.ts`.
Öffentliche CTAs nie Pilot/Demo/Call/Sales/Beratung/Termin. Preise nur aus `shared/pricing.ts`.

## Design und Landing

Hard-Edge-UI (Obsidian/Titanium/Security-Blue, 90°-Kanten, Monospace für Metadaten); Status-
farben getrennt von Brand-Akzenten. Landing gezielt verbessern, Funktionen erhalten; alte
Landing-Dateien sind kein Löschbeleg (`npm run check:dead` liefert nur Kandidaten).

## Freigaben

Ohne Einzel-Freigabe nie: Merge mit Produktionswirkung, Deploy, Rebase, Force-Push, PR schließen,
Migration, Security-Merge, Preise/Recht/Claims, Workflows, Berechtigungen. Merge ≠ Deploy.
Kein `automerge`-Label. Autonom: lesen, prüfen, eigener Branch, Draft-PRs.

## Nachweise

Nur ausgeführte Prüfungen melden (Befehl, Ergebnis). Teilprüfungen = `TEILWEISE`; maßgeblich
ist die CI auf dem Head. Sprache Deutsch; „Prüfpfad“, „Herkunftsnachweis“; Bezeichner in `Monospace`.
