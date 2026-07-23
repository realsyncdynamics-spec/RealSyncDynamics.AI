# Stripe Price-IDs zum Eintragen

Diese Datei dokumentiert, welche **echten Stripe Price-IDs** in die Datenbank gehören, sobald sie in Stripe Dashboard erstellt werden.

## ✅ Bereits konfiguriert (Live)

| Plan | Preis | Stripe Price-ID |
|------|-------|---|
| Starter | 79,00 € / Monat | `price_1TfsV8REjTWueUcGCdOO6bT2` |
| Growth | 249,00 € / Monat | `price_1TfsV4REjTWueUcGsGSfjudu` |
| Agency | 699,00 € / Monat | `price_1TfsV9REjTWueUcGxJIBHYgC` |
| Scale (Partner) | 1.999,00 € / Monat | `price_1TntAwREjTWueUcGh3FKldMF` |

---

## ⚠️ Noch zu konfigurieren

### Jahres-Varianten (mit 2-Monate-Rabatt)

**Schritt 1: In Stripe Dashboard (Products) erstellen:**

1. **Starter (Jährlich)** → 790 € / Jahr
   ```sql
   UPDATE public.products SET stripe_price_id = 'price_XXXXX' WHERE default_for_plan_key = 'starter_yearly';
   ```

2. **Growth (Jährlich)** → 2.490 € / Jahr  
   ```sql
   UPDATE public.products SET stripe_price_id = 'price_XXXXX' WHERE default_for_plan_key = 'growth_yearly';
   ```

3. **Agency (Jährlich)** → 6.900 € / Jahr  
   ```sql
   UPDATE public.products SET stripe_price_id = 'price_XXXXX' WHERE default_for_plan_key = 'agency_yearly';
   ```

4. **Scale/Partner (Jährlich)** → 19.000 € / Jahr  
   ```sql
   UPDATE public.products SET stripe_price_id = 'price_XXXXX' WHERE default_for_plan_key = 'scale_yearly';
   ```

### Enterprise-Plan

**Option A: Self-Service Checkout (14-Tage-Trial)**
- Erstelle in Stripe: **Enterprise** → 1.249 € / Monat
- Ersetze `price_XXXXX` mit der echten ID:
  ```sql
  UPDATE public.products SET stripe_price_id = 'price_XXXXX' WHERE default_for_plan_key = 'enterprise';
  ```

**Option B: Manual Sales (aktuell)**
- Bleibt beim Sentinel `internal_default_enterprise`
- Checkout-Button müsste zu `/contact-sales` umgeleitet werden (UI-Change nötig)

---

## 📋 Nach dem Erstellen der Stripe-Products:

1. **Kopiere die Price-IDs** aus Stripe Dashboard (Products → [Plan] → Preise)
2. **Ersetze** die `price_XXXXX` Platzhalter oben
3. **Führe die UPDATEs** in Supabase SQL-Editor aus:
   ```sql
   UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'starter_yearly';
   UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'growth_yearly';
   UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'agency_yearly';
   UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'scale_yearly';
   UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'enterprise';
   ```

4. **Verifizierung:**
   ```sql
   SELECT default_for_plan_key, stripe_price_id, name 
   FROM public.products 
   WHERE default_for_plan_key IN ('starter','growth','agency','enterprise','scale','starter_yearly','growth_yearly','agency_yearly','scale_yearly')
   ORDER BY default_for_plan_key;
   ```

---

## 🚀 Für sofort (Enterprise-Checkout fixen):

Die Migration `20260723000000_fix_stripe_price_ids_for_scale_enterprise_yearly.sql` hat bereits:
- ✅ Scale mit echter Price-ID (`price_1TntAwREjTWueUcGh3FKldMF`) konfiguriert
- ✅ Enterprise als Sentinel hinzugefügt (momentan blockiert Checkout mit 400-Fehler)

**Entscheide:**  
- 👤 **Sollen Jahres-Pläne im Checkout sichtbar sein?** → Ja/Nein
- 🏢 **Enterprise: Self-Service (mit Trial) oder Sales-Kontakt?** → Checkout / Contact-Sales
