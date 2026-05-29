-- Security (Advisor function_search_path_mutable): festen search_path auf der
-- Evidence-Hash-Trigger-Funktion setzen. digest() liegt in `extensions`,
-- ai_evidence_events in `public` → beide bleiben aufloesbar, Hash-Kette intakt.
-- Kontext: docs/runtime/SYSTEMCHECK-2026-05-28.md.
alter function public.tg_evidence_event_chain() set search_path = public, extensions, pg_temp;
