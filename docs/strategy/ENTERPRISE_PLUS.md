# Enterprise Plus — Schnitt 2026-09-19

> **Status:** Arbeitsauftrag, nicht Marketing.
> **Repo:** `realsyncdynamics-spec/RealSyncDynamics.AI` @ `main`
> **Live:** https://realsyncdynamicsai.de
> **Backend:** Supabase EU (`ebljyceifhnlzhjfyxup`)
> **Edge-Compute (EU-lokal):** Hostinger-VPS hinter Traefik (Ollama, Open WebUI, n8n)
> **Nicht in diesem Schnitt:** Cloudflare-Worker-Deploy, KV-Create, Policy-Worker-Aktivierung.
> **SSOT bereits vorhanden:** ADR 0004–0009, `shared/pricing.ts`, `docs/strategy/government-enterprise-restructure.md`

## 1. Was „Enterprise Plus“ hier heißt

Nicht ein neuer Plan-Name in Stripe und nicht eine zweite Landingpage.
Enterprise Plus ist die **Beschaffungsfähigkeit**: ein DACH-Mittelstand, eine Behörde oder ein Konzern kann den Tenant betreiben, ohne dass Identity, Nachweis und Betrieb auf Founder-Magic-Link stehen.

Vier Säulen, in dieser Reihenfolge:

| # | Säule | Schon entschieden in | IST 2026-09-19 |
|---|---|---|---|
| 1 | Identity (MFA → SSO/OIDC → SCIM) | ADR 0004, 0006, 0007, 0008 | Magic-Link + OAuth, 0 MFA-Faktoren, 0 SSO-Provider, kein SCIM |
| 2 | Rollen & SoD (`dpo` orthogonal zu `admin`) | ADR 0005, 0011 | CHECK `owner, admin, editor, viewer_auditor` — `dpo` fehlt |
| 3 | Tenant-Admin-Konsole (8 Menüpunkte) | ADR 0004 §7 | Fragmente unter Settings, keine Enterprise-Konsole |
| 4 | Public-Sector-Baseline | ADR 0009 | Flag `tenants.is_public_sector` existiert, Enforcement fehlt |

Was **nicht** in Sprint 1 gehört: BSI-C5-Zertifikat, eIDAS-QES, On-Prem-Lizenzvertrag, Policy-Worker auf Cloudflare, neue KV-Namespaces.

## 2. Stack — verbindliche Grenzen

| Schicht | System | Regel |
|---|---|---|
| Produkt-SPA | Vite/React auf `realsyncdynamicsai.de` | Änderungen nur hinter bestehendem Routing / AppGate |
| Auth + RLS | Supabase Auth + Postgres | Identity bleibt Supabase-nativ. Kein eigener IdP. |
| Edge Functions | `supabase/functions/*` | Service-Role nur hier. Keine Service-Role im Browser. |
| EU-lokal | Hostinger + Traefik + Ollama `gemma3:4b` | Residency-Toggle bleibt Source of Truth |
| Billing | Stripe + `shared/pricing.ts` | Keine zweiten Preise in Docs oder UI |
| Cloudflare Workers / KV | `wrangler-workers.toml` | **Freeze.** Kein `wrangler kv create`, kein Policy-Worker-Deploy, keine unbestätigten Namespace-IDs als Infra behandeln. |

## 3. Sprint-Schnitt

### Sprint A — P0 Identity (beschafftbar machen)

1. **MFA TOTP** für `super_admin` zuerst, dann `owner` / `admin` / `dpo`.
2. Tabelle `tenant_security_settings` (MFA-enforced, public-sector inherits).
3. Recovery-Codes (gehasht) + Super-Admin-Reset. MFA ohne Recovery ist verboten.
4. Rollout **observe → enforce**. AAL2 noch nicht an RLS-Writes koppeln.
5. UI: `/settings/security` Enroll / Verify / Recovery anzeigen.
6. Tests: Enroll, Verify, Recovery, Lockout-Reset, Public-Sector-Default.

Nicht in A: SAML-Addon kaufen, JIT-Provisioning, SCIM-Token.

### Sprint B — SoD + Admin-Konsole

1. `memberships.role` CHECK um `'dpo'` erweitern. Bestehende Reihen unverändert.
2. RLS: `dpo` liest alles und gibt DSFA/DPIA / Art.-15/17 frei. `dpo` ändert keine Identity und kein Billing.
3. Acht Menüpunkte der Tenant-Admin-Konsole verdrahten (Team, Rollen, Sicherheit, SSO-Platzhalter, Identität & Domains, Prüfprotokoll, Datenresidenz, Abrechnung). SSO-Seite darf in B nur den Zustand „nicht konfiguriert“ zeigen.
4. Default-Rolle bei unmapped IdP = `viewer_auditor` (Default-Deny), sobald SSO kommt.

### Sprint C — SSO OIDC, dann SAML

1. OIDC zuerst: Entra ID, Google Workspace. JIT mit Default-Deny.
2. Domain-Verify vor Enforcement.
3. SAML 2.0 danach (Okta / ADFS / Behörden) — setzt Supabase-SSO-Add-on voraus, nicht raten.
4. SCIM bleibt P2 (ADR 0008).

## 4. Definition of Done — Enterprise Plus v1

Ein Enterprise-Tenant ist Plus, wenn alle Punkte wahr sind:

- [ ] `super_admin` kann sich nicht ohne AAL2 an der Plattform-Konsole anmelden (nach Enforce-Phase).
- [ ] Owner/Admin/DPO sehen MFA-Enrollment und Recovery, bevor Enforce greift.
- [ ] Public-Sector-Tenant erzwingt MFA für jede Rolle.
- [ ] Rolle `dpo` existiert in CHECK + RLS + UI, nicht nur in der ADR.
- [ ] Jede privilegierte Aktion aus der AAL2-Matrix von ADR 0006 ist **gelistet** (Observe) und hat einen Owner.
- [ ] Evidence-Export und DSFA-Freigabe sind rollengetrennt (`admin` ≠ `dpo`).
- [ ] Pricing-SSoT unverändert: Enterprise bleibt Sales-led, keine erfundenen Listenpreise.
- [ ] Kein neuer Cloudflare-Worker und kein neues KV aus diesem Schnitt.

## 5. Bewusst nicht jetzt

- Policy-Worker / `POLICY_CACHE` / `SESSION_CACHE` (unbestätigte IDs).
- Fabricated operational KPIs in der Command-Center-Oberfläche.
- Zweiter Enterprise-OS-App-Prototyp unter `/os/app/*` (siehe offener PR #1405).
- On-Prem-Fork des ganzen Monorepos.
- Perplexity oder Claude als produktiver IdP oder als Policy-PDP.

## 6. Nächster Commit nach diesem Dokument

Implementierung Sprint A in einem eigenen Branch, nicht in diesem Docs-Branch.
