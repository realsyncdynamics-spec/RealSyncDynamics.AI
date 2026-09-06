# 04 — RISK / GAP REPORT (Phase 3, Auftrag 1 — Final)

**Auftrag:** `docs/audit/AUFTRAG_1.md` · **Modus:** Read-only · **Datum:** 2026-09-02
**Quellen:** ausschließlich `docs/audit/01_INVENTORY.md` (Reality, gemessen `main@1657e23`) und `docs/audit/02_CLAIMS_REALITY_MATRIX.md` (Claims, erhoben `main@8cb2986`). Referenzen: `A-xx/B-xx/C-xx/D-xx/E-xx/F-xx/G-xx/H-xx/I` = Matrix-Claims, `T-xx` = Inventory-Enforcement-Tabelle, `CHECK-xx` = Produktionsprüfungen.
**Basis-Hinweis:** `main` steht bei Redaktionsschluss 87 Commits über der Claim-Basis. Dieser Report führt die **belegten** Abweichungen der beiden Phasen zusammen (Spec Phase 3); er misst nicht neu. Jeder Befund trägt seine Quellen-Referenz — wer einen Einzelbefund gegen den heutigen Stand prüfen will, findet dort Datei:Zeile.

Kategorien gemäß Spec: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW` · `UNKNOWN`.
Einstufungslogik: CRITICAL = widerlegte Kernzusage mit Rechts- oder unbegrenztem Kostenrisiko auf einer Kauf-/Datenschutzstrecke; HIGH = verkaufte Leistung ohne Wirkung, kaufentscheidungsrelevante Fehldarstellung oder bindende Zusage ohne Absicherung; MEDIUM = interne Widersprüche und strukturelle Schulden mit Außenwirkung; LOW = Kosmetik/Untertreibung; UNKNOWN = nur in Produktion feststellbar (Abschnitt „Production Unknowns").

---

## A. Unsupported & Contradicted Claims (Produkt/Runtime)

| Sev. | Befund | Belege |
|---|---|---|
| **CRITICAL** | **„EU-region-pinned Endpoints (Anthropic EU, OpenAI EU-Tenant, Google Vertex eu-central)" ist im Repo widerlegt**: Adapter-Defaults sind US-Endpoints, Vertex-Code existiert nicht, die eigene Subprozessorenliste sagt „USA (mit SCCs)". Eine Datenschutz-Kernzusage auf FAQ, Trust- und Security-Seite steht gegen den eigenen Code UND den eigenen Rechtstext | A-10 · Inv. A.9 · CHECK-10 |
| **HIGH** | **„RFC-3161 timestamped" an drei Stellen behauptet, nirgends implementiert** (0 Treffer über den gesamten Code); ebenso keine externe Chain-Verankerung | A-06 · Inv. A.7/A.8 |
| **HIGH** | **„SHA-256 + Ed25519" für den Evidence Vault**: Vault signiert nur HMAC; Ed25519 existiert allein im Provenance-Modul | A-05 · Inv. A.7 |
| **HIGH** | **Claude-Code-Optimizer verspricht Repository-Prüfung + Merge-Evidence** — im Inventory existiert keine solche Pipeline; real ist eine Template-Regel-Engine (die `/pricing`-FAQ beschreibt das selbst korrekt) | A-16 |
| **HIGH** | **„aufsichtskonform" / „VAIT-konforme IT-Governance, BaFin-Audit-Trail"** für Banken/Versicherer — es existiert kein VAIT/BAIT/MaRisk-Policy-Pack (Seed umfasst genau sechs Frameworks) | H-08 · Inv. A.6 |
| **MEDIUM** | „Audit-Export als **PDF**" / „signiertes PDF": Server liefert print-optimiertes HTML, echtes PDF laut Code-Kommentar auf „Phase 2" vertagt | A-08 · Inv. A.7 |
| **MEDIUM** | „**C2PA Content Credentials**": Ed25519-Custody real, aber kein C2PA-Claim-Format (kein JUMBF/CBOR); FAQ formuliert korrekt „C2PA-angelehnt", Capability-Karte nicht | A-09 · Inv. A.7 |
| **MEDIUM** | „Tägliches/kontinuierliches Monitoring": Cron-Registrierung im Repo belegt, `agent-os-runner` jedoch ohne Cron; Betriebszustand offen | A-03 · Inv. A.15/A.16 · CHECK-03/-05 |
| **MEDIUM** | Scanner-Standort „Frankfurt (**Hetzner**)" auf zwei Seiten vs. **Hostinger** in der AVV-Liste — Hetzner steht in keiner Subprozessorenliste | Matrix Sektion I · H-Umfeld |
| **MEDIUM** | „500 Mandanten ohne Cross-Tenant-Leakage" — RLS trägt das Muster, aber kein Plan trägt 500 Mandanten (Maximum 50) | A-13 |
| **LOW** | Landing untertreibt: „beantworten kann er noch nichts" — die Bot-Functions sind im Repo vollständig und in der Produktions-Registry gelistet (UNDERMARKETED/OUTDATED) | A-18 · CHECK-01 |

## B. Fehlendes Enforcement & Kostenrisiken (Kern des Audits)

| Sev. | Befund | Belege |
|---|---|---|
| **CRITICAL** | **Telegram-Kanal völlig ungedeckelt**: kein Feature-Gate, kein `consumeUsage`, dazu fail-open ohne gesetztes Webhook-Secret — der einzige Kanal, der unbegrenzte AI-Kosten erzeugen kann, und zwar potenziell für jedermann | B-02 · T-04 · Inv. A.14 · CHECK-09 |
| **CRITICAL** | **Von 12 verkauften SSoT-Limit-Typen sind 7 reine Anzeige** (Bots-Anzahl, Mandanten, Speicher, Seats, Audit-Berichte, Domains, Behebungspläne, API-Schlüssel); **genau ein** Mengen-Limit im ganzen System erreicht Spec-HARD (LLM-Query-Quota) | B-01, B-03, B-05, B-07, B-08, B-09, B-11 · T-01/07/08/09/16/17/18/19, T-14 · Inv. Querbefund C-1/2 |
| **HIGH** | **API-Limits: verkauft 50.000–1 Mio./Monat, erzwungen werden hartcodierte Fremdwerte** (agency: 1.000/Monat — Faktor 50 darunter; Legacy-Key `scale`; ApiDocs nennt zusätzlich Minuten-Limits, die es nicht gibt) | B-06 · A-14 · T-06 |
| **HIGH** | **Seats-Enforcement existiert nicht, wird aber in einer Migration als existent behauptet** („checked at invitation time"); `requireQuota` ist toter Code | B-05 · T-09 · Inv. A.17 |
| **HIGH** | Scan-/Report-Limits nur clientseitig (umgehbar); WhatsApp fail-open ohne APP_SECRET | T-16 · B-15-Umfeld · Inv. A.14 · CHECK-09 |
| **HIGH** | **Enforcement-Fundament ungetestet in CI**: `consumeUsage`/`gateFeature` ohne Unit-Test; RLS-, Hash-Chain-, Grant- und Cost-Cap-DB-Tests werden mangels `TEST_DB_URL` still übersprungen; 38 von 47 E2E-Specs und `check:pricing` laufen in keinem Workflow | Inv. A.2/A.8/A.17/A.24/A.26/A.27, Querbefund 5 |
| **MEDIUM** | Agent-Runs: gemessen und abgerechnet (metered), aber nie geblockt — auch free mit Kontingent 0; Voice-Minuten nur gezählt | T-12 · T-05 |
| **MEDIUM** | Race-Condition im Usage-Check dokumentierter Ist-Zustand; Statuscodes bei Überschreitung inkonsistent (402/429/403); Token-Doppelzählung in `ai-invoke` | Inv. A.17/A.24, Querbefund 3-4 · A-Matrix A.9 |
| **MEDIUM** | Zwei entkoppelte Limit-Achsen (SSoT `plan.limits` vs. DB `limit.*`) ohne Kopplungstest, mit Wert-Divergenzen (z. B. Seats starter 1 vs. 3) | Inv. A.17 · Matrix-Kopf |

## C. Pricing-Widersprüche & Darstellung

| Sev. | Befund | Belege |
|---|---|---|
| **HIGH** | **Vergleichstabelle zählt Bullet-Strings statt Leistungen — Enterprise (1.249 €) zeigt in 3 von 4 Zeilen kleinere Zahlen als Growth (249 €)**; Enterprise-Karten/Teaser beginnen mit „Alles aus Agency" (Verweis auf einen Legacy-Plan), die Enterprise-Differenzierungsgruppe fehlt in der Kartenansicht | B-§7 |
| **HIGH** | **WhatsApp-Preisseite komplett außerhalb der SSoT**: eigene Preise/Limits/SLAs, „Alle Tiers beinhalten WhatsApp" (SSoT: Starter nur per Add-on), nicht existentes Add-on „Analytics Pro", Checkout-CTA auf den Legacy-Plan Agency | B-15 |
| **MEDIUM** | Legacy-Pläne Agency/Partner werden in JSON-LD, SEO-Descriptions, FAQ und PersonaCards weiter beworben/verkauft | B-16 |
| **MEDIUM** | Interne Zahlen-Widersprüche: Partner „Unbegrenzte API-Nutzung" (SSoT: 1 Mio.), Enterprise „unbegrenzte Mandanten" (SSoT: 5), Agency 10.000 Antworten (SSoT: 25.000) | B-12, B-13, B-14 |
| **MEDIUM** | Preis-Hartcodierung an >10 Stellen gegen die eigene SSoT-Regel; `check:pricing` nicht in CI — Drift strukturell vorprogrammiert | E-07 · Inv. A.22 |

## D. SLA-Widersprüche & operative Zusagen

| Sev. | Befund | Belege |
|---|---|---|
| **HIGH** | **„SLA 4 h"-Badge und „Zugesicherte Reaktion"** ohne jede Mess-/Vertragsgrundlage im Repo; AGB machen SLA von einem „ausdrücklich vereinbarten SLA-Anhang" abhängig — Badge und AGB widersprechen sich | D-01 · D-02 |
| **HIGH** | **8h-/4h-„Garantie" in der Pricing-FAQ gilt einem Legacy-Plan** und steht live; WhatsApp-Seite verspricht „SLA 99,5 % Verfügbarkeit", während `/api-docs` und `compliance-notices` ehrlich „kein vertraglicher SLO / Best Effort" sagen | D-03 · D-08 · D-07 |
| **HIGH** | **AVV-Muster bindet vertraglich „RTO: 24 Stunden" und 24h-Meldung** — auf Infrastruktur, deren Backup-/PITR-Fähigkeit nicht belegt ist (Free-Tier-Befund) | D-11 · CHECK-02 |
| **UNKNOWN** | Alle übrigen Zeitzusagen (15 min Zugang, 24 h Onboarding/Antwort, 72 h Security, 5 Werktage Tiefenscan, „90 Sekunden", „14 Tage live") — operativ, aus dem Repo nicht verifizierbar; untereinander uneinheitlich | D-04…D-06, D-09, D-10, D-12 |

## E. Trial, Preisrecht, Vertragstexte

| Sev. | Befund | Belege |
|---|---|---|
| **CRITICAL** | **USt-Widerspruch auf der Kaufstrecke**: Preisseite „Alle Preise zzgl. gesetzlicher Umsatzsteuer" vs. AGB/Impressum „Kleinunternehmer §19 UStG, keine USt" — beides gleichzeitig kann nicht stimmen | E-03 |
| **HIGH** | **14-Tage-Trial beworben und technisch sauber implementiert, aber in AGB und Widerrufsbelehrung mit keinem Wort geregelt**; Erlöschensklausel kollidiert ungelöst mit sofortigem Trial-Zugang; zweiter, abweichender Trial-Pfad (Growth-only, hartcodiert) besteht parallel | E-01 · E-04 · Inv. A.18 |
| **MEDIUM** | „Keine Kreditkarte erforderlich" (WhatsApp-Seite) widerspricht dem Stripe-Checkout-Trial; „90 Tage Daten exportierbar" ohne Beleg | E-02 · E-05 |

## F. Legal Routes & Locale

| Sev. | Befund | Belege |
|---|---|---|
| **HIGH** | **Öffentlich erreichbare Duplikat-Rechtsseiten mit Widersprüchen** (`/os/impressum`, `/os/datenschutz`): Platzhalter-Adressen, andere E-Mail, Handelsregister-Behauptung gegen „nicht eingetragen", „keine Drittlandübermittlung" gegen die Datenschutzerklärung | F-01 |
| **MEDIUM** | Aliase ohne 301 (nur JS-Canonical, entgegen der eigenen `_redirects`-Regel); Canonical-Lücken (u. a. alle drei Widerrufs-Routen); Sitemap listet Alias-Paare, aber keinen Widerruf; Landing-Footer ohne AGB-/Widerrufs-Link; ~30 Seiten verlinken Alias- statt Canonical-Pfade | F-02…F-05 |
| **MEDIUM** | **Locale**: Kostenkalkulator auf `/pricing` rendert bei EN-Browser „10,200 €" (live bestätigt — das Spec-Beispiel); `en-US` in RuntimeMetric; „4,128"/„1,248"/„8,240€" hartcodiert; €-Zeichen-Konvention uneinheitlich | G-01…G-05 |

## G. Compliance-Claims & Subprozessoren

| Sev. | Befund | Belege |
|---|---|---|
| **CRITICAL** | **Subprozessoren-/Hosting-Transparenz (Art.-28-Umfeld)**: Die AVV-Liste nennt **GitHub Pages** als Frontend-Host — ausgeliefert wird über **Cloudflare Pages**; Cloudflare (inkl. neuem Worker mit **D1-Datenbank**) fehlt in jeder Datenschutz-Seite; parallel existiert eine zweite, abweichende 5er-Liste auf `/trust`; dynamische Provider-Konfiguration (DB `ai_tools`) kann jede statische Liste überholen. Nicht rechtlich abschließend bewertet — als Befund markiert | Matrix Sektion I · Inv. A.9/A.28 |
| **MEDIUM** | **Vier verschiedene ISO-27001-Termine** im Repo (Q3 2026 / Q4 2026 Zertifizierung / Q4 2026 Vorbereitung / 2027 Q1-Q2); toter Verweis auf ein nicht existentes Control-Mapping; „BSI C5-Track" ohne C5-Pack | H-03 · H-04 · H-05 |
| **VERIFIED (positiv)** | Framework-Support ist real und ehrlich abgegrenzt, wo es zählt: alle sechs Policy Packs mit Vollkatalogen geseedet; FAQ/„/security"/„/trust" sagen ausdrücklich „Noch nicht zertifiziert" bzw. „Self-Assessment" | H-01 · H-02 |

---

## Production Unknowns (Spec §15)

Unverändert offen aus dem Inventory — Format gekürzt, vollständige Kommandos in `01_INVENTORY.md` Abschnitt B:

```text
CHECK-01  Unknown: deployte Edge Functions (Live vs. 178+ im Repo)
          Reason: Produktions-API aus dieser Session nicht erreichbar
          Check: supabase functions list --project-ref ebljyceifhnlzhjfyxup
          Expected: Function-Liste deckungsgleich mit Repo-Registry

CHECK-02  Unknown: Live-Schema (RLS/ACLs, UNIQUE(subscriptions.tenant_id),
          audit_evidence/audit_jobs, Migrations-Ledger, Backup/PITR-Status)
          Reason: Live-DB nicht zugänglich
          Check: supabase db pull · SQL-Abfragen aus Inventory B ·
          Supabase-Dashboard → Backups
          Expected: Constraint + Tabellen vorhanden; Backup-Plan, der D-11 (RTO 24 h) trägt

CHECK-03  Unknown: pg_cron-Registrierung (monitoring, recheck, memory-decay;
          erwartet KEIN Eintrag für agent-os-runner)
          Check: SELECT jobname, schedule FROM cron.job;
          Expected: Jobs decken die „täglich/kontinuierlich"-Claims (A-03)

CHECK-04  Unknown: usage_limits_config-Inhalt (hard_limits, billing_mode je Key)
          Check: SELECT entitlement_key, hard_limit, billing_mode FROM usage_limits_config;
          Expected: Werte konsistent zur Preisseite

CHECK-05  Unknown: Trigger-Quelle für agent-os-runner in Produktion
          Check: Supabase Dashboard → Functions → Invocations
          Expected: regelmäßige Aufrufe oder Bestätigung „läuft nicht"

CHECK-06  Unknown: Stripe-Live-Konfiguration (Products/Prices je plan_key,
          Trial-Verhalten, Webhook-Endpunkte, Metered-Items)
          Check: npm run stripe:diff mit Live-Key · Stripe Dashboard
          Expected: Katalog deckungsgleich mit public.products/SSoT; Trial „keine Kosten bis Tag 15" bestätigt

CHECK-07  Unknown: Cloudflare-Konfiguration (Pages-Build, deployte Worker,
          govard-gateway/D1-Status)
          Check: npx wrangler pages project list / deployments list
          Expected: Bestätigung der Hosting-Realität für Sektion G (Subprozessoren)

CHECK-08  Unknown: npm-Publikation @realsyncdynamics/sdk
          Check: npm view @realsyncdynamics/sdk version
          Expected: publiziert ja/nein → SDK-Claims entsprechend

CHECK-09  Unknown: Secrets-Belegung der fail-open-Pfade
          (WHATSAPP_APP_SECRET, TELEGRAM_WEBHOOK_SECRET)
          Check: supabase secrets list --project-ref ebljyceifhnlzhjfyxup
          Expected: beide gesetzt; sonst nehmen die Webhooks ungeprüfte Anfragen an

CHECK-10  Unknown: EU-lokal-Stack-Erreichbarkeit (Ollama/LM Studio) und
          tatsächliche Provider-Endpoints/ai_tools-Zeilen in Produktion
          Check: curl $OLLAMA_URL/api/tags · SELECT key, model_provider FROM ai_tools;
          Expected: eu_local funktionsfähig; Provider-Realität für A-10/Sektion G
```

---

## Final Decision (Spec §16)

# **C — SIGNIFICANT GAP**

**Begründung.** Die Plattform hat einen substanziellen, teils sehr gut gebauten technischen Kern — Hash-Chain mit DB-Trigger und Verifier-RPC, RLS-Pattern, Policy-Pack-Vollkataloge, saubere Trial-Mechanik, fail-closed LLM-Quota, ehrliche Selbstauskünfte an mehreren Stellen (H-02, D-07, ApiDocs-Beta-Kennzeichnung). Aber die kommunizierten Versprechen sind in drei tragenden Dimensionen technisch nicht gedeckt: **(1)** Verkaufte Kontingente werden überwiegend nicht durchgesetzt — 7 von 12 Limit-Typen sind reine Anzeige, genau ein Limit im System erreicht die Spec-Definition von HARD, und ein ganzer Bot-Kanal ist ungedeckelt; **(2)** konkrete Datenschutz- und Norm-Zusagen sind widerlegt (EU-Endpoint-Pinning, RFC-3161, Subprozessoren-/Hosting-Angaben) — teils durch die eigenen Rechtstexte; **(3)** die Kaufstrecke enthält kaufentscheidungsrelevante Fehldarstellungen und Rechtstext-Widersprüche (Vergleichstabelle, USt, ungeregelter Trial). Dass die tragenden Ketten (RLS, Hash-Chain, Grants, Cost-Caps) in CI still übersprungen werden, entzieht auch den funktionierenden Teilen den fortlaufenden Nachweis.

**Die drei gewichtigsten Belege aus der Matrix:**
1. **A-10** — „EU-region-pinned Endpoints (Anthropic EU, OpenAI EU-Tenant, Google Vertex eu-central)": Adapter-Defaults `api.anthropic.com`/`api.openai.com`, kein Vertex-Code, eigene AVV-Liste sagt „USA".
2. **B-01…B-09 / T-Tabelle** — sieben von zwölf verkauften Limit-Typen DISPLAY_ONLY, Telegram gänzlich ungedeckelt, API-Limits um Faktor 50 abweichend hartcodiert: das Preismodell ist technisch nicht das, was verkauft wird.
3. **Sektion I** — die Art.-28-Subprozessorenliste beschreibt einen anderen Hosting-Stack (GitHub Pages statt Cloudflare Pages + Worker/D1) als der, der deployt.

---

## Go-Live-Blocker

Getrennt nach Lösungsweg. „Textlich" = Text-/Rechtstext-/Datenpflege ohne Runtime-Code; „Runtime" = Code-/Infra-Arbeit. **Keine dieser Maßnahmen wird in diesem Auftrag umgesetzt** (Spec §17).

### Rein textlich lösbar
1. **E-03** USt-Widerspruch Preisseite ↔ AGB/Impressum auflösen (eine Seite hat recht).
2. **A-10** EU-Endpoint-Behauptungen auf FAQ/Trust/Security auf den realen Stand ziehen (oder als Roadmap kennzeichnen).
3. **Sektion I** Subprozessorenliste korrigieren: Cloudflare (Pages + Worker/D1) aufnehmen, GitHub-Pages-Eintrag richtigstellen, `/trust`-Zweitliste konsolidieren, Hetzner/Hostinger klären, Sentry in die Kurzfassung.
4. **A-06** RFC-3161-Behauptungen entfernen; **A-05** „Ed25519 im Vault" → HMAC korrekt benennen; **A-09** „C2PA" → „C2PA-angelehnt" vereinheitlichen; **A-08** „PDF" → tatsächliches Format.
5. **E-04** Trial in AGB + Widerrufsbelehrung regeln (Dauer, Umwandlung, Verhältnis zur Erlöschensklausel).
6. **D-01/D-03/D-08** SLA-Texte konsistent machen: Badge ↔ AGB-SLA-Anhang, Legacy-Agency-Garantien von `/pricing` nehmen, WhatsApp-„SLA 99,5 %" gegen die ehrliche D-07-Linie abgleichen.
7. **B-15/B-16** WhatsApp-Preisseite auf SSoT umstellen oder abschalten; Legacy-Pläne aus JSON-LD/SEO/FAQ/PersonaCards nehmen.
8. **C-04** „Mandanten-Isolation mit Unterkonten" streichen oder Datenmodell nachliefern (dann Runtime); **A-13** „500 Mandanten" korrigieren.
9. **H-03/H-08** ISO-Termine auf eine Aussage vereinheitlichen; „aufsichtskonform/VAIT" abschwächen oder Pack bauen (dann Runtime).
10. **F-01** `/os/*`-Platzhalter-Rechtsseiten entfernen/entlinken; **A-16** Optimizer-Wortlaut auf die reale Template-Engine ziehen.

### Runtime-Arbeit erfordernd
1. **T-04 (CRITICAL)** Telegram: Feature-Gate + `consumeUsage` wie in `bot-chat`; fail-open-Defaults beider Webhooks (WhatsApp/Telegram) auf fail-closed, Secrets setzen (CHECK-09).
2. **T-01/07/08/09/16/17/18/19** Entscheidung je Limit: serverseitig erzwingen **oder** ehrlich nicht als hartes Kontingent verkaufen — insbesondere Seats (inkl. irreführendem Migrations-Kommentar), Domains, Storage, Bots-Anzahl, Audit-Berichte.
3. **B-06** `api-audit`/`api-gateway` auf die Entitlement-Achse umstellen (SSoT-Werte, `scale`-Key entfernen); ApiDocs-Ratenangaben angleichen.
4. **CI**: `test:db`-Job mit `TEST_DB_URL` (RLS-, Hash-Chain-, Grant-, Cost-Cap-Tests), `check:pricing` und die 38 verwaisten E2E-Specs in Workflows; Unit-Tests für `consumeUsage`/`gateFeature`.
5. **B-§7** Vergleichsmatrix von Bullet-Zählung auf Capability-Darstellung umstellen (Darstellungslogik, kleiner Eingriff — Design-Freeze §10 beachten).
6. **G-01/G-03** Locale-Fixes (`toLocaleString('de-DE')`, `en-US` entfernen) — klein, aber Code.
7. **D-11/CHECK-02** Backup-/PITR-Grundlage schaffen (Infra/Tarif), bevor „RTO 24 h" vertraglich zugesagt bleibt.
8. **E-01** Trial-Doppelpfad konsolidieren (`create-trial-subscription` vs. Checkout-`trial_period_days`).
9. **CHECK-01…CHECK-10** als Produktions-Abnahmelauf ausführen und Ergebnisse gegen diesen Report stellen.

---

**Abgrenzung (Spec §17, gilt uneingeschränkt):** Dieser Report entwickelt keine Preise, keine Paketstruktur, keine Add-ons, ändert keine Stripe-Objekte, baut keine Claim Registry, implementiert keine Tests und keine der oben gelisteten Maßnahmen. Er ist der Endpunkt eines Read-only-Audits.

# ENDE — Auftrag 1 abgeschlossen. Auftrag 2 folgt separat.
