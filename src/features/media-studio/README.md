# Media Studio — Bild-/Video-Builder mit Regie-Agent

Route `/app/media-studio` (AppGate). Analyse und Freigabestand: `docs/product/media-studio-analyse.md`.

1. Briefing (Einsatz, Branche, Motiv, Stil, Format, optional Video + Kamera).
2. `agent/planner.ts` plant deterministisch: Anbieter nach Verfügbarkeit, Formatanpassung,
   Bild → Keyframe → Video.
3. Mensch prüft Prompts und gibt frei (`approvePlan`). Jede Änderung hebt die Freigabe auf.
4. `agent/runner.ts` führt aus: Reihenfolge, Keyframe-Übergabe mit Server-Signatur, Polling,
   ein Retry nur bei vorübergehenden Fehlern, Abbruch, Prüfpfad-Ereignisse.

Keine Anbieter-Schlüssel im Browser. Alle Gates in `supabase/functions/media-studio/handler.ts`.
Tests: `test/media-studio/agent.test.ts`, `test/edge/media-studio.test.ts`.
