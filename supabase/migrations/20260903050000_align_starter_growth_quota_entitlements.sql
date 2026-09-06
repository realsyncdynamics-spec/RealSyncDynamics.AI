-- ============================================================================
-- Klasse B aus `docs/product/kanonische-kontingente.md` §4: die drei
-- Kontingent-Divergenzen auf oeffentlich verkauften Self-Service-Plaenen.
--
-- Fuer diese Plaene ist die **Preisseite** kanonisch (§1.2). Die Berechtigung
-- lag hoeher als der veroeffentlichte Wert — ein Datenfehler, kein Versprechen:
--
--   starter · limit.team_seats                  3 -> 1
--   starter · limit.compliance_exports_monthly  5 -> 2
--   growth  · limit.compliance_exports_monthly 20 -> 12
--
-- Die urspruenglichen Werte stammen aus `20260618000000_pricing_tier_alignment`
-- und sind seither nie an die Preisseite angeglichen worden.
--
-- ── Warum auch die Jahresvarianten ──────────────────────────────────────────
--
-- `PLAN_ENTITLEMENTS` kennt keine `_yearly`-Eintraege: Die Jahresvariante ist
-- kein eigener Plan, sondern derselbe Plan mit anderem Abrechnungszeitraum, und
-- erbt dessen Kontingente. In `products` hat sie aber eine eigene Zeile mit
-- eigenen `product_entitlements` — dort stehen dieselben zu hohen Werte.
--
-- Nur die Monatsplaene anzugleichen haette deshalb eine NEUE Inkonsistenz
-- erzeugt: `starter` = 1 Sitz, `starter_yearly` = 3 Sitze. Derselbe Plan,
-- unterschiedliches Kontingent, je nachdem wie abgerechnet wird.
--
-- `check:limits` haette das nicht gemeldet — der Guard vergleicht
-- `plan.limits` gegen `PLAN_ENTITLEMENTS[planKey]` und sieht die
-- Jahres-Produktzeilen der Datenbank gar nicht. Deshalb stehen sie hier
-- ausdruecklich mit drin.
--
-- ── Bestandsschutz: §1.3, beantwortet statt uebergangen ─────────────────────
--
-- Die Schutzklausel verlangt, VOR einer Reduktion zu klaeren, ob der hoehere
-- Wert jemandem zugesagt wurde. Der Eigentuemer hat am 2026-09-01 entschieden,
-- jetzt zu korrigieren — auf Grundlage dieser Messung gegen das Live-Projekt
-- `ebljyceifhnlzhjfyxup` am selben Tag:
--
--   * Starter-Abos:                     0  (beide Starter-Kuerzungen treffen niemanden)
--   * Growth-Abos:                      1, Status `past_due` (nicht aktiv)
--   * usage_counters / usage_events /
--     usage_totals / feature_usage /
--     quota_alerts / audit_jobs:        alle 0 Zeilen
--   * Mitglieder je Tenant:             genau 1 bei allen fuenf Tenants
--
-- Die Sitzplatz-Kuerzung von 3 auf 1 traefe also selbst dann niemanden, wenn
-- ein Starter-Abo existierte. Kein Tenant verliert eine Faehigkeit, die er
-- heute nutzt; es gibt nichts, wovor zu schuetzen waere.
--
-- Bewusst KEIN Bestandsschutz-Mechanismus gebaut: `entitlement_grants` ist
-- produktfoermig (`product_id`, `plan_key`, `purchase_reference` sind NOT NULL)
-- und kennt weder Entitlement-Key noch Wert. Ein Override je Schluessel haette
-- eine Schemaaenderung gebraucht — fuer null bis einen Bestandsfall. Sollte er
-- spaeter noetig werden, traegt ihn die Zusammenfuehrungsregel des Aufloesers
-- ohne Bruch: `CASE WHEN bool_or(value = -1) THEN -1 ELSE MAX(value) END`
-- laesst einen anhebenden Grant von selbst gewinnen.
--
-- Das Fenster, in dem diese Korrektur kostenlos ist, schliesst mit dem ersten
-- zahlenden Starter- oder Growth-Kunden. Deshalb jetzt.
--
-- ── Wirkung ────────────────────────────────────────────────────────────────
--
-- Additiv im Sinne von §3: Es werden weder Zeilen noch Spalten noch Policies
-- entfernt, nur drei Werte in `product_entitlements` angeglichen. `public.
-- subscriptions` wird nicht angefasst — laufende Abos rechnen unveraendert ab.
-- Auf diesen Feldern existiert kein Gate (§1.4), die Aenderung entzieht also
-- keinem laufenden Vorgang die Grundlage.
--
-- DSGVO / EU AI Act: keine Beruehrung. Es sind Kontingentwerte eines
-- Produktkatalogs, keine personenbezogenen Daten und keine Governance-Regeln.
-- ============================================================================

WITH korrektur(plan_key, ent_key, neuer_wert) AS (VALUES
    ('starter',        'limit.team_seats',                  1),
    ('starter',        'limit.compliance_exports_monthly',  2),
    ('growth',         'limit.compliance_exports_monthly', 12),
    -- Jahresvarianten: gleicher Plan, gleiche Kontingente (siehe Kopf).
    ('starter_yearly', 'limit.team_seats',                  1),
    ('starter_yearly', 'limit.compliance_exports_monthly',  2),
    ('growth_yearly',  'limit.compliance_exports_monthly', 12)
)
UPDATE public.product_entitlements pe
   SET value = k.neuer_wert
  FROM korrektur k
  JOIN public.products p   ON p.default_for_plan_key = k.plan_key
  JOIN public.entitlements e ON e.key = k.ent_key
 WHERE pe.product_id = p.id
   AND pe.entitlement_id = e.id
   AND pe.value IS DISTINCT FROM k.neuer_wert;

-- Nachweis im Migrationsprotokoll.
--
-- Geprueft wird BEIDES: dass alle drei Paare existieren und dass sie den
-- Sollwert tragen. Nur auf den Wert zu pruefen waere blind — fehlte eine
-- Produkt- oder Entitlement-Zeile, lieferten die Joins nichts, die Pruefung
-- zaehlte null Abweichungen und die Migration liefe still durch, ohne etwas
-- angeglichen zu haben.
DO $$
DECLARE
  vorhanden  integer;
  abweichend integer;
BEGIN
  WITH soll(plan_key, ent_key, wert) AS (VALUES
      ('starter',        'limit.team_seats',                  1),
      ('starter',        'limit.compliance_exports_monthly',  2),
      ('growth',         'limit.compliance_exports_monthly', 12),
      ('starter_yearly', 'limit.team_seats',                  1),
      ('starter_yearly', 'limit.compliance_exports_monthly',  2),
      ('growth_yearly',  'limit.compliance_exports_monthly', 12)
  ), ist AS (
    SELECT s.plan_key, s.ent_key, s.wert, pe.value AS gefunden
      FROM soll s
      JOIN public.products p     ON p.default_for_plan_key = s.plan_key
      JOIN public.entitlements e ON e.key = s.ent_key
      JOIN public.product_entitlements pe
        ON pe.product_id = p.id AND pe.entitlement_id = e.id
  )
  SELECT count(*), count(*) FILTER (WHERE gefunden IS DISTINCT FROM wert)
    INTO vorhanden, abweichend
    FROM ist;

  IF vorhanden <> 6 THEN
    RAISE EXCEPTION
      'Kontingent-Angleichung: % von 6 Paaren gefunden. Fehlt ein Produkt '
      'oder ein Entitlement-Key, greift der UPDATE oben ins Leere.', vorhanden;
  END IF;

  IF abweichend > 0 THEN
    RAISE EXCEPTION
      'Kontingent-Angleichung unvollstaendig: % Paar(e) weichen weiterhin ab.',
      abweichend;
  END IF;
END $$;
