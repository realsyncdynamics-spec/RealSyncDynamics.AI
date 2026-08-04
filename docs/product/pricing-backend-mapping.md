# Pricing Backend Mapping — Konsistenz über alle Schichten

**Ziel**: Preise, Limits und Module sind `shared/pricing.ts` die einzige Quelle der Wahrheit. Keine abweichenden Werte in Stripe, DB oder Edge Functions.

---

## Architektur

```
Frontend              Backend                Database
────────────────────────────────────────────────────────
shared/pricing.ts ──→ Deno/Edge Functions ──→ postgres
  ↓                      ↓                        ↓
  └──────────────────────→ Stripe Metadata      Products Catalog
```

### 1. Frontend → Deno (Pricing Sync)

**Datei**: `supabase/functions/_shared/pricing.generated.ts`

Diese Datei wird **AUTOMATISCH** aus `shared/pricing.ts` erzeugt:

```bash
npm run sync:pricing
```

Das Script (`scripts/sync-pricing.mjs`) kopiert den exakten Plan-Katalog nach Deno.

**Warum?**
- Deno hat keine `import()` zu Node-Modulen
- Beide Umgebungen müssen identisch sein
- Test (`test/config/pricing-ssot.test.ts`) prüft auf Drift

**Gültig?** Immer dann, wenn:
```bash
npm run check:pricing
```
0 Unterschiede meldet.

---

### 2. Deno → Stripe (Plan-Keys)

**Edge Function**: `supabase/functions/create-checkout-session/index.ts`

Diese Function mappt `planKey` → Stripe-Price-ID.

```typescript
// Nicht so:
const stripePriceId = HARDCODED_PRICES[planKey]; // FALSCH

// Sondern so:
const plan = planByKey(planKey); // Aus pricing.generated.ts
const stripePriceId = await db
  .from('public.stripe_price_mapping')
  .select('stripe_price_id')
  .eq('plan_key', plan.planKey)
  .single();
```

**Plan-Key ist das Bindeglied**:
- Frontend sendet `plan_key` (z.B. `growth`, `starter_yearly`)
- Deno schlägt auf `public.stripe_price_mapping` nach
- Stripe-Price-ID wird abgerufen und an Stripe API übergeben

**Tabelle**: `public.stripe_price_mapping`

```sql
CREATE TABLE public.stripe_price_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE,  -- 'starter', 'starter_yearly', etc.
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  price_eur NUMERIC NOT NULL,     -- MUSS mit shared/pricing.ts übereinstimmen
  billing_interval TEXT NOT NULL, -- 'month' | 'year' | 'one_time'
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_stripe_price_mapping_plan_key 
  ON public.stripe_price_mapping(plan_key);
```

**Wartung**: Nur über Deno-Funktion `sync-stripe-pricing` ändern (nicht manuell editieren):

```bash
# Edge Function aufrufen (mit Service-Role-Key):
curl -X POST https://API_URL/functions/v1/sync-stripe-pricing \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --data-raw '{"dryRun": false}'
```

Diese Function:
1. Liest `pricing.generated.ts`
2. Iteriert über alle `PLANS` + `planKey`
3. Erstellt/aktualisiert Stripe-Products + Prices über Stripe API
4. Schreibt `stripe_price_mapping` in die DB

---

### 3. Deno → Database (Limits + Modules)

**Tabelle**: `public.products_catalog`

Diese Tabelle ist die **Quelle für die App** (Subscriptions-Seite, Limits-Prüfung, etc.).

```sql
CREATE TABLE public.products_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL UNIQUE,     -- 'starter', 'growth', etc.
  plan_key TEXT NOT NULL,           -- 'starter' | 'starter_yearly'
  name TEXT NOT NULL,
  modules TEXT[] NOT NULL,          -- ['dsgvo', 'eu_ai_act', ...]
  limits JSONB NOT NULL,            -- { bots, domains, seats, ...}
  permissions JSONB NOT NULL,       -- { api, webhooks, whiteLabelReports, ... }
  support_level TEXT NOT NULL,      -- 'community' | 'email' | 'priority' | 'dedicated'
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

**Maintenance**: Identisch zu `stripe_price_mapping`. Edge Function `sync-products-catalog` wird aufgerufen:

```bash
curl -X POST https://API_URL/functions/v1/sync-products-catalog \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  --data-raw '{"dryRun": false}'
```

Diese Function:
1. Liest `pricing.generated.ts`
2. Iteriert über alle `PLANS`
3. Schreibt `{ plan_id, modules, limits, permissions }` in `public.products_catalog`
4. Bestehende Rows werden aktualisiert (ON CONFLICT … DO UPDATE)

---

### 4. Database → Frontend (Authentische Limits)

**Usage Pattern**: Jede Limits-Prüfung geht in die DB, nicht zu `shared/pricing.ts`.

```typescript
// FALSCH:
import { limitOf } from '@/shared/pricing';
const max = limitOf(plan, 'bots');

// RICHTIG (in geschützten Features):
const { data: planCatalog } = await supabase
  .from('public.products_catalog')
  .select('limits')
  .eq('plan_id', userPlan)
  .single();
const max = planCatalog.limits.bots;
```

**Warum?**
- Die Limits können sich ändern (z.B. Promotion, Fehlerfix)
- Frontend sollte die **aktuelle** DB-Version nutzen, nicht eine gecachte
- `shared/pricing.ts` ist Marketing — was wir *verkaufen*, nicht was Benutzer *haben*

---

## Konsistenz-Checks

### 1. Frontend ↔ Deno

```bash
npm run check:pricing
```

Vergleicht `shared/pricing.ts` mit `supabase/functions/_shared/pricing.generated.ts`.

**Wird aufgerufen von**:
- CI: `npm run lint` (obligatorisch vor Merge)
- Lokal vor Commit (pre-commit Hook)

**Failure**: Wenn abweichend, `npm run sync:pricing` laufen lassen.

### 2. Deno ↔ Stripe ↔ Database

```bash
npm run check:stripe-sync
```

Vergleicht:
- `pricing.generated.ts` vs. `public.stripe_price_mapping` (DB-Werte)
- `pricing.generated.ts` vs. `public.products_catalog` (DB-Werte)
- Stripe-Objekte (über API) vs. `public.stripe_price_mapping`

**Wird aufgerufen von**:
- CI: Täglich (via Cron)
- Lokal: `npm run qa:pricing`

**Failure**: Einer der Edge-Function-Syncs (s.o.) laufen.

### 3. Checkout ↔ Subscription

```typescript
// Nach Checkout-Erfolg in Stripe Webhook (supabase/functions/stripe-webhook)
const { data: subscription } = await db
  .from('public.subscriptions')
  .select('plan_id')
  .eq('stripe_subscription_id', event.subscription.id)
  .single();

// Plan-Daten IMMER von der Datenbank-Quelle:
const { data: plan } = await db
  .from('public.products_catalog')
  .select('*')
  .eq('plan_id', subscription.plan_id)
  .single();
```

**Nicht**: `const plan = planById(subscription.plan_id)` (gecachte Frontend-Daten).

---

## Änderungsprozess

### Szenario A: Preis ändern (z.B. Growth: 249 € → 299 €)

1. **Update `shared/pricing.ts`**:
   ```typescript
   {
     id: 'growth',
     price: { monthlyEur: 299, yearlyEur: 2990 }, // War: 249 / 2490
   }
   ```

2. **Sync Frontend**:
   ```bash
   npm run sync:pricing
   ```

3. **Sync Stripe**:
   ```bash
   npm run qa:stripe-sync --dry-run    # Prüfe zuerst
   npm run qa:stripe-sync --apply      # Dann apply
   ```
   (oder via Webhook: `POST /functions/v1/sync-stripe-pricing`)

4. **Verify**:
   ```bash
   npm run check:pricing               # Frontend ↔ Deno ✓
   npm run check:stripe-sync           # Deno ↔ Stripe ↔ DB ✓
   ```

### Szenario B: Modul hinzufügen (z.B. Growth + `nis2`)

1. **Update `shared/pricing.ts`**:
   ```typescript
   {
     id: 'growth',
     modules: [
       'dsgvo', 'eu_ai_act', 'iso_27001', 'nis2', // Neu: nis2
       // ...
     ]
   }
   ```

2. **Sync**:
   ```bash
   npm run sync:pricing
   npm run qa:products-sync --apply
   ```

3. **Benutzer mit Growth-Plan bekommen sofort Zugriff** (über DB-Query in Features).

### Szenario C: Plan entfernen (z.B. `scale` → `partner`)

1. **Update `shared/pricing.ts`**: Plan entfernen, Legacy-Alias hinzufügen:
   ```typescript
   const LEGACY_PLAN_KEY_ALIASES: Record<string, PlanKey> = {
     scale: 'partner',        // Umleitung
     scale_yearly: 'partner_yearly',
     // ...
   };
   ```

2. **Sync**:
   ```bash
   npm run sync:pricing
   npm run qa:stripe-sync --apply
   ```

3. **Bestandskunden bleiben automatisch auf dem neuen Plan** (via `normalizePlanKey()`).

---

## Deployment

### Lokal vor Commit
```bash
npm run sync:pricing      # Frontend ↔ Deno
npm run lint              # Includes pricing-ssot.test.ts
npm run check:pricing
```

### CI/CD (GitHub Actions)
- **lint**: Prüft `pricing-ssot.test.ts`
- **deploy**: Schiebt `supabase/functions/_shared/pricing.generated.ts` nach Supabase
- **Nightly**: Läuft `check:stripe-sync` und alertet bei Drift

### In Produktion (Post-Deploy)
```bash
# In der ersten Stunde nach Deploy:
curl -X POST https://realsyncdynamicsai.supabase.co/functions/v1/sync-stripe-pricing \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -X POST https://realsyncdynamicsai.supabase.co/functions/v1/sync-products-catalog \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Dann prüfen:
npm run check:stripe-sync
```

---

## Troubleshooting

### Q: Stripe zeigt alte Preise, aber `shared/pricing.ts` ist korrekt?
**A**: `sync-stripe-pricing` lief nicht oder fehlgeschlagen.
```bash
npm run qa:stripe-sync           # Status prüfen
npm run qa:stripe-sync --apply   # Neu syncen
```

### Q: Benutzer berichten falsches Limit (z.B. `bots: 1`, aber sollte `10` sein)?
**A**: `products_catalog` ist veraltet.
```bash
npm run qa:products-sync --apply
```
Oder Benutzer-Session neuladen (localStorage clearen).

### Q: Frontend sagt „Growth kostet 249 €", aber ich habe grade auf 299 € erhöht?
**A**: Normales Caching. Page-Reload oder Service-Worker-Clear.
Wenn issue persistent: Git-History prüfen, ob Change wirklich in `shared/pricing.ts` ist.

### Q: `npm run check:pricing` schlägt fehlt — „drift detected"?
**A**: `sync:pricing` laufen:
```bash
npm run sync:pricing
git add supabase/functions/_shared/pricing.generated.ts
git commit -m "chore: sync pricing to Deno"
```

---

## Checkliste für Preis-Änderungen

- [ ] `shared/pricing.ts` editiert
- [ ] `npm run sync:pricing` laufen lassen
- [ ] `npm run lint` erfolgreich
- [ ] `npm run test` erfolgreich (include pricing-ssot.test.ts)
- [ ] `npm run check:pricing` erfolgreich
- [ ] git commit + push
- [ ] Merge zu main
- [ ] Deploy zu Supabase
- [ ] Post-Deploy: `npm run qa:stripe-sync --apply`
- [ ] Prüfen: `npm run check:stripe-sync`

---

## Referenzen

- **SSoT**: `shared/pricing.ts`
- **Deno-Kopie**: `supabase/functions/_shared/pricing.generated.ts`
- **Test**: `test/config/pricing-ssot.test.ts`
- **Sync-Script**: `scripts/sync-pricing.mjs`
- **Stripe-Mapping**: `supabase/functions/create-checkout-session/index.ts`
- **DB-Schema**: Migrations `202*_stripe_price_mapping.sql` und `202*_products_catalog.sql`
