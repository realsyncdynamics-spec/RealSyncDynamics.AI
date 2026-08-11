# 05 — Billing / Stripe

## 1. Webhook-Pfad — verifiziert

`supabase/functions/stripe-webhook/index.ts`, **deployt** (Live-Probe: HTTP 400 ohne
Signatur — korrektes Verhalten).

| Kontrolle | Umsetzung | Bewertung |
|---|---|---|
| Signaturprüfung | `stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET)` über den **Rohtext** | ✅ korrekt |
| Fehlende Signatur | `400 missing signature` vor jeder Verarbeitung | ✅ |
| Secret-Quelle | Vault-first (`get_app_secret`), Env-Fallback — Rotation ohne Redeploy | ✅ gut gelöst |
| Idempotenz | Insert der `event.id` mit `ON CONFLICT DO NOTHING`; Duplikat = No-op-Erfolg | ✅ |
| Fehler-Rollback | Idempotenz-Zeile wird zurückgerollt, damit Stripe erneut zustellt | ✅ durchdacht |
| Tenant-Bindung | `metadata.tenant_id` auf Customer/Subscription; **ohne → Ablehnung** | ✅ |
| Plan-Auflösung | `normalizePlanKey` + `planByKey` aus `_shared/pricing.generated.ts` | ✅ Single Source |
| API-Version | gepinnt `2024-06-20` | ✅ |

**Angriffe (aus dem Code beurteilt, nicht gegen Produktion ausgeführt — Regel 15):**

| Angriff | Ergebnis |
|---|---|
| Gefälschter Webhook | HMAC schlägt fehl → 400 ✅ |
| Replay eines echten Events | Idempotenz-Insert kollidiert → No-op ✅ |
| Doppelte Zustellung | dito ✅ |
| Falscher Tenant | `metadata.tenant_id` maßgeblich; ohne → Ablehnung ✅ |
| Falscher Preis | Plan aus generiertem Katalog, nicht aus dem Event ✅ |

**Bewertung: Der Stripe-Webhook ist der am saubersten implementierte Teil des
Systems.**

---

## 2. Checkout-Pfad

`stripe-checkout` löst die Price-ID **serverseitig** aus `public.products`
(`default_for_plan_key`-Match) und verwirft Sentinel-Werte (`internal_default_*`).
Die `VITE_STRIPE_PRICE_*`-Variablen sind ausdrücklich nur UI-Convenience und werden
für die Preisermittlung nicht gelesen. ✅ Richtiges Design — der Client kann den
Preis nicht beeinflussen.

---

## 3. Produktionslücken

| Function | Zweck | Prod |
|---|---|---|
| `stripe-webhook` | Abo-Sync | ✅ deployt |
| `stripe-checkout` | Checkout-Session | ✅ deployt |
| `stripe-portal` | Kündigung / Zahlungsmittel | ✅ deployt |
| `stripe-meter-sync` | Metered Billing | ✅ deployt |
| **`create-trial-subscription`** | 14-Tage-Trial | ❌ **404** |
| **`stripe-checkout-verify`** | Post-Checkout-Verifikation (Frontend ruft auf) | ❌ **404** |
| **`invoice-email`** | Rechnungsversand | ❌ **404** |
| **`stripe-oauth-callback`** | Connect/OAuth | ❌ **404** |
| **`stripe-token-meter-sync`** | Token-Metering | ❌ **404** |
| **`automation-trigger-trial-webhook`** | Trial-Events | ❌ 404 (+ Auth-Bypass F-04) |

**`entitlement_grants` fehlt in der Produktions-Datenbank** (`PGRST205`) → F-03.

---

## 4. Entitlement-Matrix

Quelle: `shared/pricing.ts` (Single Source of Truth, `npm run check:pricing` ✅ grün —
Deno-Zwilling und DB-Katalog `20260808140000_canonical_plan_catalog.sql` synchron).

| Ebene | Zustand |
|---|---|
| MARKETING (`/pricing`) | aus `shared/pricing.ts` projiziert ✅ |
| FRONTEND | `hasPermission()` / `hasModule()` / `limitOf()` — keine Plan-Namen-Vergleiche ✅ |
| BACKEND | `_shared/pricing.generated.ts` — synchron ✅ |
| DATENBANK | `plan_catalog`-Migration synchron ✅ |
| **STRIPE** | **nicht verifizierbar** — `npm run stripe:diff` braucht Live-Credentials ⚠️ GRAU |
| **ENFORCEMENT** | siehe unten ⚠️ |

### Limit-Durchsetzung

`recordUsage()` in `_shared/usage.ts` wird von `workflow-callback` und
`automation-callback` aufgerufen — aber **nach** der Ausführung und in einem
`try/catch`, dessen Fehler nur geloggt wird:

```ts
try { await recordUsage(admin, run.tenant_id, 'limit.automation_runs_monthly', 1, ...); }
catch (e) { console.error('recordUsage failed', (e as Error).message); }
```

**Konsequenzen:**
- Das Kontingent wird **gezählt**, nicht **erzwungen** — es gibt an dieser Stelle keine
  Prüfung „Limit erreicht → ablehnen".
- Schlägt `recordUsage` fehl, läuft der Job trotzdem durch und wird nicht gezählt →
  systematische Unterzählung zugunsten des Kunden.
- Parallele Requests: kein Lock, keine atomare Prüfung → klassische Race-Condition
  beim Überschreiten der Grenze.
- `entitlement_grants` fehlt in Prod → Einmalprodukte greifen gar nicht.

**Nicht getestet:** Quota-Bypass gegen Produktion (Regel 15/16). Die Bewertung
stammt aus dem Code-Pfad.

---

## 5. Findings

| ID | Sev | Kurz |
|---|---|---|
| F-03 | P0 | `entitlement_grants` fehlt → Einmalprodukt 349 € nicht auslieferbar |
| F-04 | P0 | `automation-trigger-trial-webhook` akzeptiert `Bearer <beliebig>` und setzt Trial-Zustand fremder Tenants |
| F-B1 | — | ✅ Webhook-Signatur + Idempotenz vorbildlich |
| F-B2 | P2 | 6 Billing-Functions nicht deployt, davon `stripe-checkout-verify` vom Frontend aufgerufen |
| F-B3 | P2 | Limits werden gezählt, nicht erzwungen; keine Atomarität → Quota-Race |
| F-B4 | P3 | Stripe-Katalog vs. `shared/pricing.ts` nicht automatisiert verifiziert (`stripe:diff` läuft nicht in CI) |
| F-B5 | P3 | Kein Test für „Webhook darf keinen fremden Tenant verändern" |
