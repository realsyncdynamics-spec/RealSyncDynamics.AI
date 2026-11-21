# RealSync White-Produktseiten – Integrationsmatrix (20.11.2026)

## Zielbild des Owners

- **Dachmarke:** `realsyncdynamicsai.de`, eine Codebasis, eine Auth-/Mandantenwelt, ein Dashboard, ein Billing.
- **Design:** ein identisches weißes Corporate-Designsystem für Haupt- und Produkt-Landingpages. Pro Produkt ein eigenes Hero-Motiv; der Startseiten-Hero zeigt das **animierte 3D-Maskottchen SYNC**.
- **Produkt-Familie:** `/governance-os`, `/voice-agent`, `/app-builder`, `/software-factory`, `/automation-os`, `/creative-studio`. Der eigenständige **Landingpage-Builder** (`/landingpage-builder`) gehört zusätzlich zum Website-Angebot, nicht zum Voice-Agent.
- **Kundenweg:** Scan → Ergebnis → Landingpage/Frontend (vorhandenes Backend beibehalten) → optional Telefonassistent und/oder WhatsApp-Agent → Governance. Produkt-Landingpages sind zusätzlich direkt aus dem Hauptkatalog erreichbar.

## Bereits existierende Arbeiten (nicht duplizieren)

| PR | Gegenstand | Relevanz / Integrationsentscheidung |
| --- | --- | --- |
| [#2338](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2338) | 3D-Maskottchen `/sync`, `public/models/sync-mascot.glb` | Modell- und Animationsquelle, kein zweiter Bot nötig |
| [#2340](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2340) | `SyncHeroStage` auf `/`, gemeinsame Produktseiten | Startseiten-Hero-Implementierung mit echter GLB-Animation und Standbild-Fallback |
| [#2344](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2344) | Weiße, gemeinsame Produktseiten + Scan-/Landingpage-/Telefon-Kundenweg | **Bevorzugte Funktionsbasis**, bereits mit eigener Hero-Inszenierung pro Produkt, Beispielablauf und Tarif-/Statuslogik |
| [#2331](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2331) | Alternativer Voice-Agent-Hero mit Neon-Toggle | Entwurfs-Alternative; Neon nicht als neues verpflichtendes Design übernehmen |
| [#2349](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2349) | Governance-Glaswürfel als isolierte Preview | Bei Bedarf Governance-Hero übernehmen; nicht automatisch produktiv |
| [#2350](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2350) | Sechs White-Marketingseiten + optionale Higgsfield-Videoquelle | **Nicht unabhängig parallel mergen**; Designs und drei fehlende Produktseiten in die bevorzugte Basis überführen |

## Asset-Abgleich

- `main` enthält nach der geprüften Ausgangsversion **keinen verifizierten Higgsfield-Export**.
- In #2340 und #2338 ist bereits `public/models/sync-mascot.glb` mit 3D-Winkanimation und `public/landing-v3/sync-still.jpg` vorhanden. Diese Basis ist für den animierten Startseiten-Hero zweckmäßiger als ein neu erfundener Video-Link.
- **Nicht nachgewiesen:** ob das GLB exakt der ursprünglich in Higgsfield gerenderten Bot-Version entspricht. Vor Medienfreigabe visuellen Soll-Ist-Abgleich machen.
- Video-Fallback in #2350 bleibt Entwurf; nicht ohne Qualitätsvergleich gegen den vorhandenen SYNC-Hero austauschen.

## Merge-Reihenfolge / Konflikte

1. #2338 → #2340 → #2344 in der bereits dokumentierten Abhängigkeitskette prüfen. Achtung: PRs teils gestapelt und andere Base-Refs; **nicht blind nacheinander mergen**, sondern tatsächliche Diffs und enthaltene Commits kontrollieren.
2. Danach fehlende Marketingseiten Software Factory / Automation OS / Creative Studio sowie gewünschte `/voice-agent`-URL als **kleinen Folge-PR** mit exakt derselben weißen Produktvorlage ergänzen. Doppelte `ProductLanding`-Implementierungen vermeiden.
3. Das gemeinsame Hero-Szenensystem von #2344 verwenden. Jedes Produkt eigener Bühneninhalt/Kamerawinkel/Prozess, SYNC als Markenfigur ist zulässig.
4. SEO-/SPA-Routen, Links, Claims, Pricing, Mobile-E2E, Tastaturbedienung und Reduced Motion prüfen.
5. Kein Merge/Deploy ohne **eigene** Freigabe je betroffener Hot-File-/Produktionsänderung (`AGENTS.md`, `.github/PR_TRIAGE_POLICY.md`).

## Prüfstatus

- In #2350: Cloudflare **Build SPA**, Playwright-E2E, Lighthouse, CTA Enforcement, CodeQL und Merge Hygiene grün.
- In #2350: Workflow **CI** insgesamt übersprungen (Draft). Cloudflare-Deploy- und Live-Smoke-Jobs im GitHub-Workflow übersprungen. Eine Cloudflare-Git-Integration hat eine Preview-URL kommentiert; deren Erreichbarkeit wurde hier nicht unabhängig verifiziert. Nicht mit Produktivdeploy gleichsetzen.
- Eigenständige neue Vitest-Testdatei in #2350 wurde nicht als ausgeführter gezielter Unit-Test nachgewiesen.
- Produktfreigabe, Higgsfield-Medienabnahme und Produktions-E2E sind **offen**.
