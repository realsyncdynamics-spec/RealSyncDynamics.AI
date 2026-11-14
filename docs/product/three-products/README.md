# Drei Produkte, eine Plattform — IST-Analyse, Matrix, Integration, GO/NO-GO

Stand: 07.11.2026 · Branch `ccr-deffdd1e-8qm639` · Basis `main` @ `c8af738`
Code-Quelle der Status: `src/product/productSuite.ts` (liest `src/product/implementation-status.ts`, fail-closed).

Produktspezifikationen:
[Build Studio](./BUILD_STUDIO_SPEC.md) · [Agent Studio](./AGENT_STUDIO_SPEC.md) · [Governance OS](./GOVERNANCE_OS_SPEC.md)

---

## 0. Kritischer Befund vorab: Produktion ≠ Repository

| Prüfung (07.11.2026, `curl`) | Ergebnis |
|---|---|
| `https://realsyncdynamicsai.de/` | HTTP 200, Titel „RealSync Dynamics & AI — Governance OS, Voice Agent, Landingpage Builder“, Header `x-nf-request-id` (**Netlify**), Einzel-HTML ~5,7 MB (Bundler-Export) |
| `https://realsyncdynamicsai.de/build`, `/audit`, `/pricing`, `/chatbot/start`, `/phonebot/start` | **HTTP 404** |
| `https://realsyncdynamics-ai.pages.dev/` | HTTP 200, Titel der Landing v6 (Repo-Stand) |
| `https://realsyncdynamics-ai.pages.dev/build`, `/audit`, `/pricing` | HTTP 200 |

Folge: Die Hauptdomain liefert derzeit nicht die SPA aus dem Repository (Cloudflare Pages, Projekt
`realsyncdynamics-ai`), sondern eine statische Seite über Netlify. Alle Funnels (`/audit`, `/build`,
`/welcome`, `/pricing`, Checkout) sind auf der Hauptdomain nicht erreichbar. `CLAUDE.md` nennt
Cloudflare Pages als Deploy-Ziel — **Widerspruch Doku/Produktion, nicht durch diesen PR behoben**
(DNS/Hosting-Änderung braucht Einzel-Freigabe). Ein Merge dieses PRs hat ohne DNS-Korrektur keine
Wirkung auf `realsyncdynamicsai.de`.

---

## 1. IST-Zustand (belegt)

### Öffentliche Website

| Bereich | Datei / Route | Befund |
|---|---|---|
| Startseite (vor diesem PR) | `src/App.tsx` `<Route path="/">` → `src/pages/LandingV6.tsx` | Governance-OS-Positionierung, CSS `src/styles/landing-v6*.css` |
| Produktportal (dieser PR) | `/produkte` → `src/pages/ProductPortal.tsx` | BUILD · AUTOMATE · GOVERN; `/` bleibt unverändert (Owner-Entscheidung 09.11.2026: Landing v9, #2191) |
| Drei-Produkt-Gerüst (bestehend) | `/unternehmen` → `CompanyLanding`, `src/components/landing/company/companyProducts.ts` | noindex-Gerüst mit Governance OS, Voice Agent, Landingpage Builder — inhaltlich verwandt mit dem Netlify-Export |
| Builder-Einstieg | `/build` (`src/unified-entry/pages/BuildStudioPage.tsx`), Aliase `/builder`, `/app/bauen`, `/unified-entry*` | öffentlich, Login beim Speichern |
| Builder-Workspace | `/builder/:slug` (Puck), `/builder/:slug/code` (Code-Workbench) | getrennte Oberflächen, ein Projekt |
| Bot-Einstiege | `/chatbot/start`, `/phonebot/start` (`src/pages/product-entry-points/`) | verweisen auf `/app/bots` bzw. Voice-Onboarding |
| Governance-Einstieg | `/audit` (kanonischer Scan), `/governance` → `/app` | live |
| Preise | `/pricing` (`src/features/billing/PricingPage.tsx`), SSoT `shared/pricing.ts`, Beta `src/config/beta.ts` | Beta-Angebot aktiv bis 31.01.2027 |
| Lösungen / Doku / Login | `/branchen`, `/docs`, `/login`, `/welcome` | vorhanden |

### Authentifizierter Bereich

| Bereich | Route | Gate |
|---|---|---|
| Command Center | `/app/dashboard` | `AppGate` + `GovernanceBrowserShell` |
| SiteOS | `/app/siteos`, `/app/siteos/modernize`, `/app/siteos/claim`; `/app/siteos/builder` → Legacy-Redirect | `AppGate` |
| Bots | `/app/bots`, `/app/bots/inbox`, `/app/bots/whatsapp`, `/app/bots/:botId` | `AppGate` |
| Voice | `/app/voice` (nur Session-Liste) | `AppGate` |
| Governance | `/app/ai-systems`, `/app/risks`, `/app/policy-packs`, `/app/governance/gates`, `/app/evidence`, `/app/governance/evidence`, `/app/monitoring` | `AppGate` |
| Abrechnung | `/app/billing` | `AppGate` + `RequireAal2` |

Auth/Mandant: `SupabaseAuthProvider`, `TenantProvider` (`src/App.tsx`), Login `/welcome?next=` (`src/lib/safeInternalPath.ts`).

### Backend (nur gelesen, nicht verändert)

| Domäne | Edge Functions (`supabase/functions/`) |
|---|---|
| Builder | `siteos` (inkl. `site-entitlements.ts`), `checkout-siteos-project`, `checkout-website-rebuild` |
| Bots/Kanäle | `bot-chat` (Budget-Reservierung), `whatsapp-webhook` (Meta-Signatur fail-closed), `bot-voice-webhook`, `bot-voice-enforcer`, `provision-voice-agent` |
| Governance | `governance-*` (u. a. `-approvals`, `-decide`, `-router`, `-evidence-handler`), `policy-packs`, `evidence-*` |
| Billing | `stripe-checkout`, `stripe-webhook`, `stripe-portal`, `stripe-meter-sync` |
| Voice-Runtime | `apps/agent-runtime` (Deploy-Workflow `deploy-agent-runtime-vps.yml` zuletzt fehlgeschlagen laut Registry) |

**Nicht geprüft** (eigene Profile, keine Freigabe): Supabase-Tabellen/RLS live, Stripe-Produkte live,
Provider-Konten (Meta, Telefonie), Edge-Function-Deploystand. Diese Punkte sind `TEILWEISE`.

### Freischaltungen (`shared/pricing.ts` → `PLAN_ENTITLEMENTS`)

`siteos.builder`, `siteos.publish`, `limit.sites` (Free 0 · Starter 1 · Growth 3 · Agency 10 · Enterprise 25 laut
`PLAN_ENTITLEMENTS`), Bots `bots.*`/`limit.bot_*`, Governance `governance.*`/`evidence.*`. Preise unverändert.

---

## 2. Capability-Matrix (LIVE | PREVIEW | BLOCKED | NOT IMPLEMENTED)

Generiert aus `src/product/productSuite.ts` (Ausgabe des Prüfskripts, 07.11.2026). LIVE heißt: im Code
erreichbar und in der Registry als live gemessen — **nicht** „auf der Hauptdomain produktiv“ (siehe §0).

| Produkt | Fähigkeit | Status |
|---|---|---|
| BUILD | Studio-Einstieg `/build` | PREVIEW |
| BUILD | Visueller Editor (Seiten, Komponenten, Medien, Versionen) | PREVIEW |
| BUILD | Engineering-Oberfläche `/builder/:slug/code` | PREVIEW |
| BUILD | Freischaltung `siteos.builder` · `siteos.publish` · `limit.sites` | PREVIEW |
| BUILD | Bestehende Website analysieren (`/audit`) | LIVE |
| BUILD | Modernisierungs-Assistent (Enterprise) | PREVIEW |
| BUILD | Veröffentlichung in Vorschau-Umgebung nach Freigabe | PREVIEW |
| BUILD | Eigene Domain zuordnen (DNS-Automatik/Rollback fehlen) | PREVIEW |
| BUILD | Individuelles Webdesign auf Anfrage | LIVE |
| BUILD | Chatbot im Builder-Projekt aktivieren | NOT IMPLEMENTED |
| AUTOMATE | Website-Chatbot (Persona, Wissen, Regeln) | PREVIEW |
| AUTOMATE | Anfragen-Posteingang | PREVIEW |
| AUTOMATE | Human Handoff | NOT IMPLEMENTED |
| AUTOMATE | WhatsApp-Kanal konfigurieren | PREVIEW |
| AUTOMATE | WhatsApp-Produktivbetrieb | BLOCKED |
| AUTOMATE | Telefonagent konfigurieren | PREVIEW |
| AUTOMATE | Telefonie (echte Anrufe, Sessions) | BLOCKED |
| AUTOMATE | Workflows/Automationen | PREVIEW |
| AUTOMATE | Branchenvorlagen | PREVIEW |
| AUTOMATE | Qualitätslabor | NOT IMPLEMENTED |
| GOVERN | Discover & Scan | LIVE |
| GOVERN | KI-Systeminventar | LIVE |
| GOVERN | EU-AI-Act-Klassifizierung | LIVE |
| GOVERN | Policy Engine | LIVE |
| GOVERN | Approval Gates | PREVIEW |
| GOVERN | Evidence (Hash-Kette, Export) | LIVE |
| GOVERN | Command Center | LIVE |
| GOVERN | Laufende Prüfungen / Drift | NOT IMPLEMENTED |
| GOVERN | Agent Governance | PREVIEW |

## 3. Integrationsübersicht

`BUILD → AUTOMATE → GOVERN → APPROVE → DEPLOY → MONITOR → EVIDENCE`

| Schritt | Status | Verbindung heute |
|---|---|---|
| BUILD | PREVIEW | Projekt im Mandanten (`/build`, `siteos`) |
| AUTOMATE | PREVIEW | Bots im selben Mandanten; keine Projekt-Verknüpfung Website ↔ Bot |
| GOVERN | LIVE | Governance Runtime; Publish Gate bewertet Builder-Versionen |
| APPROVE | PREVIEW | Approval Gates; Produktion nur mit Owner/Admin-GO |
| DEPLOY | BLOCKED | Domain/DNS/Rollback fehlen; Telefonie-Deploy fehlgeschlagen; WhatsApp-Verifizierung unbelegt |
| MONITOR | NOT IMPLEMENTED | Dauerüberwachung auf Roadmap |
| EVIDENCE | LIVE | `/app/evidence`, `/app/governance/evidence` |

Gemeinsame Schichten (nicht dupliziert): ein Login (`/welcome`), ein Mandant (`TenantProvider`, RLS), ein
Billing (`shared/pricing.ts`, Stripe), eine Governance Runtime. Produktübergreifende Deep-Links laufen
über `/welcome?next=` (`appDeepLink()` in `productSuite.ts`); die Autorisierung bleibt bei `AppGate`
und serverseitigen Prüfungen.

## 4. Fehlende produktive Backend-Funktionen (Integrationsanforderungen)

1. **Hauptdomain auf Cloudflare Pages zurückführen** (DNS/Hosting; §0). Ohne das ist nichts davon produktiv.
2. Builder: eigene Domain mit DNS-Automatik, Rollback, Self-Service-Livegang nach Kundenfreigabe.
3. Website ↔ Bot: Projekt-Verknüpfung (Chat-Widget im Builder-Projekt aktivieren, kanalspezifische Wissensfreigabe).
4. Human Handoff: Übergabe-Ablauf im Posteingang (K4, PR C), Entitlement `bots.human_handoff` vorhanden.
5. WhatsApp: verifizierte Business-Nummer, Webhook-Registrierung bei Meta, Nachweis im Kanalstatus.
6. Telefonie: funktionierender Deploy von `apps/agent-runtime`, Rufnummer/Provider, gemessene Minutenkosten (Voice-Preisabweichung `MODULE_ADDON_PRICE_DIVERGENCE`).
7. Workflows: erreichbarer n8n-Runtime-Host, Bindung der Skills.
8. Qualitätslabor (Testgespräche, Bewertung) — neu, Konzept fehlt.
9. Dauerhafte Domain-Überwachung und Drift-Erkennung.
10. App-Shell: Produktwechsler (Build/Agent/Governance) im `GovernanceBrowserShell` — UI-Änderung im App-Profil, nicht Teil dieses Website-PRs.
11. Echte Screenshots der App-Oberflächen für die Produktseiten (nur aus freigegebenem Demo-Mandanten, nicht aus Kundendaten).

## 5. Änderungen dieses PRs

| Datei | Änderung |
|---|---|
| `src/product/productSuite.ts` | neu: drei Produkte, Fähigkeiten mit Status (aus Registry), Ablauf, Deep-Links |
| `src/pages/ProductPortal.tsx` | neu: Produktportal `/produkte` „BUILD. AUTOMATE. GOVERN.“ |
| `src/pages/products/ProductPage.tsx` | neu: `/produkte/build-studio`, `/produkte/agent-studio`, `/produkte/governance-os` |
| `src/components/portal/PortalChrome.tsx`, `src/styles/product-portal.css` | neu: gemeinsame Navigation, Footer, Status-Chips, Hard-Edge-Design |
| `src/App.tsx` | `/produkte` → `ProductPortal`, drei Produktrouten, Kurzpfade `/build-studio`, `/agent-studio`, `/governance-os` als Weiterleitung. `/` unverändert, keine Route entfernt. |
| `src/config/seo.ts`, `public/sitemap.xml`, `src/config/spaRoutes.generated.ts` | Meta-Daten und Sitemap für `/produkte` und Produktseiten; Routenliste regeneriert |
| `src/product/implementation-status.ts` | neuer Eintrag `product-portal` (`/produkte`) |
| Tests | neu `test/product/product-suite.test.ts`, `test/landing/product-portal.test.tsx` |

Nicht geändert: Backend, Supabase, Edge Functions, Stripe, Preise, Beta-Konditionen, Auth, Builder-/Bot-/Governance-Oberflächen.

## 6. Prüfnachweise

| Befehl | Ergebnis |
|---|---|
| `node scripts/sync-spa-routes.mjs --check` | ✓ 549 SPA-Routen aktuell |
| `node scripts/check-sitemap-routes.mjs` | ✓ 116 Sitemap-URLs, alle mit Route |
| `node scripts/check-landing-claims.mjs` | ✓ 16 verbotene Phrasen, 28 Nicht-live-Einträge geprüft |
| `node scripts/check-offer-prices.mjs` | ✓ kein öffentlicher Betrag ohne Kaufpfad |
| `node scripts/check-context-budget.mjs` | ✓ Budget eingehalten |
| `node scripts/check-plan-name-gates.mjs` | ✓ keine neuen Plan-Namen-Gates |
| `node scripts/check-fabricated-results.mjs` | ✗ — **schlägt auch auf `main` ohne diesen PR fehl** (`Math.random()` in `spaceSceneV5.ts`, `heroEuropeNetwork3D.ts`, `EuropeMapCanvas.tsx`) |
| Node-Type-Stripping-Lauf über `productSuite.ts` | alle CTA-, Seiten- und App-Routen existieren (0 fehlend); Status wie in §2 |
| `tsc --noEmit` | **TEILWEISE**: `node_modules` fehlt im Container (kein Setup-Skript), daher nur Modul-Auflösungsfehler; in den neuen Dateien kein eigener Typfehler außer dem umgebungsbedingten CSS-Side-Effect-Import |
| `vitest`, `vite build`, Playwright | **nicht ausgeführt** (keine Abhängigkeiten installiert). Maßgeblich ist die CI auf dem Head. |
| Live-Domain | `curl` siehe §0 |

## 7. GO/NO-GO-Empfehlung

**NO-GO für eine Produktionsfreigabe heute.** Begründung:

1. Die Hauptdomain zeigt nicht auf das Repository (§0). Erst DNS/Hosting klären, sonst ist jeder Merge wirkungslos bzw. die Wirkung unbekannt.
2. Positionierung: Seit 09.11.2026 ist Landing v9 als Startseite entschieden (#2191); das Portal liegt deshalb unter `/produkte`. Der Auftrag (drei gleichrangige Produkte als Startseite) weicht zudem von **K4** (`docs/PRODUCT_PRIORITIZATION.md`, 27.10.2026: KI-Mitarbeiter als Hero, Governance als Infrastruktur, erster Ablauf AI Receptionist Handwerk) ab. Das Portal nimmt das Handwerk-Beispiel auf, die Gewichtung bleibt eine **Owner-Entscheidung**.
3. Zwei von drei Produkten sind überwiegend PREVIEW/BLOCKED; das Portal weist das offen aus, verkauft aber noch keinen durchgängigen Ablauf.
4. CI (Unit-, Build-, E2E-Tests) muss auf dem Head grün sein; lokal nicht ausführbar.

**GO für Review/Merge des Draft-PRs** (ohne Deploy), sobald: CI grün · Owner entscheidet K4 vs. Drei-Produkt-Hero · Domain-Fehlkonfiguration als eigener Vorgang freigegeben.
