# xAI-API-Watch: Erstprüfung und RealSync-Anschluss

**Stand:** 2026-11-13 · **Prüftyp:** erste Baseline, kein Vorwochenvergleich  
**Quelle:** Offizielle xAI-Entwicklerdokumentation, Release Notes und vorhandener RealSync-Code  
**Wirkung dieses PR:** nur inventarisieren und dokumentieren; kein API-Call, Deploy, Migration, Workflow oder Preiswechsel.

## 1. Bestehende Überwachung (nicht duplizieren)

Externe ChatGPT-Automatisierung **„xAI API wöchentlich überwachen“**:
- Aktiv, erster manueller Lauf am 2026-11-13 angestoßen.
- Termin: Montag **11:09 Uhr Europe/Berlin**, nächster geplanter 2026-11-16.
- Auftrag: primärquellenbasierter Bericht zu Grok Build/ACP, Imagine Bild/Video, Voice, Modellen,
  Endpunkten, Preisen, Limits und Datenschutz mit Auswirkungen auf RealSync.
- **Ausführung ausschließlich in ChatGPT.** Das AI-OS-Routinenregister zeigt sie als extern an;
  der registrierte Status ist **keine** Live-Statusabfrage, Berichtsübertragung oder Dispatch.
- Keine zweite GitHub-Action, kein Supabase-pg_cron-Job und keine zusätzliche kostenpflichtige
  xAI-Abfrage für denselben Überwachungszweck anlegen.
- Eine spätere Integration der Berichte benötigt einen **separat freigegebenen**, authentifizierten
  Import mit minimalen Rechten, Herkunftsprüfung, Redaktion und Audit. Keine ChatGPT-Task-ID im
  öffentlichen Repository ablegen.

## 2. Änderungen / verifizierte API-Baseline

Da die Automatisierung noch keinen früheren Bericht hat, sind dies **keine Veränderungen seit
letzter Woche**, sondern die erste belastbare Referenz.

| Fähigkeit | Offizieller Stand | RealSync-Konsequenz |
|---|---|---|
| Images | `POST /v1/images/generations`; `grok-imagine-image-2.0`; Bearbeitung mit Referenzen | Eigene serverseitige Medienoperation, nicht in Browser-Code |
| Videos | `POST /v1/videos/generations`; `GET /v1/videos/{request_id}`; `pending/done/failed` | Jobzustand, Polling, Limits, TTL und Kostenreservierung erforderlich |
| Grok Build | Coding-Agent mit TUI, Headless und ACP | Nur getrennte isolierte Entwicklungsumgebung; nicht als Kunde-Shell in Pages/Edge |
| Voice | `grok-voice-3.0` seit 2026-10-14, v2 deprecated; `grok-voice-latest` zeigt auf v3 | bestehende Grok-Voice-Konfiguration gegen Live-Protokoll testen |
| Images Legacy | seit 2026-11-02 `grok-imagine-image-quality/pro` intern zu `grok-imagine-image-2.0-low` geroutet | Bei neuen Funktionen die aktuellen Modellslugs verwenden |
| Datenschutz | Standard-Aufbewahrung laut xAI-Sicherheits-FAQ; ZDR teamweit mit Feature-Einschränkungen | Drittland-/Auftragsverarbeitungsprüfung, Consent und Zweckbindung vor Livebetrieb |

Offizielle Nachweise:

- https://docs.x.ai/developers/release-notes
- https://docs.x.ai/developers/model-capabilities/imagine
- https://docs.x.ai/developers/model-capabilities/video/generation
- https://docs.x.ai/developers/rest-api-reference/inference/images
- https://docs.x.ai/developers/rest-api-reference/inference/videos
- https://docs.x.ai/build/overview
- https://docs.x.ai/developers/models/speech-to-speech
- https://docs.x.ai/developers/pricing
- https://docs.x.ai/developers/faq/security

## 3. Vorhandenes RealSync vor Integration

- **React 19 / Vite 6 / Cloudflare Pages:** App-UI und Pages-Function für Voice;
  `src/lib/company-voice/grok-relay.ts` trennt xAI-Schlüssel vom Browser,
  ist ohne Feature-Flag deaktiviert und begrenzt Laufzeit/Frames.
- **Supabase Edge/Postgres:** zentrale `ai-gateway`-Infrastruktur, Tenant-/Policy-Zugriff,
  `bot_usage_limits` / `bot_usage_reservations` / `bot_usage_ledger` als bereits vorhandenes
  Budgetmuster. Keine neue zweite Budgettabelle.
- **Builder:** `/builder/:slug` (SiteOS/Puck) und `/builder/:slug/code` (Code Builder);
  `/build` als Einstieg. Keine Verdopplung durch ein separates Grok-Builder-Produkt.
- **Voice:** weiterer Provider im `apps/agent-runtime`, zusätzlich Landing-Demo-Relay.
  Repo-Code ist **nicht** der Nachweis einer erfolgreich produktiv laufenden Sprachsession.
- **Internes Command Center:** `/admin/ai-os/routinen` registriert bestehende Automationen.
  Dieser PR ergänzt nur die externe xAI-Watch.

## 4. Empfohlene Umsetzung (nicht Gegenstand dieses PR)

1. **Gateway/Policy-Freeze:** tatsächliche Auth, Tenant-RLS, Budget-Reserve/Settlement,
   Auditing, Entitlements und regionalen Datentransfer vor weiteren xAI-Operationen prüfen.
2. **Medien-Adapter** als neue Operation *hinter* dem vorhandenen Governance-/Kosten-Gateway;
   niemals `XAI_API_KEY` im `VITE_*`-Bundle oder als Browser-Token.
3. **Bild-Generierung/Bearbeitung:** erlaubte Modelle, Typ-/Größen-/Prompt-Validierung,
   Moderation, Nutzungsrechte, kurze Ergebnis-URLs, kontrollierte Speicherung.
4. **Video-Jobs:** atomare Kostenreservierung vor Start, asynchrones Polling mit Backoff,
   idempotente Statuswechsel `pending/done/failed`, Download temporärer Provider-URLs,
   abgelaufene Aufgaben und Fehlversuche begrenzen.
5. **Build/ACP:** nur verifizierter, isolierter Runner mit erlaubten GitHub-Repositories
   und Tool-Allowlist; niemals unüberwachte Kundenbefehle ausführen; Code-Auslieferung
   ausschließlich über Review-PR/Approval Gate.
6. **Produktstatus:** keine „live“-Bewerbung für Imagine/Build, bevor Serverbetrieb,
   Berechtigungen, Abrechnung und E2E tatsächlich geprüft sind. Preise nur aus
   `shared/pricing.ts` sowie freigegebenen tarifbezogenen Quellen.
7. **Bericht-Import (optional):** erst Schnittstelle und Zugriffskontrolle entscheiden.
   Bis dahin bleibt die externe Überwachung als lesendes Inventar dokumentiert.

## 5. Verifikation und Freigabegrenze

Dieser PR ändert allein das interne Routinen-Register und den Hinweis in der
bereits vorhandenen Ansicht. Ein automatischer Statusimport wird **nicht** behauptet.
Kein Merge oder Deployment ohne separate Freigabe. CI gegen PR-Head ist maßgeblich.
