# Pricing-Unified-Rollout — Schrittweise Implementierung

**Status**: Q3 2026 — Phase 1: Foundations  
**Ziel**: Professionelle, konsistente Preisdarstellung über alle Oberflächen

---

## Phase 1: Foundations (Jetzt)

### Deliverables
✅ **Komponenten**
- `UnifiedPlanCard.tsx` — Zentrale Plan-Karten-Komponente (compact + full)
- `UnifiedPricingGrid.tsx` — Grid-Layout für alle Oberflächen

✅ **Dokumentation**
- `pricing-backend-mapping.md` — Stripe + DB Konsistenz-Regeln
- `pricing-components-library.md` — Komponenten-Gebrauchsanweisung
- `PRICING_ROLLOUT_PLAN.md` — dieser Plan

### Nächste Schritte (Diese Woche)
1. Tests schreiben (`test/components/pricing/unified.test.ts`)
2. PricingTeaserSection aktualisieren → nutzt UnifiedPricingGrid
3. Code Review + Merge zu main
4. Deploy zu Produktion

---

## Phase 2: Frontend Integration (Q3 2026, Woche 2–3)

### Ziele
- Alle Pricing-Komponenten nutzen `UnifiedPricingGrid` / `UnifiedPlanCard`
- Keine duplizierte Plan-Logik mehr

### Aufgaben
| Komponente | Änderung | Priorität |
|---|---|---|
| `PricingTeaserSection` | Nutzt `UnifiedPricingGrid` | P0 |
| `PricingPage` | nutzt ggf. `UnifiedPlanCard` für Full-Variante | P1 |
| `PlanUpgradeModal` | Nutzt `UnifiedPricingGrid` + `onPlanSelect` Callback | P1 |
| `GovernanceTierGate` | Nutzt `UnifiedPricingGrid` | P2 |
| `CheckoutPlanPage` | Nutzt `UnifiedPlanCard` | P2 |
| Landing-Page Niche-Sections | Nutzen `PricingTeaserSection` (keine Custom Cards) | P2 |

**Success Criteria**:
- `npm test` ✓
- `npm run lint` ✓
- `npm run check:pricing` ✓
- Pricing-Seite rendert identisch (visuell)
- Keine neuen Lighthouse-Warnings

---

## Phase 3: Backend Konsistenz (Q3 2026, Woche 4+)

### Ziele
- Stripe Price IDs sind immer aktuell
- DB `products_catalog` ist immer in sync mit `shared/pricing.ts`
- Checkout funktioniert end-to-end

### Aufgaben
| Task | Owner | Deadline |
|---|---|---|
| Edge Function: `sync-stripe-pricing` schreiben | @backend | W3 |
| Edge Function: `sync-products-catalog` schreiben | @backend | W3 |
| Stripe-Webhook für Subscription-Handling prüfen | @backend | W3 |
| RLS + Policies auf `products_catalog` definieren | @backend | W4 |
| E2E Test: Free Audit → Recommendation → Checkout | @qa | W4 |
| Staging: Alle Pläne durchbuchen, Abos prüfen | @qa | W4 |
| Production Deploy + Post-Sync-Checks | @ops | W4+ |

**Critical Checks vor Production**:
```bash
npm run check:pricing           # Frontend ↔ Deno
npm run check:stripe-sync       # Deno ↔ Stripe ↔ DB
npm run e2e -- pricing-flow     # Full checkout
```

---

## Phase 4: Optimization (Q3 2026, Woche 5+)

### Optionale Verbesserungen
- [ ] Plan-Vergleich: Interaktive Tabelle (welche Features in welchem Plan)
- [ ] Jährliche Rabatte: Badge + Preis-Differenz anzeigen
- [ ] Add-ons: Dynamische Kalkulatoren
- [ ] Jahresvarianten: Beide Knöpfe auf der Card
- [ ] Mobile: Swipe zwischen Plans

---

## Rollback-Plan

Falls nach Phase 2 Probleme auftauchen:

1. **Minor Bugs** (Styling, Text): Fix + hotfix-deploy
2. **Major Issues** (Checkout broken): Revert zu letztem Working Commit
   ```bash
   git revert <commit-hash>
   npm run build && npm run deploy
   ```

---

## Messaging & Timing

- ✅ **Intern**: "Unified Pricing Architecture — konsistente Darstellung überall"
- ✅ **Extern**: Keine Ankündigung nötig (ist UI-Refactor, keine Feature)
- ✅ **Benutzer**: Merken keinen Unterschied (Ziel!)

---

## Checkliste vor Live

### Code Quality
- [ ] `npm run lint` ✓
- [ ] `npm run test` (>90% coverage) ✓
- [ ] `npm run e2e -- pricing-flow` ✓
- [ ] `npm run check:pricing` ✓
- [ ] Code Review approved ✓

### Deployment
- [ ] GitHub Actions CI grün ✓
- [ ] Staging Deploy erfolgreich ✓
- [ ] Staging: Alle Preise korrekt ✓
- [ ] Staging: Checkout funktioniert ✓
- [ ] Production: Canary Deploy (5% Traffic) ✓
- [ ] Production: Monitoring aktiv (Sentry, Analytics) ✓

### Post-Deployment
- [ ] `npm run check:stripe-sync` ✓
- [ ] `npm run qa:smoke` ✓
- [ ] Pricing-Seite manuell geprüft ✓
- [ ] Checkout durchgetestet ✓
- [ ] Slack Update: ✓ Live

---

## Owned By

- **Architektur**: @claude
- **Frontend**: @frontend-team
- **Backend**: @backend-team
- **QA**: @qa-team
- **DevOps**: @ops-team

---

## Success Metrics (Post-Launch)

1. **Keine Regressions**: Conversion-Rate identisch ± 2%
2. **Performance**: Lighthouse Score >90
3. **Consistency**: Alle Pricing-Komponenten nutzen Unified-Code
4. **Maintainability**: Preis-Änderungen in <5 Minuten möglich (nur `shared/pricing.ts` editieren)
