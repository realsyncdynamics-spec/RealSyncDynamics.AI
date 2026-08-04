# Pricing Components Library — Konsistente Verwendung überall

**Ziel**: Pricing-Komponenten sind **konsistent und wiederverwendbar** auf Landing Pages, Pricing-Seite, Checkout, Upgrade-Modals und Admin-Panels.

Keine duplizierte Logik. Eine Komponente, viele Kontexte.

---

## Komponenten-Hierarchie

```
UnifiedPricingGrid (höchste Ebene)
  ├─ Landing: compact cards, 5 Pläne, schnell scannen
  └─ Pricing-Page: full cards, 5 Pläne, tiefe Details

UnifiedPlanCard (Kernkomponente)
  ├─ variant="compact" → 4 Features, CTA
  ├─ variant="full"    → Limits + Module + Feature-Gruppen
  └─ variant="hero"    → (reserved for future)

PlanFeatureGroups (Detail-Komponente)
  └─ Zeigt Features in den 4 verbindlichen Gruppen

PlanRuntimeLimits (Detail-Komponente)
  └─ Bot-Limits, Domain-Limits, Seats, etc.

PlanModuleAreas (Detail-Komponente)
  └─ GOVERN / AUTOMATE / ENGAGE Module
```

---

## Verwendungsmuster

### 1. Landing Page — Kurz & Prägnant

**Wo**: `src/components/sections/PricingTeaserSection.tsx`

**Komponente**:
```tsx
import { UnifiedPricingGrid } from '@/components/pricing/unified/UnifiedPricingGrid';

export function PricingTeaserSection({ sourceTag }) {
  return (
    <UnifiedPricingGrid
      variant="landing"
      highlight="growth"
      include={['starter', 'growth', 'agency', 'enterprise', 'partner']}
      source={sourceTag}
    />
  );
}
```

**Ausgabe**: 5 kompakte Cards, Growth hervorgehoben, jede Card zeigt:
- Plan-Name
- Preis / Monat
- Outcome-Headline
- Top-3 Features
- CTA-Button mit Checkout-Link

**Responsive**: 1 Spalte (mobile) → 2 Spalten (tablet) → 5 Spalten (desktop).

---

### 2. Pricing-Seite (Full) — Alle Details

**Wo**: `src/features/billing/PricingPage.tsx`

**Komponente**:
```tsx
import { UnifiedPricingGrid } from '@/components/pricing/unified/UnifiedPricingGrid';

export function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section>
        <h1>Wie viel Governance-Runtime brauchen Sie?</h1>
      </section>

      {/* Full Cards */}
      <UnifiedPricingGrid
        variant="pricing-page"
        highlight="growth"
        includeFree={true}
        source="pricing"
      />

      {/* Feature Comparison Matrix */}
      <PlanComparisonMatrix />

      {/* etc. */}
    </>
  );
}
```

**Ausgabe**: 6 volle Cards (incl. Free), Growth hervorgehoben:
- Plan-Name
- Preis / Monat + Jahres-Badge
- Outcome + Technical Headlines
- Runtime-Limits (Top 3–4)
- Module nach Bereich
- Features in 4 Gruppen
- CTA-Button

---

### 3. Upgrade-Modal — Kontextabhängig

**Wo**: `src/features/billing/PlanUpgradeModal.tsx`

**Komponente**:
```tsx
import { UnifiedPricingGrid } from '@/components/pricing/unified/UnifiedPricingGrid';

interface PlanUpgradeModalProps {
  currentPlanId: PlanId;
  onSelect: (planId: PlanId) => void;
}

export function PlanUpgradeModal({ currentPlanId, onSelect }: PlanUpgradeModalProps) {
  // Nur Upgrades anzeigen (höherwertig als current)
  const upgradePlans = ORDERED_PLANS.filter(
    (p) => planRank(p.id) > planRank(currentPlanId),
  );

  return (
    <UnifiedPricingGrid
      variant="compact"
      include={upgradePlans.map((p) => p.id as PlanId)}
      onPlanSelect={onSelect}
      source="upgrade-modal"
    />
  );
}
```

**Ausgabe**: Nur Pläne, die ein Upgrade darstellen (höherwertig). Klick auf CTA ruft `onPlanSelect()` auf.

---

### 4. Checkout-Bestätigung — Read-Only

**Wo**: `src/components/pricing/CheckoutConfirmPage.tsx`

**Komponente**:
```tsx
import { UnifiedPlanCard } from '@/components/pricing/unified/UnifiedPlanCard';

interface CheckoutConfirmProps {
  planKey: string;
}

export function CheckoutConfirmPage({ planKey }: CheckoutConfirmProps) {
  const plan = planByKey(planKey);
  
  return (
    <>
      <h1>Sie haben {plan.name} gewählt</h1>
      
      {/* Single Card, Read-Only */}
      <UnifiedPlanCard
        plan={plan}
        variant="full"
        ctaHref={checkoutHrefForPlan(plan)}
      />
    </>
  );
}
```

**Ausgabe**: Eine einzelne Plan-Karte zum Bestätigen + CTA für tatsächlichen Checkout.

---

### 5. Admin-Dashboard — Alle 6 Pläne als Tabelle/Grid

**Wo**: `src/features/admin/AdminPricingManagement.tsx`

**Komponente**:
```tsx
import { UnifiedPricingGrid } from '@/components/pricing/unified/UnifiedPricingGrid';

export function AdminPricingManagement() {
  return (
    <UnifiedPricingGrid
      variant="full"
      includeFree={true}
      source="admin"
    />
  );
}
```

**Zusatz**: Jede Card könnte einen "Edit" Button haben für Admin-Zwecke.

---

## Props Referenz

### UnifiedPricingGrid

```typescript
interface UnifiedPricingGridProps {
  /** 'landing': compact | 'pricing-page': full | etc. */
  variant?: 'landing' | 'pricing-page' | 'compact' | 'full';
  
  /** Plan-ID zum Hervorheben */
  highlight?: PlanId;
  
  /** Welche Pläne anzeigen? */
  include?: PlanId[];
  
  /** Free-Plan einschließen? Default: false */
  includeFree?: boolean;
  
  /** Pläne mit funktionsfähigen CTA-Links */
  ctalink?: PlanId[];
  
  /** Callback wenn CTA geklickt wird */
  onPlanSelect?: (planId: PlanId) => void;
  
  /** Source-Tag für Tracking (?source=) */
  source?: string;
}
```

### UnifiedPlanCard

```typescript
interface UnifiedPlanCardProps {
  plan: Plan;
  variant?: 'compact' | 'full' | 'hero';
  highlight?: boolean;
  onCta?: () => void;
  ctaHref?: string;
  showComparison?: boolean;
  comparisonWith?: PlanId;
}
```

---

## Styling — Unified Design System

Alle Preiskomponenten nutzen dieselben Tailwind-Token:

**Farben** (pro Plan):
```typescript
const TIER_ACCENT: Record<PlanId, { border, text, ring }> = {
  free:       { border: 'border-silver-400',   text: 'text-silver-400',   ... },
  starter:    { border: 'border-ai-cyan-400',  text: 'text-ai-cyan-400',  ... },
  growth:     { border: 'border-security-500', text: 'text-security-500', ... },
  agency:     { border: 'border-violet-400',   text: 'text-violet-400',   ... },
  enterprise: { border: 'border-emerald-400',  text: 'text-emerald-400',  ... },
  partner:    { border: 'border-gold-400',     text: 'text-gold-400',     ... },
};
```

**Highlight** (Empfohlen):
```
bg-gold-400 text-obsidian-950
text-xs font-mono uppercase tracking-wider
px-3 py-1 rounded (kein radius noch, wenn Design-Lock sagt)
```

**Buttons** (CTA):
```
Highlight: surface-gold class (definiert in tailwind.config.ts)
Regular: border border-silver-500 hover:border-gold-400
```

---

## Konsistenz-Regeln (NICHT verhandeln)

1. **Preis-Format**: IMMER `formatPriceEur()` nutzen
   ```tsx
   const priceString = formatPriceEur(plan.price.monthlyEur);
   // Gibt: "249" (ohne €) oder "79" mit lokalem Format
   ```

2. **Plan-Zugriff**: IMMER aus der SSoT lesen (`@/shared/pricing`)
   ```tsx
   // FALSCH:
   const plan = { name: 'Growth', price: 249 };
   
   // RICHTIG:
   import { planById } from '@/shared/pricing';
   const plan = planById('growth');
   ```

3. **Checkout-Links**: IMMER über `checkoutHrefForPlan()` erstellen
   ```tsx
   // FALSCH:
   href={`/checkout/growth?source=landing`}
   
   // RICHTIG:
   href={checkoutHrefForPlan('growth', { source: 'landing' })}
   ```

4. **Hervorhebung**: Nur `highlight` + `TIER_ACCENT` nutzen — keine Ad-Hoc-Farben

5. **Features**: IMMER aus `plan.features` lesen, NICHT aus Content-Dateien
   ```tsx
   // FALSCH:
   features={getFeaturesFromContent('growth')}
   
   // RICHTIG:
   features={plan.features}
   ```

6. **Module**: IMMER über `hasModule()` prüfen statt String-Vergleiche
   ```tsx
   // FALSCH:
   if (plan.id === 'agency') { /* show API */ }
   
   // RICHTIG:
   if (hasModule(plan, 'api')) { /* show API */ }
   ```

---

## Testing

Jede Komponente muss getestet werden auf:

1. **Rendering**: Alle Pläne rendern ohne Fehler
2. **Props**: Variant, highlight, include funktionieren
3. **Tracking**: Source-Tag wird an Checkout-Link angehängt
4. **A11y**: Buttons sind fokussierbar, Links haben Title-Attribute
5. **Responsive**: Desktop (5 Spalten) → Tablet (2) → Mobile (1)

**Test-Datei**: `test/components/pricing/unified.test.ts`

```typescript
import { render, screen } from '@testing-library/react';
import { UnifiedPricingGrid } from '@/components/pricing/unified/UnifiedPricingGrid';

describe('UnifiedPricingGrid', () => {
  it('renders 5 plans in landing mode', () => {
    render(<UnifiedPricingGrid variant="landing" />);
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('highlights growth plan', () => {
    render(<UnifiedPricingGrid highlight="growth" />);
    expect(screen.getByText('Empfohlen')).toBeInTheDocument();
  });

  it('includes source tag in checkout links', () => {
    render(<UnifiedPricingGrid source="test-source" />);
    const link = screen.getByRole('link', { name: /checkout/i });
    expect(link.href).toContain('source=test-source');
  });
});
```

---

## Migration-Checkliste

Bestehende Komponenten, die konsolidiert werden:

- [ ] `src/components/sections/PricingTeaserSection.tsx` → nutzt `UnifiedPricingGrid`
- [ ] `src/features/billing/PricingPage.tsx` → nutzt ggf. `UnifiedPlanCard` für Full-Variant
- [ ] `src/features/billing/PlanUpgradeModal.tsx` → nutzt `UnifiedPricingGrid`
- [ ] `src/components/pricing/CheckoutPlanPage.tsx` → nutzt `UnifiedPlanCard`
- [ ] `src/features/governance/GovernanceTierGate.tsx` → nutzt `UnifiedPricingGrid`
- [ ] Landing-Page Teasers (MainLanding, Niche-Pages) → nutzen `PricingTeaserSection`

**Nach Migration**: Alle Pricing-Darstellungen nutzen den gleichen Code.

---

## FAQ

### Warum nicht nur EINE Komponente für alles?
Weil die Anforderungen unterschiedlich sind:
- **Landing** braucht Schnelligkeit (compact)
- **Pricing-Page** braucht alle Details (full)
- **Upgrade-Modal** braucht nur Upgrades (filtered)
- **Admin** braucht Editierbarkeit (admin variant)

Trotzdem: ALLE nutzen `UnifiedPlanCard` oder `UnifiedPricingGrid` — keine Custom-Logik repliziert.

### Wo wird Hervorhebung entschieden?
Per `highlight` Prop. Landing hebt **Growth** hervor (beste Conversion). Pricing-Page hebt auch **Growth** hervor. Admin hat keine Hervorhebung.

### Wie ändern wir die Farben eines Plans?
Nur in `src/config/pricing.ts`:
```typescript
const TIER_ACCENT: Record<PlanId, ...> = {
  growth: { border: 'border-NEW-COLOR', ... }
}
```
Dann `npm run lint` (stellt sicher, dass die Klasse bei Tailwind bekannt ist) + Commit.

### Können einzelne Teams andere Styling-Overrides einbringen?
**Nein.** Das ist exakt der Punkt: Keine Overrides, nur zentrale Änderungen.

Wenn ein Use-Case Styling braucht, das nicht durch Props konfiguriert ist:
1. Eröffne ein Issue
2. Diskutiere in Code Review
3. Füge den Prop zu `UnifiedPlanCard` hinzu (wenn allgemein sinnvoll)
4. Oder erstelle eine neue Variant

---

## Links

- SSoT: `shared/pricing.ts`
- Komponenten: `src/components/pricing/unified/`
- Tests: `test/components/pricing/unified.test.ts`
- Backend-Mapping: `docs/product/pricing-backend-mapping.md`
