# Vorschlag: Plan-Konsolidierung — Free + 2 Kernpakete + Modul-Store

**Status**: VORSCHLAG zur Freigabe durch den Eigentümer — **nichts hiervon ist
umgesetzt**. Keine Preisänderung, keine Planänderung, kein Stripe-Eingriff.
**Datum**: 2026-08-23
**Grundlagen**: `docs/product/capability-matrix.md` (Messung),
`docs/product/reality-matrix.md` (Phase 0), `shared/pricing.ts` (SSoT),
`docs/product/pricing-governance.md` (Regeln).

**Produktentscheidung, die dieser Vorschlag umsetzt**: „Gratis + maximal 2–3
Pakete; alles Weitere aus dem Dashboard" (Eigentümer, 2026-08-23).

---

## 1. Ausgangslage — zwei Preissysteme parallel

Heute existieren nebeneinander:

1. **Die Sechser-Leiter** (`PLANS`): Free Audit → Starter 79 € → Growth 249 €
   → Agency 699 € → Enterprise 1.249 € → Partner 1.999 €, plus Add-ons
   (`ADDONS`) und das Einmalprodukt Governance Launch.
2. **Der modulare Checkout** (`BOOKABLE_MODULES`): Governance Core 79 €
   (Pflicht) + 8 einzeln zubuchbare Module (`MODULE_PRICING_STATUS =
   'provisional'`).

Voice und WhatsApp haben dadurch **zwei Preise**
(`MODULE_ADDON_PRICE_DIVERGENCE`) — deklariert, aber ungelöst. Die
Konsolidierung ist zugleich die Auflösung dieser Divergenz.

## 2. Zielbild

```
FREE                    STARTER                  BUSINESS
(Free Audit, 0 €)       (= Governance Core)      (= Core + Advanced)
     │                        │                        │
     └────────────────────────┴────────────────────────┘
                              │
                    DASHBOARD-MODUL-STORE
        Website Chat · Voice Bot · WhatsApp Bot · Terminbuchung
        AI Frontend · Weitere Domain · Weiteres Unternehmen
                              │
                    ENTERPRISE (auf Anfrage)
        White-Label · Multi-Tenant · SLA · Partner-Konditionen
```

| Zielpaket | Herkunft | Inhalt (Entitlement-Sicht) |
|---|---|---|
| **FREE** | Free Audit, unverändert | Einmal-Scan, Score, 1 Bericht — der Trichter-Eingang |
| **STARTER** | Starter ≈ Governance Core (beide 79 €) | DSGVO + EU AI Act, Evidence Vault, Audit-Export, Monitoring, Alerts |
| **BUSINESS** | Growth + Advanced-AI-Governance-Modul | Starter + ISO 27001/NIS2, Risk Register, Workflows, Drift, Remediation, höhere Limits |
| **Modul-Store** | `BOOKABLE_MODULES` (ohne Core) | Chat, Voice, WhatsApp, Booking, AI Frontend, Domain, Unternehmen — je Modul „Aktivieren" im Dashboard |
| **ENTERPRISE** | Enterprise + Partner, `purchaseMode: 'inquiry'` | verlässt die Selbstbedienung: White-Label, Multi-Tenant, SLA, Partner-Konditionen als Vertriebsgespräch |

Prinzipien:

- **Zugriff bleibt `hasModule()`/`hasPermission()`/`limitOf()`** — die
  Konsolidierung ändert Verkaufseinheiten, nicht die Art der
  Berechtigungsprüfung.
- **Persistenz bleibt die bestehende Kette** `products →
  product_entitlements → entitlements` + `tenant_entitlements()`. Keine
  neue Tabelle (Lehre aus `reality-matrix.md` §3).
- **Ein Kanal, ein Preis**: `ADDONS` für Voice/WhatsApp/Response-Pack werden
  zugunsten der Bookable Modules stillgelegt (deprecated, nicht gelöscht —
  Bestands-Add-ons laufen weiter). `MODULE_ADDON_PRICE_DIVERGENCE` wird
  damit leer.
- **Einmalprodukte** (Governance Launch) bleiben unberührt — sie sind schon
  heute kein Rang der Leiter.

## 3. Migrationspfad (wenn freigegeben)

1. **Preise kalkulieren** — `MODULE_PRICING_STATUS` von `'provisional'` auf
   kalkulierte Beträge heben (Telefonie/STT/TTS, LLM-Token,
   WhatsApp-Konversationsgebühren, Scan-Laufzeit). Ohne diesen Schritt wird
   nichts umgestellt.
2. **`shared/pricing.ts`**: `PLAN_ORDER` auf `free → starter → business →
   enterprise` verengen; `normalizePlanKey()` erweitert um `growth →
   business`, `agency → business`+Grant-Migration, `partner → enterprise`
   (gleiches Muster wie `scale → partner`). Danach `npm run sync:pricing`,
   `npm run check:pricing`.
3. **DB**: `plan_catalog`/`products.default_for_plan_key` nachziehen
   (Muster: Migration `20260802001000_canonical_plan_catalog.sql`).
   Bestandskunden werden **nicht** zwangsmigriert — Grandfathering, Wechsel
   nur beim nächsten Checkout/Portal-Besuch.
4. **Stripe**: neue Prices für Business + Module; alte Prices archivieren,
   nicht löschen (laufende Subscriptions).
5. **Dashboard**: Modulansicht „Öffnen vs. Aktivieren" auf
   `Gate`/`FeatureGate` verdrahten (Befund 7 der Capability-Matrix — die
   Bausteine existieren, es fehlt die Adoption).
6. **Öffentliche Pricing-Seite**: Textänderung an Bestehendem →
   **Fragepflicht nach `CLAUDE.md` §10.3**, eigener Freigabeschritt.

## 4. Offene Entscheidungen (für den Eigentümer)

1. **Paket-Namen**: „Business" ist Arbeitstitel. (Nicht „Scale" — der Name
   ist untersagt.)
2. **Advanced AI Governance**: fest in BUSINESS (Vorschlag) oder als
   Store-Modul behalten?
3. **Agency-Bestandskunden**: Business + White-Label-Gespräch, oder eigene
   Grandfather-Stufe bis Vertragsende?
4. **Preispunkte**: erst nach der Kostenkalkulation aus §3.1 — dieser
   Vorschlag nennt bewusst keine neuen Beträge.

## 5. Was dieser Vorschlag ausdrücklich nicht tut

Keine Änderung an `shared/pricing.ts`, keine Migration, kein Stripe-Zugriff,
keine Änderung öffentlicher Seiten. Erst wenn §4 entschieden ist, wird §3
als eigene, additive Arbeitspakete umgesetzt.
