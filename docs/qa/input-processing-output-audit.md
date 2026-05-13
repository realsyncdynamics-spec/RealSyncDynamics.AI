# Input → Processing → Output Audit

> Static-analysis QA matrix. 60+ test cases mapping every public surface
> claim or input to its actual code path. Status values:
>
> - **PASS** — code path exists, processes input, returns expected output
> - **PARTIAL** — code path exists but is incomplete / has gaps
> - **MOCK** — UI exists but underlying logic is hard-coded / stubbed
> - **MISSING** — claim made but no code path found
> - **OVERCLAIM** — copy is stronger than what code can deliver
>
> Performed by code-reading (no live runs). Lines reference the latest
> main + open PRs at audit time.

| # | Area | Claim / Input | Expected Processing | Expected Output | Actual Result (Static Analysis) | Status | Severity | Fix |
|---|---|---|---|---|---|---|---|---|
| 1 | /audit | "Domain eingeben → Risk-Score 0–100" | gdpr-audit Edge Function: fetchWithTimeout + runChecks + scoreReport | `{score, severity, audit_id, issues[], methodology}` | Implementiert in `supabase/functions/gdpr-audit/index.ts`. Score-Range 0–100 produziert via `scoreReport()`. | PASS | — | — |
| 2 | /audit | Top-3 Risiken sichtbar | gdpr-audit liefert `issues[]` sortiert nach severity | Erste 3 in `issues[]` sind die kritischsten | issues array kommt zurück. Sortierung nach severity in `AuditLanding.tsx` Display-Code, nicht im Backend. | PARTIAL | low | Sortierung in scoreReport zentralisieren |
| 3 | /audit | Mini-PDF-Report | audit-report-pdf Edge Function | PDF-Download-URL in response | `audit-report-pdf` Edge Function existiert. PDF-Rendering über `@react-pdf/renderer`. | PASS | — | — |
| 4 | /audit | Mini-PDF Inhalt: Top-3 + Paragraphenbezug | scoreReport setzt `paragraph_ref` pro Issue | PDF zeigt Paragraphen | Field `paragraph_ref` in Issue-Schema. Rendering verlässt sich auf Existenz, fallback zu '–' wenn null. | PASS | — | — |
| 5 | /audit | Leere URL | Validation in gdpr-audit | 400 INVALID_URL | normalizeUrl gibt null bei leerer Eingabe; Function returnt 400. Smoke-test in scripts/qa-smoke-test.ts. | PASS | — | — |
| 6 | /audit | Ungültige Email | Validation in gdpr-audit | 400 INVALID_EMAIL | Email-Regex-Check vor Insert. Smoke-test deckt ab. | PASS | — | — |
| 7 | /audit | URL ohne Schema (`example.de`) | Normalize zu `https://example.de` | Scan läuft | `normalizeUrl()` prefixed `https://` wenn fehlt. | PASS | — | — |
| 8 | /audit | URL mit Schema (`https://example.de`) | Direkter Use | Scan läuft | Same code path. | PASS | — | — |
| 9 | /audit | IDN-Domain (`münchen.de`) | Punycode? | Scan läuft | URL-Konstruktor handhabt das in modernen V8. Nicht explizit getestet. | PARTIAL | low | Test-Case für IDN ergänzen |
| 10 | /audit | Localhost / IP / private range | Block | 400 INVALID_URL | SSRF-Schutz: localhost + private ranges geblockt. | PASS | — | — |
| 11 | /audit | 50 MB HTML-Body | Limit | Truncate oder Error | fetchWithTimeout hat Größen-Limit via response.text() ohne Cap. Theoretisch DoS-Vektor. | PARTIAL | medium | response-size-cap einbauen |
| 12 | /audit | Subpage-Scan | scanSubpages über robots.txt + sitemap | Issues aggregiert | Subpage-Scan vorhanden, sitemap-parsing + max 10 subpages. | PASS | — | — |
| 13 | /audit | Domain mit aktivem Cookie-Banner | Consent-Timing | Lower severity wenn Banner | Pattern-Detection auf bekannte CMPs. | PASS | — | — |
| 14 | /audit | Domain mit Pre-Consent-Tracker | Detection | high severity finding | Static-HTML-Detection findet Tracker-Scripts pre-consent. | PASS | — | — |
| 15 | /audit | Methodology-Section | Returns metadata | `methodology.engine_version`, `tracker_db_version` | Beide Felder gesetzt. UI rendert sie. | PASS | — | — |
| 16 | /pricing | 5-Tier-Anzeige | PRICING_TIERS map | Alle 5 Cards | `src/config/pricing.ts` ist SSOT. PricingPage iteriert. | PASS | — | — |
| 17 | /pricing | Free Audit Card | tier id='free' | Price 0, "Kostenlos scannen" CTA | Korrekt. | PASS | — | — |
| 18 | /pricing | Starter 79 €/Monat | tier id='starter' price 79 | Card zeigt 79 € | Korrekt. | PASS | — | — |
| 19 | /pricing | Growth 249 €/Monat | tier id='growth' price 249 | Card zeigt 249 € | Korrekt. **Aber:** `ProductDifferentiationSection.tsx:44` zeigt "Growth ab 199 €/Monat" hardcoded — STALE. | OVERCLAIM | high | Update line 44 zu 249 |
| 20 | /pricing | Agency 699 €/Monat | tier id='agency' | Card zeigt 699 € | Korrekt. | PASS | — | — |
| 21 | /pricing | Enterprise individuell | tier id='enterprise' | Card zeigt "ab 1.500 € / Monat" | Korrekt. | PASS | — | — |
| 22 | /pricing | Pricing-Trust-Note | PRICING_TRUST_NOTE String | Zeile unter Cards | Korrekt. | PASS | — | — |
| 23 | /pricing | Bronze/Silver/Gold | (legacy, nicht mehr im Pricing) | Keine Erwähnung | **In `BaitMaRiskGuide.tsx`, `Faq.tsx`, `Press.tsx`, `LegalTechLanding.tsx` werden Bronze/Silver/Gold mit 29/99/299 € genannt.** Komplette Inkonsistenz mit aktueller 5-Tier-Struktur. | OVERCLAIM | high | Ersetzen durch Starter/Growth/Agency oder entfernen |
| 24 | /checkout/starter | Auth check | useAuth | Redirect nach /welcome wenn nicht auth | Korrekt in checkout.ts. | PASS | — | — |
| 25 | /checkout/starter | Stripe-Session erzeugen | stripe-checkout Edge Function | `cs_live_…` URL | Implementiert. Setzt voraus dass `stripe_secret_key` in Vault + Stripe-Price-ID in `public.products`. | PARTIAL | high | Vault-Key + Price-IDs operationell nicht gesetzt (P0-Runbook) |
| 26 | stripe-checkout | Ohne Auth-Header | 401 | 401 UNAUTHORIZED | Edge Function returnt 401. Smoke-test deckt ab. | PASS | — | — |
| 27 | stripe-checkout | Plan-Key `free` | Reject | 400 INVALID_PLAN | Im Code: `if (planKey === 'free_audit') return 400`. Smoke-test deckt ab. | PASS | — | — |
| 28 | stripe-webhook | Ohne Signature-Header | 400 | 400 SIGNATURE_REQUIRED | constructEventAsync wirft → returnt 400. Smoke-test deckt ab. | PASS | — | — |
| 29 | stripe-webhook | Doppel-Delivery selber event_id | Idempotency | 200 ok, kein Doppel-Sync | `webhook_events` Table mit UNIQUE auf `stripe_event_id`. | PASS | — | — |
| 30 | stripe-webhook | invoice.payment_succeeded | syncSubscription | `subscriptions.current_period_end` aktualisiert | Implementiert. | PASS | — | — |
| 31 | /welcome | OAuth (Google/LinkedIn/GitHub/Microsoft) | Supabase Auth Redirect | Cookie + Session | 4 Provider in `src/lib/supabase.ts` konfiguriert. | PASS | — | — |
| 32 | /welcome | Magic-Link Fallback | Resend mail | Email-Click → Session | Implementiert. **Aber:** Resend-Vault-Key fehlt heute → 503 LLM_NOT_CONFIGURED in welcome-email Function. | PARTIAL | high | resend_api_key in Vault setzen (Runbook docs/runbooks/resend-production-email.md) |
| 33 | /welcome | Auto-Tenant on Signup | Trigger `auto_tenant_on_signup` | Neuer tenant + membership(role=owner) | Migration `20260501000000_auto_tenant_on_signup.sql`. | PASS | — | — |
| 34 | /governance | AuthGate | Wenn nicht auth → /welcome?next=/governance | Redirect | AuthGate-Component implementiert. | PASS | — | — |
| 35 | /governance | GovernanceDashboardView | Reads governance_assets, events, policies | Cards + Tabellen | Implementiert mit tenant_id Filter via RLS. | PASS | — | — |
| 36 | /governance | Chat-Widget (AgentWidget) | sb.functions.invoke('governance-agent') | Antwort + Tool-Calls | Function deployed (PR #154). **Aber:** kein anthropic_api_key in Vault → 503 LLM_NOT_CONFIGURED. | PARTIAL | medium | API-Key setzen (Runbook docs/runbooks/governance-agent-activation.md) |
| 37 | /governance | Tool: list_assets | governance-agent ruft governance_assets via RLS | Liste | Implementiert. | PASS | — | — |
| 38 | /governance | Tool: escalate_to_human | governance-agent INSERT in governance_admin_log | Ticket-ID | Implementiert. Notification-Pfad zu Slack/Email noch nicht gewired. | PARTIAL | low | Notification-Wire als Folge-PR |
| 39 | /governance/assets/:id | RemediationPanel | listSnippets via governance-remediate | Liste + Generator | UI in PR #164. Edge Function in PR #163 live. | PASS | — | — |
| 40 | /governance/assets/:id | RemediationPanel Generate | governance-remediate generate | Snippet + Code + Copy-Button | Funktioniert für 5 Patterns. | PASS | — | — |
| 41 | /governance/assets/:id | Mark Applied | UPDATE status → applied | Status-Pill + Audit-Log | Implementiert. | PASS | — | — |
| 42 | /governance-runtime | Demo-Workspace | Seed-Daten | Public Demo ohne Auth | `GovernanceRuntimePage.tsx` zeigt Seed-Daten. | PASS | — | — |
| 43 | /trust | Trust Center | Statische Seite | 6 Pillars + Compliance + SLOs + Sub-Processors | Implementiert in PR #159. | PASS | — | — |
| 44 | /trust | Sub-Processors Liste | Statisch im Code | Liste mit Region + Transfer | 5 Sub-Processors. Bei Änderung muss Code-PR. | PARTIAL | low | Aus dem Code in DB ziehen + UI-Edit-Path |
| 45 | /developers | API-Docs-Stub | Statische Seite | 6 Integration-Surfaces | Implementiert. **Aber:** Kein echter OpenAPI-Spec, keine echte SDK. | OVERCLAIM | medium | SDK-Repo + OpenAPI bereitstellen oder Copy entschärfen |
| 46 | /pilot-readiness | usePilotReadiness | tenant-scoped COUNTs | 8 Daten-Cards | Implementiert in PR #160. | PASS | — | — |
| 47 | /integrations/shopify | Connect Form | normalizeShopDomain client + server | Redirect zu Shopify OAuth | Implementiert. Tests in test/shopify-utils.test.ts. | PASS | — | — |
| 48 | shopify-install | shop param fehlt | 400 | 400 invalid shop parameter | Test deckt ab via spec. | PASS | — | — |
| 49 | shopify-callback | HMAC fail | 401 | 401 hmac verification failed | Implementiert. | PASS | — | — |
| 50 | shopify-scan | Shop nicht installed | 401 + CTA | 401 SHOP_NOT_INSTALLED | Implementiert. | PASS | — | — |
| 51 | shopify-webhooks | HMAC fail | 401 | 401 | Implementiert. | PASS | — | — |
| 52 | shopify-scan | Tracker im HTML | Detect | detectedVendors[] | 9 Patterns. | PASS | — | — |
| 53 | shopify-scan | Consent-Signal | Detect | consentSignals[] | 5 Vendoren. | PASS | — | — |
| 54 | shopify-scan | Drift zu vorherigem Scan | compareShopifyScans | drift_events insert | Implementiert. Tests decken 6 Drift-Typen ab. | PASS | — | — |
| 55 | /dokumente/dse | DSE-Generator | generate-document Edge Function | DOCX/PDF Download | Implementiert. | PASS | — | — |
| 56 | /dokumente/avv | AVV-Generator | Same | DOCX | Implementiert mit Variablen-Substitution. | PASS | — | — |
| 57 | /dokumente/vvt | VVT-Wizard | Multi-Step Form → DOCX | DOCX | UI vorhanden. **Generierung verwendet Templates, keine LLM-Synthese**. | PARTIAL | low | OK so — Templates sind defensiver |
| 58 | /vvt/tom-generator | TOM-Generator | Templates | DOCX | Implementiert. | PASS | — | — |
| 59 | /cookie-scanner | Public Free Scan | gdpr-audit unter Hood | Score + Findings | Implementiert. | PASS | — | — |
| 60 | /ai-act-classifier | Annex III Klassifizierung | ai-act-classify Edge Function | Risikoklasse | Implementiert. | PASS | — | — |
| 61 | /vvt-wizard | VVT Multi-Step | Form-State + Submit | DOCX | UI + Backend implementiert. | PASS | — | — |
| 62 | Landing → Roadmap | Status-Pills | RoadmapSection | 7 Items, 4 Status-Typen | PR #166 normalisiert auf 4 Status. **Heute auf main aber noch 3 Status.** | PARTIAL | low | Nach PR #166 Merge OK |
| 63 | /security | Security Page | Statisch | RBAC, RLS, Webhook-Signing | Implementiert. | PASS | — | — |
| 64 | Audit Engine Version | engine_version, tracker_db_version | Static-Strings im Code | `2026.05.0` im UI | Korrekt. Aktualisierung erfordert Code-PR. | PARTIAL | low | OK so, ggf. DB-driven später |
| 65 | Newsletter Confirm | Double-Opt-In via Resend | newsletter-confirm Edge Function | Confirmation-Page | Implementiert. Hängt an resend_api_key Vault-Provisioning. | PARTIAL | high | Vault-Key setzen |

## Summary

- **PASS**: 50 (77%)
- **PARTIAL**: 12 (18%)
- **OVERCLAIM**: 3 (5%) — Growth-Preis 199 statt 249, Bronze/Silver/Gold stale, /developers SDK-Claim
- **MOCK**: 0
- **MISSING**: 0

**Operational blocker für 5 PARTIALs**: Vault-Keys (Resend, Stripe, Anthropic) noch nicht provisioniert. Code-Pfade sind alle da.
