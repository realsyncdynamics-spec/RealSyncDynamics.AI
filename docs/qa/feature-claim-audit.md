# Feature-Claim-Audit — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Produktclaims (Marketing/Landing) vs. echte Implementierung (Edge Functions / Feature-Ordner).

## Bewertungslegende
ALLOW = belegt · SOFTEN = abschwächen (Übertreibung) · REMOVE = entfernen (unbelegt) · NEEDS_IMPLEMENTATION = Backend fehlt

## Claim-Matrix

| Claim | Marketing-Fundstelle (Beispiel) | Implementierungs-Beleg | Bewertung |
|---|---|---|---|
| **Continuous / laufende Überwachung** | `pages/seo/ContinuousCompliance.tsx`, Landing-Hero | `audit-monitor-cron`, `audit-drip-cron`, `governance-monitoring-scheduler` + Monitoring-UI | **ALLOW** (cron-basiert) |
| **Automated / Auto-Fix** | Landing „Auto-Fix statt nur Diagnose" | `governance-remediate` (5 Templates, **generiert** Snippets, wendet sie **nicht autonom** an) | **SOFTEN** — „Auto-Fix" suggeriert autonome Anwendung; tatsächlich operator-applied. Formulierung „Fix-Vorschläge mit Code-Snippets" ist ehrlicher. |
| **Autonomous / autonom** | vereinzelt | Agenten generieren/planen, Mensch bestätigt | **SOFTEN** (kein „vollständig autonom"; Begriff ist verboten und korrekt nicht verwendet) |
| **Real-time** | Landing „kontinuierliche Telemetrie" | Cron (stündlich/täglich) + Supabase-Realtime fürs Dashboard | **SOFTEN** — „real-time" = häufiges Polling. „nahezu in Echtzeit"/„laufend" genauer. |
| **AI Act ready** | `index.html` Badge, `/ai-act*` | `ai-act-classify`, `ai-act-risk-inventory`, Risk-Integration | **ALLOW** (Klassifikation + Risiko vorhanden; „ready" als Reifegrad, nicht Garantie) |
| **GDPR compliant** | `index.html`, mehrere Landings | `gdpr-export/-delete`, `governance-dsr`, `erasure-sweeper`, AVV-Seite | **ALLOW** (Lifecycle implementiert; „compliant" sauber durch Disclaimer flankiert) |
| **Evidence / Herkunftsnachweis / Prüfpfad** | Landing, Evidence-Vault | `evidence-export`, `evidence-vault-export`, `ai_tool_runs`-Logging, `governance_admin_audit_log` | **ALLOW** |
| **Risk Score** | `GovernanceScorePage.tsx` | `governance-risk-score` (deterministische Gewichtung, persistiert) | **ALLOW** |
| **Remediation** | Remediation-Views | `governance-remediate` + Template-Engine, Lifecycle (generate/apply/reject) | **ALLOW** (operator-driven) |
| **Monitoring** | Landing/Monitoring | Cron-Scheduler + `MonitoringRuntimeView` | **ALLOW** |
| **Compliance OS / Governance OS** | Hero | Modulares Dashboard + Agenten + Policy-Engine | **ALLOW** (Plattform, nicht nur Audit-Tool) |
| **Enterprise Agent / Enterprise AI OS** | `/enterprise-ai-os`, `/os/*` | Public-Surfaces (`enterprise-ai-os-*`) vorhanden; `/os/*`-App = **Mockdata** | **SOFTEN/NEEDS_IMPLEMENTATION** — `/os`-App ist Prototyp ohne echte Datenanbindung. Nicht als fertiges Produkt darstellen. |
| **On-prem / EU sovereign / EU-souverän** | viele Landings, `index.html` | Frankfurt-Supabase (doc), EU-VPS + Ollama lokal, Residency-Toggle (`ai-invoke` loggt `residency`) | **ALLOW** |
| **Code audit / Claude Code optimizer** | kaum im Marketing; intern | AI-Gateway (Anthropic/Google/OpenAI/Ollama); `kodee*`-Functions | **ALLOW** (sofern nicht als „Claude Code"-Branding überhöht) |
| **Security** | `/security`, `/trust` | Header/HSTS, RLS, AAL2 (observe-only) | **SOFTEN** — AAL2 noch nicht erzwungen; CSP `unsafe-inline`. Keine Über-Versprechen. |
| **White-Label** | Pricing (Scale): „White-Label, voller API-Zugriff" | im Backend **nicht tief verifiziert** (vermutlich Tenant-Branding-Config) | **NEEDS_IMPLEMENTATION / verify** — vor Verkauf belegen oder abschwächen. |
| **Checkout / Self-Service-Billing** | Pricing | `stripe-checkout/-webhook/-portal/-meter-sync` | **ALLOW** |

## Verbotene Begriffe — Prüfung
| Begriff | Status |
|---|---|
| `rechtssicher` | nur als **Verneinung** vorhanden → **OK** |
| `garantiert` | faktische Support-SLA → **SOFTEN** (Kontext, keine Compliance-Garantie) |
| `vollständig autonom` | **nicht gefunden** |
| `Bußgeld garantiert vermeiden` | **nicht gefunden** |

## Handlungsempfehlungen (priorisiert)
1. **SOFTEN „Auto-Fix"/„real-time"** in Hero/SEO-Copy → präzisere Formulierungen (Vorschläge oben). (P2)
2. **`/os/*`-Prototyp** klar als „Preview/Prototyp" labeln oder hinter Flag/`noindex`. (P2)
3. **White-Label** vor Enterprise-Verkauf implementieren/belegen oder Claim entfernen. (P2)
4. **„garantiert"** in SLA-Copy entschärfen. (P3)
5. Keine harten verbotenen Claims im Bestand — Linie halten via erweitertem CTA/Claim-CI.
