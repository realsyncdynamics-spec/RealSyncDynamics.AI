# Preise, Pläne und Berechtigungen — Details (Archiv)

> Ausgelagert aus `CLAUDE.md` §7. Die **harten Regeln** stehen weiterhin dort;
> hier die Herleitung, die Kontingent-Kanonizität und die Add-on-Mechanik.
> Vollständige Regeln: `docs/product/pricing-governance.md`.

### Preise, Pläne und Berechtigungen

`shared/pricing.ts` ist die **einzige** Quelle für Plan-Namen, Preise,
Runtime-Limits, Module, Berechtigungen, Feature-Listen und Add-ons.
`src/config/pricing.ts` ist nur noch eine Projektion davon.

- Änderungen ausschließlich in `shared/pricing.ts`, danach `npm run sync:pricing`
- `npm run check:pricing` prüft Deno-Zwilling und DB-Katalog gegen die Quelle
- Zugriff **nie** über Plan-Namen (`if (plan === 'agency')`), sondern über
  `hasPermission()`, `hasModule()`, `limitOf()`
- Es gibt genau sechs **Abo-Pläne**: Free Audit · Starter · Growth · Agency ·
  Enterprise · Partner. Der Name „Scale" ist untersagt.
- Seit AP2 (2026-08-24) trägt jeder Plan zusätzlich `availability`:
  `self_service` (Free, Starter, Growth) · `contract` (Enterprise) ·
  `legacy` (Agency, Partner). Das ist **nicht** dasselbe wie `purchaseMode`:
  Jenes sagt, welche Art Stripe-Session entsteht, dieses, ob der Plan heute
  noch neu gewählt werden darf. Stillgelegte Pläne behalten Produkte, Preise,
  Entitlements und laufende Abos vollständig — sie stehen weiterhin in
  `PLAN_ORDER`, damit Rangvergleiche für Bestandskunden stimmen.
  **Verkaufslisten nehmen `SALES_PLANS` bzw. `SELF_SERVICE_PLANS`, nie
  `ORDERED_PLANS`.** Einzelheiten: `docs/product/ap2-paketumbau.md`.
- Daneben gibt es **Einmalprodukte** (`purchaseMode: 'one_time'`), derzeit
  Governance Launch (349 € einmalig). Sie sind kein Rang der Abo-Leiter:
  nicht in `PLAN_ORDER`, Preis in `price.oneTimeEur`, Persistenz als Grant in
  `entitlement_grants` (nicht `subscriptions` — dort gilt „genau ein Abo pro
  Tenant"), Anzeige über `ONE_TIME_PRICING_TIERS`.

- Bei **Kontingenten** (Zahlenwerte) hängt die kanonische Quelle seit dem
  2026-08-25 an der **Planart**: für Self-Service und öffentlich verkaufte
  Pläne gilt `plan.limits.*` (die Preisseite), für Vertragspläne
  (`availability: 'contract'`, heute Enterprise) gilt **der Vertrag**.
  `PLAN_ENTITLEMENTS['limit.*']` ist in beiden Fällen nur eine Ableitung.
  Seit dem **2026-08-31** ist die Kodierung für Vertragspläne festgelegt
  (Option A): dort bedeutet `-1` bei einem `limit.*`-Key **„das System
  begrenzt hier nicht, der Vertrag tut es"**. Die Quelle ist damit *benannt*,
  nicht *aufgelöst* — der Vertrag liegt dem System weiterhin nicht vor, es
  gibt keine Tabelle für tenant-spezifische Werte, und auf diesen acht
  Feldern ist **kein Gate erlaubt**. Ein Vertragsplan trägt deshalb
  ausschließlich `-1`; ein endlicher Wert wäre eine technisch durchgesetzte
  Obergrenze, die unter A nicht abbildbar ist. Der erste Enterprise-Vertrag
  mit vereinbarter Obergrenze ist der benannte Auslöser für Option B
  (Tenant-Overrides) — festgehalten in
  `test/billing/limit-canonicity.test.ts`. Beide Seiten
  weichen heute in 18 von 38 Paaren ab; `npm run check:limits` verhindert
  **neue** Divergenzen (Ratsche, Grundlinie in
  `scripts/limit-canonicity-baseline.json`). Es waren 21 — die drei Kürzungen
  auf Starter und Growth sind am 2026-09-01 an die Preisseite angeglichen
  worden, nachdem gemessen war, dass sie niemanden treffen (§4 Klasse B). **Kein neues Enforcement gegen
  einen divergierenden Wert**, solange er nicht bereinigt ist — und keine
  stillschweigende Kürzung bei Bestandskunden. Diff und Entscheidung:
  `docs/product/kanonische-kontingente.md` §1.2a,
  `docs/product/enterprise-quelle-entscheidungsvorlage.md`.

- **Add-ons** (seit 2026-09-01) sind Positionen des Stripe-Abos: `AddOn.grants`
  in `shared/pricing.ts` nennt die Keys, der Generator erzeugt daraus
  `products`/`product_entitlements`, die Function `subscription-addons` bucht
  und kündigt, `tenant_entitlements()` **addiert** Kontingente aus Add-on-Grants
  auf den Plan. Buchbar ist ein Add-on erst, wenn `plan_addons.stripe_price_id`
  eine echte Price trägt — das ist ein Betreiberschritt mit Freigabe. Vertrag
  und offene Entscheidungen: `docs/product/addon-booking.md`.
- **Dashboard-Gates** kommen aus **einem** Register:
  `src/core/access/featureAccess.ts` (Route → Entitlement-Key), geprüft von
  `RouteEntitlementGate` in der `GovernanceBrowserShell`. Neue bezahlte
  Fläche = ein Eintrag dort; `test/core/feature-access.test.ts` hält Register,
  `App.tsx` und Navigation zusammen. Kein Gate gegen einen divergierenden
  Kontingent-Wert.

Vollständige Regeln: `docs/product/pricing-governance.md`

