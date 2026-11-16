# Creative Studio — MVP Implementation Blueprint (Draft)

Status: **ENTWURF — keine Implementierung, kein Deployment**. Stand: 2026-11-16.

## Verifizierter Bestand

- Stack: React 19 / Vite 6 / TypeScript / Tailwind 4, Supabase EU, Cloudflare Pages (CLAUDE.md).
- Serverseitige Berechtigungsprüfung: `supabase/functions/_shared/entitlements.ts`.
- Preis-/Tarif-SSoT: `shared/pricing.ts`; Checkout: `src/lib/stripe.ts`.
- xAI-Realtime-Voice-Relay: `src/lib/company-voice/grok-relay.ts`. **Nicht** mit Bild-/Video-API gleichsetzen.
- Live-DB (read-only geprüft): `audit_jobs`, `fmt_publish_jobs`, `usage_events`, `usage_counters`, `bot_usage_reservations`, `bot_usage_ledger` vorhanden; privater Bucket `bilder` und `creatorseal-content` vorhanden.
- `audit_jobs` ist auditspezifisch; `fmt_publish_jobs` ist publikationsspezifisch. Keine Umwidmung ohne Prüfung.
- `usage_events` enthält `tenant_id`, `entitlement_key`, `delta`, `metadata`; `usage_counters` hat feste Spalten. Vor Erweiterung bestehende Usage-SSoT und Reservierungslogik prüfen.
- Keine Tabelle namens `creative_jobs` in der initialen Schema-Suche; alternative Benennungen und bestehende Provider-Adapter weiter prüfen.

## Vorgeschlagener MVP-Schnitt

1. **Image create** (zuerst), **video create/status** (danach); Bildbearbeitung, Videoedit und Extend erst nach validiertem Basispfad.
2. UI innerhalb der vorhandenen `/app`-Shell, keine zweite App oder neue Billing-SSoT.
3. Serverseitiger Provider-Adapter hinter Auth, Tenant-/Policy-Check, Feature-Entitlement und Kostenlimit. Kein xAI-Key im Browser.
4. Private Medienobjekte mit mandantenbezogenen Pfaden und kurzlebigen signierten URLs; Buckets/RLS vor Wiederverwendung prüfen.
5. Nachvollziehbarer Job-Lifecycle: `queued → submitted → processing → completed | failed | cancelled`. Provider-Request-ID, Idempotency-Key, Versuche, Fehlercode und Audit-Ereignisse dokumentieren.

## Vorgeschlagenes Schema (NICHT AUSFÜHREN)

`creative_jobs`: `id uuid PK`, `tenant_id uuid NOT NULL`, `user_id uuid NOT NULL`, `kind text`, `provider text`, `model text`, `status text`, `idempotency_key text`, `provider_request_id text`, `request_params jsonb` (ohne Secrets), `result_storage_path text`, `estimated_cost_usd numeric`, `actual_cost_usd numeric`, `error_code text`, `attempts integer`, `created_at/updated_at/completed_at timestamptz`.

Constraints/Indizes: eindeutiger `(tenant_id, idempotency_key)`; Tenant-/Status-/Created-at-Index; Status-Check; RLS aktiv. Client nur eigene autorisierte Jobs lesen; Schreib-/Statusübergänge ausschließlich über geprüfte Serverpfade. RLS-Prädikat aus **bestehendem Tenant-Mitgliedschaftsmodell** ableiten, nicht frei erfinden. Keine direkte öffentliche INSERT/UPDATE-Freigabe.

## Edge-Function-Schnitt (Entwurf)

- `creative-image-create`: Request validieren, Entitlement prüfen, atomar Budget reservieren, idempotenten Job anlegen, Provider aufrufen, Ergebnis sicher speichern, Nutzung finalisieren.
- `creative-video-create`: wie oben, Provider-Request-ID persistieren, schnell antworten.
- `creative-video-status`: ausschließlich autorisierte Tenant-Jobs, Status über Worker/Provider synchronisieren; Rate Limits, Backoff, Ablaufzeit.
- `creative-library`: Metadaten und zeitlich begrenzte Download-URLs für berechtigte Nutzer.

Fehlerfälle: fehlende Berechtigung, Budget erschöpft, Provider-Timeout, Doppelklick, wiederholter Callback/Poll, fehlendes Objekt, fehlende API-Credentials. Fehler dürfen keine Geheimnisse enthalten.

## Prüf- und Freigabegates

- [ ] Repo-Inventar: vorhandene Medienfunktionen, Routen, Adapter, Storage-Policies, Migrationen und CI-Konventionen vollständig prüfen.
- [ ] Live-RLS/Bucket-Policies **read-only** prüfen; keine Annahmen aus Bucket-Namen.
- [ ] Offizielle xAI-API-Referenz für Modellnamen, Parameter, asynchrone Aufträge und Preise gegenprüfen.
- [ ] Nutzungs-/Reservierungslogik auf transaktionssichere Kostenabrechnung prüfen; keine doppelte Stripe-Belastung.
- [ ] Datenschutz: Aufbewahrung, Löschung, Provider-Datenfluss, Nutzungsrechte, Inhaltsmoderation, AVV/Subprozessoren klären.
- [ ] Tests: Cross-Tenant Denial, RLS, Budget-Parallelität, Idempotenz, Retry, Statusübergänge, Storage-Signierung, Fehlermeldungen.
- [ ] `npm run lint`, `npm test`, `npm run build` und relevante CI-Checks auf Implementierungs-Head ausführen.
- [ ] Produktstatus in `src/product/implementation-status.ts` korrekt als Entwurf/Preview abbilden; keine Live-Claims.

## Änderungsschranken

Gemäß `AGENTS.md`: keine Migration, Deployments, Merge, Preis-/Claim-Änderung, Workflows oder Berechtigungsänderung ohne Einzel-Freigabe. Dieser Draft-PR dokumentiert nur den geprüften Plan und stellt **keine funktionsfähige Integration** dar.
