# Unified Pricing Components

**One Source of Truth for Plan Presentation Everywhere**

Diese Ordner enthält die zentrale Komponenten-Bibliothek für einheitliche Preisdarstellung über alle Oberflächen (Landing, Pricing-Seite, Checkout, Modals).

---

## 🎯 Grundidee

Statt dass jeder Plan-Grid seine eigene Styling-Logik, Preis-Formatierung und Feature-Manipulation hat, nutzen ALLE denselben Code:

```
Landing Page
Pricing Page  ┐
Checkout      ├─→ UnifiedPricingGrid / UnifiedPlanCard
Modals        │
Admin Panel  ┘
```

**Vorher**: Preis-Fehler auf Landing = manuell fix auf 4 anderen Seiten  
**Nachher**: Preis-Fehler in `shared/pricing.ts` = automatisch überall korrekt

---

## 📦 Komponenten

### UnifiedPlanCard
```tsx
<UnifiedPlanCard 
  plan={plan}
  variant="compact" | "full"
  highlight={true}
  ctaHref="/checkout/growth"
/>
```

**compact**: Kurze Version (Landing) — 4 Features, Preis, CTA  
**full**: Volle Version (Pricing-Seite) — Limits, Module, Feature-Gruppen, CTA

### UnifiedPricingGrid
```tsx
<UnifiedPricingGrid
  variant="landing" | "pricing-page"
  highlight="growth"
  include={['starter', 'growth', 'agency']}
  source="landing"
/>
```

Zeigt mehrere Pläne in einem Grid. Kümmert sich um Responsive-Verhalten, Spacing, Source-Tagging.

---

## 🚀 Schnelleinstieg

### 1. Landing Page (Teaser)
```tsx
import { PricingTeaserSection } from '@/components/sections/PricingTeaserSection';

export function HeroSection() {
  return (
    <>
      <h1>Governance Runtime</h1>
      <PricingTeaserSection sourceTag="hero" />
    </>
  );
}
```

### 2. Pricing Page (Full)
```tsx
import { UnifiedPricingGrid } from '@/components/pricing/unified/UnifiedPricingGrid';

export function PricingPage() {
  return (
    <UnifiedPricingGrid
      variant="pricing-page"
      highlight="growth"
      includeFree={true}
      source="pricing"
    />
  );
}
```

### 3. Upgrade Modal
```tsx
import { UnifiedPricingGrid } from '@/components/pricing/unified/UnifiedPricingGrid';

export function PlanUpgradeModal({ currentPlanId, onSelect }) {
  return (
    <UnifiedPricingGrid
      variant="compact"
      include={upgradePlans}
      onPlanSelect={onSelect}
      source="upgrade-modal"
    />
  );
}
```

---

## 📝 Props-Referenz

### UnifiedPlanCard

| Prop | Type | Default | Beschreibung |
|---|---|---|---|
| plan | Plan | *required* | Plan-Objekt aus `shared/pricing.ts` |
| variant | 'compact' \| 'full' | 'compact' | Darstellungsgröße |
| highlight | boolean | false | Mit "Empfohlen" Badge? |
| ctaHref | string | undefined | Link für CTA-Button |
| onCta | () => void | undefined | Callback für CTA-Button |

### UnifiedPricingGrid

| Prop | Type | Default | Beschreibung |
|---|---|---|---|
| variant | 'landing' \| 'pricing-page' | 'landing' | Grid-Größe |
| highlight | PlanId | undefined | Welcher Plan soll hervorgehoben werden? |
| include | PlanId[] | alle | Nur diese Pläne anzeigen |
| includeFree | boolean | false | Free-Plan einbeziehen? |
| ctalink | PlanId[] | alle | Welche Pläne haben funktionsfähige CTAs? |
| onPlanSelect | (id: PlanId) => void | undefined | Callback wenn Plan geklickt wird |
| source | string | 'pricing-grid' | Tracking-Tag (?source=) |

---

## ✅ Regeln (nicht verhandeln)

1. **Preis-Format**: IMMER `formatPriceEur()` nutzen — nicht selbst formatieren
2. **Plan-Daten**: IMMER aus `shared/pricing.ts` (nicht hardcoded)
3. **Checkout-Links**: IMMER über `checkoutHrefForPlan()` (sichert Source-Tags)
4. **Styling**: IMMER `TIER_ACCENT[plan.id]` nutzen — keine Custom-Farben
5. **Features**: IMMER aus `plan.features.*` lesen (nicht aus Content-Dateien)

---

## 🧪 Tests

```bash
# Component tests
npm test -- unified.test.ts

# E2E: Pricing-Flow
npm run e2e -- pricing-flow

# Konsistenz prüfen
npm run check:pricing
```

---

## 📚 Dokumentation

- **Komponenten-Anleitung**: `docs/product/pricing-components-library.md`
- **Backend-Mapping**: `docs/product/pricing-backend-mapping.md`
- **Rollout-Plan**: `docs/product/PRICING_ROLLOUT_PLAN.md`
- **SSoT**: `shared/pricing.ts`

---

## 🐛 Troubleshooting

### "Plan zeigt falschen Preis"
→ Preis wurde in `shared/pricing.ts` geändert?  
→ `npm run sync:pricing` laufen  
→ `npm run check:pricing` prüfen

### "CTA-Link funktioniert nicht"
→ `ctaHref` oder `onCta` prop gesetzt?  
→ `checkoutHrefForPlan()` nutzen, nicht hardcoded

### "Styling stimmt nicht"
→ `TIER_ACCENT[plan.id]` nutzen  
→ Nicht `border-random-color` schreiben

---

## 📞 Fragen?

- Architektur: `docs/product/pricing-components-library.md` lesen
- Backend: `docs/product/pricing-backend-mapping.md` lesen
- Rollout: `docs/product/PRICING_ROLLOUT_PLAN.md` lesen
