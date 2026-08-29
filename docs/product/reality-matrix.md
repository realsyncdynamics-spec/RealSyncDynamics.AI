# Phase 0 — Architecture & Product Reality Audit

**Erhoben am**: 2026-08-22
**Quellen**: Repository (`main` + `claude/intelligent-bohr-9372fg`), Live-Projekt
`RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`, eu-central-1, PostgreSQL 17),
Edge-Function-Verzeichnis, Stripe-Abbildung in der Datenbank.

Ergänzende Spezifikationen:
`docs/product/design-intelligence-and-guided-integration.md` (Design Intelligence,
Guided Integration) und `docs/product/siteos-anonymous-build.md` (anonymer Build,
Live Preview, Project Claim — inkl. der Sandbox-Grenze für interaktive Vorschauen).

Diese Matrix ist **gemessen, nicht abgeleitet**. Jede Zeile nennt den Beleg.
Wo etwas nicht geprüft werden konnte, steht das ausdrücklich da — nicht eine
plausible Vermutung.

---

## 1. Reality Matrix

| Bereich | Zustand | Beleg | Umgang |
|---|---|---|---|
| Auth | **vorhanden** | Supabase Auth, `profiles`, `useSupabaseAuth()`, `ProtectedRoute`/`RequireAal2`, `mfa_recovery_codes` (10) | wiederverwenden |
| Tenants / Memberships | **vorhanden** | `tenants` (4), `memberships` (4), `tenant_memberships` (4), `tenant_invites` | wiederverwenden |
| Organizations | **teilweise** | `organizations` nur in einer Migration; live führend sind `tenants` | klären, nicht doppeln |
| **Multi-Company** | **fehlt** | keine `companies`-Tabelle; `company_profiles` hält genau **ein** Profil je Tenant (`tenant_id`, `sector`) | Phase 13 |
| Domain Scan | **vorhanden** | `cookie-scan`, `cookie-scan-deep`, `gdpr-audit`; `gdpr_audits` (159 Zeilen — wird produktiv genutzt) | wiederverwenden |
| Free-Scan-Funnel ohne Account | **vorhanden** | `ScanEntryPage` ruft `cookie-scan` mit `requireAuth: false` | wiederverwenden |
| Governance Runtime | **vorhanden** | `governance_assets`, `governance_policies`, `governance_events`, `governance_evidence`, `governance_ingest_keys`, `runtime_events` (partitioniert bis 202702) | wiederverwenden |
| Policy Engine | **vorhanden** | `policy_pack_catalog` (7), `policy_pack_controls` (196), `policy_pack_activations`, `framework_controls` (219) | wiederverwenden |
| Evidence Vault | **vorhanden** | `evidence_snapshots` (prev_hash-verkettet), `evidence_legal_holds`, `governance_evidence` | wiederverwenden |
| Risk Engine | **vorhanden** | `governance_risk_thresholds` (5), `asset_risk_history`, `governance_risk_links`, `ai_act_risk_inventory` | wiederverwenden |
| Audit | **vorhanden** | `audit_logs`, `audit_events`, `audit_jobs`, `audit_reports`, `audit_exports`, `audit_determinism_tests` | wiederverwenden |
| Provenance / C2PA | **vorhanden** | `provenance_manifests`, `provenance_custody_events` (append-only Trigger), `c2pa_provenance_log`, `signing_keys` | wiederverwenden |
| SiteOS Blueprint | **vorhanden** | `siteos_blueprints` (append-only, prev_hash), `packages/siteos-core` | wiederverwenden |
| SiteOS Runtime Scan / Scores | **vorhanden** | `siteos_runtime_scans`, `siteos_scores`, Handler `runtime-scan.ts` | wiederverwenden |
| SiteOS Discovery | **vorhanden** | Handler `discover.ts`, Route `/discover` | wiederverwenden |
| SiteOS Agenten | **vorhanden** | `siteos_agent_runs`, Handler `agents.ts` | wiederverwenden |
| Preview | **vorhanden** | `DashboardPreviewPage`, `PreviewSelectionPage`, echte Render-Kette aus `siteos-core` | wiederverwenden |
| **Publishing** | **fehlt** | `supabase/functions/siteos/handlers/` enthält nur `agents`, `builder`, `discover`, `runtime-scan` — **kein Publish-Handler** | Phase 8 |
| **Publish Gate** | **fehlt** | `docs/architecture/target-architecture.md` §7 beschreibt ihn normativ; Zeile 786 führt ihn selbst als „nicht vorhanden" | **vor** Phase 8 |
| Website-Registry / Deployment | **teilweise** | `websites`, `website_projects`, `website_domains`, `deployment_logs`, `website_rebuilds` — alle mit 0 Zeilen, also nie produktiv gelaufen | prüfen vor Wiederverwendung |
| Stripe | **vorhanden** | `stripe-checkout`, `stripe-webhook`, `stripe-portal`, `stripe-meter-sync`; `products` (22), `stripe_invoices`, `webhook_events` (4) | wiederverwenden |
| **Module Entitlements** | **vorhanden — reicher als angenommen** | `entitlements` (63: 43 boolean + 20 limit), `product_entitlements` (350), `entitlement_grants`, `subscription_addons`, `metered_subscription_items` | **wiederverwenden, nicht neu bauen** |
| Pricing Engine | **vorhanden** | `shared/pricing.ts` als SSoT + Deno-Zwilling + Drift-Test; `plan_catalog` (7), `plan_addons` (6) gespiegelt | wiederverwenden |
| Usage / Metering | **vorhanden** | `usage_events`, `usage_totals`, `usage_limits_config` (14), `usage_meter_sync`, `tenant_cost_ledger`, `tenant_cost_caps` | wiederverwenden |
| Chatbot | **teilweise** | `bots` (Kanal, Persona, `capabilities` jsonb), `bot_conversations`, `bot_messages`, Edge Function `bot-chat` — aber **keine** Terminlogik | erweitern |
| Voice | **teilweise** | `voice_channels`, `bot-voice-webhook`, Entitlement `bots.voice`, Limit `limit.bot_voice_minutes_monthly` | erweitern |
| **WhatsApp** | **fehlt** | keine Tabelle, keine Edge Function; nur Telegram (`telegram_connections`, `telegram-webhook`) | Phase 10+ |
| **Booking Engine** | **teilweise — und falsch verankert** | siehe §2 | Phase 9 |
| Dashboard | **vorhanden** | 468 Routen in `src/App.tsx`, `GovernanceBrowserShell`, zahlreiche `/app/*`-Views | reorganisieren, nicht neu bauen |
| Onboarding | **teilweise** | `/unified-entry/onboarding`, `customer_onboarding`, `tenant_activation`, `save-company-profile` | erweitern |
| Multi-Domain | **teilweise** | `monitored_domains`, `website_domains`, Limit `limit.domains` vorhanden — aber kein UI-Pfad zum Hinzufügen | erweitern |
| Tenant Isolation | **vorhanden** | RLS auf **allen** 280+ `public`-Tabellen aktiviert (`rls_enabled: true` durchgängig) | wiederverwenden |
| Design-Token-Ebene | **vorhanden** | `packages/siteos-core/src/render/theme.ts`: `sanitizeTheme`, `safeColor`, `renderThemeCss`, `meetsWcagAA` | Design Intelligence schreibt **hierhin** |
| **Bildanalyse / Vision** | **fehlt** | keine Vision-Aufrufe, keine Paletten-Extraktion im Repository | Teil A |
| **Asset-Upload für Design** | **fehlt** | einziger Storage-Bucket ist `documents` | Teil A |
| Verschlüsselte Secret-Ablage | **vorhanden** | Supabase Vault (`vault.decrypted_secrets`, `app_secret_rpc`) | wiederverwenden |
| Integrations-Registry | **vorhanden** | `integrations` (5), `integration_configs`, `integration_connectors`, `IntegrationMarketplaceView` | erweitern |
| **Geführte Integration / Verbindungstest** | **fehlt** | keine Anleitung, kein Test, kein Zustand je Integration | Teil B |
| Deployment | **vorhanden** | Cloudflare Pages via `wrangler.toml` + GitHub Actions, `npm run build:full` mit Prerender | unverändert |

---

## 2. Der wichtigste Befund: die Booking-Ebene

Der Master-Prompt fordert (§12–§16), dass Chat, Voice und WhatsApp **eine
gemeinsame** Booking Engine befragen und der Bot niemals eigene Termine
erfindet. Der gemessene Zustand:

**Was existiert:**

- `availability_rules(tenant_id, bot_id, weekday, start_time, end_time,
  slot_minutes, service_type, is_active)` — deckt sogar bereits die
  **variable Termindauer je Zeitfenster** aus §13 ab.
- `appointments(tenant_id, bot_id, conversation_id, service_type, starts_at,
  ends_at, customer_name, status, …)`
- `bot_appointments` — eine **zweite** Terminspur.
- Edge Function `appointment-book`.

**Was das Problem ist — drei Befunde, jeder einzeln belegt:**

1. **`availability_rules` wird nirgends gelesen.** `appointment-book`
   referenziert die Tabelle nicht; `bot-chat` und `bot-voice-webhook`
   enthalten überhaupt keine Terminlogik. Es gibt im gesamten Repository
   **keine Slot-Berechnung**.
2. **`appointment-book` prüft keine Verfügbarkeit.** Die Funktion nimmt jedes
   `requested_at` entgegen, das ISO-8601 ist, prüft nur
   `capabilities.appointments` und schreibt nach `bot_appointments`. Keine
   Kollisionsprüfung, keine Kapazität, keine Öffnungszeiten. Genau der
   Zustand, den §14 verhindern soll — heute *muss* der Bot den Termin
   erfinden, weil ihn niemand fragen kann.
3. **Die Verfügbarkeit hängt am Bot, nicht am Unternehmen.**
   `availability_rules.bot_id` und `appointments.bot_id` binden Termine an
   einen einzelnen Bot. Wer Chat und Voice betreibt, pflegt zwangsläufig zwei
   Regelsätze — die „drei Terminlogiken", die §11 ausdrücklich ausschliesst.

**Was fehlt**: Location, Employee/Resource, Service (als Entität statt
`service_type`-Text), Break, Holiday, Vacation, BookingRule (Vorlauf,
Puffer, parallele Termine).

**Folgerung**: Die Booking Engine wird nicht auf `bot_id` gebaut, sondern auf
Company/Location. `availability_rules` und `appointments` bekommen einen
Bezug zur Business-Ebene; `bot_appointments` und `appointments` werden zu
**einer** Spur zusammengeführt. Das ist eine Migration mit Datenbestand 0 in
beiden Tabellen — also jetzt billig und später teuer.

---

## 3. Korrektur eines eigenen Fehlers

Ein früherer Entwurf dieses Umbaus (`docs/product/modular-product-experience.md`,
§4) schlug eine neue Tabelle `tenant_modules` für aktive Module vor.

**Das war falsch.** Die Messung zeigt eine bereits vollständige
Entitlement-Ebene:

```
products (22) ──< product_entitlements (350) >── entitlements (63)
                                                   ├─ 43 boolean  (bots.enabled, bots.voice, api.access, …)
                                                   └─ 20 limit    (limit.domains, limit.bots, limit.bot_voice_minutes_monthly, …)

subscriptions (4)  ─┐
entitlement_grants ─┴─→ tenant_entitlements()
```

Eine `tenant_modules`-Tabelle wäre eine zweite Wahrheit neben dieser Kette —
genau der Fehler, den §7 des Master-Prompts („Die Datenbank darf nicht
versuchen, Stripe zu ersetzen") vermeiden will, nur eine Ebene tiefer.

**Richtiger Weg**: Jedes buchbare Modul wird zu einer Zeile in `products`
(mit `stripe_price_id`) plus den zugehörigen `product_entitlements`. Fehlende
Entitlement-Schlüssel werden ergänzt — nach heutigem Stand mindestens:
`booking.enabled`, `whatsapp.enabled`, `frontend.builder`,
`limit.booking_appointments_monthly`, `limit.whatsapp_conversations_monthly`.
Keine neue Tabelle.

---

## 4. Was Phase 1 bereits verändert hat

Auf `claude/intelligent-bohr-9372fg`, rein additiv, nichts Bestehendes
ersetzt oder umgeschrieben:

- `shared/pricing.ts`: `ProductTrack` (`keep_frontend` | `modernize_frontend`),
  `BOOKABLE_MODULES` (9 Verkaufseinheiten), `modulesForTrack()`,
  `monthlyBaseTotalEur()`, `hasUsageBasedModules()`,
  `normalizeModuleSelection()`. Deno-Zwilling nachgezogen, Drift-Test grün.
- `src/unified-entry/pages/PathChoicePage.tsx` + Route
  `/unified-entry/entscheidung`: die Weiche „behalten vs. modernisieren",
  beide Wege gleichwertig.
- `src/unified-entry/productTrack.ts`: Pfad-Persistenz über `sessionStorage`
  und Query-Parameter, mit Prüfung jeder Eingabe.
- Vorschauseite: **ergänzter** Ausgang „Bestehende Website behalten → nur
  Governance" (§10.2 des `CLAUDE.md` erlaubt Ergänzungen ohne Rückfrage).
- Tests: `test/config/bookable-modules.test.ts` (16),
  `test/unified-entry/product-track.test.ts` (12).

Zwei Produktregeln sind als Test festgenagelt, nicht nur als Kommentar:
Ohne Frontend-Umbau entfällt **genau ein** Modul (`ai_frontend`), und jedes
Modul mit echten Drittkosten ist als `flat_plus_usage` gekennzeichnet.

Die Preise stehen als `MODULE_PRICING_STATUS = 'provisional'` — Testwerte,
keine Kalkulation.

---

## 5. Offene Entscheidungen

1. ~~**Einstiegsseite des Trichters.**~~ **Erledigt am 2026-08-23.** Die
   Freigabe liegt vor (`CLAUDE.md` §10, „CTA-Hierarchie der Startseite auf
   den Scan-Trichter"). Gelöst wurde es anders als hier vermutet: nicht durch
   Umbau von `/unified-entry/scan`, sondern durch einen eigenen öffentlichen
   Trichter `/scan` → `/scan/ergebnis` → Registrierung. `/unified-entry/scan`
   und die Weiche bleiben unverändert bestehen — sie sind nur nicht mehr das,
   was die Startseite bewirbt. Siehe `docs/product/public-scan-funnel.md`.
2. **Modulpreise.** Rückwärts aus Telefonie-, LLM-, WhatsApp-, Scan- und
   Speicherkosten kalkulieren. Voice und WhatsApp haben derzeit **zwei**
   Preise (Add-on 150 €/99 € vs. Modul 99 €/39 €); die Abweichung ist in
   `MODULE_ADDON_PRICE_DIVERGENCE` deklariert und getestet, aber nicht gelöst.
3. **`organizations` vs. `tenants`.** Zwei Begriffe für dieselbe Ebene. Vor
   Multi-Company klären, welcher führt.
4. **Supabase-Plan `free`.** Kein Backup, kein PITR, kein SLA — bei einem
   Produkt mit Prüfpfad und Evidence-Hash-Ketten ein eigener
   Governance-Befund, unabhängig vom Umbau.

---

## 6. Reihenfolge

| # | Phase | Vorbedingung |
|---|---|---|
| 0 | Reality Matrix | **erledigt** |
| 1 | Modulkatalog + Weiche | **erledigt** (additiv) |
| 2 | Free-Scan-Flow auf die Weiche ausrichten | Freigabe §5.1 |
| 3 | Registrierung: Pfad + Scan-Ergebnis dem Tenant zuordnen | — |
| 4 | Modul-Auswahl-UI auf `BOOKABLE_MODULES` | Preise §5.2 |
| 5 | Module als `products` + `product_entitlements` + Stripe-Prices | Phase 4 |
| 6 | Dashboard-Navigation | — |
| 7 | Feature Gating über `tenant_entitlements()` | Phase 5 |
| 8 | **Publish Gate**, danach SiteOS-Publish | Gate zuerst |
| 8a | Asset Intake + Guided Integration (Teil A/B) | — |
| 8b | Vision Analysis → `sanitizeTheme()`, Design-Chat | 8a |
| 9 | Booking Engine auf Company-Ebene (§2) | — |
| 10 | Chat an die Booking Engine | Phase 9 |
| 11 | Voice an dieselbe Engine | Phase 9 |
| 12 | Bots/Websites als Governance-Assets | — |
| 13 | Multi-Company | §5.3 geklärt |
| 14 | Testing | laufend |
