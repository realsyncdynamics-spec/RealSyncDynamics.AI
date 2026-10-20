-- Einkaufspreis-SSoT, Schritt D: ai_tools.cost_* ist keine Preisquelle mehr.
--
-- Seit Schritt C rechnet runAiTool (supabase/functions/_shared/ai.ts) aus
-- shared/model-prices.ts und fiel nur noch auf diese beiden Spalten zurück,
-- wenn für (model_provider, model_id) kein Preis geführt war. Mit Schritt D
-- entfällt auch dieser Rückfall: ohne SSoT-Preis läuft ein Tool nicht
-- (MODEL_PRICE_MISSING, vor Reservierung und Providercall). Kein Code liest
-- die Spalten noch.
--
-- Bewusst NICHT destruktiv: die Spalten bleiben mit ihrem NOT NULL DEFAULT 0
-- bestehen, damit bestehende INSERTs in ai_tools weiterlaufen. Entfernt
-- werden sie erst in einer eigens freigegebenen Migration. Bis dahin sagt der
-- Spaltenkommentar jedem, der sie in Studio oder per SQL ändert, dass das
-- nichts an der Abrechnung ändert.

COMMENT ON COLUMN public.ai_tools.cost_input_per_million_usd IS
    'VERALTET (Schritt D): wird nicht mehr gelesen. Einkaufspreise stehen ausschließlich in shared/model-prices.ts; ohne Preis dort läuft das Tool nicht (MODEL_PRICE_MISSING).';

COMMENT ON COLUMN public.ai_tools.cost_output_per_million_usd IS
    'VERALTET (Schritt D): wird nicht mehr gelesen. Einkaufspreise stehen ausschließlich in shared/model-prices.ts; ohne Preis dort läuft das Tool nicht (MODEL_PRICE_MISSING).';
