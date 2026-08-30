-- P0-A/5 — Basis-Berechtigungen für die bezahlten Pläne.
--
-- Befund (gemessen am 2026-08-23 gegen RealSyncDynamicsLive):
-- `dashboard.access` wurde ausschließlich von `free_tier` und
-- `governance_launch` gewährt — von **keinem** bezahlten Abo-Plan.
-- `AdaptiveGovernanceNav` prüft `canAccess('dashboard.access')` und schickt bei
-- fehlendem Zugriff auf `upgradeUrl`. Ein zahlender Growth-Kunde wäre damit für
-- sein eigenes Dashboard auf eine Upgrade-Seite geleitet worden.
--
-- Dass das bislang niemanden traf, liegt allein am `FREE_TIER_FALLBACK` in
-- `src/core/billing/useEntitlements.ts` — der greift nur, solange **keine**
-- aktive Subscription existiert. Mit dem ersten zahlenden Kunden hätte er nicht
-- mehr gegriffen.
--
-- Dasselbe Muster bei `website.scan`, `evidence.basic_vault`,
-- `governance.dsgvo_directory` und `governance.ai_register`: alles Karten, die
-- im Free-Plan freigeschaltet sind und im bezahlten Plan verschwunden wären.
--
-- Diese Migration ist rein additiv: Sie fügt `product_entitlements` hinzu und
-- entfernt nichts. Bestehende Werte werden nicht überschrieben.

BEGIN;

-- Boolesche Basis-Keys für alle fünf bezahlten Abo-Pläne.
-- `value = 1` ist die Ja-Kodierung für `kind = 'boolean'` in diesem Schema.
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, 1
FROM public.products p
CROSS JOIN public.entitlements e
WHERE p.default_for_plan_key IN ('starter', 'growth', 'agency', 'enterprise', 'partner')
  AND e.key IN (
    'dashboard.access',
    'website.scan',
    'evidence.basic_vault',
    'governance.dsgvo_directory',
    'governance.ai_register'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.product_entitlements pe
    WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
  );

-- `free_audit` ist der Plan-Schlüssel des Free-Plans in `shared/pricing.ts` und
-- trägt live drei Subscriptions — aber es gab **kein** Produkt dazu. Dass diese
-- Mandanten trotzdem Berechtigungen hatten, war der Rückfall auf `free_tier`
-- im Auflöser, also Zufall statt Absicht.
--
-- Das Produkt wird mit den Berechtigungen von `free_tier` angelegt: Für die drei
-- bestehenden Mandanten ändert sich dadurch nichts — es ist nur nicht länger ein
-- Zufall. Ohne Stripe-Price, weil der Free-Plan nichts kostet.
--
-- Es steht hier oben, weil der Kontingent-Block darunter darauf verweist; ohne
-- das Produkt fiele dessen `free_audit`-Zeile stillschweigend weg.
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
SELECT '', 'Free Audit (default)', 'free_audit'
WHERE NOT EXISTS (
  SELECT 1 FROM public.products WHERE default_for_plan_key = 'free_audit'
);

-- Scans sind unbegrenzt und kostenlos — für jeden Plan, auch den kostenlosen.
--
-- Entscheidung des Eigentümers vom 2026-08-24: „mache die Scans immer
-- kostenlos, wir verkaufen was anderes — nämlich die dauerhafte Überwachung,
-- die nach dem Buchen des ersten Pakets im Dashboard beginnt."
--
-- Der Scan ist damit die Eintrittskarte, nicht die Ware. Ein Kontingent darauf
-- würde genau den Trichter drosseln, der Kunden bringen soll. `-1` ist in
-- diesem Schema die Kodierung für unbegrenzt (siehe `tenant_entitlements()`:
-- `bool_or(pe.value = -1) THEN -1`).
--
-- Verkauft wird stattdessen `monitoring.*`, und das hängt bereits an den
-- bezahlten Plänen: `monitoring.monthly` ab Starter, `monitoring.daily` und
-- `monitoring.drift` ab Growth. Daran ist nichts zu ändern.
--
-- Ein früherer Entwurf dieser Migration spiegelte hier
-- `limits.auditReportsPerMonth` aus `shared/pricing.ts` hinein. Das war eine
-- Verwechslung: Jenes Feld speist `complianceExportsMonthly`
-- (`src/core/billing/entitlements.ts`) und meint Compliance-Exporte, nicht
-- Scans. Die beiden Zahlen gehören zu verschiedenen Berechtigungen —
-- `limit.compliance_exports_monthly` und `website.scan_monthly_limit`.
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, -1
FROM public.products p
CROSS JOIN public.entitlements e
WHERE p.default_for_plan_key IN (
        'free_audit', 'free', 'free_tier',
        'starter', 'growth', 'agency', 'enterprise', 'partner',
        'starter_yearly', 'growth_yearly', 'agency_yearly', 'partner_yearly'
      )
  AND e.key = 'website.scan_monthly_limit'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_entitlements pe
    WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
  );

-- Bestehende Kontingente auf unbegrenzt heben. Das ist die einzige Stelle in
-- dieser Migration, die einen vorhandenen Wert überschreibt — bewusst, denn
-- `free_tier` trägt live eine 3, und die soll gerade wegfallen. Es nimmt
-- niemandem etwas: `-1` ist mehr als jede endliche Zahl.
UPDATE public.product_entitlements pe
SET value = -1
FROM public.entitlements e
WHERE pe.entitlement_id = e.id
  AND e.key = 'website.scan_monthly_limit'
  AND pe.value <> -1;

INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT neu.id, pe.entitlement_id, pe.value
FROM public.products neu
JOIN public.products vorlage ON vorlage.default_for_plan_key = 'free_tier'
JOIN public.product_entitlements pe ON pe.product_id = vorlage.id
WHERE neu.default_for_plan_key = 'free_audit'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_entitlements x
    WHERE x.product_id = neu.id AND x.entitlement_id = pe.entitlement_id
  );

COMMIT;
