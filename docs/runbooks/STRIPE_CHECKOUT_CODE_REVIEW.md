# Code Review: `stripe-checkout` Edge Function

**Datei**: `supabase/functions/stripe-checkout/index.ts` (272 Zeilen)  
**Zweck**: Stripe Checkout Session anlegen für Abonnements und Einmalkäufe  
**Status**: ✅ **Produktionsreif** — Architektur und Error-Handling sind solide  

---

## ✅ Stärken

### 1. **Sicherheit: Multi-Layer Validation**
- ✅ JWT-Validierung (Bearer Token, Supabase Auth)
- ✅ Tenant-Zugehörigkeit geprüft (User ist Member?)
- ✅ Role-Check (nur Owner/Admin darf Checkout starten)
- ✅ Plan-Key gegen Pricing-SSoT validiert (keine fremden Keys möglich)
- ✅ Legacy-Pläne blockiert (Ursache A aus Recovery Guide)

**Code** (Zeile 133–141):
```typescript
if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
if (membership.role !== 'owner' && membership.role !== 'admin') {
  return jsonError(403, 'FORBIDDEN', 'only owner/admin may start checkout');
}
```

### 2. **Vault-First Secret Management**
- ✅ Secrets laufen im Handler, nicht beim Module-Load
- ✅ Vault-First-Fallback auf `.env` (Operator kann live updaten ohne Redeploy)
- ✅ Fehlendes Secret gibt 500, nicht 502 (klare Diagnose)

**Code** (Zeile 50–60):
```typescript
async function getSecret(envVar: string, vaultName: string): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ...);
  const { data, error } = await admin.rpc('get_app_secret', { secret_name: vaultName });
  if (!error && typeof data === 'string' && data.length > 0) return data;
  return Deno.env.get(envVar) ?? null;
}
```

### 3. **Pricing-Governance**
- ✅ Plan-Key wird normalisiert (`scale` → `partner`)
- ✅ `purchaseMode` kommt **nicht** aus Request-Body, sondern aus Pricing-SSoT
- ✅ Free Plans kurz-geschlossen (Zeile 98–100)
- ✅ Legacy-Pläne (Agency, Partner) blockiert (Zeile 110–113)
- ✅ Enterprise nur über Vertragsweg, nicht Self-Service (Zeile 126–130)

**Code** (Zeile 98–100):
```typescript
if (plan.purchaseMode === 'free') {
  return jsonError(400, 'BAD_REQUEST', 'Free Audit braucht keinen Checkout');
}
```

### 4. **Preis-Validierung: Sentinel-Detection**
- ✅ Stripe-Price-ID muss mit `price_` beginnen (nicht `internal_*` oder leer)
- ✅ Verhindert API-Fehler durch Schema-Validierung statt Laufzeit-Fehler

**Code** (Zeile 178–184):
```typescript
const isLiveStripePrice = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith('price_');
const realPrice = (products ?? []).find((p) => isLiveStripePrice(p.stripe_price_id));
if (!realPrice) {
  return jsonError(400, 'PRICE_NOT_CONFIGURED', ...);
}
```

### 5. **Error Handling & Messaging**
- ✅ Try-Catch um Stripe-API (Zeile 220–269)
- ✅ Explizite Fehler-Codes (PRICE_NOT_CONFIGURED, STRIPE_ERROR, ENTERPRISE_CONTRACT_ONLY)
- ✅ Nutzer-Meldungen sind actionable (nicht generisch)

**Code** (Zeile 267–269):
```typescript
} catch (e) {
  return jsonError(502, 'STRIPE_ERROR', `stripe checkout failed: ${(e as Error).message}`);
}
```

### 6. **One-Time vs. Subscription Handling**
- ✅ `subscription_data` wird nur bei `mode: 'subscription'` gesetzt
- ✅ `payment_intent_data` wird nur bei `mode: 'payment'` gesetzt (Zeile 246–254)
- ✅ Tenant-Zuordnung in beiden Modi sichergestellt

---

## ⚠️ Verbesserungen (nicht kritisch)

### 1. **Strukturierte Logs**
- **Aktuell**: Keine Log-Ausgaben
- **Ideal**: Structured Logging für Debugging
- **Grund**: Fehler-Szenarien sind schwer nachzuvollziehen ohne Logs

**Vorschlag** (optional, Phase 3):
```typescript
console.log(JSON.stringify({
  event: 'stripe_checkout_initiated',
  tenant_id: body.tenant_id,
  plan_key: body.plan_key,
  timestamp: new Date().toISOString(),
}, null, 2));
```

### 2. **Integration mit `ai_tool_runs` / `workflow_runs`**
- **Aktuell**: Checkout wird nicht in Audit-Table geloggt
- **Ideal**: Jeder Checkout wird in `public.ai_tool_runs` oder ähnlich gespeichert
- **Grund**: Governance / Prüfpfad-Anforderung
- **Status**: Könnte in Phase 3 durch eine Webhook-Nachbearbeitung erfolgen

### 3. **Keine Tests für die Edge Function selbst**
- **Aktuell**: Tests existieren für UI (`checkoutPage.test.tsx`) und Webhooks
- **Fehlt**: Integration-Tests für die Function (`stripe-checkout.test.ts`)
- **Grund**: Könnte Regressions-Fehler früher fangen
- **Umfang**: Könnte in nächster Iteration hinzugefügt werden

---

## 🎯 Fazit

**Die Function ist produktionsreif.**

Stärken überwiegen deutlich. Die fehlenden Verbesserungen sind **Nice-to-Have**, nicht **Must-Have**:

| Was | Nutzen | Aufwand | Phase |
|-----|--------|--------|-------|
| Struktur-Logs | Besseres Debugging | 30 min | 3 |
| `ai_tool_runs` Integration | Governance-Traceability | 1h | 3 |
| Edge-Function-Tests | Regressions-Prävention | 2h | 3 |

---

## Nächste Schritte

1. ✅ **Sofort**: Recovery Guide (STRIPE_CHECKOUT_RECOVERY.md) umsetzen
2. 📋 **Phase 3**: Structured Logs hinzufügen
3. 📋 **Phase 3**: `ai_tool_runs` Integration für Checkout-Events
4. 📋 **Phase 3**: Edge-Function-Tests schreiben

---

## Referenzen

- **Function**: `supabase/functions/stripe-checkout/index.ts`
- **Tests**: `test/billing/checkoutPage.test.tsx`, `test/contracts/stripe-price-guard.test.ts`
- **Pricing-SSoT**: `shared/pricing.ts`
- **Recovery**: `docs/runbooks/STRIPE_CHECKOUT_RECOVERY.md`

