# Production E2E Reality Audit — 2026-09-06

**Methode**: Gemessen, nicht hergeleitet. Repo-Stand `main` @ `dce3278` (Merge PR #1135),
Arbeitsbranch `claude/production-e2e-audit-kzku7k`. Produktionsbelege per Management-API
und SQL gegen das Live-Projekt `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`,
eu-central-1, PostgreSQL 17.6.1.104, `ACTIVE_HEALTHY`). HTTP-Proben ohne Token gegen
`realsyncdynamicsai.de` und `…supabase.co/functions/v1`.

**Statusvokabular**: LIVE · PARTIAL · PROTOTYPE · PLANNED · UNKNOWN · CLAIM BLOCKED.
Code vorhanden ≠ LIVE. Migration vorhanden ≠ angewendet. Tabelle vorhanden ≠ benutzt.

---

## 0. Der eine Satz

Die Plattform ist **gebaut und ausgerollt**, aber die Wertschöpfungskette hinter dem
kostenlosen Scan ist **in Produktion noch nie gelaufen** — kein einziges Mal.

Repo und Produktion sind deckungsgleich, RLS ist lückenlos, alle Auth-Gates greifen.
Was fehlt, ist nicht Code, sondern ein einziger vollständig gegangener Kundenweg.

---

## 1. Architektur

**STATUS**: LIVE
**EVIDENCE**: `vite.config.ts`, `wrangler.toml` (`pages_build_output_dir = "dist"`),
React 19 / TS strict / react-router-dom. Kein Next.js, kein `app/`, kein Vercel.
**PRODUCTION EVIDENCE**: `https://realsyncdynamicsai.de/` · `/audit` · `/pricing` → alle **HTTP 200**.
**GAP**: keiner.
**PRIORITY**: —

### Repo ↔ Produktion, in beide Richtungen verglichen

| | Repo (`main`) | Produktion | Lücke |
|---|---|---|---|
| Edge Functions | 188 (+ `_shared`) | **188** aktiv | **0** |
| Migrationen | 326 Dateien | **326** verbucht (neueste `20260906100000`) | **0** |
| Tabellen in `public` | — | 368 | — |
| davon mit RLS | — | **368 / 368** | **0** |

`comm -23` und `comm -13` sind bei Functions **und** Migrationen **beide leer**.
Keine doppelte Versionsnummer im Repo. Zahlengleichheit war dabei nicht der Beleg —
der Mengenvergleich war es (Lehre aus der Messung vom 2026-08-30).

> **CLAUDE.md §2 und §7 sind an dieser Stelle veraltet.** Dort stehen sechs Functions
> und neun Migrationen als „warten auf den nächsten Deploy". Der Lauf ist inzwischen
> erfolgt: `governance-decide`, `governance-access`, `integration-credentials`,
> `evidence-anchor`, `microsoft365-connect`, `microsoft365-audit-sync` sind live,
> ebenso alle neun Migrationen bis `20260906100000_pdp_shadow_readiness`.
> Das ist genau der in CLAUDE.md beschriebene Alterungseffekt: Die Ledger-Messung
> altert mit jedem Merge, die Tree-Messung nicht.

---

## 2. Onboarding

**STATUS**: PARTIAL (Code LIVE, Nutzung **null**)
**CODE LOCATION**: `src/unified-entry/pages/PostRegisterOnboardingPage.tsx`,
`src/core/onboarding/` (questionEngine, recommendationEngine, canonicalRecommendation,
nextBestAction, findingClassifier, funnelContext), `src/pages/Welcome.tsx`,
`supabase/functions/onboarding-orchestrator`.
**PRODUCTION EVIDENCE**: `customer_onboarding` = **0 Zeilen**. `company_profiles` = **0 Zeilen**.
**GAP**: Der Onboarding-Pfad ist vollständig implementiert und deployt, aber **kein
einziger Nutzer hat ihn je durchlaufen**. Die Tabellen, in denen Firmenprofil, Branche
und Governance-Ziel landen sollen, sind leer. Damit ist die Template-Empfehlung
(Schritt 4 des Auftrags) in Produktion unbelegt — sie hat nie Eingabedaten gesehen.
**PRIORITY**: **P0**

---

## 3. Stripe

**STATUS**: PARTIAL (Implementierung stark, Produktionsnachweis schwach)
**CODE LOCATION**: `supabase/functions/stripe-webhook/index.ts` (1013 Zeilen),
`stripe-checkout` (271), `stripe-checkout-verify`, `stripe-portal`, `subscription-addons`,
`stripe-meter-sync`.
**EVIDENCE — und die ist besser als erwartet**:
- Signaturprüfung: `constructEventAsync(raw, sig, WEBHOOK_SECRET)`, Secret aus Vault (`getSecret`)
- Idempotenz: Insert mit `ON CONFLICT DO NOTHING`, **mit Rollback der Idempotenz-Zeile**,
  wenn der Handler wirft — Stripe kann dann sauber wiederholen
- **11 Events** behandelt, mehr als die im Auftrag geforderten sechs:
  `checkout.session.completed`, `customer.subscription.created/updated/deleted/trial_will_end`,
  `invoice.created/finalized/paid/payment_failed`, `charge.failed/refunded`
**PRODUCTION EVIDENCE**: 6 Zeilen in `subscriptions`, davon **genau eine** mit echter
`stripe_subscription_id` — Plan `growth`, Status **`past_due`**. Die übrigen fünf sind
Free-Pläne ohne Stripe-Abo. HTTP-Probe: `stripe-checkout` → **401** ohne Token.
**GAP**: Der bezahlte Pfad wurde in Produktion **einmal** beschritten und steht auf
`past_due`. Es gibt keinen automatisierten E2E-Beleg: der einzige Stripe-E2E-Test
(`e2e/landing-signup-checkout.spec.ts:215`) ist `test.skip`, solange `STRIPE_TEST_MODE`
nicht gesetzt ist — in CI also faktisch immer.
**PRIORITY**: **P0**

---

## 4. Entitlements

**STATUS**: LIVE (Auflösung funktioniert)
**CODE LOCATION**: `public.tenant_entitlements(uuid)` (SECURITY DEFINER),
`shared/pricing.ts`, `src/core/access/featureAccess.ts` (150 Zeilen),
`src/core/billing/entitlements.ts`, `RouteEntitlementGate`.
**PRODUCTION EVIDENCE**: Katalog gefüllt — 29 `products`, 70 `entitlements`,
630 `product_entitlements`, 6 `plan_addons`. Auflösung direkt nachgerechnet:

| plan_key | Produkt gefunden über | aufgelöste Entitlements |
|---|---|---|
| `growth` | `stripe_price_id` **und** `default_for_plan_key` | **46** |
| `free_audit` | `default_for_plan_key` | 9 |
| `free_tier` | `default_for_plan_key` | 9 |

Die Grace-Period-Logik ist ausdrücklich zugunsten des Kunden gebaut: `past_due` mit
`past_due_since IS NULL` gilt als „innerhalb" — eine fehlende Information sperrt niemanden aus.

> **Eine Fehldiagnose im Verlauf dieses Audits, festgehalten weil sie lehrreich ist**:
> `select count(*) from tenant_entitlements(...)` lieferte für **alle sechs** Tenants 0.
> Das sah nach totem Revenue-Pfad aus. Es war ein Artefakt des Aufrufkontexts:
> Die Funktion endet auf `CROSS JOIN authorized a WHERE a.ok`, und `authorized` verlangt
> `auth.role() = 'service_role'` oder Mitgliedschaft von `auth.uid()`. Eine SQL-Sitzung
> ohne JWT ist beides nicht. Dasselbe galt für `pdp_shadow_readiness()`, das an
> `is_tenant_member(NULL)` leer zurückkam. **Regel**: Bei `SECURITY DEFINER` mit
> eigenem Autorisierungs-Gate misst ein Leerergebnis zuerst den eigenen Aufruf,
> nicht das System.

**GAP** (klein, aber benennenswert): Zwei Produkte decken denselben Plan ab —
`free_audit` (`f8a406d3…`) und `free_tier` (`a0ecb8b6…`), beide mit 9 Entitlements.
`shared/pricing.ts:2241` führt `free_tier: 'free_audit'` als Alias; die Datenbank
löst den Alias dagegen über ein **eigenes zweites Produkt** auf. Das funktioniert
heute, ist aber zwei Quellen für eine Aussage — genau das Muster, das §6 („Single
Source of Truth") ausschließt. Zwei Tenants (2026-08-30, 2026-09-01) tragen `free_tier`.
**PRIORITY**: P1

---

## 5. Dashboard

**STATUS**: PARTIAL
**CODE LOCATION**: `src/features/`, `GovernanceBrowserShell`, `RouteEntitlementGate`,
`src/core/access/featureAccess.ts`.
**PRODUCTION EVIDENCE**: 6 `tenants`, **1** `profiles`. `governance_assets` = 1.
**GAP**: Das Dashboard hat in Produktion praktisch keine Daten, aus denen es etwas
zeigen könnte. Ein neuer Kunde landet damit auf genau der leeren Fläche, die der
Auftrag (§7 Schritt 7) ausschließt — nicht wegen fehlender Widgets, sondern weil
Discovery, Evidence und Findings nie liefen (siehe §7).
**PRIORITY**: **P0** (abhängig von §2 und §7)

---

## 6. Connectors

**STATUS**: PROTOTYPE
**CODE LOCATION**: `supabase/functions/microsoft365-connect`, `microsoft365-audit-sync`,
`supabase/migrations/20260904100000_connector_registry.sql`, `20260905100000_microsoft365_connector.sql`.
**PRODUCTION EVIDENCE**: Beide Functions deployt, `microsoft365-connect` → **401** ohne Token.
Tabellen existieren. Aber: `connector_registry` = **0 Zeilen**, `m365_connections` = **0 Zeilen**.
**GAP**: Die Registry ist **leer**. Sie trägt laut Migration die `enforcement_class`
je Quelle (`connector_registry_derive_class_trg`) — ohne Eintrag gibt es für Microsoft 365
keine hinterlegte Klasse, an der `M365_PDP_ENFORCEMENT` sich ausrichten könnte.
Kein Mandant hat je verbunden. Der Auftrag verlangt **einen** belastbaren Connector
statt zehn halbe; heute ist es einer, der noch nie eine echte Verbindung gesehen hat.
**PRIORITY**: **P1**

---

## 7. Governance, Evidence, Prüfpfad

**STATUS**: PARTIAL (Code LIVE, Laufzeit **null**)
**CODE LOCATION**: `supabase/functions/governance-decide`, `governance-access`,
`evidence-anchor`, `_shared/pdp/`, `packages/evidence-chain`, `supabase/functions/evidence-vault`.
**PRODUCTION EVIDENCE**: alle Functions deployt, alle **401** ohne Token.

| Tabelle | Zeilen |
|---|---|
| `ai_evidence_events` | **0** |
| `evidence_snapshots` | **0** |
| `governance_approvals` | **0** |
| `runtime_events` | **0** |
| `workflow_runs` | **0** |
| `entitlement_grants` | **0** |
| `governance_assets` | 1 |

**GAP**: Das ist der schwerwiegendste Befund dieses Audits. Die Kette
`Discovery → Evidence → Governance → Decision → Approval → Action` ist vollständig
gebaut, vollständig deployt — und **vollständig unbenutzt**. Kein Nachweis, kein
Vorgang, kein Freigabeschritt existiert in Produktion. Ein Produkt, das Prüfpfad
zusagt, hat heute keinen einzigen Prüfpfad-Eintrag eines Kunden.
**PRIORITY**: **P0** (Nachweis der Kette) / **P1** (Ausbau)

---

## 8. Enforcement-Schalter und Shadow-Betrieb

**STATUS**: **CLAIM BLOCKED** — die Umschaltentscheidung ist heute nicht begründbar
**CODE LOCATION**: `_shared/pdp/decide.ts:420` und `governance-ingest/index.ts:609`
schreiben `pdp_shadow_log`. Auswertung: `pdp_shadow_readiness(uuid, timestamptz)`,
`pdp_shadow_known_sources()` — beide in Produktion vorhanden (per `pg_proc` geprüft).
**PRODUCTION EVIDENCE**: **`pdp_shadow_log` = 0 Zeilen — über die gesamte Tabelle,
ohne Mandantenfilter.**
**GAP**: CLAUDE.md verlangt: „Vor dem Umschalten `pdp_shadow_log` auswerten." Es gibt
nichts auszuwerten. Sechs Kanäle sind verdrahtet, **keiner** hat je geschrieben.
Damit gilt: Kein Enforcement-Schalter darf heute von `shadow` auf `enforce` —
nicht weil die Vorgabe konservativ wäre, sondern weil die Datengrundlage der
Entscheidung fehlt. Die Warnung aus CLAUDE.md trifft hier wörtlich zu: Ein leeres
Shadow-Protokoll bedeutet nicht „keine Abweichungen", sondern zuerst „nachsehen,
ob überhaupt geschrieben wird". Genau das ist der Fall — die Ursache ist aber diesmal
nicht ein verschluckter Fehler, sondern schlicht, dass die Pfade nie liefen (§7).
**PRIORITY**: **P1**

---

## 9. Bots und Agent Runtime

**STATUS**: PARTIAL
**CODE LOCATION**: `src/features/bots/`, `_shared/pdp/botmessage.ts` (`enforceBotMessage`),
`apps/agent-runtime`, `services/realsync-runtime-core`, `services/openclaw-agent`.
**EVIDENCE**: Ein gemeinsamer PEP für Chat, WhatsApp und Voice; der Nachrichtentext
verlässt den Prozess bewusst **nicht** (`bot-chat` und `whatsapp-webhook` laufen mit
`verify_jwt = false`). Gesichert durch `test/governance/pdp-botmessage.test.ts` und
`bot-pep-wiring.test.ts`.
**PRODUCTION EVIDENCE**: `runtime_events` = 0, `workflow_runs` = 0.
**GAP**: Kein Agent-/Bot-Lauf in Produktion nachweisbar. Die offene Produktfrage aus
CLAUDE.md bleibt offen: Eine vom PDP gesperrte Bot-Nachricht verbraucht trotzdem eine
Einheit von `limit.bot_messages_monthly`, weil das Kontingent **vor** der Prüfung
gebucht wird. Das gehört entschieden, nicht nebenbei geändert.
**PRIORITY**: P2

---

## 10. SiteOS, App Builder, Publish Gate

**STATUS**: PARTIAL — und besser als der Auftrag annimmt
**CODE LOCATION**: `packages/siteos-core`, `supabase/functions/siteos/handlers/`:
`agents.ts`, `anonymous.ts`, `builder.ts`, `discover.ts`, **`publish-gate.ts`**, `runtime-scan.ts`.
**EVIDENCE**: Der im Auftrag als fehlend vermutete Publish-Handler **existiert**.
`publish-gate.ts` implementiert §7 G1 serverseitig und nimmt vom Client ausdrücklich
nichts entgegen, was dieser behaupten könnte: Das Bündel wird neu gebaut, die Befunde
neu erhoben, der Nachweis **vor** der Bewertung geschrieben. Endpunkte:
`POST /siteos/publish-gate` und `/siteos/publish-approve`.
**PRODUCTION EVIDENCE**: `siteos_blueprints` = 2, `siteos_runtime_scans` = 3,
`siteos_agent_runs` = 5 — Entwicklungsverkehr. `siteos_publish_evaluations` = **0**,
`siteos_anonymous_builds` = **0**.
**GAP**: Der Gate ist gebaut, aber **nie ausgewertet worden**. Publishing als Zusage
ist damit nicht belegt: Es gibt Preview und einen Gate, aber keinen einzigen
durchlaufenen Freigabe- oder Auslieferungsvorgang.
**PRIORITY**: P2

---

## 11. RLS und Mandantentrennung

**STATUS**: LIVE
**PRODUCTION EVIDENCE**: **368 von 368** Tabellen in `public` mit aktivierter RLS,
**keine einzige ohne** (`pg_class.relrowsecurity`, `relkind='r'`).
Alle acht geprüften Edge Functions antworten ohne Token mit **401**:
`governance-decide`, `governance-access`, `integration-credentials`, `evidence-anchor`,
`microsoft365-connect`, `stripe-checkout`, `subscription-addons`, `siteos`.
**GAP**: Keiner auf der Flag-Ebene. Die Wirksamkeit der Policies bleibt davon
unberührt — RLS **aktiviert** ist nicht dasselbe wie RLS **richtig**. Der Nachweis
dafür ist `rls.db.test.ts`, der seit dem 2026-09-06 in CI läuft.
**PRIORITY**: —

---

## 12. Tests

**STATUS**: PARTIAL
**EVIDENCE**: `npm run lint` (`tsc --noEmit`) **grün, Exit 0**, am 2026-09-06 auf
diesem Branch ausgeführt. 361 Testdateien, 38 Playwright-E2E-Spezifikationen, 30+ CI-Workflows
inkl. dreier Drift-Guards und `drift-alert.yml` (legt bei Rot ein Issue an).
Seit dem 2026-09-06 laufen alle 25 DB-Integrationsdateien gegen das volle Schema.
**GAP — die Lücke liegt genau auf dem Revenue-Pfad**:
- Der einzige Stripe-E2E-Test ist übersprungen (`test.skip`, `STRIPE_TEST_MODE`).
- **Kein** E2E-Test prüft die Kette Webhook → Entitlement → Dashboard-Zugriff.
  Die vier Treffer auf „webhook" in `e2e/` betreffen die Webhook-**Verwaltung**
  als Produktfeature, nicht den Stripe-Empfang.
**PRIORITY**: **P0**

---

## 13. Claims Audit

**STATUS**: **CLAIM BLOCKED** in mehreren Fällen

| Behauptung | Vorkommen in `src/` | Bewertung |
|---|---|---|
| „revisionssicher" | **20 Dateien** | **CLAIM BLOCKED** — siehe unten |
| „unveränderlich" | 14 | prüfen, meist im selben Kontext |
| „immutable" | 9 | prüfen |
| „DSGVO-konform" | 46 | überwiegend Produktbeschreibung, einzeln zu prüfen |
| „100 %" | 12 | einzeln zu prüfen |
| „tausende" | 2 | **CLAIM BLOCKED** bei Kunden-/Scan-Zahlen |
| „gerichtsfest" | 0 | — |
| „fully compliant" / „vollständig konform" | 0 | — |

**Der harte Fall**: „revisionssicher" steht an nutzersichtbaren Stellen, u. a.
`ScannerTechStackSection.tsx:56` („Alle Findings signiert, versioniert und
revisionssicher … Reproduzierbar gegenueber Aufsichtsbehoerden auch nach 6+ Monaten"),
`Faq.tsx:256`, `AuditLandingPage.tsx:131`, `LegalPage.tsx:82`.

Dem steht die Messung entgegen: `ai_evidence_events` = 0, `evidence_snapshots` = 0.
Eine Hash-Kette ist ein **Integritätsmechanismus**, keine extern bezeugte
Unveränderbarkeit; RFC3161-Zeitstempelung ist nicht implementiert und bleibt
**PLANNED**. Eine Zusage der Reproduzierbarkeit „gegenüber Aufsichtsbehörden nach
6+ Monaten" ist damit heute nicht gedeckt — es gibt keinen einzigen Nachweis, der
dieses Alter erreichen könnte.

Zusätzlich unverändert offen (aus CLAUDE.md §3, hier bestätigt): `worker/src/persistence.ts`
(`recordScreenshotEvidence`) schreibt nach `audit_evidence` und behandelt den Fehler
als non-fatal — die Tabelle fehlt in Produktion. Der Screenshot-Nachweis **jedes**
Audits geht still verloren. Für ein Produkt mit Prüfpfad-Zusage ist das ein eigener Befund.

**PRIORITY**: **P0** (Rechtsrisiko, unabhängig von Technik)

---

## 14. Gesamtbild

| Bereich | Status | Produktionsbeleg |
|---|---|---|
| Frontend / Deployment | LIVE | HTTP 200 |
| Repo ↔ Prod Deckung | LIVE | 188=188, 326=326, `comm` beidseitig leer |
| RLS | LIVE | 368/368 |
| Auth-Gates | LIVE | 8×401 |
| **Free Scan (Audit)** | **LIVE** | **173 `gdpr_audits`, 21 in 30 Tagen** |
| Entitlement-Auflösung | LIVE | Growth → 46, Free → 9 |
| Stripe Webhook (Code) | LIVE | 11 Events, Signatur, Idempotenz + Rollback |
| Stripe (bezahlter Pfad) | PARTIAL | 1 Abo, `past_due`, kein E2E-Test |
| Onboarding | PARTIAL | 0 / 0 |
| Dashboard-Wert | PARTIAL | 1 Asset |
| Governance / Evidence | PARTIAL | **alles 0** |
| Shadow-Auswertung | CLAIM BLOCKED | **0 Zeilen** |
| Connectors | PROTOTYPE | Registry leer |
| Publish Gate | PARTIAL | Gate gebaut, 0 Auswertungen |
| RFC3161 | PLANNED | nicht implementiert |
| „revisionssicher" | CLAIM BLOCKED | 0 Evidence-Zeilen |

**Der einzige Teil des Produkts, der in Produktion nachweislich Kunden erreicht,
ist der kostenlose Scan.** 173 Audits, davon 21 in den letzten 30 Tagen — der
Trichtereingang funktioniert und wird benutzt. Alles dahinter ist gebaut und
ungegangen.

Das ist eine gute Ausgangslage, nicht eine schlechte: Es fehlt kein Fundament,
es fehlt der erste vollständige Durchgang.

---

## 15. Empfohlene Reihenfolge

**P0 — den einen Weg gehbar machen und beweisen**
1. Onboarding E2E: Registrierung → Tenant → `company_profiles` → Template → erstes Asset
2. Stripe E2E: Checkout → Webhook → `subscriptions` → Entitlement → Dashboard-Zugriff,
   als **automatisierter** Test (den `test.skip` auflösen)
3. Erster Governance-Wert: Discovery → Finding → Evidence, sodass `ai_evidence_events`
   und `evidence_snapshots` erstmals echte Zeilen tragen
4. Claims bereinigen: „revisionssicher" präzisieren oder entfernen (§10.3 Fragepflicht
   — Textänderung an Bestehendem, gehört dem Eigentümer vorgelegt)

**P1 — Wert belastbar machen**
5. `audit_evidence`-Schreibpfad reparieren (stiller Verlust in jedem Audit)
6. Ein Connector (Microsoft 365) vollständig: Registry befüllen → verbinden → Sync → Evidence
7. Approval → Action → Monitoring erstmals durchlaufen
8. `free_tier` / `free_audit` Doppelprodukt auf eine Quelle zurückführen
9. Shadow-Betrieb tatsächlich befüllen, dann `pdp_shadow_readiness` auswerten

**P2 — Plattform ausbauen**
10. Publish Gate erstmals real auswerten · Bot Capability Model · Agent Governance ·
    App-Builder-Anbindung

**Nicht tun, solange P0 offen ist**: Enforcement-Schalter umlegen (Datengrundlage
fehlt, §8), weitere Connectoren beginnen (§6), neue Produktflächen bauen.

---

## 16. Was dieses Audit nicht geprüft hat

Ehrlichkeitshalber benannt, damit niemand mehr hineinliest, als gemessen wurde:

- **Wirksamkeit** der RLS-Policies (nur das Flag wurde gezählt, nicht jede Policy)
- Vollständiger Testlauf (`npm test`, `npm run e2e`) — nur Bestand und Skip-Zustand
  gezählt. `npm run lint` lief und ist grün; `npm run build` wurde nicht ausgeführt.
- Stripe-Preis-IDs gegen das echte Stripe-Konto (Live vs. Test)
- `platform/`-Monorepo (eigener Python-Stack, eigene `pytest`-Lage)
- Inhaltliche Richtigkeit der 173 Audit-Befunde
