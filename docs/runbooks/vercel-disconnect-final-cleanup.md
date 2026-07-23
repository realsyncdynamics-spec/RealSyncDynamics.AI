# Vercel Disconnect: Final Cleanup Runbook

**Status:** 2026-07-23 · Cloudflare Pages ist einzige Deployment-Plattform  
**Scope:** Entfernung von Vercel GitHub Integration  
**Urgency:** 🟢 Optional (Kill-Switch ist aktiv, aber manuelle Cleanup sauberer)

---

## Why: Kill-Switch nicht ausreichend

Commit `a54deed` fügte `vercel.json` mit `deploymentEnabled: false` hinzu.  
Das **blockiert Vercel-Deployments**, aber nicht die **GitHub-Integration selbst**:

- ❌ Vercel postet weiterhin PR-Status-Checks (auch wenn blockiert)
- ❌ Vercel-Account-Fehler zeigen sich noch in PR-Checks
- ✅ Aber: Actual Deployment erfolgt über Cloudflare (nicht Vercel)

**Resultat:** Sauberer wird es, wenn wir Vercel aus GitHub entfernen.

---

## What: Drei Vercel-Projekte trennen

Laut Dokumentation existieren drei Vercel-Projekte für dieses Repo:

| Projekt | Root Directory | Status | Aktion |
|---------|---|---|---|
| `real-sync-dynamics-ai` | (Repo-Root) | ❌ Blocked | **Disconnect** |
| `real-sync-dynamics-ai-9ue5` | (Repo-Root) | ❌ Blocked | **Disconnect** |
| `real-sync-dynamics-ai-remu` | `services/realsync-runtime-core` | ⚠️ Error | **Klären ob nötig** |

---

## How: Disconnect Steps

### Step 1: Vercel Dashboard öffnen
1. https://vercel.com/login
2. Team/Account `realsynchost` wählen

### Step 2: Disconnect `real-sync-dynamics-ai`
1. **Projects** → `real-sync-dynamics-ai` auswählen
2. **Settings** → **Git**
3. **Disconnect Repository** Button
4. Bestätigen: "Ja, Repo trennen"

### Step 3: Disconnect `real-sync-dynamics-ai-9ue5`
1. Zurück zu **Projects**
2. `real-sync-dynamics-ai-9ue5` auswählen
3. **Settings** → **Git** → **Disconnect Repository**
4. Bestätigen

### Step 4 (Optional): Klären ob `-remu` gebraucht wird
1. `real-sync-dynamics-ai-remu` auswählen
2. **Settings** → **General** → `rootDirectory` checken
3. Falls `services/realsync-runtime-core` = bewusster Backend-Deploy → **NICHT trennen**
4. Falls Duplikat/Relikt → **Disconnect**

### Step 5: Verifikation
1. GitHub → **realsyncdynamics-spec/RealSyncDynamics.AI**
2. Offene PR öffnen oder neue pushen
3. **Checks** Tab → sollten **keine „Vercel …"-Einträge** mehr sein
   - ✅ Cloudflare Pages: …
   - ✅ GitHub Actions: ci, build, e2e, …
   - ❌ Vercel …: **NICHT mehr sichtbar**

---

## After: Verify the Clean State

### PR #870 sollte zeigen:
```
✅ Cloudflare Pages — Deploy successful
✅ GitHub Actions — ci, build, e2e (alle grün)
❌ Vercel: (NICHT vorhanden)
```

### Lokal verifizieren:
```bash
git checkout main
git pull origin main

# Oder in offener PR:
git status

# Prüfen dass vercel.json da ist:
cat vercel.json
# Output: { "git": { "deploymentEnabled": false } }
```

---

## Rollback Plan (falls nötig)

Falls Vercel später wieder gebraucht wird:
1. **Vercel Dashboard** → Projects → **Add new project** → Repo wählen
2. `vercel.json` → `deploymentEnabled: true` setzen
3. ⚠️ Dann aber: Cloudflare **deaktivieren**, um nicht beide parallel zu deployen

---

## Timeline

| Date | Action | Status |
|------|--------|--------|
| 2026-06-25 | Hosting-Konsolidierung: Cloudflare Pages Decison | ✅ Done |
| 2026-07-01 | Kill-Switch Konzept dokumentiert | ✅ Done |
| **2026-07-23** | **`vercel.json` Kill-Switch erstellt** | ✅ **Done** |
| **2026-07-23** | **Manual Vercel Disconnect (diese Runbook)** | 🔄 **Todo** |

---

## Referenzen

- `docs/infra/hosting-consolidation-cloudflare-pages.md` — Master-Dokumentation
- PR #750 — Kill-Switch Konzept (ca. 2026-07-01)
- PR #870 — `vercel.json` Commit `a54deed`
- DEPLOYMENT.md — Canonical Deployment Guide

---

## Support

**Fragen zu Vercel-Account / Subscription?**  
→ Vercel Support kontaktieren oder Account auf `realsynchost` überprüfen

**Fragen zu Cloudflare?**  
→ Siehe `deploy/cloudflare-pages/README.md`
