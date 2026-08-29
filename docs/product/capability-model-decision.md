# Capability-Modell und Schnitt von PR #1129

**Stand: 2026-08-23. Gemessen, nicht hergeleitet.**
Quelle der Zahlen: Live-Projekt `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`,
eu-central-1, PostgreSQL 17) über `execute_sql`, plus Repo-Stand auf
`claude/realsyncdynamics-funnel-refactor-gzbd4g`.

Dieses Dokument beantwortet die drei Fragen, die vor jeder weiteren Zeile Code
entschieden sein müssen:

1. Wie wird PR #1129 geschnitten?
2. Was ist der Pilot — und was schaltet danach das Abo frei?
3. Welche Capability-Blöcke gibt es wirklich, und wie hängen sie an Plänen?

---

## 1. Befund A — den Builder gibt es zweimal

Die Frage „ist der Builder ein Modul, nur falsch erreichbar, oder noch zu
integrieren" hatte eine falsche Voraussetzung: Sie unterstellt **einen**
Builder. Es sind zwei, und der mit dem Kaufvorgang ist nicht der, über den
bisher gesprochen wurde.

| | **SiteOS Builder** | **Website-Rebuild** |
|---|---|---|
| Kern | `packages/siteos-core` (7 Module) | `supabase/functions/_shared/website-rebuild/` (5 Module) |
| Function | `siteos` (6 Handler) | `rebuild-website` (8 Schritte) |
| Eingang | `/app/siteos`, `/app/siteos/builder`, `/app/siteos/claim` | Admin-Ansicht `RebuildsView` |
| Nav-Eintrag | **keiner** | **keiner** (nur Admin) |
| Checkout | `createSiteOsCheckoutSession()` → `checkout-website-rebuild` mit `tier: 'governance_launch'` | `checkout-website-rebuild` mit `tier: managed\|premium\|enterprise` |
| Stripe-Produkte | — | `website_rebuild_managed\|premium\|enterprise`, alle mit Price |
| Entitlement-Prüfung im Code | **keine** (0 Treffer für `hasPermission`/`hasModule`/`entitlement`) | **keine** |
| Läufe live | `siteos_anonymous_builds`: **1** | `website_rebuilds`: **0** |

Beide sind deployt. Beide sind unbewacht. Und der bezahlte Weg aus SiteOS
heraus kauft `governance_launch` — ein Produkt, das mit dem Bauen nichts zu tun
hat, aber immerhin 16 Entitlements trägt, während die drei
`website_rebuild_*`-Produkte **null** tragen (siehe Befund C).

**Konsequenz für die Entscheidung:** „Builder als Capability des Governance-OS"
heißt zuerst, einen der beiden zum Träger zu erklären. Die Messung spricht für
`rebuild-website` als Pipeline und `siteos-core` als Analyse-/Blueprint-Ebene
darin — nicht für ein Nebeneinander.

---

## 2. Befund B — der Produktkern ist bereits gebaut; es fehlen zwei Schritte

Der von Ihnen beschriebene Kreislauf existiert als implementierte Pipeline in
`supabase/functions/rebuild-website/index.ts`. `STEP_ORDER` lautet:

```
scrape → audit → strip_trackers → self_host → inject_consent
       → legal_pages → ai_ready → package_deploy
```

Das ist Zeile für Zeile Ihr Kern: Domain → Befund → Behebung → Deployment.
`audit_id` wird vom Checkout bis in `generate-document` durchgereicht, die
Rechtsdokumente (DSE, AVV, VVT, TOM) werden je Domain und Audit erzeugt.

**Es fehlen genau zwei Schritte — beide benannt, beide klein:**

| Schritt | Zustand | Was fehlt |
|---|---|---|
| `audit` | **verlinkt nur** | Liest die Findings nicht. Der Code sagt selbst: „sonst hier no-op (Audit nicht zwingend für Rebuild)". Damit steuert der Befund die Behebung **nicht** — die Behebung läuft pauschal. |
| `package_deploy` | **Stub** | `// TODO Phase 2: Upload zu Storage + Cloudflare-Pages-Deploy.` Die Preview-URL wird **erfunden** (`https://preview.…/{id}`), ohne dass etwas hochgeladen wurde. `cloudflare-deployer` ist deployt und hat keinen Aufrufer. |

Das verkürzt Ihre Punkte 4 und 5 erheblich: „Audit → Builder-Datenfluss
implementieren" ist nicht der Bau einer Pipeline, sondern das Füllen eines
`case`-Zweigs, der schon an der richtigen Stelle steht. „Builder →
Domain/Deployment verdrahten" ist das Ersetzen eines TODO durch einen Aufruf an
eine Function, die bereits läuft.

> **Achtung — das ist zugleich eine Attrappe im Sinne von CLAUDE.md §14.**
> `package_deploy` meldet Erfolg und liefert eine URL, hinter der nichts liegt.
> Solange der Rebuild nicht verkauft wird (live: 0 Läufe), tut das niemandem
> weh. Vor dem ersten bezahlten Lauf muss es weg — entweder fertig oder als
> `skipped` gemeldet.

---

## 3. Befund C — sieben Produkte mit Stripe-Preis und null Entitlements

Das ist der schwerste Befund und er betrifft Ihren Punkt 4 direkt.

| Produkt | `plan_key` | Stripe-Price | Entitlements |
|---|---|---|---|
| Starter (Yearly) | `starter_yearly` | ja | **0** |
| Growth (Yearly) | `growth_yearly` | ja | **0** |
| Agency (Yearly) | `agency_yearly` | ja | **0** |
| Scale (Yearly) | `partner_yearly` | ja | **0** |
| Website-Rebuild Managed | `website_rebuild_managed` | ja | **0** |
| Website-Rebuild Premium | `website_rebuild_premium` | ja | **0** |
| Website-Rebuild Enterprise | `website_rebuild_enterprise` | ja | **0** |

Warum das nicht bloß unschön ist, sondern bricht: `tenant_entitlements()`
löst das Produkt so auf —

```sql
COALESCE(
  (SELECT id FROM products WHERE stripe_price_id = active_sub.stripe_price_id),
  (SELECT id FROM products WHERE default_for_plan_key = active_sub.plan_key),
  (SELECT id FROM products WHERE default_for_plan_key = 'free_tier'),
  (SELECT id FROM products WHERE default_for_plan_key = 'free')
)
```

`COALESCE` nimmt den **ersten nicht-leeren** Wert. Wer jährlich bucht, trägt den
Jahres-Price; damit greift Zweig 1, liefert die Jahres-Produkt-ID — und die ist
nicht `NULL`. Der Rückfall auf `free_tier` wird also **nie erreicht**. Der Join
auf `product_entitlements` findet null Zeilen. Ergebnis: **ein Jahreskunde hat
gar keine Berechtigungen.** Nicht weniger — keine.

**Heute latent, nicht akut:** live existieren 4 Subscriptions
(3 × `free_audit`, 1 × `growth` `trialing`), keine davon jährlich. Der Fehler
schlägt beim ersten Jahresabschluss zu, nicht vorher.

### Und ein zweiter, der schon heute greifen würde

`dashboard.access` wird gewährt von **`free_tier` und `governance_launch` — von
keinem einzigen bezahlten Abo-Plan.** `AdaptiveGovernanceNav` prüft
`canAccess('dashboard.access')`; wer nicht besteht, wird beim Klick auf
`upgradeUrl` geschickt. Ein zahlender Growth-Kunde ohne
`governance_launch`-Grant würde also für das Dashboard, das er bezahlt, auf eine
Upgrade-Seite geleitet. Dass es noch niemanden trifft, liegt allein daran, dass
der `FREE_TIER_FALLBACK` greift, solange keine aktive Subscription existiert.

Dasselbe Muster bei `website.scan`, `evidence.basic_vault`,
`governance.dsgvo_directory`, `governance.ai_register`, `reports.export`: alle
auf `free_tier`, keiner auf `starter`/`growth`/`agency` — mit Ausnahme von
`reports.export`, das auf den bezahlten Plänen zusätzlich existiert.

---

## 4. Befund D — Plan-Key-Wildwuchs

22 Produkte, vier nebeneinanderliegende Familien:

1. **Abo-Leiter** — `starter`, `growth`, `agency`, `enterprise`, `partner`
2. **Jahresvarianten** — vier Stück, alle ohne Entitlements (Befund C)
3. **Fremde Leiter** — `bronze`, `silver`, `gold`, `enterprise_public`
   (16/23/30/33 Entitlements) plus drei **verwaiste Dubletten**
   „Bronze (default)", „Silver (default)", „Gold (default)" **ohne**
   `plan_key`, die trotzdem 10/17/24 Entitlements tragen
4. **Einmalprodukte** — `governance_launch`, drei × `website_rebuild_*`

Dazu drei Unstimmigkeiten mit Namen:

- **`free` und `free_tier` sind zwei Produkte** mit unterschiedlichen Sätzen
  (13 bzw. 9 Entitlements). Welches gilt, entscheidet die Reihenfolge im
  `COALESCE`.
- **`free_audit`** ist der `plan_key` von 3 der 4 lebenden Subscriptions — und
  es gibt **kein Produkt** dazu. Dass diese Tenants trotzdem etwas haben,
  ist der `free_tier`-Rückfall, also Zufall, nicht Absicht.
- **`partner` heißt in der Datenbank „Scale"** („Scale (default)",
  „Scale (Yearly)"). CLAUDE.md §7: *„Der Name ‚Scale' ist untersagt."*

Die sechs Entitlements, die in keinem verkauften Abo-Plan vorkommen —
`ai.tool.code_explain`, `ai.tool.log_analyze`, `barcode.issue`,
`provenance.basic`, `public-sector.mode`, `watermark.apply` — hängen
ausschließlich an dieser fremden Leiter. Sie sind nicht „unzugeordnet", sie sind
**über die Pläne, die Sie verkaufen, unerreichbar**.

---

## 5. Das Capability-Modell

Aufgestellt aus dem, was im Repository existiert und in der Datenbank hängt —
nicht aus einer Marketingliste. Jede Zeile nennt den Nachweis.

| Block | Existiert als | Entitlements heute | Lücke |
|---|---|---|---|
| **Core Governance** | `policy_packs`, `governance_controls`, Sentinel-Loop, Score | `policy.packs`, `evidence.basic_vault`, `evidence.advanced`, `governance.dsgvo_directory`, `governance.ai_register`, `org.governance` | Basis liegt nur auf `free_tier` (Befund C) |
| **Audit** | `gdpr_audits` (159 Zeilen), `cookie-scan-deep`, `tenant-audit`, `_shared/public-scan` | `website.scan`, `website.scan_monthly_limit`, `compliance.export`, `reports.export`, `limit.compliance_exports_monthly` | `tenant-audit` ohne Aufrufer, `scan_runs` live 0 |
| **Builder** | `siteos` + `rebuild-website` (Befund A) | **keins** | Kein Key existiert. Vorschlag: `site.build`, `site.publish` |
| **Deployment** | `package_deploy` (Stub), `cloudflare-deployer` (deployt, ohne Aufrufer) | **keins** | Vorschlag: `deploy.hosted`, `limit.deploys_monthly` |
| **Monitoring** | Recheck-Cron, Drift-Erkennung | `monitoring.daily`, `monitoring.monthly`, `monitoring.drift`, `alerts.email` | vollständig, nur nicht am Builder angeschlossen |
| **Automation** | Workflows, `workflow_runs`, Scheduler | `ai.tool.automations`, `ai.tool.workflows`, `scheduler.enabled`, `limit.automation_runs_monthly`, `limit.workflow_runs_monthly` | `ai.tool.workflows` fehlt auf `starter`/`growth`/`agency` |
| **Kanäle / Bots** | Website-Chat, Voice, WhatsApp, Booking | `bots.enabled`, `bots.voice`, `limit.bots`, `limit.bot_messages_monthly`, `limit.bot_voice_minutes_monthly` | konsistent |
| **Provenance / C2PA** | Ed25519, Watermark, Barcode | `c2pa.export`, `provenance.basic`, `provenance.advanced`, `watermark.apply`, `barcode.issue` | drei davon nur auf der fremden Leiter (Befund D) |
| **Nur Enterprise/Partner** | SSO, Whitelabel, SLA | `sso.enabled`, `whitelabel.dashboard`, `whitelabel.reports`, `sla.priority` | `sso.enabled` fehlt auf `partner` — teurer, aber weniger |
| **Add-ons** | `BOOKABLE_MODULES` (9 Einheiten, `shared/pricing.ts`) | — | `unlocks`-Schlüssel sind **kein** Entitlement-Key-Raum; zwei Vokabulare nebeneinander |

**Die entscheidende Zeile ist die dritte.** Es gibt heute keinen Weg, den
Builder über ein Entitlement zu erlauben oder zu verweigern — weder in der
Datenbank noch im Code. Genau deshalb ist „Builder als Capability" nicht bloß
eine Zuordnung, sondern zwei neue Keys.

### Der zweite Vokabular-Bruch

`BOOKABLE_MODULES[].unlocks` nennt Werte wie `dsgvo`, `eu_ai_act`,
`policy_engine`, `evidence_vault`, `audit_center`, `monitoring`. Die
Entitlement-Tabelle nennt `policy.packs`, `evidence.basic_vault`,
`monitoring.daily`. Das sind zwei getrennte Namensräume für dieselbe Sache;
`src/core/billing/entitlements.ts` übersetzt punktuell (`'website.scan' → {
module: 'audit_center' }`). Bevor Entitlements auf die endgültigen Capabilities
gemappt werden (Ihr Punkt 6), muss einer der beiden Räume der maßgebliche sein.

---

## 6. Der Schnitt von PR #1129

Ihr Punkt 1, konkret auf Dateien heruntergebrochen.

**Bleibt (Analyse-/Domain-Schicht):**

| Datei | Warum |
|---|---|
| `supabase/functions/_shared/public-scan/target.ts` | SSRF-Schranke, drei gemessene Sicherheitskorrekturen |
| `supabase/functions/_shared/public-scan/observe.ts` | Abruf mit Sprungprüfung und Größenbegrenzung |
| `supabase/functions/_shared/public-scan/detectors.ts` | Host-Vergleich statt Host-Muster (CodeQL 17 → 0) |
| `supabase/functions/_shared/public-scan/report.ts` | Sechs Kundenkategorien, Sprachregel, Haftungshinweis |
| `test/public-scan/*` | 162 Tests, darunter die, die zwei echte Fehler gefunden haben |
| `docs/product/public-scan-funnel.md`, `docs/product/canonical-funnel-decision.md`, dieses Dokument | Nachweis und Entscheid |
| `test/backend/edge-function-contract.test.ts`, `src/config/production-edge-functions.ts` | Korrektur eines blinden Flecks, unabhängig vom Trichter |

**Wird zurückgezogen (Persistenz/Claim):**

| Datei | Warum |
|---|---|
| `supabase/migrations/20260826000000_public_site_scans.sql` | Führt einen nicht-kanonischen Datensatz ein |
| `supabase/functions/public-site-scan/index.ts` | Trägt Scan, Bericht **und** Claim gegen diesen Datensatz |
| `src/pages/PublicScanPage.tsx`, `src/pages/PublicScanResultPage.tsx` | Zweiter Trichter neben `/audit` |
| `src/lib/scanSession.ts`, `src/lib/scanClaim.ts` | Zweites Claim-Modell |
| `src/config/scan-funnel.ts` | Konfiguration nur dieses Trichters |

**Offen und nicht von mir zu entscheiden:** Die Landingpage zeigt seit der
freigegebenen CTA-Änderung auf `/scan`. Fällt `/scan` weg, braucht der Knopf ein
neues Ziel. Kanonisch wäre `/audit`. Das ist eine Änderung an bestehendem Text
bzw. Ziel und fällt damit unter CLAUDE.md §10.3 — **Fragepflicht**, keine
Vorab-Umsetzung.

**Marketplace** (`src/features/market/*`) hängt an keinem der beiden Teile und
kann in jedem der beiden Schnitte bleiben.

---

## 7. Pilot-Semantik — was noch fehlt

Die Frage bleibt offen, aber sie ist jetzt schärfer gestellt. Gemessen:

- Eine Tabelle, zwei Erzeugungswege, gleiche Felder.
- Kanonisch: `plan_key` + `status` + `trial_start`/`trial_end`.
- Karteileichen: `trial_ends_at` (live nie gesetzt), `plan_id` (live überall `NULL`).
- `entitlement_grants`: **0 Zeilen live** — der Grant-Weg ist gebaut, aber
  noch nie benutzt worden.

Für den Trichter
`Free Audit → Befund → Empfehlung → Pilot/Checkout → Dashboard → Builder`
sind zwei Zuschnitte möglich:

| | **A — Pilot als Abo mit `trialing`** | **B — Pilot als befristeter Grant** |
|---|---|---|
| Träger | `subscriptions.status = 'trialing'` | `entitlement_grants` mit `expires_at` |
| Auflösung | über `plan_key` → Produkt | zusätzlich zum Abo, additiv |
| Nach Ablauf | Stripe entscheidet | Grant läuft aus, Abo bleibt |
| Passt zu | „Pilot ist ein Plan auf Probe" | „Pilot ist eine Capability auf Zeit" |
| Live-Nachweis | 1 Zeile (`growth`, `trialing`) | 0 Zeilen |
| Konsequenz | genau ein Abo je Tenant bleibt gewahrt | Builder-Pilot ohne Planwechsel möglich |

**B passt besser zu „Builder als Capability des Governance-Systems"**, weil ein
Builder-Pilot dann kein Abo verdrängt und nach Ablauf nichts kaputtgeht. A ist
näher am Bestehenden. Die Entscheidung gehört Ihnen.

---

## 8. Was ich als Nächstes brauche

1. **Schnitt von #1129 freigeben** — und mit ihm das neue Ziel des
   Landing-CTA (`/audit`, wenn `/scan` entfällt). §10.3-Fragepflicht.
2. **Pilot-Semantik: A oder B.**
3. **Träger-Builder benennen** — `rebuild-website` als Pipeline mit
   `siteos-core` darin, oder umgekehrt.
4. **Maßgeblicher Namensraum** — Entitlement-Keys oder `unlocks`-Schlüssel.

Erst danach ist Ihr Punkt 6 (Entitlements auf Capabilities mappen) überhaupt
eindeutig formulierbar.
