# Zielzustand — Paketmodell, Add-ons, Entitlements

**Stand: 2026-08-24. Konzept, keine Implementierung.**

Beruht auf den vier Entscheidungen des Eigentümers vom 2026-08-24 und dem
Entscheidungsbericht `docs/product/pricing-packaging-entscheidungsbericht.md`.
Preise, die neu wären, sind mit **PROPOSED** markiert.

**Nichts hiervon ist umgesetzt.** Kein Preis geändert, kein Produkt gelöscht,
keine Migration ausgeführt, kein Stripe-Objekt angefasst.

---

## 0. Das Produktversprechen in einem Satz

> Der Scan ist kostenlos und unbegrenzt. Bezahlt wird die dauerhafte
> Überwachung — und deren Erweiterungen.

Daraus folgt die Kette:

```
Kunde → Scan (frei) → Befund → Paket buchen → Dashboard aktiv
      → Governance-Core läuft → Module einzeln dazubuchen
```

Der entscheidende Vorteil dieses Zuschnitts: **Ein neues Modul ist künftig ein
neuer Entitlement-Key plus ein Stripe-Price — kein neues Paket.**

---

## 1. Entscheidung 1 — drei bezahlte Stufen

| Stufe | Preis | Scans | Überwachung | Self-Service |
|---|---|---|---|---|
| **Free** | 0 € | unbegrenzt | **keine** | ja |
| **Starter** | 79 € | unbegrenzt | monatlich | ja |
| **Growth** | 249 € | unbegrenzt | täglich + Drift-Erkennung | ja |
| **Enterprise** | Angebot | unbegrenzt | täglich + Drift | **nein** — individuelles Angebot |

Free bis Growth entsprechen exakt dem, was heute schon verdrahtet ist:
`monitoring.monthly` ab Starter, `monitoring.daily` und `monitoring.drift` ab
Growth, im Free-Plan keine Überwachung. Die Trennlinie zwischen kostenlos und
bezahlt muss nicht gezogen werden — sie liegt bereits richtig.

### 1.1 Was mit Agency und Partner geschieht

`agency` (699 €) und `partner` entfallen als Self-Service. Ihre heute
exklusiven Berechtigungen brauchen ein neues Zuhause, sonst gehen sie verloren.
Gemessen sind es vierzehn Keys. Vorschlag:

| Key | heute nur auf | **PROPOSED** neu |
|---|---|---|
| `api.access` | agency, enterprise, partner | **Growth** |
| `webhooks.enabled` | agency, enterprise, partner | **Growth** |
| `scheduler.enabled` | agency, enterprise, partner | **Growth** |
| `evidence.advanced` | agency, enterprise, partner | **Growth** |
| `bulk.jobs` | agency, enterprise, partner | **Growth** |
| `c2pa.export` | agency, enterprise, partner | **Growth** |
| `provenance.advanced` | agency, enterprise, partner | **Growth** |
| `policy.packs` | agency, enterprise, partner | **Starter** — siehe 1.2 |
| `whitelabel.reports` | agency, enterprise, partner | **Add-on** „White Label" |
| `whitelabel.dashboard` | enterprise, partner | **Add-on** „White Label" |
| `bots.voice` | agency, enterprise, partner | **Add-on** „Voice" |
| `org.governance` | enterprise, partner | **Enterprise** |
| `sso.enabled` | enterprise | **Enterprise** |
| `sla.priority` | agency, enterprise, partner | **Enterprise** |

### 1.2 Ein Befund, der dabei auffällt

**`policy.packs` liegt heute nicht auf Growth und nicht auf Starter** — nur auf
Agency, Enterprise, Partner und `governance_launch`. Für eine
Governance-Plattform, deren Kern die Policy Packs sind, ist das schwer zu
begründen: Ein Kunde zahlt 249 € für Governance und bekommt die Regelwerke
nicht. Der Vorschlag hebt sie auf Starter.

Das ist eine Erweiterung des Leistungsumfangs bestehender Pläne, also keine
Verschlechterung für irgendjemanden — aber es ist eine Produktentscheidung und
gehört ausdrücklich freigegeben.

---

## 2. Entscheidung 2 — ein Vokabular

**Kanonisch sind die Entitlement-Keys.** Alles andere wird darauf abgebildet.

```
Paket  ──┐
Add-on ──┼──→  Entitlement-Key  ──→  Runtime-Autorisierung  ──→  UI
Grant  ──┘
```

Nicht mehr: `Paket → Entitlement → unlocks → addon_id`.

### 2.1 Was zusammengeführt wird

| Vokabular | heute | Zielzustand |
|---|---|---|
| `entitlements.key` | 63 Keys | **bleibt — die Wahrheit** |
| `BOOKABLE_MODULES[].unlocks` | 9 Module, eigene Namen (`audit_center`) | `unlocks` enthält künftig **Entitlement-Keys** |
| `ADDONS` / `plan_addons.addon_id` | 6 Add-ons | Add-on trägt eine **Liste von Entitlement-Keys** |
| Übersetzungstabelle in `src/core/billing/entitlements.ts` | punktuelle Zuordnung | **entfällt** |

### 2.2 Die Fremdleiter wird stillgelegt, nicht gelöscht

`bronze`, `silver`, `gold`, `enterprise_public` plus die drei verwaisten
`(default)`-Produkte werden als **Legacy** markiert
(`plan_catalog.active = false`, `products.default_for_plan_key` bleibt stehen).

**Vor dem Stilllegen zu prüfen:** ob ein Mandant daran hängt. Heute lautet die
Messung: vier Subscriptions, davon drei auf `free_audit` und eine auf `growth`
— **keine** auf der Fremdleiter. Die Prüfung ist trotzdem Teil des Schritts,
weil sich das bis zur Umsetzung ändern kann.

Sechs Keys hängen ausschließlich an dieser Leiter und würden dadurch
unerreichbar: `ai.tool.code_explain`, `ai.tool.log_analyze`, `barcode.issue`,
`provenance.basic`, `public-sector.mode`, `watermark.apply`. Sie brauchen
entweder ein neues Zuhause in der Dreier-Leiter oder werden ausdrücklich als
eingestellt vermerkt. **Offene Frage an den Eigentümer.**

---

## 3. Entscheidung 3 — WhatsApp: die Frage war falsch gestellt

Der Auftrag lautete, die beiden Quellen zu identifizieren. Es sind **vier**, und
sie widersprechen sich nicht zufällig — sie gehören zu **drei verschiedenen
Geschäftsmodellen**.

### 3.1 Was gemessen wurde

| # | Ort | Preis | Modell dahinter | Sichtbar für Kunden |
|---|---|---|---|---|
| 1 | `BOOKABLE_MODULES.whatsapp_bot` (`shared/pricing.ts`) | **39 €** | modulares Modell: Governance Core 79 € + Module einzeln | **ja** — `/app/marketplace` |
| 2 | `ADDONS.whatsapp` (`shared/pricing.ts`) → `plan_addons` (DB) | **99 €** | Abo-Leiter + Add-ons | **ja** — Preisseite, `GovernanceBotsSection` |
| 3 | `src/pages/WhatsAppPricingPage.tsx` | eigene Tarife | eigene Kanal-Leiter | **ja** — `/pricing/whatsapp` |
| 4 | Stripe | **kein Produkt, kein Price** | — | nein |

### 3.2 Die drei Modelle

**Modell A — modular (39 €).** Nichts ist enthalten; wer WhatsApp will, bucht
das Modul für 39 € zum Governance Core. Das ist die Logik von
`BOOKABLE_MODULES`.

**Modell B — Abo plus Add-on (99 €).** WhatsApp ist ein Zusatz für Growth und
darüber. Hier liegt jedoch ein **Widerspruch im Bestand**: Der Growth-Plan
enthält den WhatsApp-Kanal bereits (`channels: ['website', 'whatsapp',
'telegram']`). Das 99-€-Add-on verkauft also an Growth-Kunden etwas, das ihr
Plan schon enthält, und ist für Starter — den einzigen Plan **ohne** WhatsApp —
laut `availableFor` **nicht** buchbar. Das ist genau verkehrt herum.

**Modell C — eigene Kanal-Leiter (`/pricing/whatsapp`).** Die Seite ist
hartkodiert und führt vier Tarife:

| Tarif dort | Preis dort | tatsächlicher Plan |
|---|---|---|
| Starter WhatsApp | 79 € | = Starter (79 €) |
| Growth WhatsApp | 249 € | = Growth (249 €) |
| Agency WhatsApp | 699 € | = Agency (699 €) |
| Enterprise WhatsApp | **1249 €** | Enterprise ist „auf Anfrage" — **diese Zahl existiert sonst nirgends** |

Die Kauf-Knöpfe zeigen auf `/checkout/starter`, `/checkout/growth`,
`/checkout/agency`. **Die Seite verkauft also die normalen Pläne** und ist keine
eigene Produktlinie — bis auf die 1249 €, die frei erfunden sind.

Nebenbei verstößt sie gegen CLAUDE.md §6 und Ihren §4: Preise stehen direkt in
einer React-Komponente statt in der Quelle.

### 3.3 Empfehlung

**Weder 39 € noch 99 € unverändert übernehmen, sondern zuerst das Modell
festlegen — es ist mit Entscheidung 1 bereits gefallen.**

Da die Dreier-Leiter gilt, ist Modell B das Zielmodell. Daraus folgt:

| Was | **PROPOSED** |
|---|---|
| WhatsApp in **Free** | nicht enthalten, nicht buchbar |
| WhatsApp in **Starter** | **als Add-on buchbar** — heute nicht möglich, `availableFor` korrigieren |
| WhatsApp in **Growth** | **enthalten** (wie heute) |
| Preis des Add-ons | **99 €/Monat**, zzgl. WhatsApp-Konversationsgebühren |
| 39 € aus `BOOKABLE_MODULES` | **entfällt** mit Modell A |
| `/pricing/whatsapp` | Preise aus der Quelle beziehen statt hartkodieren; die 1249 € streichen |

**Begründung für 99 € statt 39 €:** Der Wert steht in der Datenbank
(`plan_addons`), auf der öffentlichen Preisseite und in `ADDONS` — drei
übereinstimmende Stellen gegen eine. Und er gehört zu dem Modell, das mit
Entscheidung 1 gilt. Die 39 € gehören zu einem Modell, das damit entfällt.

**Achtung, sichtbare Preisänderung:** Die 39 € stehen heute im Marketplace
unter `/app/marketplace`. Der Wechsel auf 99 € ist damit eine Änderung an
bereits Sichtbarem und braucht nach CLAUDE.md §10.3 eine ausdrückliche Freigabe.

> **Achtung, Funktionsänderung — sollen wir dies machen? Ja oder nein?**
> Konkret: WhatsApp im Marketplace von 39 € auf 99 € heben, als Add-on für
> Starter öffnen und die hartkodierten Preise auf `/pricing/whatsapp` durch die
> Quelle ersetzen.

---

## 4. Entscheidung 4 — Grace Period von sieben Tagen

```
Zahlung fehlgeschlagen
      ↓  Stripe: invoice.payment_failed → subscription.status = 'past_due'
Entitlements bleiben aktiv          ← Tag 0
      ↓  Zahlungsaufforderung an den Kunden
      ↓  7 Tage
Entitlements pausieren              ← Tag 7
      ↓  Daten und Konfiguration bleiben unangetastet
Zahlung erfolgreich → automatische Reaktivierung
```

### 4.1 Was das technisch bedeutet

Der Auflöser `tenant_entitlements()` fragt heute **nicht** nach
`subscriptions.status`. Ein Abo im Zustand `past_due` liefert daher weiterhin
alle Berechtigungen — die Grace Period ist faktisch unendlich.

Der Zielzustand braucht genau eine Ergänzung: Die Auswahl der aktiven
Subscription berücksichtigt den Status und ein Ablaufdatum.

| Status | Entitlements |
|---|---|
| `active`, `trialing` | vollständig |
| `past_due` **innerhalb** 7 Tagen | vollständig |
| `past_due` **nach** 7 Tagen | wie Free-Plan |
| `canceled` | wie Free-Plan |

**Wichtig — pausieren heißt nicht löschen.** Der Mandant, seine Daten, seine
Domains, sein Evidence Vault und seine Konfiguration bleiben. Es fällt allein
der Zugriff auf die bezahlten Funktionen weg. Für eine Governance-Plattform ist
das die einzig vertretbare Auslegung: Ein Prüfpfad, der bei einer
fehlgeschlagenen Lastschrift verschwindet, wäre als Nachweis wertlos.

**Was zu klären bleibt:** Läuft die Überwachung während der Pause weiter (und
sammelt Befunde, die der Kunde nicht sieht) oder ruht sie? Ich empfehle
**ruhen** — Überwachung, die niemand sieht, erzeugt Kosten ohne Nutzen und
könnte als Zusage missverstanden werden, die gerade nicht gilt.

---

## 5. Zielzustand der Add-ons

Aus dem Bestand abgeleitet. Nur was heute liefert.

| Add-on | Preis | Für | Entitlement-Keys | Reifegrad |
|---|---|---|---|---|
| WhatsApp-Kanal | 99 € | Starter | `whatsapp`, `bots.enabled`, `limit.bot_messages_monthly` | produktiv |
| Voice-Kanal | 150 € | Starter, Growth | `bots.voice`, `limit.bot_voice_minutes_monthly` | produktiv |
| Response Pack | 49 € | Starter, Growth | `limit.bot_messages_monthly` (additiv) | produktiv |
| White Label | 299 € | Growth | `whitelabel.dashboard`, `whitelabel.reports` | produktiv |
| Weitere Domain | 19 €/Stück | alle bezahlten | `limit.domains` (additiv) | produktiv |
| Weiteres Unternehmen | 49 €/Stück | Growth | `limit.tenants`, `org.governance` | produktiv |
| Terminbuchung | 29 € | Starter, Growth | Booking-Keys — **fehlen heute** | produktiv, Key fehlt |

**Bewusst noch nicht im Katalog:**

- **Website-Builder.** `package_deploy` liefert nicht aus; der Schritt bricht
  seit dem 2026-08-24 ehrlich ab. Ein bezahltes Modul, das eine Preview-Adresse
  ohne Inhalt liefert, kostet mehr Vertrauen als es einbringt. Kommt in den
  Katalog, wenn der Deployer verdrahtet ist.
- **Advanced AI Governance** (NIS2, ISO 27001). Rahmenwerke vorhanden, aber
  ohne Datenfluss.
- **Compliance Pack** (149 €). Überschneidet sich mit `policy.packs`, das nach
  1.2 in Starter wandert. Erst nach dieser Entscheidung sinnvoll zuzuschneiden.

---

## 6. Zielzustand der Durchsetzung

Der Befund „18 von 178" ist ein eigener Arbeitsstrang, kein Nebeneffekt des
Packagings. Der Zielzustand:

```
Anfrage → JWT prüfen            (vorhanden, 57 Functions)
        → Mandant auflösen      (vorhanden, RLS)
        → Entitlement prüfen    (Wächter vorhanden, 18 Functions nutzen ihn)
        → Kontingent prüfen     (requireQuota vorhanden)
        → ausführen
```

**Reihenfolge der Nachrüstung** — nicht alphabetisch, sondern nach Schadenshöhe:

1. Functions, die **Geld** bewegen oder Kosten verursachen (KI-Aufrufe,
   Telefonie, Bots, Bulk-Jobs)
2. Functions, die **fremde Systeme** erreichen (Webhooks, Connectors, Deploy)
3. Functions, die **Daten ausleiten** (Exporte, Berichte, API)
4. der Rest

Jede nachgerüstete Function braucht einen Test, der den 403-Fall belegt —
sonst ist die Prüfung eine Behauptung.

**Wichtig für die Reihenfolge insgesamt:** Diese Nachrüstung sollte **nach** der
Vokabular-Zusammenführung (Abschnitt 2) kommen. Wer vorher anfängt, verdrahtet
Keys, die danach umbenannt werden.

---

## 7. Zielzustand Stripe

| Objekt | Zielzustand |
|---|---|
| Free | kein Stripe-Objekt (0 €) |
| Starter, Growth | je ein wiederkehrender Price — **existiert** |
| Enterprise | kein Self-Service-Price; Angebot und manuelle Rechnung — **wie heute** |
| Add-ons | **je ein wiederkehrender Price — fehlt vollständig** |
| Buchung | Add-on = zusätzliche Position in derselben Subscription |
| Persistenz | `subscription_addons.stripe_item_id` — **Tabelle existiert, wartet** |
| Kündigung eines Add-ons | Position löschen, Zeile entfernen; Abo bleibt |
| Legacy-Pläne | Prices bleiben bestehen, Produkte werden inaktiv |

**Der eine fehlende Baustein bleibt der Add-on-Price.** Ohne ihn ist jede
Add-on-Oberfläche eine Attrappe.

---

## 8. Zielzustand Dashboard

Ein Bereich „Mein Plan", zwei Listen, eine Preisvorschau.

```
Mein Plan                     Growth · 249 € / Monat
Nächste Abrechnung            15.09.2026

Enthalten
  ✓ Überwachung täglich + Drift-Erkennung
  ✓ Policy Packs · Evidence Vault · Prüfpfad
  ✓ WhatsApp- und Telegram-Kanal
  ✓ Website-Scans                unbegrenzt
  ✓ Compliance-Exporte           12 / Monat

Zubuchbar
  ○ Voice-Kanal                  + 150 € / Monat
  ○ White Label                  + 299 € / Monat
  ○ Weitere Domain               +  19 € / Monat je Domain

Vor der Aktivierung:
    heute        249 €
    Voice        + 150 €
    ─────────────────────
    ab 15.09.    399 € / Monat
```

Ohne diese drei Zeilen keine Aktivierung. Ort ist `/app/marketplace` aus
PR #1129 — keine neue Fläche.

---

## 9. Was in welcher Reihenfolge

| # | Schritt | Voraussetzung |
|---|---|---|
| 1 | Vokabular zusammenführen — `unlocks` und `addon_id` auf Entitlement-Keys | — |
| 2 | Entitlements der entfallenden Stufen umhängen (1.1), `policy.packs` klären (1.2) | 1 |
| 3 | Fremdleiter als Legacy markieren, vorher Mandanten prüfen | 1 |
| 4 | Grace Period in `tenant_entitlements()` | unabhängig |
| 5 | Stripe-Prices je Add-on anlegen | 2 |
| 6 | Add-on-Buchung verdrahten (`line_items`, `subscription_addons`, Webhook) | 5 |
| 7 | Dashboard „Mein Plan" mit Preisvorschau | 6 |
| 8 | Abhängigkeiten modellieren und beim Buchen prüfen | 6 |
| 9 | Entitlement-Durchsetzung nachrüsten, nach Schadenshöhe | 1 |
| 10 | `/pricing/whatsapp` entkoppeln, hartkodierte Preise entfernen | 1 |
| 11 | Aufräumen: verwaiste Dashboards, Dubletten | zuletzt |

Schritt 4 ist unabhängig und könnte vorgezogen werden — er behebt, dass ein
nicht zahlender Kunde heute unbegrenzt weiterläuft.

---

## 10. Was noch entschieden werden muss

| # | Frage | Warum sie zählt |
|---|---|---|
| 1 | **WhatsApp im Marketplace von 39 € auf 99 €** heben und für Starter öffnen? | sichtbare Preisänderung, §10.3 |
| 2 | **`policy.packs` auf Starter** heben? | heute zahlt ein Growth-Kunde 249 € ohne Regelwerke |
| 3 | Die **sechs Keys der Fremdleiter** — neues Zuhause oder eingestellt? | sonst verschwinden sie mit dem Stilllegen |
| 4 | **Ruht die Überwachung** während der Grace Period oder läuft sie weiter? | Kosten gegen Erwartung |
| 5 | Die **1249 €** auf `/pricing/whatsapp` — streichen oder ist Enterprise so gemeint? | die Zahl existiert sonst nirgends |

**Es wird nichts umgesetzt, bevor Sie freigeben.**
