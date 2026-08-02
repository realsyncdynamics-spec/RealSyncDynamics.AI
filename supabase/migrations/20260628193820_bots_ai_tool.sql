-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02), Option A.
-- 1:1 aus supabase_migrations.schema_migrations, Version 20260628193820.
-- Gehoert zu Bots-Feature B.
--
-- Hinweis: fuegt denselben ai_tools-Key 'bot_reply' ein wie 20260628121603
-- (Feature A), aber mit `where not exists`. Da A frueher laeuft, ist dieser
-- Insert faktisch ein No-op — in Prod steht A's bot_reply-Definition, nicht
-- die hier beschriebene. Bewusst unveraendert uebernommen, damit ein
-- `supabase db reset` dieselbe Reihenfolge und dasselbe Ergebnis erzeugt.

insert into public.ai_tools
  (key, name, description, model_provider, model_id, ollama_model_id, system_prompt,
   max_tokens, temperature, cost_input_per_million_usd, cost_output_per_million_usd,
   required_entitlement_key, enabled)
select
  'bot_reply',
  'Assistent-Antwort (Termin/Bestellung/FAQ)',
  'Gespraechsantwort der Termin-/Bestell-/FAQ-Bots. Gated via bots.chat.',
  'anthropic', 'claude-sonnet-4-6', 'gemma3:4b',
  $prompt$Du bist ein KI-Assistent fuer ein lokales Unternehmen, eingebettet auf dessen Website oder Telefon-Kanal. Es gelten IMMER folgende Regeln:
1. Gib dich klar als KI zu erkennen, sobald danach gefragt wird oder zu Beginn eines Gespraechs (EU AI Act Art. 50).
2. Bleibe strikt beim hinterlegten Unternehmens-Kontext und Fragenkatalog. Erfinde keine Fakten, Preise oder Zusagen.
3. Keine Rechts-, Steuer- oder Gesundheitsberatung.
4. Verhandle keine Preise und mache keine verbindlichen Zusagen ohne Deckung.
5. Erfrage nur die fuer den Vorgang noetigen Daten (Datenminimierung, DSGVO).
6. Bei Beschwerde, Notfall oder ausdruecklichem Wunsch nach einem Menschen: biete die Weiterleitung an einen Mitarbeiter an und haenge das Signal [[HANDOFF]] ans Ende deiner Antwort.
Antworte kurz, freundlich und in der Sprache des Kunden.$prompt$,
  1024, 0.3, 3.00, 15.00, 'bots.chat', true
where not exists (select 1 from public.ai_tools where key = 'bot_reply');
