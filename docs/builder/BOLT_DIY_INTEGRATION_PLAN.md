# Integrationsplan — bolt.diy Engine in RealSync

**Branch:** `feat/bolt-diy-builder-integration`  
**Rollback:** `backup/pre-bolt-diy-2026-09-16`

## Ziel

Die produktionsreife Builder-Mechanik von bolt.diy (Code-Gen-Protokoll, Dateien, Vorschau, Fehlerloop) sitzt **hinter** Auth, Mandant, Governance, Prüfpfad und Evidence. SiteOS/Puck bleibt der visuelle Website-Editor. Es entsteht **kein** zweites Produkt.

```
Prompt
  → (später) RealSync AI-Gateway, nie Browser-Keys
  → bolt.diy Parser
  → Governance-Gate (fail-closed)
  → FileStore  |  Shell gehalten
  → Sandboxed Preview
  → Prüfpfad + Evidence-Hash
```

## Phasen

### 0 — Sichern (erledigt)

Snapshot- und Arbeitsbranch. `main` unberührt.

### 1 — Dokumentieren (erledigt)

Dieses Dokument plus Ist-Zustand.

### 2 — Engine-Adapter (diese Lieferung)

Neues Modul `src/features/app-builder/bolt/`:

- Parser (Protokoll von bolt.diy, ohne Remix)
- FileStore, Path-Guard, Secret-Scan
- ActionRunner ohne WebContainer
- Governance-Gate
- Preview aus dem Dateibaum (CSP)
- Prüfpfad-Records
- Tests

**Nicht** in dieser Phase: App.tsx-Route, Puck ersetzen, Orchestrator abschalten, Gateway verdrahten, Migrationen.

### 3 — Workspace (nächster sicherer Schritt)

`BoltWorkbench` als zusätzlicher Modus in `/builder/:slug` (Edit | Preview | Code). Puck bleibt Default. AI nur über das bestehende Gateway. Evidence-Write über vorhandene APIs, keine neue Tabelle in diesem Schritt.

### 4 — Runtime (Freigabe)

WebContainer nur nach bewusster COOP/COEP-Entscheidung. Orchestrator bleibt Registrar (`register_project`). Kein wrangler/KV.

## Gate-Vertrag

| Bedingung | Entscheidung |
|---|---|
| Keine Sitzung | block `auth.session` |
| Mandant nicht verifiziert | block `tenant.verified` |
| `siteos.builder` fehlt | block entitlement |
| EU AI Act Art. 5 | block |
| Hochrisiko | require_approval |
| Secret im Dateiinhalt | block `secret.scan` |
| `wrangler` / `vercel --prod` / `git push` | block `backstop.no-prod-infra` |
| `supabase query` | block `backstop.no-prod-db` |
| shell / start / build | require_approval (WebContainer aus) |
| file im Projektbaum | allow |

## Anpassungen an bolt.diy (zwingend)

1. Keine zweite Schale — Feature-Modul in der Vite-SPA.
2. Keine Keys im Client.
3. Tenant nie aus Prompt oder URL.
4. Jede Mutation durch das Gate.
5. Vorschau nur sandboxed.
6. Kein Fake-Deploy.
7. MIT-Hinweis bleibt im Modul.

## Rollback

`git switch main` bzw. Snapshot-Branch. Modul ist additiv. Ohne Route-Verdrahtung ändert sich die Live-App nicht.
