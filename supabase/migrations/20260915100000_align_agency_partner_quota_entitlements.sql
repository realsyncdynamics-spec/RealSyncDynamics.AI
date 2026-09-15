-- ============================================================================
-- Klasse D aus `docs/product/kanonische-kontingente.md` §4: die neun
-- Kontingent-Divergenzen auf Agency und Partner, bei denen die Berechtigung
-- NIEDRIGER liegt als die oeffentliche Zusage der Preisseite.
--
-- Fuer beide Plaene ist nach §1.2 die **Preisseite** kanonisch — Agency als
-- heute wieder verkaufter Self-Service-Plan, Partner als stillgelegter, aber
-- oeffentlich verkauft gewesener Plan. In beiden Faellen bekamen Kunden
-- bisher weniger, als ihnen zugesagt war:
--
--   agency  · limit.api_calls_monthly        25000 ->   50000
--   agency  · limit.bot_messages_monthly     10000 ->   25000
--   agency  · limit.bulk_jobs_monthly           50 ->     100
--   partner · limit.api_calls_monthly       100000 -> 1000000
--   partner · limit.automation_runs_monthly   2500 ->   10000
--   partner · limit.bot_messages_monthly     50000 ->  100000
--   partner · limit.bulk_jobs_monthly          500 ->      -1
--   partner · limit.domains                     50 ->     100
--   partner · limit.team_seats                  50 ->     100
--
-- Alle neun Werte sind am 2026-09-15 gegen den aktuellen Pricing-Kanon neu
-- gemessen (`npm run check:limits` auf `main` @ fd561378), nicht aus einer
-- frueheren Fassung uebernommen.
--
-- ── Agency ist kein stillgelegter Plan mehr ────────────────────────────────
--
-- Fruehere Fassungen dieser Analyse fuehrten Agency als `legacy`, womit die
-- Korrektur „ausschliesslich Bestandskunden" betroffen haette. Das gilt nicht
-- mehr: Agency traegt heute `availability: 'self_service'` und ist wieder
-- buchbar. Die Angleichung wirkt damit auf **Neu- und Bestandskunden**, und
-- die Zusage der Preisseite ist fuer Agency eine laufende Verkaufsaussage,
-- keine historische. Partner bleibt `legacy` (nur Bestandskunden).
--
-- ── Warum hier KEIN Bestandsschutz noetig ist ───────────────────────────────
--
-- Die Schutzklausel §1.3 verlangt eine Messung, BEVOR ein Kontingent reduziert
-- wird. Sie greift hier nicht: Alle neun Faelle sind **Ausweitungen**. Die
-- Korrektur gibt, was die Preisseite zusagt; niemand verliert eine Faehigkeit.
-- §5 haelt das ausdruecklich fest: „Die neun Ausweitungen (Klasse D) laufen
-- unabhaengig; sie nehmen niemandem etwas."
--
-- Das ist der Unterschied zur Klasse-B-Migration
-- (`20260903050000_align_starter_growth_quota_entitlements`): dort wurde
-- gekuerzt, deshalb war dort eine Messung gegen das Live-Projekt noetig.
--
-- ── Warum auch die Jahresvarianten ──────────────────────────────────────────
--
-- `PLAN_ENTITLEMENTS` kennt keine `_yearly`-Eintraege: Die Jahresvariante ist
-- kein eigener Plan, sondern derselbe Plan mit anderem Abrechnungszeitraum,
-- und erbt dessen Kontingente. In `products` hat sie aber eine eigene Zeile
-- mit eigenen `product_entitlements` — dort stehen dieselben zu niedrigen
-- Werte.
--
-- Nur die Monatsplaene anzugleichen wuerde eine NEUE Inkonsistenz erzeugen:
-- `partner` = 100 Sitze, `partner_yearly` = 50. `check:limits` wuerde das
-- nicht melden — der Guard vergleicht `plan.limits` gegen
-- `PLAN_ENTITLEMENTS[planKey]` und sieht die Jahres-Produktzeilen gar nicht.
-- Dieselbe Falle, die der Kopf von `20260903050000` dokumentiert.
--
-- Anders als dort werden die Jahreszeilen unten NICHT hart eingefordert: ob
-- fuer diese Plaene Jahresprodukte in `products` gefuehrt werden, ist nicht
-- vorausgesetzt. Die Pruefung verlangt die neun Monatspaare und prueft
-- Jahreszeilen nur, soweit sie existieren.
--
-- ── Was hier bewusst NICHT angefasst wird ──────────────────────────────────
--
--   * `agency · limit.compliance_exports_monthly` (100 -> 50) ist Klasse C:
--     eine KUERZUNG. Nach §5 kommt erst der Bestandsschutz, dann die
--     Wertkorrektur. Sie ist seit Agencys Rueckkehr in den Self-Service
--     dringlicher geworden, nicht weniger dringlich — entschieden ist sie
--     damit aber nicht.
--   * Die neun Enterprise-Felder sind Klasse A: Vertragsplan, kanonische
--     Quelle unaufgeloest. §5 sagt ausdruecklich, der naechste PR duerfe
--     „nicht einfach die Enterprise-Werte korrigieren". Sie bleiben auf `-1`.
--     (Es sind neun statt acht, seit `limit.sites` hinzugekommen ist.)
--
-- Beide bleiben als bekannte Divergenzen in
-- `scripts/limit-canonicity-baseline.json` stehen — die Grundlinie faellt von
-- 19 auf 10.
--
-- ── Wirkung ────────────────────────────────────────────────────────────────
--
-- Additiv: Es werden weder Zeilen noch Spalten noch Policies entfernt, nur
-- Werte in `product_entitlements` angehoben. `public.subscriptions` wird nicht
-- angefasst — laufende Abos rechnen unveraendert ab. Auf diesen Feldern
-- existiert kein Gate; die Aenderung kann keinem laufenden Vorgang die
-- Grundlage entziehen, sie hebt nur Obergrenzen, gegen die heute niemand
-- geprueft wird.
--
-- Disjunkt zu `20260912171000_canonical_plan_catalog`: jene schreibt und
-- loescht `product_entitlements` ausschliesslich fuer Add-on-Produkte
-- (`stripe_price_id LIKE 'internal_addon_%'`), diese ausschliesslich fuer
-- Plan-Produkte ueber `default_for_plan_key`. Die Mengen ueberschneiden sich
-- nicht; der Prune der Katalog-Migration kann diese Werte nicht zuruecknehmen.
--
-- Sicherheitsrelevanz: keine. Keine Zugriffsrechte, keine Rollen, keine
-- RLS-Policies — ausschliesslich Mengenwerte eines Produktkatalogs. Eine
-- Ausweitung kann keinen Zugriff oeffnen, der nicht ueber Module und
-- Berechtigungen ohnehin erlaubt ist.
--
-- DSGVO / EU AI Act: keine Beruehrung. Kontingentwerte eines Produktkatalogs,
-- keine personenbezogenen Daten und keine Governance-Regeln.
-- ============================================================================

WITH korrektur(plan_key, ent_key, neuer_wert) AS (VALUES
    ('agency',         'limit.api_calls_monthly',         50000),
    ('agency',         'limit.bot_messages_monthly',      25000),
    ('agency',         'limit.bulk_jobs_monthly',           100),
    ('partner',        'limit.api_calls_monthly',       1000000),
    ('partner',        'limit.automation_runs_monthly',   10000),
    ('partner',        'limit.bot_messages_monthly',     100000),
    ('partner',        'limit.bulk_jobs_monthly',            -1),
    ('partner',        'limit.domains',                     100),
    ('partner',        'limit.team_seats',                  100),
    -- Jahresvarianten: gleicher Plan, gleiche Kontingente (siehe Kopf).
    ('agency_yearly',  'limit.api_calls_monthly',         50000),
    ('agency_yearly',  'limit.bot_messages_monthly',      25000),
    ('agency_yearly',  'limit.bulk_jobs_monthly',           100),
    ('partner_yearly', 'limit.api_calls_monthly',       1000000),
    ('partner_yearly', 'limit.automation_runs_monthly',   10000),
    ('partner_yearly', 'limit.bot_messages_monthly',     100000),
    ('partner_yearly', 'limit.bulk_jobs_monthly',            -1),
    ('partner_yearly', 'limit.domains',                     100),
    ('partner_yearly', 'limit.team_seats',                  100)
)
UPDATE public.product_entitlements pe
   SET value = k.neuer_wert
  FROM korrektur k
  JOIN public.products p     ON p.default_for_plan_key = k.plan_key
  JOIN public.entitlements e ON e.key = k.ent_key
 WHERE pe.product_id = p.id
   AND pe.entitlement_id = e.id
   AND pe.value IS DISTINCT FROM k.neuer_wert;

-- Nachweis im Migrationsprotokoll.
--
-- Geprueft wird BEIDES: dass die neun Monatspaare existieren und dass jede
-- gefundene Zeile den Sollwert traegt. Nur auf den Wert zu pruefen waere blind
-- — fehlte eine Produkt- oder Entitlement-Zeile, lieferten die Joins nichts,
-- die Pruefung zaehlte null Abweichungen und die Migration liefe still durch,
-- ohne etwas angeglichen zu haben.
DO $$
DECLARE
  monatlich  integer;
  abweichend integer;
BEGIN
  WITH soll(plan_key, ent_key, wert) AS (VALUES
      ('agency',         'limit.api_calls_monthly',         50000),
      ('agency',         'limit.bot_messages_monthly',      25000),
      ('agency',         'limit.bulk_jobs_monthly',           100),
      ('partner',        'limit.api_calls_monthly',       1000000),
      ('partner',        'limit.automation_runs_monthly',   10000),
      ('partner',        'limit.bot_messages_monthly',     100000),
      ('partner',        'limit.bulk_jobs_monthly',            -1),
      ('partner',        'limit.domains',                     100),
      ('partner',        'limit.team_seats',                  100),
      ('agency_yearly',  'limit.api_calls_monthly',         50000),
      ('agency_yearly',  'limit.bot_messages_monthly',      25000),
      ('agency_yearly',  'limit.bulk_jobs_monthly',           100),
      ('partner_yearly', 'limit.api_calls_monthly',       1000000),
      ('partner_yearly', 'limit.automation_runs_monthly',   10000),
      ('partner_yearly', 'limit.bot_messages_monthly',     100000),
      ('partner_yearly', 'limit.bulk_jobs_monthly',            -1),
      ('partner_yearly', 'limit.domains',                     100),
      ('partner_yearly', 'limit.team_seats',                  100)
  ), ist AS (
    SELECT s.plan_key, s.wert, pe.value AS gefunden
      FROM soll s
      JOIN public.products p     ON p.default_for_plan_key = s.plan_key
      JOIN public.entitlements e ON e.key = s.ent_key
      JOIN public.product_entitlements pe
        ON pe.product_id = p.id AND pe.entitlement_id = e.id
  )
  SELECT count(*) FILTER (WHERE plan_key IN ('agency', 'partner')),
         count(*) FILTER (WHERE gefunden IS DISTINCT FROM wert)
    INTO monatlich, abweichend
    FROM ist;

  -- Die Monatsplaene MUESSEN da sein: `PLAN_ENTITLEMENTS` fuehrt alle neun
  -- Schluessel, und `check:limits` liest sie. Fehlen sie im Katalog, ist der
  -- Katalog kaputt und nicht diese Migration zu locker.
  IF monatlich <> 9 THEN
    RAISE EXCEPTION
      'Kontingent-Angleichung: % von 9 Monatspaaren gefunden. Fehlt ein '
      'Produkt oder ein Entitlement-Key, greift der UPDATE oben ins Leere.',
      monatlich;
  END IF;

  -- Jahreszeilen werden nicht eingefordert, aber wenn sie existieren, muessen
  -- sie denselben Wert tragen.
  IF abweichend > 0 THEN
    RAISE EXCEPTION
      'Kontingent-Angleichung unvollstaendig: % Paar(e) weichen weiterhin ab.',
      abweichend;
  END IF;
END $$;
