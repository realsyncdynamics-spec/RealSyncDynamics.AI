# Governance OS — Release Baseline (Mai 2026)

> **Meilenstein:** PRODUCTION VALIDATION READY
> **Phase:** FREEZE & VALIDATION (nicht: weitere Entwicklung)
> **Datum:** 2026-05-31
> **Modus:** Documentation only — keine Code-Änderung bis Validierungsergebnis.
> **Status:** READY FOR VALIDATION (nicht: VALIDATED)

Dieses Dokument ist der maßgebliche Release-Record. Jede Aussage trägt ein
**Evidence-Level**. Aussagen ohne Beleg werden nicht als Tatsache geführt — für
eine Governance-/Compliance-Plattform ist die Trennung „bewiesen vs. angenommen
vs. offen" wichtiger als zusätzliche Funktionen.

## Evidence-Level (Statusmodell)

| Label | Bedeutung |
|---|---|
| **VERIFIED** | Durch Code / Deploy / DB / HTTP nachweisbar belegt. |
| **ASSUMED** | Technisch vorhanden (Code deployed), aber nicht in einer echten Live-Session getestet. |
| **OPEN** | Benötigt einen echten Nutzer / echten Test, bevor es behauptet werden darf. |

---

## 1. Release Baseline — Deployments

| Deployment | Inhalt | Evidence-Level | Beleg |
|---|---|---|---|
| **PR #507** — Workspace Shell + Governance-OS-Navigation | Einheitliche `/app`-Navigation, stabiler Einstiegspunkt, Objektmodell | **VERIFIED** | „Governance OS" + Nav-Labels (Websites, KI-Systeme, Risiken, Compliance, Monitoring) im deployten `WorkspaceShell`-Chunk |
| **PR #508** — Kundensprache + SaaS-Positionierung | „Websites & Assets", „Ereignis-Verlauf" statt Developer-Jargon | **VERIFIED** | Neue Strings = 1, alte Strings („Runtime Event Stream"/„Echtzeit-Telemetrie") = 0 im deployten `GovernanceDashboardView`-Chunk |
| **PR #509** — Embed-Cleanup + Auth-Konsistenz | Monitoring-Embed ohne Doppel-Navbar, AuthGate für KI-Systeme | **VERIFIED** | Neue `supabase`-Abhängigkeitskante im deployten `AgentRegistryView`-Chunk (nur durch den AuthGate-Import aus #509 erklärbar) |
| Deploy-Frische (kein stale Cache / kein alter Deploy) | Live = `main`-HEAD nach #509 | **VERIFIED** | Merge-Commit `8b897ba`; alle drei PRs in den deployten Chunks nachweisbar |

---

## 2. Aktueller Produktzustand

### Governance-OS-Workspace (kundenorientiert)

```
/app
├── Übersicht
├── Websites
├── KI-Systeme
├── Risiken
├── Compliance
├── Evidence
├── Monitoring
├── Team
└── Einstellungen
```

**Aus der kundenseitigen Governance-OS-Navigation entfernt** (nicht gelöscht):
- Runtime Agent Registry
- Event Stream (Developer)
- Developer Console

> **Korrektur ggü. früherem Entwurf:** Diese Elemente wurden **nicht gelöscht**.
> Die Architektur ist additiv (#507 war ausdrücklich additiv, keine View entfernt).
> Die internen technischen Routen (`/governance/*`, z. B. `/governance/agents`)
> **bleiben vorhanden**; `AgentRegistryView` ist weiterhin auch unter
> `/app/ai-systems` eingehängt (jetzt auth-gated). Entfernt wurde lediglich die
> **prominente kundenseitige Navigation**, nicht die Funktion.

### Public-SaaS-Surface

| Route | Inhalt | Evidence-Level | Beleg |
|---|---|---|---|
| `/` | Landing | **VERIFIED** | HTTP 200, prerendert, keine verbotenen CTAs |
| `/audit` | Audit-Einstieg (Route) | **VERIFIED** | HTTP 200 |
| `/pricing` | Pricing | **VERIFIED** | HTTP 200, prerendert |
| `/monitoring` | Public-Monitoring-Vorschau (Demo, vor Login) | **VERIFIED** | HTTP 200 |
| `/checkout/starter` · `/growth` · `/agency` | Checkout-Routen erreichbar | **VERIFIED** | HTTP 200; ungültiger Plan (`/checkout/invalid`) → korrekt 404 |

> **HTTP-200-Aussagekraft:** Kalibriert — Unsinns-Routen liefern echtes **404**
> (kein Blanket-200-Fallback). 200 bedeutet hier also wirklich „Route existiert".

### Bewertung nach Freeze (Produkteinschätzung, kein technischer Beweis)

| Achse | Score | Hinweis |
|---|---|---|
| Frontend / UX | 🟢 8.5/10 | Navigation, Klarheit, User-Guidance |
| SaaS-Produktform | 🟢 8.0/10 | Self-Service, Checkout, Onboarding |
| Backend-Basis | 🟢 7.5/10 | Auth, Datenfluss, Monitoring |
| Checkout-Fähigkeit | 🟢 8.0/10 | Integration, Payment-Routing |
| Enterprise-Fähigkeit | 🟡 7.0/10 | Team, Audit-Logs, Enterprise-Auth |
| GovTech-Compliance | 🟡 6.5/10 | Evidence-Export, Standards |
| **Gesamt** | **7.6/10** | Release Baseline erreicht |

> Diese Scores sind eine **Produkteinschätzung**, kein Messergebnis. Sie sind als
> Orientierung dokumentiert, nicht als VERIFIED-Tatsache.

---

## 3. Product Validation — Status & Checkliste

**Status: READY FOR VALIDATION** — *nicht* VALIDATED.

Es wurde **kein** externer Kundendurchlauf ausgeführt. Die folgende Checkliste ist
**offen** und wird erst durch echte Nutzer abgeschlossen:

- [ ] **Externer Nutzer versteht die Landing** (First Impression, < 60 s: Was, welches Problem, nächster Schritt)
- [ ] **Audit Ende-zu-Ende** (Domain eingeben → Daten laden → verständliches Ergebnis → klare Handlung)
- [ ] **Checkout mit echter Zahlung** (Account → Plan wählen → `checkout.session.completed`)
- [ ] **Erstlogin ins Governance OS** (Login → `/app` lädt → Übersicht + nächste Aktion verständlich)
- [ ] **Evidence-Export** (Risiken/Findings sichtbar → Evidence als JSON/PDF/Report exportierbar)

**Auswertung:** 5/5 bestanden → nächste Kunden freigeben · 4/5 → Blocker benennen ·
≤3/5 → Freeze verstärken, Postmortem.

---

## 4. Evidence-Matrix (pro Aussage)

| Aussage | Evidence-Level | Begründung |
|---|---|---|
| Workspace-Shell + `/app`-Navigation deployed | **VERIFIED** | Deployter `WorkspaceShell`-Chunk |
| Keine Entwicklerbegriffe in der Hauptnav | **VERIFIED** | „Agent Registry / Event Stream / Evidence Chain / Runtime" = 0 im Shell-Chunk |
| Kundensprache (#508) live | **VERIFIED** | Deployter `GovernanceDashboardView`-Chunk |
| AuthGate-Code für `/app/ai-systems` deployed | **VERIFIED** | `supabase`-Kante im `AgentRegistryView`-Chunk |
| Public-Routen + Checkout-Routen erreichbar | **VERIFIED** | HTTP 200, 404-kalibriert |
| Keine alten Pilot-/Demo-/Beratungs-CTAs (Public) | **VERIFIED** | Prerender-Scan `/ /audit /pricing /monitoring` = 0 Treffer |
| `/app/monitoring` zeigt nur **eine** Topbar (kein Doppel-Navbar) | **ASSUMED** | Fix-Code deployed + CI-Playwright grün; nicht live-browser-beobachtet |
| `/app/ai-systems` zeigt ohne Session den Auth-Screen (keine Agentenliste vor Login) | **ASSUMED** | AuthGate-Code deployed + CI-Playwright grün; nicht live-browser-beobachtet |
| Audit liefert echte Daten Ende-zu-Ende | **OPEN** | Braucht echte Session/Domain |
| Erfolgreiche Zahlung | **OPEN** | „Checkout erreichbar" ≠ „Zahlung abgeschlossen" |
| Login → `/app` rendert für echten Nutzer | **OPEN** | Client-gerendert; nicht in echter Session beobachtet |
| Evidence-Export-User-Journey | **OPEN** | Braucht echten zahlenden Nutzer |

---

## 5. Auth-Stack & Messpunkte

**Auth-Stack: Supabase Auth** (nicht Auth0).

Messpunkte werden **nur aus tatsächlich vorhandenen Quellen** dokumentiert.
Keine nicht-verifizierten Analytics-Systeme werden als Quelle behauptet.

| Messpunkt | Quelle | Evidence-Level |
|---|---|---|
| Signup | Supabase Auth | **OPEN** (Instrumentierung zu bestätigen) |
| Login | Supabase Auth | **OPEN** (Instrumentierung zu bestätigen) |
| Tenant Creation | App-DB (`tenants`/`memberships`) | **OPEN** (Instrumentierung zu bestätigen) |
| Activation (erste sinnvolle Aktion in `/app`) | App-DB / Event-Log | **OPEN** (Instrumentierung zu bestätigen) |
| Bezahlung | Stripe-Event `checkout.session.completed` | **OPEN** (Live-Zahlung steht aus) |

> Ein dediziertes Analytics-System (z. B. GA4) ist **nicht** als vorhanden
> verifiziert und wird daher hier nicht als Messquelle geführt.

---

## 6. Finale Status-Entscheidung

| Frage | Antwort |
|---|---|
| Production deployed | **YES** |
| Release Baseline | **YES** |
| Customer validated | **NO** |
| Enterprise complete | **NO** |
| Government certified | **NO** |

---

## 7. Offene Punkte (OPEN — sichtbar zu halten)

Diese Punkte sind **OPEN** und dürfen nicht als erreicht dargestellt werden. Sie
sind kein Teil dieser Baseline, sondern der nachgelagerten Validierungs-/Trust-/
GovTech-Phasen. Aufnahme hier dient ausschließlich der Transparenz, nicht als
Roadmap-Start (Freeze bleibt aktiv).

| Offener Punkt | Status | Phase |
|---|---|---|
| Customer Validation (echter Nutzer-Durchlauf) | **OPEN** | Real User Validation |
| Payment E2E (echte abgeschlossene Zahlung) | **OPEN** | Real User Validation |
| Evidence-Export E2E (User-Journey end-to-end) | **OPEN** | Real User Validation |
| SSO (SAML/OIDC) | **OPEN** | P1 Enterprise Trust |
| SCIM (automatisiertes User-Provisioning) | **OPEN** | P1 Enterprise Trust |
| FRIA (Fundamental Rights Impact Assessment, EU AI Act Art. 27) | **OPEN** | P2 Government |
| BSI / NIS2 / KRITIS | **OPEN** | P2 Government |

> Keine dieser Aussagen darf als „ready"/„complete"/„certified" formuliert werden,
> bevor sie nicht durch Test/Audit/Zertifizierung von VERIFIED-Qualität belegt ist.

---

## 8. STOP — Nächster erlaubter Schritt

**Keine neue Roadmap. Keine Feature-Entwicklung.**

Der nächste erlaubte Schritt ist **Real User Validation** (siehe offene Checkliste
in §3). Erst ein Validierungsergebnis hebt den Freeze auf.

**Feature Gate (bis Validierungsergebnis aktiv):** Neue Features nur, wenn sie
Conversion, Vertrauen, Umsatz oder Enterprise-Fähigkeit messbar adressieren.
Bug-Fixes nur, wenn sie einen der 5 Validierungs-Tests verhindern.
Kein Refactoring, keine Migration, keine Edge-Function-Optimierung, keine
Design-Überarbeitung (außer ein UX-Test weist sie als Conversion-Blocker nach).

---

## Anhang A — Verifikations-Provenance (wie die VERIFIED-Labels belegt sind)

Alle Belege wurden **read-only** erhoben (keine Änderung am System):

- **HTTP-Status / 404-Kalibrierung:** `curl`-Sweep aller Routen; Unsinns-Routen
  liefern 404 → 200 ist beweiskräftig (kein Blanket-Fallback).
- **Deploy-Frische:** Strings in den **deployten, code-gesplitteten JS-Chunks** der
  Produktion geprüft — `WorkspaceShell` (#507-Nav), `GovernanceDashboardView`
  (#508-Wording, neu=1/alt=0), `AgentRegistryView` (#509-AuthGate via neuer
  `supabase`-Abhängigkeitskante; `AgentCard`/`demoAgents` haben keinen
  Supabase-Import → die Kante stammt eindeutig aus dem AuthGate-Import).
- **Nav ohne Dev-Begriffe:** Deployter `WorkspaceShell`-Chunk — „Agent Registry /
  Event Stream / Evidence Chain / Runtime" = 0.
- **Keine Alt-CTAs:** Prerender-HTML von `/ /audit /pricing /monitoring` — verbotene
  Mehrwort-CTAs („Demo anfragen", „Pilot anfragen/starten", „Beratung anfragen",
  „… Call buchen", „Partner-Gespräch", „Strategie-Call", „Migration-Call") = 0.
- **Merge-Commit:** `8b897ba` (Merge #509) ist der Live-Stand.

## Anhang B — Was OPEN bleibt (nicht maschinell beweisbar)

- Architektur: `realsyncdynamicsai.de` ist eine client-gerenderte SPA auf GitHub
  Pages; `/app/*` liefern dieselbe Shell-HTML und rendern per JS. Daher sind
  Laufzeit-Render-Verhalten **nicht** per `curl` beweisbar.
- Ein Headless-Browser-Versuch gegen Produktion war in der Verifikations-Umgebung
  nicht möglich (Netzwerk-Egress des Browser-Prozesses blockiert).
- **Browser-Restpunkte (Abnahmeprüfung, kein Blocker):**
  1. `/app/monitoring` — genau **eine** Topbar (kein Doppel-Navbar).
  2. `/app/ai-systems` — ohne Login der **Auth-Screen** (keine Agentenliste).
  Beide sind im deployten Code enthalten und durch CI-Playwright grün; sie sind im
  echten Browser/Inkognito in unter einer Minute manuell bestätigbar.

---

*Read-only erhoben. Documentation only. Keine Code-Änderung im Rahmen dieses
Records. Freeze + Feature Gate bleiben aktiv bis zum Real-User-Validierungsergebnis.*
