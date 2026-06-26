# Testkäufer- & Technik-Audit — 2026-06-14

> Rolle: Testkäufer (Customer Journey) + technischer Analyst (Code-Pfad).
> Scope: Checkout/Stripe-Pakete, Gratis-/EU-lokal-Modelle, Dashboard/AI-Workflows, DSGVO-Compliance, Routing.
> Ergänzt `docs/qa/fix-plan.md` (P0–P3 dort bleibt gültig) und `docs/strategy/government-enterprise-restructure.md` (Positionierung).
> Dieses Dokument fügt **einen neuen P0-Sicherheitsfund** hinzu und konsolidiert den Status für die Umsetzungsstrategie.

---

## 0. Befund in einem Satz

Die Plattform ist **architektonisch sehr weit** (RLS, Audit-Trail, Stripe-Webhook, GDPR-Export/-Delete, Residency-Routing — alles real implementiert), aber **zwei konkrete Lücken verhindern einen sauberen Live-Start**:

1. **Checkout kann aktuell keine zahlenden Kunden annehmen** (Stripe-Price-IDs sind Sentinels) — bekannt, in `fix-plan.md` als F-001/F-002/F-003 (P0).
2. **NEU — Sicherheitsleck:** Im Creator-Dashboard (`/assistant`) wird ein zweiter, paralleler AI-Gateway-Pfad (`src/core/ai-gateway/gateway.ts`) genutzt, der (a) den `GEMINI_API_KEY` **in den Browser-Bundle einbettet** und (b) **kein Audit-Logging** (`ai_tool_runs`) durchführt — Verstoß gegen die in CLAUDE.md festgelegte Multi-Tenancy-/Logging-Pflicht und gegen "Service-Role-/API-Keys ausschließlich serverseitig".

---

## 1. Testkäufer-Walkthrough (Customer Journey)

| Schritt | Route | Befund |
|---|---|---|
| Landing | `/` | Lädt, CTA zu `/pricing` funktioniert. Positionierung "Agentur-Tool" statt "EU Governance OS" (siehe `government-enterprise-restructure.md`, separates Thema) |
| Gratis-Audit | `/audit` | Funktioniert ohne Login, liefert Mini-Report (Score + Top-3-Risiken) über `gdpr-audit` Edge Function — **gut, funktioniert als Lead-Magnet** |
| Pricing | `/pricing` | 6 Stufen sichtbar: Free Audit (0 €), Starter (79 €), Growth (249 €, "Empfohlen"), Agency (699 €), Scale (1.999 €, manueller Sales), Enterprise (individuell) |
| Checkout-Klick | `/checkout/:planKey` | UI lädt, Consent-Gate (§312k/§356(5) BGB) korrekt. **Aber:** `stripe-checkout` Edge Function bricht mit `PRICE_NOT_CONFIGURED` ab, da `public.products.stripe_price_id` noch Sentinel-Werte (`internal_default_*`) enthält. **Ein Testkäufer kann aktuell nicht zahlen.** |
| Free/EU-lokal-Modell | `/settings/ai-residency` | UI vorhanden (Tenant-Policy: user_choice / enforce_eu_local / enforce_cloud), Backend-Routing (`resolve_ai_residency()` → Ollama bei `eu_local`) ist implementiert — **funktioniert für den ai-invoke-Pfad**. Nicht im Pricing/Billing als eigenständiges "Gratis-Paket" sichtbar — ist ein Setting, kein Tarif. |
| Dashboard (Workspace `/app`) | `/app/*` | Governance-OS-Shell (Websites, AI-Systeme, Risiken, Compliance, Evidence, Monitoring) — alle Tabs laden, Quick Actions verlinken korrekt. |
| Dashboard (Creator `/assistant`) | `/assistant` | Chat-UI mit Modell-Auswahl (Gemini 3.1 Pro / Claude 4.6 / GPT-5). **Claude- und GPT-Antworten sind hartcodierte Mock-Strings** ("🤖 OpenAI (GPT-5) Mock-Antwort..."). Gemini-Antworten sind real, laufen aber **direkt aus dem Browser** gegen die Google-API mit einem **im Client-Bundle eingebetteten API-Key**. |
| Admin-Dashboard | `/dashboard/business` | MRR/ARR/Plan-Mix/Payment-Activity — funktional, admin-only. |

---

## 2. NEU — P0 Sicherheitsfund: AI-Gateway-Zweigleisigkeit

### 2.1 Befund

Es existieren **zwei unabhängige AI-Aufruf-Pfade**:

**Pfad A (korrekt, CLAUDE.md-konform):**
`ai-invoke` Edge Function (`supabase/functions/ai-invoke/index.ts`) → `runAiTool()` → Provider-Auswahl via `resolve_ai_residency()` → Insert in `ai_tool_runs` (Tenant-RLS, Kosten-/Token-Tracking). Genutzt von `/app/*`-Workflows, Workflows-View, etc.

**Pfad B (Problem):**
`src/pages/CreatorDashboard.tsx` (`/assistant`) ruft `processAIGatewayRequest()` aus `src/core/ai-gateway/gateway.ts` direkt im Browser auf:

- `gateway.ts:36-49` — Gemini-Branch instanziiert `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })` **client-seitig**.
- `vite.config.ts:15` — `'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)` ersetzt das zur **Build-Zeit durch den Klartext-Key**, der dann **für jeden Besucher im JS-Bundle sichtbar** ist (DevTools → Sources).
- Claude/OpenAI-Branches (`gateway.ts:55-75`) sind **hartcodierte Mock-Strings**, keine echten Calls.
- **Kein** Insert in `ai_tool_runs` — diese Aufrufe sind für Billing/Quota/Audit-Trail **unsichtbar**.

### 2.2 Warum das kritisch ist

- **Kostenrisiko:** Jeder Website-Besucher kann den Gemini-Key aus dem Bundle extrahieren und auf Kosten des Betreibers Requests fahren (Quota-/Kosten-Explosion, Key-Missbrauch).
- **Compliance-Verstoß:** CLAUDE.md fordert "jeder externe Call wird in `ai_tool_runs` geloggt" — Pfad B unterläuft das vollständig. Für einen EU-AI-Act-/DSGVO-Prüfpfad ist das eine Lücke (nicht protokollierte KI-Nutzung).
- **Trust-Gap:** Zwei Drittel der im Dashboard angebotenen Modelle (Claude, GPT-5) sind Mock — ein zahlender Kunde im Agency/Growth-Tier bekommt keine echten Antworten von diesen Modellen, ohne dass das im UI kommuniziert wird.

### 2.3 Empfohlener Fix (P0, vor jedem öffentlichen Go-Live)

1. `CreatorDashboard.tsx` auf `ai-invoke` Edge Function umstellen (gleicher Pfad wie `/app/*`), inkl. Provider-Mapping `gemini|claude|openai` → entsprechende `ai_tools`-Einträge.
2. `src/core/ai-gateway/gateway.ts` entfernen oder klar als "Dev-only / Preview"-Stub kennzeichnen und aus dem Produktions-Build ausschließen.
3. `GEMINI_API_KEY` aus `vite.config.ts`/`define` entfernen — Gemini-Calls dürfen nur noch serverseitig (Edge Function) erfolgen.
4. Falls ein "BYO API Key"-Feature gewünscht ist (Nutzer bringt eigenen Key): Key serverseitig speichern (verschlüsselt) und über Edge Function proxien, nie im Bundle.

---

## 3. Checkout / Stripe-Pakete (Bestätigung bestehender Befunde + Status)

| Paket | Preis | Stripe-Price-ID Status |
|---|---|---|
| Free Audit | 0 € | kein Checkout nötig — funktioniert |
| Starter | 79 €/Monat | `internal_default_starter` (Sentinel) |
| Growth | 249 €/Monat | `internal_default_growth` (Sentinel) |
| Agency | 699 €/Monat | `internal_default_agency` (Sentinel) |
| Scale | 1.999 €/Monat | `internal_default_scale` (Sentinel) + manueller Sales-Flow |
| Enterprise | individuell | `internal_default_enterprise` (Sentinel) + manueller Sales-Flow |

- Checkout-Code-Pfad (UI → `stripe-checkout` → Stripe → `stripe-webhook` → `subscriptions`-Tabelle) ist **strukturell korrekt und idempotent** implementiert.
- Blocker ist rein **Daten-/Konfigurationsseitig**: echte `price_xxx`-IDs müssen in `public.products` eingetragen werden (siehe `docs/runbooks/stripe-production-checkout.md`, F-002/F-003 in `fix-plan.md`).
- Ebenfalls aus `fix-plan.md` offen: Resend-API-Key fehlt → Welcome-/Report-Mails laufen nicht in Production (F-001).

**Keine neuen Findings hier** — bestätigt den bestehenden Plan.

---

## 4. DSGVO/GDPR — Bewertung

**Reifegrad: 7/10.** Kernrechte sind implementiert:

- ✅ Art. 15 Export (`gdpr-export`), Art. 17 Löschung (`gdpr-delete`, mit Anonymisierung statt Hard-Delete für Compliance-Retention)
- ✅ RLS auf allen kritischen Tabellen (`ai_tool_runs`, `workflow_runs`, `subscriptions`, `tenants`, `profiles`, `pii_redaction_log`, `webhook_events`, …)
- ✅ Cookie-Consent-SDK mit 3 gleichrangigen Buttons (Accept/Reject/Customize), `user_consents` RLS-geschützt
- ✅ AVV-Template (Art. 28), Sub-Prozessoren-Notify-Flow
- ✅ EU-lokal-Modus (Ollama) korrekt im `ai_tool_runs`-Metadata erfasst (`residency`, `provider`)

**Offene Punkte (P1/P2, neu priorisiert):**

| # | Befund | Datei:Zeile | Schwere |
|---|---|---|---|
| 1 | `workflow_runs.output_payload` wird bei `gdpr-delete` **nicht** mitanonymisiert, nur `user_id`/`triggered_by` → NULL | `supabase/functions/gdpr-delete/index.ts:97-98` | P1 — kann sensible Daten nach Löschantrag behalten |
| 2 | AAL2-Check in `gdpr-delete` ist nur Logging (`observeAal2`), kein Hard-Block | `supabase/functions/gdpr-delete/index.ts:54-55` | P1 |
| 3 | `gdpr-audit` (Free-Tool) erfasst Lead-E-Mails ohne Double-Opt-In | `supabase/functions/gdpr-audit/index.ts:184-194` | P2 |
| 4 | **NEU:** nicht-geloggter AI-Call-Pfad (siehe Abschnitt 2) ist auch ein DSGVO/AI-Act-Prüfpfad-Thema | `src/core/ai-gateway/gateway.ts` | **P0** (gehört zu Abschnitt 2) |
| 5 | DSB-Bestellpflicht (§38 BDSG) — kein Automatismus bei Mitarbeiterwachstum | `src/features/legal/PrivacyPolicy.tsx:57-66` | P2, organisatorisch |

Kein kritisches regulatorisches Blockierungsrisiko für einen Pilotbetrieb — Punkt 1+2 sollten aber vor dem ersten echten Löschantrag eines zahlenden Kunden gefixt sein.

---

## 5. Routing/Buttons — Bestätigung

Keine toten Links, keine "Coming Soon"-Platzhalter gefunden. ~200 Routen, sauber gruppiert (Marketing, `/app/*` Workspace, `/governance/*`, Legal). Letzter Commit (`de00824`) hat alle toten Stripe-Payment-Links bereits durch `/checkout/:planKey` ersetzt. **Kein Handlungsbedarf hier.**

---

## 6. Zielabgleich (Soll laut CLAUDE.md/Strategy vs. Ist)

| Ziel (Soll) | Ist |
|---|---|
| EU-souverän, Anthropic/Google/OpenAI Cloud + Ollama EU-lokal | ✅ für `/app`-Workflows via `ai-invoke`. ❌ für `/assistant` (Creator-Dashboard) — siehe P0-Fund. |
| Jeder externe Call in `ai_tool_runs`/`workflow_runs` geloggt | ✅ Pfad A, ❌ Pfad B (Creator-Dashboard) |
| Multi-Tenant, RLS überall | ✅ durchgängig |
| Billing self-service (Stripe) | ⚠️ Code fertig, **Konfiguration fehlt** (Sentinel-Price-IDs) |
| "Realtime Governance Runtime" Positionierung (Enterprise/Gov) | ⚠️ separates Thema, siehe `government-enterprise-restructure.md` — Substanz vorhanden, Public-IA bildet sie nicht ab |

---

## 7. Priorisierte Umsetzungsstrategie

### Sofort (P0 — vor jedem Marketing-Push / echten Zahlungen)
1. **AI-Gateway-Fix (neu, Abschnitt 2):** `/assistant` auf `ai-invoke` umstellen, `gateway.ts` + Client-Key aus Build entfernen. — *Reine Code-Änderung, kein externer Abhängigkeit, sollte zuerst gemacht werden.*
2. **Stripe-Launch (bekannt, fix-plan F-001–F-003):** Resend-Key + Stripe Live/Webhook-Secrets in Vault, echte Price-IDs in `public.products`. — *Konfigurationsaufgabe, kein Code.*

### Diese Woche (P1)
3. `gdpr-delete`: `output_payload` mitanonymisieren + AAL2 als Hard-Block für sensible Löschoperationen.
4. Pricing-Konsistenz (fix-plan F-101–F-103): veraltete Bronze/Silver/Gold-Preise in FAQ/Press/Landingpages bereinigen.

### Folge (P2)
5. `gdpr-audit` Lead-Capture mit explizitem Consent/Double-Opt-In versehen.
6. Overclaim-Entschärfungen aus fix-plan (F-201–F-205).
7. Positionierungs-Hebel aus `government-enterprise-restructure.md` (Homepage-Recompose aus vorhandenen `sections/`-Komponenten) — größter Wirkungs-/Aufwands-Hebel für Enterprise-Pipeline, aber unabhängig vom P0/P1-Block.

### Nicht blockierend, aber zu klären
- Soll "Scale"/"Enterprise" weiterhin manueller Sales-Flow bleiben, oder Self-Service-Checkout? (betrifft `/checkout/:planKey`-Routing-Erweiterung)
- BYO-API-Key-Feature im Creator-Dashboard: behalten (dann serverseitig proxien) oder entfernen, bis echte Multi-Provider-Integration steht?

---

## 8. Nächster Schritt

Empfehlung: **mit P0.1 (AI-Gateway-Fix) beginnen** — ist reine Code-Arbeit, keine externen Credentials nötig, schließt eine aktive Sicherheitslücke (Key-Leak) und stellt DSGVO-Logging-Konformität für den Creator-Workflow her. P0.2 (Stripe-Konfiguration) erfordert Zugriff auf Stripe-Dashboard/Vault durch den Nutzer und kann parallel als Runbook-Task laufen.
