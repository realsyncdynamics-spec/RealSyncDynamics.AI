-- monitoring.browser_scan — Scan-Art des Monitorings als Berechtigung.
--
-- ZWECK
--
-- `audit-monitor-cron` entschied bis 2026-09-28 per Plan-Name, ob eine
-- ueberwachte Domain mit echtem Browser (Playwright) oder per einfachem
-- Fetch gescannt wird: `['agency','enterprise'].includes(d.tier)`. Das ist
-- ein Gate am Namen statt an einer Berechtigung (Zielarchitektur §10) — und
-- es lag im blinden Fleck von `check:plan-gates`, der nur `tier === '…'`
-- erkannte, nicht `.includes(tier)`.
--
-- Freigegeben am 2026-09-28: Agency, Enterprise **und Partner**. Partner
-- enthaelt sonst alles, was Agency enthaelt; der Ausschluss war ein Versehen
-- der Namensliste, keine Produktentscheidung.
--
-- WEN ES TRIFFT
--
-- Gemessen gegen Produktion am 2026-09-28: `monitored_domains` hat 0 Zeilen,
-- und fuer `audit-monitor-cron` ist kein pg_cron-Job registriert. Heute also
-- niemanden. Die Function liest den Key erst, wenn beides sich aendert.
--
-- WARUM DAS VOKABULAR ZUERST
--
-- `hasFeature()` liefert fuer einen Key, der in `public.entitlements` fehlt,
-- `false` — ohne Fehler. Genau so waren Terminbuchung und Bestellannahme fuer
-- jeden Plan gesperrt, bis `20260920120000` die Keys nachzog. Ohne diese
-- Zeile haette Agency/Enterprise den Browser-Scan still verloren.
--
-- Kein neuer Katalog noetig: `generate-plan-catalog-sql.ts` schreibt
-- `product_entitlements` nur fuer Add-on-Produkte. Plan-Berechtigungen kommen
-- aus eigenen Migrationen wie dieser; `--check` bleibt gegen
-- `20260924140000_canonical_plan_catalog.sql` gruen.
--
-- Rein additiv: kein Key geloescht, kein Bestandswert ueberschrieben.

BEGIN;

-- VALUES-Tupel statt `SELECT 'key', …`: test/billing/entitlement-vocabulary
-- erkennt einen Key als erstes Element eines Tupels. So wie 20260912170000.
INSERT INTO public.entitlements (key, description, kind)
SELECT v.key, v.beschreibung, v.kind
FROM (VALUES
  ('monitoring.browser_scan', 'Monitoring scannt mit echtem Browser (Playwright) statt per Fetch', 'boolean')
) AS v(key, beschreibung, kind)
WHERE NOT EXISTS (
  SELECT 1 FROM public.entitlements e WHERE e.key = v.key
);

-- Jahresvarianten erhalten denselben Wert wie ihr Monatszwilling — wie in
-- 20260912170000 und wie tenant_entitlements() ueber `_yearly` aufloest.
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, 1
FROM (VALUES ('agency'), ('enterprise'), ('partner')) AS z(plan_key)
JOIN public.entitlements e ON e.key = 'monitoring.browser_scan'
JOIN public.products p
  ON p.default_for_plan_key = z.plan_key
  OR p.default_for_plan_key = z.plan_key || '_yearly'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_entitlements pe
  WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
);

COMMIT;
