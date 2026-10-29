---
name: aios-ci-failure-analysis
description: AI-OS Development Agent — fehlgeschlagene CI-Checks einordnen (PR-Ursache, main oder Infrastruktur) und minimalen Fix vorschlagen. Eingabe Lauf-ID oder PR.
---

# CI Failure Analysis

**Agent:** Development · **Routine:** `ci-failure-analysis` (`.github/workflows/ai-os-ci-failures.yml`, deterministischer Teil)
**Rechte:** `github.actions.read`, `github.pulls.read`

## Eingaben
- `run` (Pflicht): Workflow-Lauf-ID oder PR-Nummer

## Ablauf
1. Neuesten Routinebericht lesen (Artefakt `ai-os-report` des Workflows), sonst Jobs des Laufs abrufen.
2. Fehlgeschlagenen Job und Schritt bestimmen; Log nur des fehlgeschlagenen Schritts lesen.
3. Ist derselbe Check auf `main` rot? Dann nicht Ursache dieses PRs — so benennen.
4. Lokal reproduzieren mit dem Befehl des Schritts (`npm run lint`, `npm test -- <datei>`, `npm run check:*`).
5. Minimalen Fix vorschlagen oder umsetzen; erneut ausführen; erst dann pushen.

## Ausgaben
- `diagnosis`: Job › Schritt, Ursache, betroffene Dateien
- `fix`: Patch oder Begründung, warum nicht in diesem PR

## Qualität
- „Flake" ist keine Ursache. Höchstens ein Re-Run zur Bestätigung.
- Nie einen Test überspringen, deaktivieren oder in Quarantäne stellen.
- Kein leerer Commit, um CI neu anzustoßen.
