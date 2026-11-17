# xAI Imagine / Grok Build – kontrollierte RealSync-Integration

**Stand:** 2026-11-13 · **Status:** Code- und UI-Preview, **nicht** produktiv geschaltet  
**Architekturprinzip:** Eine RealSync-Plattform, ein bestehendes AI-OS-Dashboard, kein zweites Abrechnungssystem.

## 1. In diesem Review-PR umgesetzt

- Reine Request-Validierung: `supabase/functions/_shared/xaiImagine/contract.ts`.
- Server-only HTTP-Adapter: `client.ts` für Text-zu-Bild (`POST /v1/images/generations`),
  Text-zu-Video (`POST /v1/videos/generations`) und Videostatus (`GET /v1/videos/{request_id}`).
- Kein freier Modellname, keine arbiträren API-URLs, nur freigegebene Parameter:
  Bild: 1 Ausgabe, 1K/2K; Video: max. 8 s und 720p, Modelle 1.5 und Lite.
- Keine Provider-Fehlertexte in UI, kein xAI-Key im Client, kein Upload oder fremde HTTP-Medienabrufe.
- `guarded.ts`: wiederverwendbarer Adapter an die vorhandene `AiBudgetGuard`-Reserve/
  Settlement-Methodik (`bot_ai_budget_reserve`, `bot_usage_settle`).
  Reserve vor dem bezahlten Aufruf; unbekannter Verbrauch belastet konservativ die Reserve.
- Für Video ist ein `persistJob`-Callback zwingend, bevor eine erfolgreiche Startantwort
  zurückgegeben wird. Der echte tenantgebundene Job-Store ist noch NICHT implementiert.
- Bestehendes Operator-AI-OS hat eine zusätzliche Anzeige unter
  `/admin/ai-os/xai`. Diese Anzeige startet keine bezahlten Aktionen.
- Unit-Tests für Parameter, URL-/ID-Validierung, Transport, Secret-Grenzen,
  Budgetreservierung und asynchrone Video-Ergebnisse.

**Nicht enthalten:** Endpoint, produktive API-Anfrage, aktivierender Feature-Flag in der
Plattform, xAI-Key, Cloudflare-Deploy, Supabase-Migration, Änderung am bestehenden
lokalen `ai-gateway`, RealSync-Checkout, Stripe-Katalog oder neue Kundentarife.

## 2. Warum keine direkte Cloud-Freischaltung?

Der aktuelle RealSync `ai-gateway` stellt `allowCloudFallback=false` fest ein; der
PDP im Gateway läuft standardmäßig in `shadow` und kann im Fehlerfall fail-open
sein. Deshalb **KEINE** xAI-Images als stillen Cloud-Ersatz in den bisherigen
Text-Gateway einführen. Medien benötigen einen expliziten, separat geprüften
Egress-Pfad mit **fail-closed**-Policies, Mandanten-/Kundenrechteprüfung und
Ex-ante-Kostenprüfung.

Beim xAI-Standardendpoint ist die Verarbeitungsregion nicht vertraglich
zugesichert. Nach offizieller FAQ speichert xAI API-Inputs und -Outputs
standardmäßig 30 Tage; Zero Data Retention ist teamweit und kann die
verfügbaren Media-Output-Formate und Modelle beschränken. Vor Livebetrieb
ZDR-/DPA-/Drittlandtransfers und Rechtsgrundlage nachweisen. Eine direkte
DSGVO-/EU-AI-Act-Konformitätszusage ist NICHT gegeben.

## 3. Verbindliche Freigabe-Checkliste für den produktiven Anschluss

1. Auth `requireAuthAndTenant` und rollen-/produktbezogenes Entitlement,
   keinesfalls `tenant_id` aus einem unsicheren JWT-Feld.
2. Dokumentierte Freigabe für xAI-Cloud-Egress samt Hinweis/Einwilligung
   an Nutzende und passenden Datenschutzbedingungen.
3. Ausführbarer PDP im **enforce**-Modus, fehlender PDP = Ablehnung. Keine
   Cloud-Ausnahme über `ai-gateway`.
4. Atomare `AiBudgetGuard.reserve` vor ausgehenden HTTP-Calls. `quotedMaxUsd`
   muss aus einem **serverseitigen, aktuell bestätigten** Preiskatalog stammen.
   Die Schätzpreise in `contract.ts` sind **keine** garantierte Kostenobergrenze.
5. Serverseitige persistent gespeicherte `media_jobs`-Semantik auf bestehender
   Architektur prüfen: tenant_id, user_id, provider_request_id, reservation_id,
   idempotency_key, state, timestamps, Fehler-/Abbruch-/TTL-Management und
   tenantbezogene RLS. Kein neues Schema ohne eigenen Review/Approval.
6. Poll nur für Jobs, deren Eigentümerschaft erneut serverseitig bestätigt wurde;
   Status `pending/done/failed`, Backoff und Rate-Limits.
7. Provider-URLs sind temporär. Zulässige Dateitypen, Malware-/Content-Prüfung,
   revisionsfähige Evidence, kontrollierte Supabase-Storage-Retention und
   Löschkonzept erst nach Freigabe ergänzen.
8. Misstrauische Datenvalidierung, Prompt- und Bild-Moderation, Abuse-Limits,
   Realtime-Metriken und tatsächliche Kosten anhand Provider-`usage`
   verifizieren, bevor Rechnungen/Entitlements betroffen sind.
9. Zuletzt Image-/Video-E2E mit Testkonto und minimalem Budget durchführen.
   Erst danach Integration im bisherigen Kunden-Builder/Dashboard anbieten.

## 4. Grok Build – separater Sicherheitsbereich, gleicher Builder

Grok Build ist ein ausführbarer Coding-Agent (Headless/ACP), keine synchron
ansteuerbare Bild-API. Daher nicht in Supabase Edge Functions oder im Browser
als Shell ausführen. Die vorhandenen Oberflächen `/build`,
`/builder/:slug`, `/builder/:slug/code` bleiben kanonisch.

Ein späterer isolierter Worker soll kontrollierte Repo-Kopien und erlaubte
Tools nutzen; kein Zugriff auf Supabase-Service-Role oder Kundensecrets,
kein selbstständiger Merge/Deploy, jede Änderung als Review-PR mit Evidence.

## 5. Primärquellen

- https://docs.x.ai/developers/model-capabilities/images/generation
- https://docs.x.ai/developers/model-capabilities/video/generation
- https://docs.x.ai/developers/rest-api-reference/inference/images
- https://docs.x.ai/developers/rest-api-reference/inference/videos
- https://docs.x.ai/developers/pricing
- https://docs.x.ai/developers/faq/security
- https://docs.x.ai/build/overview
- https://supabase.com/changelog?tags=edge+functions

## 6. Überprüfungen

- Neue Unit-Tests: `test/xai-imagine/client.test.ts`.
- Bestehende Checks: `npm run lint`, `npm test`, `npm run build`;
  maßgeblich sind ausgeführte CI-Checks auf PR-Head.
- Dieser Entwurf allein beweist **keinen** erfolgreichen Produktiv-E2E-Test.
