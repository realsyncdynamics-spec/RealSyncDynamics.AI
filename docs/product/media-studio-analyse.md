# Media Studio — Analyse Higgsfield und Google AI Studio, Umsetzung im Builder

Stand: 17.11.2026. Quellen: Anbieter-Dokumentation (unten), gelesen am selben Tag.
Status der Umsetzung: implementiert und mit Unit-Tests geprüft; **nicht deployt, nicht gegen
die echten Anbieter-APIs verifiziert**, serverseitig Default aus.

## Produkt-Einordnung (Widerspruch gemeldet)

`AGENTS.md`/K4 priorisiert den AI Receptionist für Handwerk. Ein Bild-/Video-Builder ist dort
nicht vorgesehen. Umsetzung erfolgt auf ausdrücklichen Auftrag des Owners, additiv, ohne
öffentliche Claims (`showOnRoadmap: false`), ohne Landing-Änderung. Nutzen für K4: Handwerks-
betriebe bekommen für ihre Landingpage passende Hero-, Leistungs- und Social-Medien ohne Agentur.

## Was die Vorbilder ausmacht

| Bereich | Higgsfield | Google AI Studio | Übernommen in RealSync |
|---|---|---|---|
| Einstieg | Presets/Apps je Zweck (Werbung, Influencer, Effekte) | Prompt → App (Build-Modus), „AI Chips“ für Bildgenerierung | Einsatz-Vorlagen: Hero, Leistungs-Kacheln, Social-Clip, Produkt-Shot, frei |
| Kamera | Benannte Kamerabewegungen (Dolly, Orbit, FPV …) als Kern-USP | Bewegung per Prompt | 9 Kamera-Presets als Prompt-Regie, anbieterneutral |
| Bild → Video | Bild als Startframe | Omni: Bild + Text → Video | Agent verkettet Bild als Keyframe für das Video |
| Ablauf | Asynchrone Aufträge (`queued → in_progress → completed`) | Synchroner Aufruf, Ergebnis inline | Beide Muster; Agent pollt asynchrone Aufträge |
| Steuerung | Manuell je Generierung | Chat-Agent baut und ändert | Regie-Agent plant, Mensch gibt frei, Agent führt aus |
| Nachweis | — | — | Evidence je Aufruf in `ai_evidence_events`, Prüfpfad in der UI |

Bewusst **nicht** übernommen: AI-Influencer/Personen-Avatare, Gesichtstausch, Motion-Transfer mit
fremden Videos (Rechte- und Deepfake-Risiko), Marken/Optik der Vorbilder.

## Technischer Stand der Anbieter-APIs (Docs)

- **Google Gemini API** (`generativelanguage.googleapis.com/v1beta/interactions`, Header
  `x-goog-api-key`, `Api-Revision: 2026-05-20`). Bild: `gemini-nano-banana-2.1`. Video:
  `gemini-omni-1.2-flash`, 3–15 s, 16:9/9:16, bis 4K. Veo-3.1-Preview ist in der Gemini API
  abgeschaltet. Bilder tragen SynthID-Wasserzeichen.
- **Higgsfield API** (`api.higgsfield.ai`, Header `Authorization: Key <id>:<secret>`):
  `POST /<modell-pfad>` → `request_id`, Status per `GET /requests/{id}/status`, Ergebnis
  `images[].url` / `video.url`, Dateien mind. 7 Tage abrufbar. Belegter Bildpfad
  `higgsfield-ai/soul/v2/standard`; für Video ist kein Pfad belegt → per Env zu setzen.
- Offen/unbelegt: Higgsfield-Felder `aspect_ratio`, `duration`, `image_url` (in den Docs nicht
  dokumentiert); Google-Antwortform für `delivery: inline` bei langen Videos (Größe, Laufzeit
  gegenüber dem Edge-Function-Zeitlimit).

## Umsetzung

| Teil | Datei |
|---|---|
| Katalog (UI + Server) | `supabase/functions/_shared/mediaStudio/catalog.ts` |
| Eingabeprüfung | `supabase/functions/_shared/mediaStudio/validate.ts` |
| Anbieter-Adapter | `supabase/functions/_shared/mediaStudio/providers.ts` |
| Mandanten-Signaturen | `supabase/functions/_shared/mediaStudio/signing.ts` |
| Edge Function | `supabase/functions/media-studio/{handler,index}.ts` |
| Regie-Agent | `src/features/media-studio/agent/{planner,runner}.ts` |
| Oberfläche | `src/features/media-studio/MediaStudioPage.tsx`, Route `/app/media-studio` |

Server-Gates in Reihenfolge: Kill-Switch `MEDIA_STUDIO_ENABLED` → Nutzer-JWT + Mitgliedschaft →
Entitlement `siteos.builder` → Signatur-Secret → Residency `cloud` (eu_local-Mandanten nie an
Google/Higgsfield) → Eingabe + PII-Sperre → signierte Referenz → Modell konfiguriert →
Rate-Limit → Evidence **vor** dem Anbieteraufruf (Fehler = keine Generierung).

Ohne neue Tabelle: Asynchrone Aufträge und Referenzbilder sind per HMAC an den Mandanten gebunden.
Referenzbilder werden nur akzeptiert, wenn das Studio sie selbst für diesen Mandanten erzeugt hat —
kein Upload fremder Fotos an US-Anbieter.

## Freigaben, die noch fehlen

1. Secrets setzen: `GEMINI_API_KEY` und/oder `HIGGSFIELD_API_KEY_ID`/`_SECRET`,
   `MEDIA_STUDIO_SIGNING_SECRET` (≥ 32 Zeichen), dann `MEDIA_STUDIO_ENABLED=true`.
2. Deploy `supabase functions deploy media-studio` (Deploy-Freigabe).
3. Datenschutz: Google/Higgsfield als Auftragsverarbeiter (AVV, Drittlandtransfer) prüfen.
4. Live-Probe je Anbieter mit einem Test-Mandanten (Residency `cloud`).

## Nächste Ausbaustufen

- Asset-Speicher (Storage-Bucket + Tabelle, Migration mit Einzel-Freigabe) → Medien direkt in
  SiteOS-Blueprints einsetzen statt Download.
- Persistentes Rate-Limit/Kostendeckel über `_shared/cost-cap.ts`.
- LLM-Planer über das AI-Gateway (gleiche `Plan`-Struktur, gleiche Freigabe).
- Bildbearbeitung (Inpainting/Variationen) über Google mit signierter Referenz.

## Quellen

- Google AI Studio Docs: https://aistudio.google.com/docs/image-generation, https://aistudio.google.com/docs/omni, https://aistudio.google.com/docs/video
- Google AI Studio Build-Modus: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- Higgsfield API: https://docs.higgsfield.ai/docs, https://docs.higgsfield.ai/docs/concepts/requests
- Higgsfield Kamera-Presets: https://higgsfield.ai/blog/WAN-AI-Camera-Control-Your-Guide-to-Cinematic-Motion
