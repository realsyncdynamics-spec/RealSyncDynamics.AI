# Zielmatrix — kanonischer Builder, Entitlements, Pilot

**Verbindliche Architekturgrundlage. Entschieden am 2026-08-23 vom Eigentümer.**
Messungen gegen das Live-Projekt `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`)
und den Repo-Stand auf `claude/realsyncdynamics-funnel-refactor-gzbd4g`.

Vorgelagerte Dokumente: `docs/product/canonical-funnel-decision.md` (Einstieg und
Datensatz), `docs/product/capability-model-decision.md` (Kassensturz).
Dieses Dokument ist die Zielmatrix, gegen die gebaut wird — **noch nicht** die
Umsetzung.

---

## 1. Die vier Entscheidungen

| # | Frage | Entscheidung |
|---|---|---|
| 1 | PR #1129 schneiden? | **Ja.** Auf die Analyse-Schicht zurücknehmen; Persistenz und Claim getrennt auf dem kanonischen Modell neu aufbauen. |
| 2 | Landing-CTA `/scan` → `/audit`? | **Ja.** Gewollte Produktkorrektur. Ein Einstieg, nicht zwei. |
| 3 | Pilot-Semantik | **B — `entitlement_grants`.** Der Pilot ist eine befristete Capability-Freischaltung, keine Subscription. |
| 4 | Träger-Builder | **`rebuild-website`.** `siteos` bleibt Analyse-/Blueprint-Ebene, nicht Produkt-Builder. |
| 5 | Maßgeblicher Namensraum | **Entitlement-Keys.** `BOOKABLE_MODULES[].unlocks` wird darauf abgebildet, nicht umgekehrt. |

Die Kette gilt damit in genau dieser Richtung:

```
Capability → Entitlement Key → Plan / Pilot Grant → Runtime Authorization
```

Zwei Bedingungen des Eigentümers sind Teil der Entscheidung, nicht Beiwerk:

- **`audit` darf kein No-op bleiben.** Die Befunde müssen steuern, was gebaut wird.
- **`package_deploy` darf keinen Erfolg simulieren.** Echter Deployment-Status
  oder harter Fehler. Die erfundene Preview-URL muss weg. **P0.**

---

## 2. Drei Korrekturen an meinem eigenen Befund von gestern

Die Messung der Schritt-Innereien hat drei Aussagen aus
`capability-model-decision.md` präzisiert. Sie ändern, was in P0-D zu bauen ist.

**Erstens: Der Audit steuert bereits einen der acht Schritte.** Ich hatte
geschrieben, der Befund steuere die Behebung nicht. Das gilt für vier der fünf
Transformationsschritte, nicht für alle. `legal_pages` reicht `audit_id` an
`generate-document` weiter, und diese Function **liest die Befunde**:
`detectTrackers(audit.issues)` und `new Set(audit.issues.map(i => i.id))`
bestimmen den Inhalt von DSE, AVV, VVT und TOM. Die Kopplung existiert also
punktuell und funktioniert — sie fehlt bei `strip_trackers`, `self_host`,
`inject_consent` und `ai_ready`, die pauschal über das gescrapte HTML laufen.

**Zweitens: Der häufigste kritische Befund hat gar keinen Behebungsschritt.**
`generate-document` kennt genau vier Dokumenttypen (`dse`, `avv`, `vvt`, `tom`)
— **kein Impressum**. Gemessen über 159 Audits ist
`sub_imprint_no_legal_form` mit **62 Vorkommen** der häufigste kritische Befund
überhaupt, dazu `no_imprint_link` (11), `sub_imprint_no_address` (8),
`sub_imprint_no_contact` (8). Der Rebuild kann diese Klasse heute nicht beheben.

**Drittens: Die drei häufigsten Befunde überhaupt kann kein HTML-Schritt
beheben.** `no_xframe` (74), `no_hsts` (70), `no_csp` (52) sind
Transport- und Header-Befunde. Sie gehören in die Auslieferung, nicht ins
Dokument. Damit ist `package_deploy` nicht bloß „Preview nachrüsten" — es ist
**der einzige Ort, an dem die häufigsten Befunde überhaupt behebbar sind**. Das
hebt seine Priorität über die einer Fertigstellungsarbeit hinaus.

---

## 3. Zielmatrix A — `rebuild-website`

`STEP_ORDER` bleibt unverändert. Was sich ändert, ist die Kopplung an die
Befunde und die Ehrlichkeit des letzten Schritts.

| Schritt | Ist | Soll | Befund-Kopplung |
|---|---|---|---|
| `scrape` | lädt Quelle, zählt Skripte/Iframes/Fonts | unverändert | keine — Eingangsdatenschritt |
| `audit` | **No-op**, verlinkt nur `audit_id` | lädt `gdpr_audits.issues`, legt den **Behebungsplan** in den Lauf-State und schreibt ihn als Schritt-Metadaten in den Prüfpfad | **wird die Quelle für alle folgenden Schritte** |
| `strip_trackers` | entfernt Tracker pauschal | entfernt gezielt, was der Plan nennt; meldet je Befund behoben/offen | `tracker_no_consent`, `social_pixel_no_consent`, `ga_no_ip_anon` |
| `self_host` | markiert Font-Familien | unverändert, aber Meldung je Befund | Google-Fonts-Befunde |
| `inject_consent` | bettet Consent-SDK ein (opt-in, default-deny) | unverändert, aber nur wenn der Plan es verlangt | `cookies_pre_consent`, `rule:COOKIE_BANNER_DARK_PATTERN` |
| `legal_pages` | erzeugt DSE/AVV/VVT/TOM aus dem Audit | **plus Impressum** (neuer Dokumenttyp) | bereits gekoppelt; Impressum-Klasse fehlt |
| `ai_ready` | Metadaten, `llms.txt` | plus Art.-50-Transparenzhinweis, wenn erkannt | `rule:AI_ACT_LIMITED_RISK_CHATBOT`, `no_og_tags` |
| `package_deploy` | **Stub**, meldet Erfolg mit erfundener URL | echter Upload + Deploy über `cloudflare-deployer`; **Fehler statt Erfolgsmeldung**, wenn nichts ausgeliefert wurde; setzt Security-Header | `no_hsts`, `no_csp`, `no_xframe`, `no_https`, `mixed_content` |

**Abbruchbedingung, die heute fehlt:** `fetch_failed` (19 Vorkommen, high) heißt,
dass die Quelle nie geladen wurde. Ein Rebuild auf dieser Grundlage baut aus
nichts. Der `audit`-Schritt muss den Lauf hier beenden, nicht fortsetzen.

### Die gemessene Befund→Schritt-Matrix

Alle 26 Befund-Codes, die über 159 Audits tatsächlich vorkommen, mit
Häufigkeit und zuständigem Schritt. Was in der letzten Spalte „—" trägt, ist
heute **nicht behebbar** und muss entweder einen Schritt bekommen oder im
Bericht ehrlich als „nicht automatisch behebbar" ausgewiesen werden.

| Befund | Schwere | Vorkommen | Schritt |
|---|---|---|---|
| `no_xframe` | low | 74 | `package_deploy` (Header) |
| `no_hsts` | medium | 70 | `package_deploy` (Header) |
| `sub_imprint_no_legal_form` | **critical** | **62** | `legal_pages` — **Typ fehlt** |
| `no_csp` | low | 52 | `package_deploy` (Header) |
| `rule:COOKIE_BANNER_DARK_PATTERN` | medium | 47 | `inject_consent` |
| `sub_privacy_third_country_no_legal_basis` | high | 40 | `legal_pages` (DSE) |
| `sub_privacy_no_complaint_right` | medium | 39 | `legal_pages` (DSE) |
| `ga_no_ip_anon` | high | 29 | `strip_trackers` |
| `no_og_tags` | info | 24 | `ai_ready` |
| `tracker_no_consent` | **critical** | 23 | `strip_trackers` + `inject_consent` |
| `social_pixel_no_consent` | **critical** | 22 | `strip_trackers` + `inject_consent` |
| `fetch_failed` | high | 19 | **Abbruch** — kein Rebuild |
| `no_privacy_link` | **critical** | 18 | `legal_pages` (DSE) |
| `rule:AI_ACT_LIMITED_RISK_CHATBOT` | low | 14 | `ai_ready` (Art. 50) |
| `no_imprint_link` | **critical** | 11 | `legal_pages` — **Typ fehlt** |
| `sub_imprint_no_address` | **critical** | 8 | `legal_pages` — **Typ fehlt** |
| `sub_imprint_no_contact` | high | 8 | `legal_pages` — **Typ fehlt** |
| `form_no_consent` | medium | 6 | — |
| `meta_refresh` | low | 6 | — |
| `cookies_pre_consent` | high | 4 | `inject_consent` |
| `no_imprint_link_non_de` | info | 3 | `legal_pages` — **Typ fehlt** |
| `mixed_content` | medium | 1 | `package_deploy` |
| `no_https` | **critical** | 1 | `package_deploy` |
| `rule:MISSING_AVV_REFERENCE` | medium | 1 | `legal_pages` (AVV) |
| `sub_privacy_no_avv_list` | high | 1 | `legal_pages` (DSE) |
| `sub_privacy_no_dpo_contact` | medium | 1 | `legal_pages` (DSE) |

Zusammengerechnet: **196 der 570 Befund-Vorkommen** (34 %) hängen an
`package_deploy`, **89 Vorkommen** (16 %) an einem Impressum-Generator, den es
nicht gibt. Beides sind keine Randfälle.

---

## 4. Zielmatrix B — der Entitlement-Namensraum

Entitlement-Keys sind maßgeblich. Damit gilt für neue Keys dieselbe Sorgfalt wie
für einen öffentlichen API-Vertrag: Ein Key, der einmal in `product_entitlements`
steht, wird von der Runtime abgefragt und darf nicht umbenannt werden.

### Neu zu definieren — Builder und Deployment

| Key | Art | Bedeutung | Heute |
|---|---|---|---|
| `site.build` | boolean | Darf einen Rebuild-Lauf starten | fehlt |
| `site.preview` | boolean | Darf das Ergebnis vor dem Kauf ansehen | fehlt |
| `site.claim` | boolean | Darf einen anonymen Lauf dem Tenant zuordnen | fehlt |
| `site.deploy` | boolean | Darf ausliefern (nicht nur bauen) | fehlt |
| `domain.custom` | boolean | Darf eine eigene Domain verbinden | fehlt |
| `limit.site_builds_monthly` | limit | Kontingent je Monat | fehlt |
| `limit.site_deploys_monthly` | limit | Kontingent je Monat | fehlt |

Die Trennung von `site.build` und `site.deploy` ist der Hebel des Funnels:
**Bauen und Ansehen ist frei, Ausliefern ist die bezahlte Schwelle.** Genau das
setzt Ihr „Wert vor Bezahlung" in eine Berechtigung um, statt in eine Absicht.

### Nicht neu erfinden — `audit.basic`

Der Vorschlag `audit.basic` beschreibt etwas, das bereits einen Key hat:
`website.scan` (mit `website.scan_monthly_limit`). Ein zweiter Name für dieselbe
Sache wäre exakt das Problem, das mit Entscheidung 5 abgeschafft werden soll —
diesmal innerhalb des kanonischen Namensraums.

**Empfehlung: `website.scan` behalten.** Wenn die Benennung stören sollte, dann
als ausdrückliche Umbenennung mit Migration und Doppellauf, nie als Synonym
daneben. Bis dahin steht in der Plan-Matrix `website.scan`.

### Abbildung der Add-ons

`BOOKABLE_MODULES[].unlocks` trägt heute ein eigenes Vokabular (`audit_center`,
`evidence_vault`, `policy_engine`, `monitoring`). Nach Entscheidung 5 wird
`unlocks` zu einer Liste von **Entitlement-Keys**; `src/core/billing/entitlements.ts`
verliert damit seine Übersetzungstabelle statt sie zu erweitern. Das Modul
`ai_frontend` (49 €, `requiresFrontend: true`, `unlocks: []`) ist der
kommerzielle Träger des Builders und bekommt `site.build`, `site.preview`,
`site.deploy`.

---

## 5. Zielmatrix C — Pilot über `entitlement_grants`

Entscheidung B ist tragfähig — `tenant_entitlements()` vereinigt Grant-Produkte
additiv mit dem Abo-Produkt und nimmt je Key `MAX(value)`, wobei `-1`
(unbegrenzt) gewinnt. Ein Pilot-Grant erweitert damit ein bestehendes Abo, ohne
es zu verdrängen, und die Regel „genau ein Abo je Tenant" bleibt unberührt.

**Eine Schema-Beschränkung muss dabei bekannt sein**, weil sie die Umsetzung
formt:

```
entitlement_grants.product_id  uuid  NOT NULL
entitlement_grants.plan_key    text  NOT NULL
entitlement_grants.purchase_reference text NOT NULL
```

Ein Grant zeigt auf ein **Produkt**, nicht auf einzelne Keys. Die Formulierung
„der Pilot gewährt gezielt `site.build`, `site.preview`, `site.claim`" ist also
nur über ein **eigenes Pilot-Produkt** umsetzbar, dessen
`product_entitlements` genau diese Keys tragen. Das ist kein Umweg, sondern der
saubere Weg: Der Pilot wird dadurch selbst ein benanntes, auditierbares
Produkt — nur ohne Stripe-Preis.

**Zielbild des Pilot-Produkts**

| Feld | Wert |
|---|---|
| `name` | Builder-Pilot (14 Tage) |
| `default_for_plan_key` | `pilot_builder_14d` |
| `stripe_price_id` | leer — der Pilot wird nicht verkauft |
| Entitlements | `site.build`, `site.preview`, `site.claim`, `website.scan`, `dashboard.access`, `limit.site_builds_monthly = 1` |
| **nicht** enthalten | `site.deploy`, `domain.custom` — die bezahlte Schwelle |

**Lebenslauf**

```
Audit → Empfehlung → Pilot-Grant (expires_at = now + 14d)
     → Bauen und Ansehen erlaubt, Ausliefern nicht
     → Checkout → Subscription → dauerhafte Entitlements inkl. site.deploy
     → Grant läuft ab; nichts bricht, weil das Abo die Keys trägt
```

Der Ablauf braucht keinen Worker: `tenant_entitlements()` filtert bereits
`expires_at IS NULL OR expires_at > now()`. Ein abgelaufener Grant verschwindet
von selbst aus der Auflösung.

**Live-Ausgangslage:** `entitlement_grants` hat **0 Zeilen**. Der Weg ist
gebaut, aber noch nie benutzt worden — der erste Pilot ist zugleich der erste
Test dieses Pfads.

---

## 6. Die zwei Authorization-Fehler, die vorher weg müssen

Ihre Einordnung als Authorization-Bug statt Aufräumarbeit trifft zu. Beide
Fehler sitzen in derselben Auflösung, die auch der Pilot benutzt — sie zu
umgehen, hieße auf einem defekten Fundament zu bauen.

**A — `dashboard.access` fehlt auf allen bezahlten Plänen.** Gewährt nur von
`free_tier` und `governance_launch`. `AdaptiveGovernanceNav` prüft
`canAccess('dashboard.access')` und leitet sonst auf `upgradeUrl`. Ein zahlender
Growth-Kunde würde für sein eigenes Dashboard zum Upgrade geschickt. Dass es
noch niemanden trifft, liegt allein am `FREE_TIER_FALLBACK`, der nur ohne aktive
Subscription greift. **Betrifft ebenso** `website.scan`, `evidence.basic_vault`,
`governance.dsgvo_directory`, `governance.ai_register` — alle nur auf `free_tier`.

**B — Jahresprodukte tragen null Entitlements.** `tenant_entitlements()` löst
über `COALESCE` zuerst nach `stripe_price_id` auf. Ein Jahreskunde trifft das
Jahresprodukt; dessen ID ist nicht `NULL`, also greift der Rückfall auf
`free_tier` **nie**, und der Join liefert null Zeilen. Der Kunde hat dann keine
Berechtigungen — nicht weniger, keine. Live noch latent (4 Subscriptions, keine
jährlich). Dieselbe Lücke bei den drei `website_rebuild_*`-Produkten, was
unmittelbar den kanonischen Builder betrifft.

**Zwei Wege**, die vor der Umsetzung zu wählen sind:

| | Weg 1 — Daten | Weg 2 — Auflösung |
|---|---|---|
| Was | Jedes Jahres- und Rebuild-Produkt bekommt dieselben `product_entitlements` wie sein Monatszwilling | `tenant_entitlements()` erhält einen Rückfall: Produkt ohne Entitlements → Basisprodukt des `plan_key` |
| Vorteil | keine Funktionsänderung an der Auflösung | eine Stelle, wirkt für jedes künftige Produkt |
| Nachteil | jedes neue Produkt muss daran denken | verändert eine `SECURITY DEFINER`-Function, die alles autorisiert |
| Empfehlung | **beides**: Weg 1 als Korrektur, Weg 2 als Netz | |

---

## 7. P0-Reihenfolge

Die Reihenfolge des Eigentümers, ergänzt um das, was die Messung sichtbar
gemacht hat. Ergänzungen sind **fett** markiert.

**P0-A — Fundament**
1. #1129 in Analyse und Persistenz trennen
2. `/audit` als kanonischen Einstieg festlegen (CTA umstellen)
3. `rebuild-website` als kanonischen Builder erklären
4. Entitlement-Namensraum festlegen — **`website.scan` behalten, `audit.basic` nicht einführen**
5. `dashboard.access` für bezahlte Pläne reparieren
6. Jahresprodukte entitlementsieren — **plus Rückfall in `tenant_entitlements()`**
7. **`package_deploy` entschärfen: die erfundene Preview-URL entfernen und den Schritt als `skipped` melden, bis er echt ist** — vorgezogen aus P0-D, weil die Attrappe sonst über drei Phasen weiterläuft

**P0-B — Anonymer Trichter**
8. Anonyme Build-Session
9. Kontingent und Verfallsfrist
10. Preview persistieren
11. Claim ohne Rebuild

**P0-C — Capability und Billing**
12. Pilot-Produkt `pilot_builder_14d` anlegen (**Produkt, nicht lose Keys** — §5)
13. Builder-Capabilities definieren (`site.*`, `domain.custom`, Limits)
14. Plan-Matrix darauf abbilden
15. Checkout → Subscription → Entitlements durchtesten

**P0-D — echte Ausführung**
16. `audit` → Behebungsplan → Transformation (**vier Schritte koppeln;
    `legal_pages` ist bereits gekoppelt**)
17. **Impressum-Generator ergänzen** — 89 Befund-Vorkommen ohne Behebungsweg
18. `package_deploy` → echter Deployer, **inklusive Security-Header** (196
    Vorkommen)
19. Publish Gate
20. Eigene Domain

---

## 8. Was diese Matrix noch nicht entscheidet

- **Plan-Zuschnitt.** Welche der `site.*`-Keys auf Free, Starter, Business
  liegen, folgt aus dieser Matrix, steht aber noch nicht fest.
- **Namensbereinigung.** `partner` heißt in der Datenbank „Scale" —
  in CLAUDE.md §7 ausdrücklich untersagt. `free` und `free_tier` sind zwei
  Produkte; `free_audit` ist ein `plan_key` von 3 lebenden Subscriptions ohne
  jedes Produkt.
- **Die fremde Leiter.** `bronze`/`silver`/`gold`/`enterprise_public` plus drei
  verwaiste `(default)`-Dubletten ohne `plan_key`, die trotzdem Entitlements
  tragen. Sie stehen quer zu jedem Drei-Pakete-Modell.
- **`siteos`.** Nicht mehr Produkt-Builder — aber `packages/siteos-core`
  liefert die Analyse, die `/audit` speist. Ob `/app/siteos` bestehen bleibt,
  umgeleitet oder entfernt wird, ist eine Änderung an Bestehendem und damit
  nach CLAUDE.md §10.3 fragepflichtig.
