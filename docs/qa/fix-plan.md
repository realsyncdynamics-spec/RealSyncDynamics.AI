# Fix Plan — priorisiert nach Audit

Resultate aus `input-processing-output-audit.md` + `claim-to-feature-audit.md`.
Reihenfolge: P0 → P1 → P2 → P3. Jeder Fix hat **Problem · Datei · Änderung · erwarteter Effekt**.

---

## P0 — Vertrauen / Checkout / Mail kaputt

### F-001 · Resend Vault-Key fehlt
- **Problem**: Welcome-Mail, Audit-Report-Mail, Newsletter-DOI funktionieren in Production nicht. Function returnt 503 LLM_NOT_CONFIGURED.
- **Datei**: `vault.secrets` Provisionierung (kein Code-Fix)
- **Änderung**: `curl POST /functions/v1/vault-set-secret` mit `name=resend_api_key`. Runbook: `docs/runbooks/resend-production-email.md`.
- **Effekt**: Signup-Welcome, Audit-Report-Mails, DOI-Mails landen tatsächlich im Postfach.

### F-002 · Stripe Live Secret + Webhook Secret fehlen
- **Problem**: `stripe-checkout` Edge Function mintet keine Live-`cs_live_…`-URLs. `stripe-webhook` kann Signatur nicht verifizieren.
- **Datei**: `vault.secrets` Provisionierung + Stripe-Dashboard-Konfiguration
- **Änderung**: 3 Schritte aus `docs/runbooks/stripe-production-checkout.md`: Restricted Key, Webhook Endpoint, Vault-Provisionierung.
- **Effekt**: Paying Customer können tatsächlich durchsignen.

### F-003 · Stripe Price IDs in `public.products`
- **Problem**: `public.products.stripe_price_id` enthält Sentinel-Werte statt echte `price_…` IDs für Starter/Growth/Agency.
- **Datei**: `public.products` Table (Daten-Migration)
- **Änderung**: SQL UPDATE pro plan_key mit echter Stripe Price ID. Verifikations-SQL in Runbook.
- **Effekt**: Checkout-Sessions können tatsächlich erzeugt werden.

---

## P1 — Pricing-Inkonsistenzen + Stale Tier-Namen

### F-101 · Growth-Preis stale auf "199 €"
- **Problem**: `ProductDifferentiationSection.tsx:44` hardcoded "Growth ab 199 €/Monat". Aktueller Preis: 249 €.
- **Datei**: `src/components/sections/ProductDifferentiationSection.tsx`
- **Änderung**: String "Growth ab 199 €/Monat" → "Growth ab 249 €/Monat". Bonus: aus `pricing.ts` referenzieren statt hardcoden.
- **Effekt**: Konsistente Preisangabe; kein Glaubwürdigkeitsverlust durch Diskrepanz zur /pricing Seite.

### F-102 · Bronze/Silver/Gold-Tiers im Code (legacy, nicht mehr in Pricing)
- **Problem**: 5 Vorkommen alter Tier-Namen mit Preisen, die nicht mehr existieren.
- **Dateien**:
  - `src/pages/BaitMaRiskGuide.tsx:115` — "Silver 99 €/Monat (passt für KMU-FinTechs bis ~50 Mitarbeitende)"
  - `src/pages/Faq.tsx:65-66` — "Silver 99 €/Monat" + "Gold 299 €/Monat"
  - `src/pages/Press.tsx:11` — "Bronze 29 €/M · Silver 99 €/M · Gold 299 €/M"
  - `src/pages/LegalTechLanding.tsx:77-78` — "Silver 99 €/M" + "Gold 299 €/M"
- **Änderung**: Ersetzen durch aktuelle Tier-Namen (Starter/Growth/Agency) oder durch "ab €79/Monat" als generische Anker.
- **Effekt**: Eine einzige Pricing-Story. Keine konkurrierenden Zahlen in Press-Kit / FAQ / Niche-Landings.

### F-103 · Pricing Single-Source-Reference
- **Problem**: Komponenten zeigen Preise hardcoded statt aus `pricing.ts` zu lesen.
- **Datei**: ProductDifferentiationSection (oben), ggf. weitere
- **Änderung**: `import { PRICING_TIERS, tierById } from '@/config/pricing'`; Werte daraus ableiten.
- **Effekt**: Single-Edit für Pricing-Änderungen.

---

## P2 — Overclaims auf Landingpage

### F-201 · White-Label-Reports „mit eigenem Logo"
- **Problem**: Logo-Variable in Templates vorhanden, aber kein Upload-UI im Agency-Tier. Agency-Kunde würde es einklagen.
- **Datei**: `src/config/pricing.ts` Agency-Bullet
- **Änderung**: "White-Label-Reports mit eigenem Logo (Logo-Upload via Support, UI in Q3 2026)" — bis Self-Service-UI gebaut.
- **Effekt**: Kein Reklamationsrisiko bei Pilot-Agency-Kunden.

### F-202 · Tägliches Monitoring (Growth)
- **Problem**: Dediziertes Daily-Cron für DSGVO-Re-Scans nicht aktiviert (Shopify-Webhooks triggern Re-Scans dort, aber nicht für non-Shopify-Domains).
- **Datei**: `src/config/pricing.ts` Growth-Bullet ODER `supabase/migrations/*_daily_audit_recheck_cron.sql`
- **Änderung**: Entweder Cron aktivieren (Code-Pfad da) oder Copy auf "Wöchentliches Monitoring" entschärfen bis aktiviert.
- **Effekt**: Pricing-Versprechen matcht Code-Realität.

### F-203 · Consent-Timing-Analyse (Growth)
- **Problem**: Static-HTML-Pattern-Detection liefert Hinweise, Headless-Browser-Tiefe ist als Option im Code, nicht default.
- **Datei**: `src/config/pricing.ts` + ggf. `supabase/functions/gdpr-audit/index.ts` Default-Mode
- **Änderung**: Headless-Mode als Default für Growth + Agency aktivieren, ODER Copy auf "Static-HTML-Pre-Consent-Detection" entschärfen.
- **Effekt**: Match zwischen Tarif-Versprechen und Methodik.

### F-204 · Evidence Vault Hash-Chain-Trigger fehlt
- **Problem**: Schema in PR #153 Blueprint dokumentiert, aber Trigger-Function-Migration noch nicht ausgeführt.
- **Datei**: `supabase/migrations/<future>_evidence_hash_chain_trigger.sql`
- **Änderung**: Trigger schreiben + apply via `apply_migration`.
- **Effekt**: Enterprise-Pricing-Bullet "Hash-Chain + HMAC-Signaturen" ist nicht mehr Vaporware.

### F-205 · /developers Page SDK-Versprechen
- **Problem**: 6 Integration-Surfaces beworben, aber kein npm-Package `@realsyncdynamics/sdk` veröffentlicht.
- **Datei**: `src/pages/Developers.tsx`
- **Änderung**: Code-Beispiele unter Hinweis "SDK in Vorbereitung — direkt POST gegen `/functions/v1/governance-ingest` möglich". GitHub-Repo verlinken sobald da.
- **Effekt**: Developer-Trust nicht durch Phantom-SDK ramponieren.

---

## P3 — UX / Conversion Verbesserungen

### F-301 · Sub-Processors aus Code statt DB
- **Problem**: `/trust` Sub-Processors-Liste in `Trust.tsx` als Const. Änderung erfordert Code-PR.
- **Datei**: `src/pages/Trust.tsx`
- **Änderung**: Optional: `sub_processors` Table + Edit-UI im /governance Bereich.
- **Effekt**: Schnellere Updates ohne Engineering-Roundtrip.

### F-302 · Audit Engine Version DB-driven
- **Problem**: `engine_version='2026.05.0'` als Const im Code.
- **Datei**: `src/config/audit.ts` oder via Settings-Table
- **Änderung**: Out of audit DB. Low-prio.
- **Effekt**: Marketing kann Engine-Bump-Announcement ohne PR triggern.

### F-303 · DSB-Notification-Channel
- **Problem**: Pricing wirbt mit "DSB-Integration" — DSR-Tracking ist da, aber Notification-Wire (E-Mail/Slack) nicht.
- **Datei**: `supabase/functions/governance-agent/index.ts` Escalation-Tool + neue `notify-dsb` Function
- **Änderung**: Webhook auf Tenant-config `dsb_notify_webhook_url` + Email-Pfad via Resend.
- **Effekt**: Enterprise-Bullet wird produkterfüllt.

### F-304 · Quota-Enforcement Agency-Tier 10 Sites
- **Problem**: Hard-Limit "10 Kundenseiten inklusive" wird nicht enforced.
- **Datei**: Membership/Tenant Quotas + Check in `governance-resources`
- **Änderung**: Soft-Limit mit Warn-Banner bei >10, Hard-Block bei >15.
- **Effekt**: Agency-Tier-Margin verteidigen ohne Power-Customer rauszuschmeißen.

---

## Operative Reihenfolge (Empfehlung)

1. **Heute (User-Action)**: F-001, F-002, F-003 — Runbook abarbeiten, ~30 Min.
2. **Diese Woche**: F-101 + F-102 + F-103 als eine Mini-PR — Pricing-Konsistenz.
3. **Nächste Woche**: F-201 + F-202 + F-203 + F-205 — Overclaim-Entschärfung.
4. **Folge-PRs**: F-204 + F-303 + F-304 — Feature-Lücken füllen.
5. **Optional**: F-301 + F-302 — UX-Polish.
