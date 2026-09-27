-- Einkaufspreis-SSoT, Schritt B: Laufzeittabelle ai_model_prices.
--
-- ACHTUNG, zwei verschiedene Dinge:
--   plan_catalog / shared/pricing.ts          VERKAUFSpreise — was ein Kunde zahlt
--   ai_model_prices / shared/model-prices.ts  EINKAUFSpreise — was ein Token uns kostet
-- Diese Migration fasst ausschließlich das Zweite an.
--
-- Schritt A (#1503) hat shared/model-prices.ts als Autorenquelle angelegt.
-- Diese Migration materialisiert sie als Tabelle, damit ein Preis ohne
-- Code-Deploy gilt und seine Geschichte behält. Der Seed-Block unten ist
-- generiert (scripts/generate-model-prices-sql.ts); `npm run check:model-prices`
-- und test/config/model-prices-ssot.test.ts erzwingen, dass die neueste
-- *_canonical_model_prices.sql wortgleich der Quelle entspricht.
--
-- Schattenbetrieb — KEINE Verhaltensänderung:
--   ai_tools.cost_*_per_million_usd bleibt die Quelle, aus der _shared/ai.ts
--   heute rechnet. Diese Migration ändert daran nichts und stellt keinen
--   Aufrufer um. Sie legt daneben die View ai_tool_price_drift an, die jede
--   ai_tools-Zeile gegen den gültigen SSoT-Preis stellt. Abweichungen werden
--   dort sichtbar, bevor Schritt C die Aufrufer umstellt.
--
-- Nicht-destruktiv: nur CREATE … IF NOT EXISTS / CREATE OR REPLACE VIEW, keine
-- Änderung an bestehenden Tabellen, keine Löschung.

-- ─── 1. Tabelle ─────────────────────────────────────────────────────────────
-- Historie statt Überschreiben: ein bereits verbuchter Lauf muss zu dem Preis
-- bewertbar bleiben, der damals galt. Eine Zeile gilt im halboffenen
-- Intervall [valid_from, valid_to); valid_to IS NULL heißt „gilt jetzt".
--
-- Kein tenant_id: Einkaufspreise sind global. Mandantenspezifische
-- Konditionen wären ein anderes Problem mit eigener Tabelle.
CREATE TABLE IF NOT EXISTS public.ai_model_prices (
  provider                    text          NOT NULL CHECK (provider = lower(provider)),
  model_id                    text          NOT NULL CHECK (model_id = lower(model_id)),
  input_per_million_usd       numeric(10,4) NOT NULL CHECK (input_per_million_usd  >= 0),
  output_per_million_usd      numeric(10,4) NOT NULL CHECK (output_per_million_usd >= 0),
  -- NULL heißt „vom Anbieter nicht separat ausgewiesen": dann gilt
  -- input × 1,25 (Write) bzw. × 0,10 (Read). NULL heißt NICHT „kostenlos".
  cache_write_per_million_usd numeric(10,4)     NULL CHECK (cache_write_per_million_usd >= 0),
  cache_read_per_million_usd  numeric(10,4)     NULL CHECK (cache_read_per_million_usd  >= 0),
  valid_from                  timestamptz   NOT NULL DEFAULT now(),
  valid_to                    timestamptz       NULL,
  -- Belegstelle. Ohne sie ist in sechs Monaten nicht mehr feststellbar, woher
  -- eine Zahl kam.
  source                      text          NOT NULL CHECK (source <> ''),
  updated_at                  timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, model_id, valid_from),
  CONSTRAINT ai_model_prices_interval CHECK (valid_to IS NULL OR valid_to > valid_from)
);

COMMENT ON TABLE public.ai_model_prices IS
  'Einkaufspreise der LLM-Provider (USD je 1 Mio. Tokens), mit Geltungsdauer. '
  'Quelle: shared/model-prices.ts, Seed generiert. NICHT die Verkaufspreise.';

-- Genau ein gültiger Preis je Modell. Die Kleinschreibungs-Checks oben sorgen
-- dafür, dass der exakte Lookup (priceFor normalisiert auf Kleinbuchstaben)
-- jede Zeile auch findet.
CREATE UNIQUE INDEX IF NOT EXISTS ai_model_prices_one_current
  ON public.ai_model_prices (provider, model_id)
  WHERE valid_to IS NULL;

-- ─── 2. RLS: lesbar für Eingeloggte, schreibend nur Service-Role ────────────
-- Dieselbe Sichtbarkeit wie ai_tools, das dieselben Preise heute schon für
-- jeden eingeloggten Nutzer trägt — es wird nichts neu offengelegt. anon hat
-- keine Policy und liest 0 Zeilen.
ALTER TABLE public.ai_model_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_model_prices authenticated-read" ON public.ai_model_prices;
CREATE POLICY "ai_model_prices authenticated-read"
  ON public.ai_model_prices FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ai_model_prices service-write" ON public.ai_model_prices;
CREATE POLICY "ai_model_prices service-write"
  ON public.ai_model_prices FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ─── 3. Schattenvergleich: ai_tools gegen den gültigen SSoT-Preis ───────────
-- Eine Zeile je ai_tools-Eintrag. status:
--   match          Tool-Preis = SSoT-Preis
--   mismatch       Tool-Preis weicht ab — genau der Fall, der bei vps_status
--                  bis 20260919170000 dreifach zu teuer verbucht hätte
--   no_ssot_price  für (Anbieter, Modell) ist kein gültiger SSoT-Preis
--                  hinterlegt; priceFor gäbe hier null zurück
--
-- Verglichen werden nur Input und Output: mehr führt ai_tools nicht.
-- lower(model_id) spiegelt die Normalisierung in priceFor.
--
-- security_invoker: ohne läuft eine View mit den Rechten ihres Owners und
-- umgeht RLS (vgl. 20260927120000_gate0_rls_hardening.sql). Mit ihm gelten die
-- Policies von ai_tools und ai_model_prices für den Aufrufer.
CREATE OR REPLACE VIEW public.ai_tool_price_drift
WITH (security_invoker = on) AS
SELECT
  t.key                          AS tool_key,
  t.enabled,
  t.model_provider,
  t.model_id,
  t.cost_input_per_million_usd   AS tool_input_per_million_usd,
  t.cost_output_per_million_usd  AS tool_output_per_million_usd,
  p.input_per_million_usd        AS ssot_input_per_million_usd,
  p.output_per_million_usd       AS ssot_output_per_million_usd,
  p.source                       AS ssot_source,
  CASE
    WHEN p.model_id IS NULL THEN 'no_ssot_price'
    WHEN t.cost_input_per_million_usd  = p.input_per_million_usd
     AND t.cost_output_per_million_usd = p.output_per_million_usd THEN 'match'
    ELSE 'mismatch'
  END                            AS status
FROM public.ai_tools t
LEFT JOIN public.ai_model_prices p
  ON  p.provider = t.model_provider
  AND p.model_id = lower(t.model_id)
  AND p.valid_to IS NULL;

COMMENT ON VIEW public.ai_tool_price_drift IS
  'Schattenvergleich ai_tools.cost_* gegen ai_model_prices (Schritt B). '
  'Auswerten vor Schritt C, der die Aufrufer auf die SSoT umstellt.';

-- Explizite ACL statt Default-Privilegien: anon soll die View gar nicht erst
-- ansprechen können, nicht bloß 0 Zeilen sehen.
REVOKE ALL ON public.ai_tool_price_drift FROM anon;
GRANT SELECT ON public.ai_tool_price_drift TO authenticated, service_role;

-- ─── 4. Seed aus shared/model-prices.ts ─────────────────────────────────────
-- >>> GENERATED MODEL PRICES (scripts/generate-model-prices-sql.ts) >>>
-- NICHT VON HAND BEARBEITEN. Quelle: shared/model-prices.ts
--
-- Historie statt Überschreiben: eine offene Zeile, deren Preis nicht mehr
-- der Quelle entspricht (oder deren Modell aus der Quelle verschwunden ist),
-- wird geschlossen; danach wird für jedes Modell ohne offene Zeile eine
-- neue eröffnet. Unveränderte Zeilen bleiben unberührt — der Block ist
-- wiederholbar.
--
-- Ein DO-Block statt zweier loser Anweisungen, damit Schließen und Eröffnen
-- auch ohne umschließende Transaktion atomar sind: dazwischen verlangt der
-- Index ai_model_prices_one_current höchstens eine offene Zeile je Modell.
-- `ts` ist clock_timestamp(), nicht now(): so bleiben valid_to des alten und
-- valid_from des neuen Preises lückenlos gleich, und zwei Seed-Migrationen
-- in derselben Transaktion bekommen trotzdem verschiedene Zeitpunkte.
DO $$
DECLARE
  ts  CONSTANT timestamptz := clock_timestamp();
  src CONSTANT jsonb := $json$[
    {"provider": "anthropic", "model_id": "claude-fable-5-1", "input_per_million_usd": 10.0000, "output_per_million_usd": 50.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": 0.2500, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-fable-5", "input_per_million_usd": 10.0000, "output_per_million_usd": 50.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-mythos-5-1", "input_per_million_usd": 10.0000, "output_per_million_usd": 50.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-opus-5", "input_per_million_usd": 5.0000, "output_per_million_usd": 25.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-opus-4-8", "input_per_million_usd": 5.0000, "output_per_million_usd": 25.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-opus-4-7", "input_per_million_usd": 5.0000, "output_per_million_usd": 25.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-opus-4-6", "input_per_million_usd": 5.0000, "output_per_million_usd": 25.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-sonnet-5", "input_per_million_usd": 2.0000, "output_per_million_usd": 10.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-sonnet-4-6", "input_per_million_usd": 3.0000, "output_per_million_usd": 15.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"},
    {"provider": "anthropic", "model_id": "claude-haiku-4-5", "input_per_million_usd": 1.0000, "output_per_million_usd": 5.0000, "cache_write_per_million_usd": null, "cache_read_per_million_usd": null, "source": "anthropic-pricing-2026-06-24"}
  ]$json$;
BEGIN
  UPDATE public.ai_model_prices p
     SET valid_to = ts, updated_at = ts
   WHERE p.valid_to IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_to_recordset(src) AS s(provider text, model_id text, input_per_million_usd numeric, output_per_million_usd numeric, cache_write_per_million_usd numeric, cache_read_per_million_usd numeric, source text)
        WHERE s.provider = p.provider
          AND s.model_id = p.model_id
          AND s.input_per_million_usd  = p.input_per_million_usd
          AND s.output_per_million_usd = p.output_per_million_usd
          AND s.cache_write_per_million_usd IS NOT DISTINCT FROM p.cache_write_per_million_usd
          AND s.cache_read_per_million_usd  IS NOT DISTINCT FROM p.cache_read_per_million_usd
          AND s.source = p.source);

  INSERT INTO public.ai_model_prices (
    provider, model_id, input_per_million_usd, output_per_million_usd,
    cache_write_per_million_usd, cache_read_per_million_usd, source, valid_from, updated_at
  )
  SELECT s.provider, s.model_id, s.input_per_million_usd, s.output_per_million_usd,
         s.cache_write_per_million_usd, s.cache_read_per_million_usd, s.source, ts, ts
    FROM jsonb_to_recordset(src) AS s(provider text, model_id text, input_per_million_usd numeric, output_per_million_usd numeric, cache_write_per_million_usd numeric, cache_read_per_million_usd numeric, source text)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ai_model_prices p
      WHERE p.provider = s.provider AND p.model_id = s.model_id AND p.valid_to IS NULL);
END
$$;
-- <<< GENERATED MODEL PRICES <<<
