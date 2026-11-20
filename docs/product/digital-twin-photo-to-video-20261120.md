# RealSync Digital Twin Studio – Foto zu Video

Stand: 20.11.2026. Status: DRAFT / local-only Vorschau. Nicht gemergt, nicht deployt, keine produktive Video-API.

## Referenzbild und Ziel
Der Nutzerscreenshot zeigt unter Video erstellen die App-Einträge Prompt to Video, Creative Studio und Foto zu Video. Die letzte Funktion wird als Foto-zu-Avatar-Video beschrieben. Screenshot allein belegt keine verwendeten Provider, KI-Modelle, Rechteprüfungen, Produktionsreife oder Kosten.

Ziel für RealSync Dynamics & AI: eigener authentifizierter Digital Twin Studio-Workflow mit Foto, Script/Audio, realistischem sprechendem Avatarvideo sowie später interaktivem Twin. Keine 1:1-Kopie der fremden App; RealSync-Design bleibt eigenständig.

## Auf diesem Branch tatsächlich implementiert
- Lokal erreichbare Preview-Route /app/creative-studio/digital-twin im vorhandenen AppGate und in der GovernanceBrowserShell.
- Vorhandener TenantProvider: bei Ladefehler oder fehlendem aktiven Tenant keine Werkzeugoberfläche.
- Fotoauswahl JPG, PNG, WEBP bis 10 MB; Bild ist ausschließlich lokale Browser-Object-URL.
- Textskript bis 1000 Zeichen, Format 9:16 / 16:9 / 1:1.
- Rechtebestätigungsfeld vor der Sprachvorschau.
- Browser-SpeechSynthesis mit deutscher Aussprache; ausdrücklich keine geklonte eigene Stimme.
- Sichtbares Label KI-AVATAR VORSCHAU; Render-Button deaktiviert.
- Pure Input-Validation und Vitest-Tests. Ausführung durch CI noch nicht nachgewiesen.
- Keine neue Edge Function, keine Migration, kein kostenpflichtiger Provider-Aufruf, keine persistenten Fotos.

## Noch nicht implementierte echte Foto-zu-Video-Generierung
Die Produktion erfordert einen autorisierten Job-Flow: Identity/Consent -> privater Upload -> Preflight (Authentifizierung, Tenant, Entitlement, Budget, Provider-Rechtmäßigkeit) -> idempotenter Job -> Provider -> Status-Callback/Polling -> private Ergebnisablage -> signierter Download -> Löschung/Evidence.

Die folgende Reihenfolge muss beim Hinzufügen der produktiven Funktion eingehalten werden:
1. Bereits vorhandene Storage-, Entitlement-, Job-, Nutzungskonto- und Agent-Gateway-Bausteine prüfen und wiederverwenden.
2. Serverseitige Authentifizierung und Tenant-Membership prüfen; im Browser gesetzte consent=true reicht als Nachweis nicht.
3. Gesonderte Einwilligung zur Gesichtsverarbeitung, zum fremden Abbild und zu etwaiger Stimmsimulation dokumentieren; Widerruf und Löschpfad implementieren.
4. Kurzlebige und eng zweckgebundene Zugriffsmöglichkeit für Provider statt öffentlicher Dauer-URL. Datenverarbeitung, Region, AVV/DPA und Unterauftragsverarbeiter verifizieren.
5. Idempotency-Key, atomare Kostenreservierung, Rate-Limits und Kill-Switch vor jedem kostenpflichtigen Render.
6. Asynchrone Verarbeitung; Provider-Job-ID, Status, Fehler, Kosten, Ausgabe und Ablauf im Tenant-konformen vorhandenen Jobsystem.
7. Vertrauliche Originale und fertige Clips nur im geprüften privaten Storage; signierte Downloadlinks, festgelegte Löschfristen und revisionssicherer Prüfpfad.
8. KI-Kennzeichnung und erforderlichenfalls maschinenlesbare Provenienz nach Artikel 50 EU AI Act.

## Provider-Einordnung
- Foto zu sprechendem Video, asynchron: D-ID Talks API, offizielle Anleitung https://docs.d-id.com/docs/v2-photo-avatar-quickstart oder HeyGen Photo Avatar / Avatar IV https://www.heygen.com/blog/announcing-the-avatar-iv-api.
- Live-interaktiver digitaler Twin: Anam https://anam.ai/api. Vorhandene RealSync-Live-Avatar-Sandbox gegenprüfen; kein Live-Status behaupten.
- Für echte persönliche Stimme separate Aufnahme/Stimmberechtigung; Browser-TTS ist dafür kein Ersatz.
- Provider dürfen erst nach konkreter API-/Kosten-/Datenschutz-Freigabe mit echtem Nutzmaterial verwendet werden.

## Bestehende RealSync-Grenzen
- Die ungemergten, geschlossenen Entwurfs-PRs #2212 (Creative Studio Editor) und #2271 (Bild-Preview/Preflight) sind keine produktive Freigabe.
- Dokumentierter Supabase-Function-Limit-Blocker (200 Functions, Fehler 402 am 16.11.2026). Neue Function nicht ungeprüft deployen.
- Keine parallele Auth, kein zweites Dashboard, keine neue Billing-SSoT, keine Umstrukturierung.
- Die öffentliche Produktstatus-SSoT wird durch diesen Preview-Branch bewusst nicht verändert.

## Abnahme
- npm run lint, npm test -- test/creative-studio/photo-video-contract.test.ts und npm run build auf dem Branch ausführen.
- Auth- und Tenant-Negativtests, ungültige Dateien, lange Texte, fehlende Zustimmung, Browser ohne TTS prüfen.
- Keine Netzwerkübertragung von Bilddaten im Browser-Preview verifizieren.
- Vor produktiver Generierung: serverseitiger Auth-/RLS-Cross-Tenant-Test, Widerruf, Gebühren-Parallelität, Providerfehler, Timeout, Retry, Callback-Signatur, Idempotenz und Löschung.
- Weder Merge noch Deploy, Migration oder Credential-/Billing-Anbindung ohne ausdrückliche Freigabe.
