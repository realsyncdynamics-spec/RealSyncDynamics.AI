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

-- Das Scan-Kontingent je Plan. Die Zahlen stammen aus `shared/pricing.ts`
-- (`limits.auditReportsPerMonth`) — der Single Source of Truth für Limits.
-- Sie werden hier nicht erfunden, sondern gespiegelt.
-- `free_audit` steht bewusst mit in der Tabelle statt das Kontingent nur von
-- `free_tier` zu erben: Drei kostenlose Scans sind eine Produktentscheidung
-- (Eigentümer, 2026-08-24), keine Nebenwirkung einer Vorlage. So steht die
-- Zahl an derselben Stelle wie die der bezahlten Pläne und wird vom
-- Paritätstest gegen `shared/pricing.ts` mitgeprüft.
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, v.wert
FROM (VALUES
  ('free_audit',   3),
  ('starter',      6),
  ('growth',      12),
  ('agency',      50),
  ('enterprise', 200),
  ('partner',    500)
) AS v(plan_key, wert)
JOIN public.products p ON p.default_for_plan_key = v.plan_key
CROSS JOIN public.entitlements e
WHERE e.key = 'website.scan_monthly_limit'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_entitlements pe
    WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
  );

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
