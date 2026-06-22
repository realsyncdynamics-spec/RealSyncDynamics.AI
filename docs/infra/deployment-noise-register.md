# Deployment Noise Register

Zweck: Deployment-Signale von **nicht genutzten / fehlkonfigurierten Legacy-
Projekten** dokumentieren, damit ihr Fehlschlagen nicht fälschlich als CI-
Blocker für die Landingpage oder den Merge behandelt wird.

> Regel: Bot-Rauschen von nicht verwendeten Legacy-Projekten ist **kein P0**.
> Es wird als `NON_BLOCKING_DEPLOYMENT_NOISE` klassifiziert.

## Was Aufmerksamkeit erzeugt (echte Signale)

- echte GitHub-Action-Fehler (build, playwright, Migration validation, Forbidden CTA)
- Cloudflare-Pages-Deployment-Fehler
- lokale Build-Fehler (`npm run build`)
- Playwright-Fehler
- menschliche Review-Kommentare
- Produktionsausfälle
- Stripe-/Auth-/Supabase-Fehler

Alles andere → `NON_BLOCKING_DEPLOYMENT_NOISE`.

---

## Registrierte Non-Blocking-Projekte

### real-sync-dynamics-ai-remu

- **Project:** real-sync-dynamics-ai-remu
- **Platform:** Vercel
- **Status:** Non-blocking
- **Reason:** Separates Projekt für den Runtime-Core-Service, nicht Teil des
  aktuellen Cloudflare-Pages-Frontend-Deployments.
- **Affected path:** `services/realsync-runtime-core`
- **Impact:** Keiner auf Landingpage oder Cloudflare-Deployment.
- **Action:** Ignorieren, bis das Runtime-Core-Deployment bewusst aktiviert wird.

### real-sync-dynamics-ai (Team `realsynchost-c3f4cfdf`)

- **Project:** real-sync-dynamics-ai (Duplikat unter abweichendem Team-Scope)
- **Platform:** Vercel
- **Status:** Non-blocking
- **Reason:** Separates/legacy- bzw. fehlkonfiguriertes Duplikat-Projekt
  (Root-Directory teils auf `services/realsync-runtime-core` gesetzt). Nicht das
  Frontend-Deployment. Das produktive Frontend läuft über Cloudflare Pages
  sowie die Vercel-Projekte `real-sync-dynamics-ai` und
  `real-sync-dynamics-ai-9ue5` (Team `realsynchost`), die erfolgreich bauen.
- **Affected path:** `services/realsync-runtime-core`
- **Impact:** Keiner auf Landingpage oder Cloudflare-Deployment.
- **Action:** Ignorieren, bis das Runtime-Core-Deployment bewusst aktiviert wird.

---

## Offene Infra-Punkte (separat von obigem Rauschen — echte Signale)

Beim Merge-Readiness-Check 2026-06-22 zusätzlich beobachtet (vorbestehend,
nicht durch den Landing-Branch verursacht — `public/_redirects` ist korrekt und
unverändert):

- **SPA-Fallback (Cloudflare Pages):** Deep-Routes wie `/ai-act`, `/pricing`
  liefern HTTP 404 statt `index.html` (200) — auf Produktions-`pages.dev` und
  Branch-Preview gleichermaßen. `public/_redirects` enthält korrekt
  `/*  /index.html  200`; Ursache liegt vermutlich in der Pages-Projekt-Config.
- **Produktions-Apex:** `https://realsyncdynamicsai.de/` liefert HTTP 500
  (`www.` → 301). Vorbestehende Apex-/Routing-Konfusion (siehe Infra-Analyse).

Diese gehören nicht zur Kategorie `NON_BLOCKING_DEPLOYMENT_NOISE`, sondern sind
eigene Infra-Tickets.
