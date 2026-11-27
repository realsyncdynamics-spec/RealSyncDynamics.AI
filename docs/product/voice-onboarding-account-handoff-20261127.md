# Voice Agent – Account-zentrierter Onboarding-Handoff (27.11.2026)

**Umsetzung:** isolierter Frontend-Entwurf, kein Backend- oder Telefonie-Go-live. **Keine zweite Plattform.**

## Bestätigter Bestand

- Zentraler RealSync-Account: `SupabaseAuthProvider`, `AppGate`, `TenantProvider` und `GovernanceBrowserShell` sind bereits unter `/app/*` vorhanden.
- Voice-Dashboard: `/app/voice` enthält eine read-only Session-Liste mit ehrlichen Leer-/Fehlerzuständen.
- Öffentliche Voice-Seite: bestehender `PhonebotStartPage` auf `/phonebot/start` mit begrenztem Checkout-Gate (`canOfferVoiceCheckout`).
- Externer Konfigurator: `https://voice.realsyncdynamicsai.de/onboarding.html` stammt aus `realsyncdynamics-spec/vertical-voice-agent` (statische GitHub-Pages-Website); er erzeugt lokal JSON-/Markdown-Dateien, aber keine belastbar bestätigte RealSync-Tenant-Provisionierung.
- VVA-Telefonie-Worker mit xAI/Telnyx und D1 ist ein **separater, derzeit nicht freigegebener** Kanal. Er ist **nicht** das von diesem Frontend benutzte Backend.

## Implementierter Schnitt in diesem Draft-PR

1. **Kanonischer Produktpfad** `/voice-agent` rendert die **vorhandene** Voice-Produktseite; `/phonebot/start` führt query-erhaltend dorthin. Kein zweiter öffentlicher Voice-Produktbaum.
2. **Kundenkonto-Link** auf `/voice-agent` führt nach `/app/voice/setup`. Die bestehende `AppGate`-Logik leitet bei fehlender Anmeldung nach `/welcome?next=/app/voice/setup`.
3. **Geschützter Setup-Handoff** `/app/voice/setup` verwendet dieselbe `GovernanceBrowserShell` und den existierenden `TenantProvider`. Nur mit einem aktuell in der Membership-Liste vorhandenen aktiven Workspace erscheint der externe Preview-Link.
4. **Read-only Preview:** fester HTTPS-Link `voice.realsyncdynamicsai.de/onboarding.html` in einem neuen Tab mit `rel="noopener noreferrer"`; **keine** Session-, Tenant-, Token- oder Formdaten in URL oder Cross-Origin-Request.
5. Die externe Seite bietet weiterhin nur einen **lokalen Export**. Keine Speicherung im RealSync-Backend, kein Checkout, kein Stripe- oder Telnyx-Schalter, keine Telefonnummernaktivierung durch diesen Schnitt. Der bestehende Checkout-Gate bleibt unangetastet.
6. Im Voice-Dashboard wird bei gültigem aktiven Tenant der Weg zur Setup-Vorschau angeboten. Ohne Tenant bleibt nur der ehrliche Blocker.

## Noch nicht implementiert / gesondert zu entscheiden

- **Mandantenbezogener Entwurfsimport:** Vor automatischer Übernahme in die zentrale Postgres-Tenant-Datenhaltung sind ein versionierter Datenvertrag, MIME-/Größen- und Schema-Validierung, Tenant-RLS, Audit und sichere Freigabe erforderlich. Keine UI-"Save"-Simulation.
- **Single Sign-on am externen Host:** Nicht vorhanden; ein Login-Cookie oder JWT der Hauptdomain darf nicht als URL-Parameter/Fragment an GitHub Pages weitergegeben werden.
- **D1 / Supabase:** VVA-Worker und Hauptplattform haben verschiedene Datenmodelle. Keine Migration, Sync oder zweite Kundenverwaltung auf Verdacht.
- **Monetarisierung:** `shared/pricing.ts` und `canOfferVoiceCheckout` bleiben alleinige Quelle. Preise, Zusatzminuten und Checkout erfordern separate Owner-/Safety-Freigabe.
- **P0-A Hosting:** Apex/www Cloudflare Pages; Voice GitHub Pages als externer DNS-only-Ursprung (Cloudflare-DNS-Read noch offen); keine automatische DNS-/Proxy-Migration.
- **P0-C Voice:** DPA/ZDR, Datenschutz, xAI-Ausgabenlimit, Telekommunikationsanbindung und echter Audio-End-to-End-Test separat belegen.

## Abnahmecheck

- [ ] `npm run check:spa-routes`: kanonische Route und geschützter Setup-Pfad enthalten; SPA-404-Regel bleibt konsistent.
- [ ] `npx vitest run test/features/governance/voice/VoiceSetupView.test.tsx test/features/governance/voice/VoiceSessionsView.test.tsx`: Login-/Tenant-/Fehler-Fälle und externer Link getestet.
- [ ] `npm run lint` und `npm run build:full` erfolgreich.
- [ ] Browser: `/phonebot/start?source=website_transformation&audit_id=...` führt auf `/voice-agent` mit Query-Parametern; `/app/voice/setup` verlangt Anmeldung und kehrt nach Login dorthin zurück.
- [ ] Browser: Tenant A sichtbar, kein Handoff bei fehlendem/ungültigem Tenant; keine Tokens in Network-Requests, URLs oder externem Link.
- [ ] Kein Backend-/Worker-/Stripe-/DNS-Code geändert, keine Telefonnummer aktiviert.
- [ ] Erst nach Review Freigabe für Merge und getrenntes Deployment; kein implizites Go-live.

**Verknüpfungen:** P0 [#2348](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/issues/2348), Cloudflare-Evidence-Draft [#2472](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2472) und bereinigungsbedingt geschlossener Diagnostik-PR [#2358](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2358).
