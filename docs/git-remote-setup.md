# Git Remote Setup — RealSyncDynamics.AI

Kurzanleitung zum Verbinden eines lokalen Checkouts mit dem GitHub-Repo
`realsyncdynamics-spec/RealSyncDynamics.AI`.

## Repository

- **GitHub:** https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI
- **Default-Branch:** `main`

## Erstmaliges Setup (lokal auf deinem Rechner)

### Variante A — Repo neu klonen

```bash
# HTTPS (empfohlen für die meisten Setups):
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git
cd RealSyncDynamics.AI

# SSH (nur falls dein SSH-Key bei GitHub hinterlegt ist):
git clone git@github.com:realsyncdynamics-spec/RealSyncDynamics.AI.git
```

### Variante B — Bestehendes lokales Repo mit GitHub verbinden

```bash
cd /pfad/zu/deinem/lokalen/RealSyncDynamics.AI

# Aktuelle Remotes prüfen
git remote -v

# Falls bereits ein origin existiert, der weg soll:
git remote remove origin

# HTTPS:
git remote add origin https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git

# Oder SSH:
git remote add origin git@github.com:realsyncdynamics-spec/RealSyncDynamics.AI.git

# Verbindung testen und Branches holen:
git fetch origin
git branch -a
```

### Auf einen bestimmten Branch wechseln

```bash
# z. B. einen Branch, der in einer Claude-Code-Session entstanden ist:
git fetch origin
git checkout claude/<branch-name>
```

## HTTPS vs. SSH

| Aspekt | HTTPS | SSH |
|---|---|---|
| URL-Form | `https://github.com/<owner>/<repo>.git` | `git@github.com:<owner>/<repo>.git` |
| Auth | Personal Access Token oder Credential Helper | Hinterlegter SSH-Public-Key bei GitHub |
| Setup-Aufwand | gering (funktioniert sofort) | einmaliger Key-Upload nötig |
| Empfehlung | Standard für lokale Dev-Rechner | Für CI/Server, oder wenn 2FA mit HTTPS hakt |

## Häufige Fehler

- **`fatal: remote origin already exists`** — `origin` ist schon gesetzt. Lösung:
  `git remote set-url origin <neue-url>` oder vorher `git remote remove origin`.
- **`Permission denied (publickey)` bei SSH** — Public-Key liegt nicht in den
  GitHub-Account-Settings unter "SSH and GPG keys".
- **`Authentication failed` bei HTTPS** — GitHub akzeptiert keine Passwörter
  mehr; nötig ist ein Personal Access Token (Settings → Developer settings →
  Tokens) oder ein konfigurierter Credential Helper.

## Hinweis: Claude Code on the Web

In einer Cloud-Sandbox-Session (Claude Code on the Web) ist `origin` bereits
auf einen lokalen Proxy gesetzt, der Branches transparent zum GitHub-Repo
durchreicht. Dieses Remote **nicht** auf eine direkte GitHub-URL umbiegen —
sonst funktioniert der Push aus der Session nicht mehr. Lokales Setup nach
dieser Anleitung passiert ausschließlich auf deinem eigenen Rechner.
