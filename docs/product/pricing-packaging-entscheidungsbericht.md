# Entscheidungsbericht — Paketmodell und Add-ons

**Stand: 2026-08-24. Analyse, kein Code.**

Gemessen gegen das Live-Projekt `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`,
PostgreSQL 17) und den Repo-Stand auf `claude/realsyncdynamics-funnel-refactor-gzbd4g`.
Es wurde nichts gelöscht, kein Preis geändert, keine Migration ausgeführt und
kein Stripe-Objekt angefasst.

Vorarbeiten, auf denen dieser Bericht aufbaut statt sie zu wiederholen:
`docs/product/capability-model-decision.md` (Kassensturz Entitlements/Produkte)
und `docs/architecture/canonical-builder-target-matrix.md` (Builder, Pilot,
Namensraum).

---

## A. Ist-Zustand

### A.1 Umfang

| | Gemessen |
|---|---|
| Frontend-Routen | **471**, davon 129 unter `/app/*` |
| Edge Functions | **178** im Repo |
| Migrationen | 288 (nach dem Merge von `main`) |
| Entitlement-Keys | **63** — 43 boolesch, 20 Limits |
| Produkte (`products`) | **22** |
| Add-ons (`plan_addons`) | **6** |
| Plan-Katalog (`plan_catalog`) | **7** Zeilen |
| Dashboards im Repo | **35** Komponenten |
| Live-Mandanten / Subscriptions | 4 / 4 |

### A.2 Die Berechtigungskette existiert vollständig

Das in Ihrem Auftrag unter §8 und Phase 4 geforderte Modell ist gebaut:

```
User → memberships → tenant → subscriptions.plan_key/stripe_price_id
     → products → product_entitlements → entitlements
     → RPC tenant_entitlements(tenant_id) → Feature Access
```

Dazu kommt additiv `entitlement_grants` (Einmalkäufe, befristbar über
`expires_at`). Der Auflöser vereinigt Abo- und Grant-Produkte und nimmt je Key
den höchsten Wert, wobei `-1` (unbegrenzt) jeden endlichen Wert schlägt.

**Der serverseitige Wächter existiert ebenfalls** — `supabase/functions/_shared/entitlements.ts`:

| Funktion | Zweck |
|---|---|
| `loadEntitlementsForTenant()` | ruft die RPC, indiziert nach Key |
| `hasFeature()` | boolesche Prüfung (`-1` oder `> 0`) |
| `requireFeature()` | wirft `EntitlementError('FORBIDDEN')` |
| `requireQuota()` | wirft `QUOTA_EXCEEDED`, gibt `null` bei unbegrenzt |
| `gateFeature()` | Laden + Prüfen in einem Aufruf |

Das ist genau das `hasEntitlement(tenantId, key) → 403` aus Ihrem §8. Es muss
nicht erfunden werden.

### A.3 Rollen und Mandantentrennung

Vier Rollen: `owner`, `admin`, `editor`, `viewer_auditor`. Drei RLS-Helfer:
`is_tenant_member()`, `is_tenant_admin()`, `is_tenant_owner_or_admin()`.
Keine eigene Feature-Flag-Schicht — Zugriff läuft ausschließlich über
Entitlements und RLS. Das ist sauber und sollte so bleiben.

### A.4 Stripe

| Baustein | Zustand |
|---|---|
| `stripe-checkout` | nimmt **ausschließlich** `tenant_id` + `plan_key`, baut **genau ein** `line_item` aus `products.stripe_price_id` |
| `stripe-webhook` | schreibt `subscriptions`, `entitlement_grants`, `stripe_invoices`, `stripe_payment_events`, `stripe_trial_events`, `website_rebuilds` |
| `stripe-portal` | vorhanden (Kundenportal für Zahlungsdaten/Kündigung) |
| `checkout-website-rebuild`, `checkout-siteos-project` | eigene Einmalkauf-Pfade |
| `create-trial-subscription` | Pilot-Anlage |

### A.5 Implementierungsstatus je Funktionsbereich

| Bereich | Status | Nachweis |
|---|---|---|
| Audit / DSGVO-Scan | **produktiv** | `gdpr_audits` 159 Zeilen, `gdpr-audit` deployt, Frontend `/audit` |
| Policy Packs | **produktiv** | Entitlement `policy.packs`, Function `policy-packs` mit Entitlement-Prüfung |
| Evidence Vault | **produktiv** | `evidence.basic_vault` / `evidence.advanced`, Function prüft Entitlements |
| Provenance / C2PA | **produktiv** | `provenance` prüft Entitlements; Keys nur auf der Fremdleiter (siehe B.2) |
| Bots (Chat/Voice/WhatsApp) | **produktiv** | `bot-chat`, `bot-voice-webhook`, `whatsapp-webhook`, alle mit Entitlement-Prüfung |
| Monitoring | **vorhanden, nicht angeschlossen** | `monitoring.*`-Keys je Plan gesetzt; `scan_runs` live **0** |
| Governance Runtime / Sentinel | **vorhanden, unvollständig** | Functions deployt, Auto-Mapping ohne Datenfluss |
| Website-Builder (`rebuild-website`) | **vorhanden, unvollständig** | 8-Schritt-Pipeline; `package_deploy` bricht ab, bis der Deployer verdrahtet ist |
| SiteOS Builder | **technisch vorhanden, nicht aktiviert** | Routen `/app/siteos*` da, **kein** Nav-Eintrag, **keine** Entitlement-Prüfung |
| Add-on-Buchung | **Attrappe im Datenmodell** | Tabellen da, keine Stripe-Preise, kein Schreiber (siehe B.4) |
| `FreeTierDashboard` | **veraltet** | in `App.tsx` nur noch als Kommentar erwähnt, **nicht verdrahtet** |
| 7 weitere Dashboards | **veraltet / verwaist** | keine Route (siehe B.5) |

---

## B. Probleme

### B.1 Serverseitig prüfen nur 18 von 178 Functions Entitlements

57 Functions prüfen die Mandanten-Mitgliedschaft, aber nur **18** prüfen, ob der
Mandant die Funktion überhaupt gebucht hat:

`automation-trigger`, `bot-chat`, `bot-voice-webhook`, `bulk-scan`,
`checkout-siteos-project`, `checkout-website-rebuild`,
`enterprise-ai-os-agents-run`, `evidence-vault`, `policy-packs`, `provenance`,
`scheduler`, `stripe-checkout`, `stripe-meter-sync`, `stripe-token-meter-sync`,
`stripe-webhook`, `usage-increment`, `whatsapp-webhook`, `workflow-trigger`.

**Was das heißt:** Für die übrigen Functions entscheidet heute allein die
Mitgliedschaft im Mandanten. Wer angemeldet ist, erreicht sie — unabhängig vom
Plan. Ihr §8 („Der Kunde darf Funktionen nicht allein aufgrund des Frontends
verwenden können") ist damit für die Mehrheit der Endpunkte **nicht** erfüllt.
Das ist kein Architekturmangel, sondern eine Abdeckungslücke: Der Wächter
liegt bereit, er wird nur nicht gerufen.

Das ist der wichtigste Befund dieses Berichts.

### B.2 Vier Produktfamilien nebeneinander

| Familie | Plan-Keys | Bemerkung |
|---|---|---|
| Abo-Leiter | `free_audit`, `starter`, `growth`, `agency`, `enterprise`, `partner` | die verkaufte Leiter |
| Jahresvarianten | `*_yearly` (4 Stück) | trugen bis zur laufenden Korrektur **0** Entitlements |
| Fremdleiter | `bronze`, `silver`, `gold`, `enterprise_public` | plus **3 verwaiste Dubletten** ohne `plan_key`, die trotzdem 10/17/24 Entitlements tragen |
| Einmalkäufe | `governance_launch`, `website_rebuild_managed\|premium\|enterprise` | die drei Rebuild-Produkte haben Preis, aber **0** Entitlements |

Sechs Entitlements hängen **ausschließlich** an der Fremdleiter und sind über
die verkauften Pläne unerreichbar: `ai.tool.code_explain`,
`ai.tool.log_analyze`, `barcode.issue`, `provenance.basic`,
`public-sector.mode`, `watermark.apply`.

Dazu drei Namensprobleme: `partner` heißt in der Datenbank **„Scale"** — ein
Name, den CLAUDE.md §7 ausdrücklich untersagt. `free` und `free_tier` sind zwei
Produkte mit unterschiedlichen Sätzen. `enterprise_yearly` steht in
`shared/pricing.ts`, hat aber kein Produkt.

### B.3 Drei Vokabulare für dasselbe

| Ort | Beispiele | Anzahl |
|---|---|---|
| `entitlements.key` | `policy.packs`, `evidence.basic_vault`, `monitoring.daily` | 63 |
| `BOOKABLE_MODULES[].unlocks` | `audit_center`, `evidence_vault`, `policy_engine` | 9 Module |
| `ADDONS` / `plan_addons` | `response_pack`, `compliance_pack`, `white_label` | 6 |

`src/core/billing/entitlements.ts` übersetzt punktuell zwischen den ersten
beiden (`'website.scan' → { module: 'audit_center' }`). Solange drei
Namensräume nebeneinander bestehen, lässt sich Ihr §4 („eine Quelle") nicht
einhalten und jedes neue Modul muss an drei Stellen gepflegt werden.

### B.4 Der Add-on-Kauf ist im Datenmodell fertig — und hat genau eine Lücke

Das ist der überraschendste Befund, und er ist gute Nachricht:

| Baustein | Zustand |
|---|---|
| `plan_addons` | 6 Zeilen mit Name, Preis, Intervall, `available_for` je Plan — **aber keine Spalte `stripe_price_id`** |
| `subscription_addons` | Tabelle existiert mit `subscription_id`, `addon_key`, **`stripe_item_id`**, `quantity` — **0 Zeilen, kein Schreiber im Code** |
| `stripe-checkout` | baut genau **ein** `line_item` |

Das Modell „Add-on als zusätzliche Stripe-Subscription-Position" ist also
vollständig vorgezeichnet — inklusive der Spalte, die die Stripe-Position
festhält. Was fehlt, sind **ein Stripe-Price je Add-on** und der Code, der die
Position anlegt. Nicht mehr.

Dasselbe gilt für `BOOKABLE_MODULES`: neun Module mit Preisen in
`shared/pricing.ts`, ohne Stripe-Price-Objekt. Deshalb zeigt der Marketplace
heute bewusst keinen „Aktivieren"-Knopf.

### B.5 35 Dashboards, davon 7 ohne Route

Nicht verdrahtet: `AiGovernanceDashboard`, `ComplianceTrendsDashboard`,
`DemoDashboard`, `GovernanceRuntimeDashboard`, `MaintenanceDashboard`,
`RuntimeDashboard`, `WebsiteOperationsDashboard`.

Dazu **20 doppelte Komponenten-Dateinamen** (u. a. zweimal
`SiteOsDashboardView`, `EvidenceVaultView`, `PricingPage`, `Navbar`).

Und eine irreführende Stelle: `App.tsx` kommentiert `/app/dashboard` mit
„DashboardRouter conditionally shows FreeTierDashboard or CeoCockpitView" —
tatsächlich rendert `DashboardRouter` **immer** `GovernanceAiWorkspace` und
prüft den Tarif gar nicht. `FreeTierDashboard` ist unerreichbar.

**Für Ihre Phase 5 heißt das:** Es gibt keinen Ort, an dem heute „freigeschaltet
vs. zubuchbar" gezeigt wird — außer dem in PR #1129 gebauten
`/app/marketplace`. Ein Dashboard-Konzept muss nicht 35 Flächen versöhnen,
sondern eine benennen.

### B.6 Keine Abhängigkeitsmodellierung

Ihr §9 verlangt „Advanced Analytics requires Analytics Core". Im Bestand gibt
es dafür **nichts** außer einem booleschen `requiresFrontend` an
`BOOKABLE_MODULES`. Weder `plan_addons` noch `entitlements` kennen
Abhängigkeiten.

---

## C. Empfohlenes Zielmodell

**Core + Add-on, aufgesetzt auf die vorhandene Kette — kein zweites System.**

```
Free Audit (unbegrenzt, ohne Konto)
        ↓  Befund erzeugt Bedarf
Basis-Paket kaufen  →  Überwachung beginnt
        ↓
Dashboard: „Freigeschaltet" | „Zubuchbar"
        ↓
Add-on buchen  →  zusätzliche Stripe-Position
        ↓
Entitlement sofort wirksam, serverseitig geprüft
```

Drei Festlegungen, die daraus folgen:

1. **Der Scan bleibt kostenlos und unbegrenzt.** Verkauft wird die dauerhafte
   Überwachung. Das ist bereits so verdrahtet: `monitoring.monthly` ab Starter,
   `monitoring.daily` + `monitoring.drift` ab Growth, im Free-Plan **keine**
   Überwachung. Die Trennlinie zwischen kostenlos und bezahlt liegt damit
   genau da, wo Ihr Geschäftsmodell sie braucht — sie muss nicht gezogen,
   nur genutzt werden.

2. **Entitlement-Keys sind der einzige Namensraum.** `unlocks` und
   `plan_addons.addon_id` werden darauf abgebildet, nicht umgekehrt.

3. **Add-ons sind Stripe-Subscription-Positionen**, keine eigenen Abos. Das
   passt zu `subscription_addons.stripe_item_id` und hält die Regel „genau ein
   Abo je Mandant" unangetastet.

---

## D. Neue Pakete

**Empfehlung: die bestehende Leiter behalten und nur bereinigen.**

Begründung: Es gibt vier lebende Subscriptions und keine zahlenden Kunden. Der
Anreiz, jetzt umzubenennen, ist gering; der Aufwand, sechs Pläne durch fünf neue
Namen zu ersetzen, trifft `shared/pricing.ts`, den Plan-Katalog, 22 Produkte,
Stripe und jeden Test, der Plan-Keys kennt. Das ist Arbeit ohne Kundennutzen.

| Paket | Preis | Bleibt/ändert sich |
|---|---|---|
| **Free Audit** | 0 € | bleibt. Unbegrenzte Scans, **keine** Überwachung |
| **Starter** | 79 € | bleibt. Erste Stufe **mit** Überwachung (`monitoring.monthly`) |
| **Growth** | 249 € | bleibt. Tägliche Überwachung + Drift-Erkennung |
| **Agency** | ? | bleibt. Mehrmandantenfähig, Whitelabel-Reports |
| **Enterprise** | Angebot | bleibt. SSO, Org-Governance |
| **Partner** | ? | bleibt — **aber in der Datenbank von „Scale" auf „Partner" umbenennen** (CLAUDE.md §7) |

**Was entfallen sollte:**

- die drei verwaisten `(default)`-Produkte ohne `plan_key`
- die Fremdleiter `bronze`/`silver`/`gold`/`enterprise_public`, **falls** sie kein
  eigenes Produkt bedienen — das ist die einzige Frage in diesem Abschnitt, die
  ich nicht aus dem Code beantworten kann und die Sie entscheiden müssen
- `free` **oder** `free_tier` — einer der beiden, nicht beide

**Was zusammengelegt werden sollte:** nichts. Die sechs Stufen sind
trennscharf; die Überschneidungen liegen nicht zwischen den Plänen, sondern
zwischen den Produktfamilien.

> **Ihre frühere Vorgabe:** Am 2026-08-23 hatten Sie „maximal drei bezahlte
> Pakete" festgelegt. Diese Empfehlung widerspricht dem. Wenn die
> Drei-Pakete-Vorgabe gilt, wäre der Schnitt Starter / Growth / Enterprise, und
> Agency und Partner würden zu Add-on-Bündeln (Mehrmandantenfähigkeit,
> Whitelabel). Sagen Sie, welche der beiden Vorgaben gilt.

---

## E. Add-ons

Abgeleitet aus dem, was **existiert und produktionsfähig ist** — nicht aus einer
Wunschliste. Preise sind mit `PROPOSED` markiert, wo sie neu wären; wo bereits
ein Preis in `plan_addons` oder `BOOKABLE_MODULES` steht, ist er übernommen.

### E.1 Bereits mit Preis hinterlegt (aus `plan_addons`, live)

| Add-on | Preis | Verfügbar ab | Entitlements dahinter |
|---|---|---|---|
| Response Pack | 49 € | Growth | `limit.bot_messages_monthly` |
| WhatsApp | 99 € | Growth | `whatsapp`, `bots.enabled` |
| Compliance Pack | 149 € | Growth | `policy.packs`, `compliance.export` |
| Voice | 150 € | Agency | `bots.voice`, `limit.bot_voice_minutes_monthly` |
| Agency Bot Pack | 199 € | Agency | `limit.bots` |
| White Label | 299 € | Agency | `whitelabel.dashboard`, `whitelabel.reports` |

### E.2 Aus `BOOKABLE_MODULES` (Preise vorhanden, Stripe fehlt)

| Add-on | Preis | Reifegrad |
|---|---|---|
| Governance Core | 79 € | produktiv — gehört ins Basispaket, nicht als Add-on |
| AI Frontend (Builder) | 49 € | **unvollständig** — `package_deploy` bricht ab |
| Website Chat | 39 € | produktiv |
| Voice Bot | 99 € | produktiv |
| WhatsApp Bot | 39 € | produktiv (Preis widerspricht den 99 € aus E.1 — **zu klären**) |
| Terminbuchung | 29 € | produktiv |
| Advanced AI Governance | 149 € | teils vorhanden (NIS2/ISO ohne Datenfluss) |
| Weitere Domain | 19 €/Stück | produktiv |
| Weiteres Unternehmen | 49 €/Stück | produktiv |

### E.3 Empfehlung

**Nicht als Add-on anbieten, was noch nicht liefert.** Konkret: der Builder
(`AI Frontend`) gehört erst in den Katalog, wenn `package_deploy` wirklich
ausliefert. Ein bezahltes Modul, das eine Preview-Adresse ohne Inhalt liefert,
kostet mehr Vertrauen als es einbringt.

**Zwei Widersprüche zuerst auflösen:** WhatsApp steht mit 39 € und mit 99 € in
zwei Quellen; `Governance Core` ist als „Add-on" geführt, obwohl es das
Basispaket ist.

---

## F. Dashboard

Ein Bereich, zwei Listen — keine App-Store-Optik.

```
Mein Plan
  Growth · 249 € / Monat · nächste Abrechnung TT.MM.JJJJ

  Enthalten
    ✓ DSGVO- und AI-Act-Überwachung (täglich)
    ✓ Evidence Vault
    ✓ Policy Packs
    ✓ Compliance-Export        12 / Monat
    ✓ Website-Scans            unbegrenzt

  Zubuchbar
    ○ WhatsApp-Kanal            + 99 € / Monat
    ○ Compliance Pack           + 149 € / Monat
    ○ Weitere Domain            + 19 € / Monat je Domain

  Gesamt heute                  249 € / Monat
```

Beim Auswählen **vor** der Bestätigung: alter Betrag, Zuschlag, neuer Betrag —
und das Datum, ab dem er gilt. Ohne diese drei Zeilen keine Aktivierung.

**Ort:** `/app/marketplace` existiert bereits aus PR #1129 und zeigt heute
`BOOKABLE_MODULES` mit ehrlichem Status. Das ist die Fläche, die auszubauen ist
— kein neues Dashboard. Die 35 bestehenden Dashboards bleiben unangetastet;
sieben davon sind ohnehin unerreichbar und sollten in einem eigenen Schritt
aufgeräumt werden (Fragepflicht nach CLAUDE.md §10.3).

---

## G. Entitlement-Modell

**Empfehlung: nichts Neues bauen. Die vorhandene Kette vollständig nutzen.**

| Ihr Auftrag verlangt | Zustand |
|---|---|
| `User → Tenant → Subscription → Plan → Entitlement → Feature Access` | **vorhanden** |
| serverseitige Prüfung, `403 FEATURE_NOT_ENTITLED` | **vorhanden** (`requireFeature` → `EntitlementError('FORBIDDEN')`) |
| Kontingente | **vorhanden** (`requireQuota`, `-1` = unbegrenzt) |
| Einmalkäufe | **vorhanden** (`entitlement_grants` mit `expires_at`) |
| Add-on als eigene Position | **Tabelle vorhanden**, ohne Schreiber |
| Laufzeit / Grace Period | teilweise — `subscriptions.status`, `expires_at`; **keine** ausdrückliche Grace-Logik |
| Abhängigkeiten zwischen Features | **fehlt vollständig** |

Zwei Ergänzungen wären nötig, beide klein:

1. **Abhängigkeiten.** Eine Tabelle `entitlement_dependencies (entitlement_id,
   requires_entitlement_id)` genügt. Der Auflöser bleibt unberührt; geprüft wird
   beim Buchen.
2. **Grace Period.** `subscriptions.status = 'past_due'` existiert in Stripe;
   die Frage ist nur, wie lange Entitlements danach noch gelten. Heute:
   unbeantwortet.

**Was nicht empfohlen wird:** eine zweite Autorisierungsschicht neben RLS. Die
Mandantentrennung über `is_tenant_member()` ist korrekt und soll die Grundlage
bleiben; Entitlements kommen **zusätzlich** darüber, nicht daneben.

---

## H. Stripe

**Keine zweite Billing-Architektur.** Konkret:

| Bereich | Empfehlung |
|---|---|
| Pläne | bleiben wie sie sind: ein Price je Plan, `products.stripe_price_id` |
| Jahrespläne | Preise existieren; die fehlenden Entitlements sind in PR #1129 nachgezogen |
| **Add-ons** | **je Add-on ein wiederkehrender Price anlegen** — das ist der eine fehlende Baustein |
| Buchung | `stripe-checkout` um weitere `line_items` erweitern; für bestehende Abos `subscriptions.items.create` |
| Persistenz | `subscription_addons` mit `stripe_item_id` füllen — die Tabelle wartet darauf |
| Kündigung eines Add-ons | `subscriptions.items.del`, Zeile in `subscription_addons` entfernen |
| Webhook | `customer.subscription.updated` verarbeitet bereits Abos; Positionen ergänzen |
| Portal | `stripe-portal` bleibt für Zahlungsdaten und Kündigung |

**Reihenfolge:** Erst die Prices in Stripe, dann der Code. Ohne Price ist jede
Add-on-Oberfläche eine Attrappe.

---

## I. Datenbank

**Verwendbar ohne Änderung:** `products`, `product_entitlements`, `entitlements`,
`subscriptions`, `entitlement_grants`, `memberships`, `tenants`, `plan_catalog`,
`subscription_addons`, `tenant_entitlements()`.

**Anzupassen:**

| Was | Warum | Risiko |
|---|---|---|
| `plan_addons` + Spalte `stripe_price_id` | ohne sie ist kein Add-on kaufbar | additiv, keins |
| neue Tabelle `entitlement_dependencies` | §9 des Auftrags | additiv, keins |
| `products`: „Scale" → „Partner" umbenennen | CLAUDE.md §7 | reine Anzeige, gering |
| `free` **oder** `free_tier` stilllegen | zwei Free-Produkte | **Vorsicht** — der Auflöser hat beide als Rückfall |
| Fremdleiter + 3 Dubletten stilllegen | tote Entitlement-Träger | **Vorsicht** — vorher prüfen, ob ein Mandant daran hängt |

**Nicht anzufassen:** RLS-Policies, `tenant_entitlements()`-Signatur, die
Grant-Semantik.

---

## J. Migration

Risikoarm, weil es **keine zahlenden Kunden** gibt (4 Subscriptions: 3 ×
`free_audit`, 1 × `growth` in `trialing`; `entitlement_grants` ist leer).

1. **Additiv beginnen.** Add-on-Prices in Stripe, `stripe_price_id` an
   `plan_addons`, Abhängigkeitstabelle. Nichts wird ersetzt.
2. **Neue Pakete parallel, falls gewünscht.** Ein neues Paket ist eine neue
   Produktzeile mit eigenen `product_entitlements`. Bestehende Abos zeigen
   weiterhin auf ihr altes Produkt und behalten ihre Entitlements — genau das
   verlangt Ihr §12, und die Architektur trägt es bereits.
3. **Stilllegen statt löschen.** `plan_catalog.active = false` und
   `products` ohne `default_for_plan_key` erhalten die Historie. Keine
   destruktiven Migrationen.
4. **Zum Schluss aufräumen.** Fremdleiter, Dubletten, unerreichbare Dashboards
   — jeweils erst nach Prüfung, ob ein Mandant daran hängt.

---

## K. Risiken

| Risiko | Bewertung | Gegenmaßnahme |
|---|---|---|
| **160 Endpunkte ohne Entitlement-Prüfung** | **hoch** — ein zahlender Starter-Kunde erreicht heute Functions, die zu Enterprise gehören | Prüfung schrittweise nachrüsten, beginnend bei den Functions, die Geld oder Daten bewegen |
| Add-on-Kauf ohne Stripe-Price | mittel | Prices zuerst, UI danach |
| Zwei Free-Produkte, Fremdleiter | mittel | vor dem Stilllegen prüfen, wer daran hängt |
| Abhängigkeiten fehlen | mittel | Kunde könnte ein Add-on buchen, das ohne sein Fundament nichts tut |
| Grace Period undefiniert | mittel | bei `past_due` verliert der Kunde heute abrupt alles |
| Builder als bezahltes Add-on | **hoch, wenn jetzt verkauft** | erst anbieten, wenn `package_deploy` ausliefert |
| Preisänderung an laufenden Abos | gering | keine zahlenden Kunden |
| 35 Dashboards | gering, aber wachsend | ein Bereich für „Mein Plan", Rest unangetastet |

---

## L. Empfohlene Umsetzung

Priorisiert nach Wirkung, nicht nach Aufwand.

| # | Schritt | Warum zuerst |
|---|---|---|
| 1 | **Entitlement-Prüfung nachrüsten**, beginnend bei Functions mit Geld- oder Datenwirkung | Der größte offene Punkt Ihres §8. Der Wächter existiert; es fehlen die Aufrufe. |
| 2 | **Namensraum zusammenführen** — `unlocks` und `addon_id` auf Entitlement-Keys | Voraussetzung für alles Weitere; ohne sie wächst jede Änderung dreifach |
| 3 | **Stripe-Prices je Add-on anlegen** | der eine fehlende Baustein für Ihr Kernmodell |
| 4 | **Add-on-Buchung verdrahten** — `line_items`, `subscription_addons`, Webhook | erst jetzt technisch möglich |
| 5 | **Dashboard „Mein Plan"** mit Preisvorschau vor der Bestätigung | die Fläche, auf der Ihr Modell sichtbar wird |
| 6 | **Abhängigkeiten** modellieren und beim Buchen prüfen | §9 |
| 7 | **Grace Period** festlegen | verhindert, dass eine fehlgeschlagene Zahlung sofort alles abschaltet |
| 8 | **Aufräumen** — Fremdleiter, Dubletten, verwaiste Dashboards | zuletzt, weil Löschen Fragepflicht auslöst |

---

## Offene Entscheidungen

Vier Punkte kann ich nicht aus dem Code beantworten:

1. **Drei bezahlte Pakete oder sechs?** Ihre Vorgabe vom 2026-08-23 gegen die
   Empfehlung aus Abschnitt D.
2. **Wird die Fremdleiter** (`bronze`/`silver`/`gold`/`enterprise_public`) noch
   gebraucht, oder darf sie stillgelegt werden?
3. **WhatsApp 39 € oder 99 €?** Zwei Quellen, zwei Preise.
4. **Grace Period:** Wie lange behält ein Kunde seine Entitlements nach einer
   fehlgeschlagenen Zahlung?

**Es wird nichts umgesetzt, bevor Sie freigeben.**
