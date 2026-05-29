# RealSyncDynamics.AI — Positionierungsstrategie

> **Zweck dieses Dokuments.** Es ist die *kanonische Quelle* für Positionierung,
> Zielgruppe (ICP), USP, Wettbewerbsabgrenzung und Go-to-Market. Wo `README.md`,
> `ROADMAP.md` und `docs/PRODUCT_FOCUS.md` heute leicht unterschiedliche
> Selbstbeschreibungen tragen, gewinnt dieses Dokument. `docs/PRODUCT_FOCUS.md`
> regelt den *Scope* (was Kern ist, was draußen bleibt) — dieses Dokument regelt
> die *Story* (wem wir was warum verkaufen).
>
> Methodisch ist die Strategie **nicht aus Annahmen, sondern aus dem real
> implementierten Code abgeleitet** (Edge Functions, `src/features/`, `src/pages/`,
> `src/config/pricing.ts`). Jeder Differenzierer unten zeigt auf gebauten Code.

*Letzte Aktualisierung: 2026-05-29*

---

## 0. Ausgangsproblem: Positionierungs-Drift

Vor diesem Dokument beschrieben fünf Artefakte das Produkt unterschiedlich:

| Quelle | Selbstbeschreibung | Bewertung |
|---|---|---|
| `CLAUDE.md` (Header) | „EU-souveräne SaaS für **Creator & Agenturen**, C2PA-Provenienz, AI-Workflows" | **veraltet** — frühere Produktphase |
| `ARCHITECTURE.md` (Root) | „RealSync **Agent OS**, Copilot, C2PA-Siegel" | **veraltet** — frühere Produktphase |
| `README.md` | „EU-souveräne **Compliance-Infrastruktur**" | aktuell |
| `docs/PRODUCT_FOCUS.md` | „**Realtime Governance Runtime**" | aktuell (Engineering-Sicht) |
| `ROADMAP.md` | „**Automated Digital Compliance Infrastructure**" | aktuell (Markt-Sicht) |

Der real gebaute Feature-Stand (siehe §2) widerlegt die Creator/C2PA-Erzählung
eindeutig. Diese Strategie konsolidiert auf **eine** Positionierung und macht die
veralteten Artefakte zu Korrektur-Aufgaben (§9).

---

## 1. Positionierung in einem Satz

> **RealSyncDynamics.AI ist die EU-souveräne Compliance-Runtime, die DSGVO- und
> EU-AI-Act-Risiken automatisch findet, kontinuierlich überwacht, technisch behebt
> und prüfsicher nachweist — vom kostenlosen Sofort-Audit bis zum mandantenfähigen
> Betrieb für Agenturen und regulierte Unternehmen.**

Vier Verben, die zugleich die Wertleiter sind: **Finden → Überwachen → Beheben →
Nachweisen.** Jedes Verb ist ein Monetarisierungs-Schritt (§7) und entspricht
gebautem Code (§2).

### Kategorie-Entscheid

- **Markt-Kategorie (Außenkommunikation):** *Automated EU Compliance Infrastructure* —
  greifbar, suchbar, vergleichbar mit Cookiebot/OneTrust/Usercentrics/Vanta.
- **Architektur-Begriff (intern / `PRODUCT_FOCUS.md`):** *Realtime Governance Runtime* —
  beschreibt das Event→Evidence→Remediation-Fundament, nicht die Marktstory.

Diese zwei Ebenen sind **kein** Widerspruch: außen verkaufen wir die Kategorie,
in der Kunden suchen; innen bauen wir die Runtime, die den Moat erzeugt.

### Was wir bewusst *nicht* sagen

- ❌ „KI baut Websites" / Website-Builder
- ❌ „Creator-Plattform" / C2PA-Provenienz als Hauptnutzen (separate, spätere Positionierung)
- ❌ „100 % rechtssicher" — wir liefern *technische* Compliance-Unterstützung und
  Nachweisbarkeit; juristische Gewähr bleibt bei DSB/Fachjurist (vgl. `ROADMAP.md`).

---

## 2. Was real existiert (Evidenz für die Strategie)

Die Positionierung ist tragfähig, weil der Stack sie *heute* schon trägt:

### Finden (Audit)
- `supabase/functions/cookie-scan`, `cookie-scan-deep`, `gdpr-audit` — Scanner-Pipeline
- `_shared/rules/` Rule-Engine mit `gdpr.json` + `ai-act.json` + Tracker-Registry
- `ai-act-classify` — Risikoklassifizierung nach EU AI Act
- Frontend: `AuditPro.tsx`, `AuditResultPage.tsx`, `ConsentTimingAnalysis.tsx`, `ToolsHub.tsx`

### Überwachen (Monitoring)
- `audit-monitor-cron`, `audit-recheck-weekly`, `audit-drip-cron` — kontinuierliche Re-Scans
- `governance-ingest` + `runtime_events` (append-only) — Drift-Detection-Fundament
- Frontend: `MonitoringPage.tsx`, `RiskDashboard.tsx`, `governance/GovernanceTrendsPanel.tsx`

### Beheben (Remediation)
- `governance-remediate`, `remediation-agent`, `rebuild-website`
- `_shared/website-rebuild/`: `self-host.ts` (Google-Fonts), `strip-trackers.ts`, `inject-consent.ts`
- `src/core/runtime/remediation.ts` — typisierter Fix → Delivery-Kanal (Webhook/Ticket/Snippet)
- Frontend: `FixPaket.tsx`, `governance/RemediationPanel.tsx`

### Nachweisen (Evidence)
- `evidence-vault-export`, `evidence-export` — Hash-Chain (SHA-256 über kanonisches JSON) + HMAC
- `src/core/runtime/evidence.ts` — deterministische, replay-fähige Evidence-Chain
- Frontend: `EvidencePage.tsx`, `governance/AuditorConsoleView.tsx`, `ComplianceReportView.tsx`

### Compliance-Operations (das, was Enterprise/DSB wirklich kauft)
- DSFA/DPIA: `governance-dpias`, `DsfaWizard.tsx`, `DpiasView.tsx`
- VVT / Vendor-Inventory: `VvtWizard.tsx`, `VendorInventoryView.tsx`, `governance-resources`
- Betroffenenrechte (Art. 15/17): `gdpr-export`, `gdpr-delete`, `DsrTrackerView.tsx`
- Meldepflicht (Art. 33, 72h): `governance-incidents`, `MeldepflichtTimer.tsx`, `IncidentsView.tsx`
- Risk-Scoring: `governance-risk-score`; Approvals: `governance-approvals`
- Connectors/Webhooks: `governance-connectors`, `governance-webhooks`, `connectors/`

### EU-Souveränität (der Trust-Layer)
- Residency-Routing `cloud` ↔ `eu_local` in `ai-invoke` / `ai-gateway`
- EU-lokaler Pfad: Ollama `gemma3:4b` auf Hostinger-DE-VPS (`deploy/ollama-traefik/`)
- Per-User-Toggle + Per-Tenant-Policy (`/settings/ai-residency`)
- Alle Tabellen RLS-isoliert; jeder externe Call geloggt (`ai_tool_runs`, `workflow_runs`)

### Vertriebs-Infrastruktur (bereits gebaut)
- Wettbewerber-Vergleichsseiten: `CookiebotAlternative`, `OneTrustAlternative`,
  `UsercentricsAlternative`, `IubendaAlternative`, `DataGuardAlternative`,
  `ProlianceAlternative`, `BorlabsAlternative`
- Branchen-Landings: `HealthTechLanding`, `FinTechLanding`, `LegalTechLanding`,
  `PublicSectorLanding`, `InsuranceLanding`, `EcommerceLanding`, `SaasAnbieterLanding`,
  `HrSoftwareLanding`, `SteuerberaterLanding`, `EducationLanding`
- SEO-Cluster: `seo/PreConsentTracking`, `EuAiActCheck`, `BaitCompliance`, `MariskAudit`, …

**Schlussfolgerung (gemessen, nicht geschätzt).** In `src/features/` (≈ 33.200 LOC)
ist Compliance/Governance der mit Abstand größte und einzige zusammenhängende
Produktcluster (`governance` + `legal` + `ai-governance` + `audit` + Shopify-Scan
≈ **52 %**). Weitere ~37 % sind *generische SaaS-Infrastruktur*, die jedes Produkt
braucht (Billing, Admin, Auth, Tenancy, Settings, Analytics, Operations). Nur
**~8 %** sind echtes *Off-Narrative*-Produkt (C2PA-`assets`, Kodee-VPS, n8n-`workflows`).

Auf der **kundenseitigen Außenfläche** (Landings, SEO-Cluster, Wettbewerber-
Vergleichsseiten, Branchen-Landings) ist der Compliance-Anteil nahezu vollständig.

Das heißt: Die konkurrierenden Narrative (Creator/C2PA, Agent-OS, VPS-Sidekick)
sind ein **~8-%-Residuum**, kein gleichwertiges zweites Produkt. Die Strategie
beschreibt damit keine Wunsch-Zukunft, sondern benennt, was bereits da ist.

---

## 3. Alleinstellungsmerkmale (USP)

Vier verteidigbare Differenzierer — jeder mit Code-Beleg, jeder schwer zu kopieren:

### USP 1 — Consent-Timing-Analyse statt „Banner ja/nein"
Wettbewerber prüfen, *ob* ein Cookie-Banner existiert. Wir prüfen, *welche Requests
VOR der Einwilligung* feuern (`ConsentTimingAnalysis.tsx`, `seo/PreConsentTracking.tsx`).
Das ist der Unterschied zwischen „sieht compliant aus" und „ist es". Genau hier
liegen die abmahn- und bußgeldrelevanten Verstöße (Schrems II, TTDSG/§25 TDDDG).

### USP 2 — Closed Loop: Audit → Fix → Nachweis, nicht nur Report
Die meisten Tools enden beim PDF. Wir liefern den **technischen Fix** (`website-rebuild/*`,
`governance-remediate`) *und* den **prüfsicheren Nachweis** (`evidence.ts`, Hash-Chain).
Aus einem Reporting-Tool wird Infrastruktur — und damit wiederkehrender Umsatz statt
Einmal-Audit.

### USP 3 — EU-Souveränität bis in die AI-Inferenz
Nicht nur „Server in der EU", sondern **wählbarer, EU-lokaler Inferenz-Pfad**
(Ollama auf DE-VPS) als Alternative zu US-Cloud-LLMs. Für regulierte DACH-Kunden
(Banken/BAIT, Healthcare, Public Sector) ist das oft das *einzige* Kaufkriterium,
das US-Wettbewerber wie OneTrust strukturell nicht erfüllen können.

### USP 4 — DSGVO **und** EU AI Act in einer Runtime
Während der Markt sich auf Cookie/Consent (Cookiebot, Usercentrics) *oder*
GRC (Vanta, Drata) konzentriert, deckt eine Runtime beide ab: klassische
DSGVO-Pflichten (VVT, DSFA, DSR, Meldepflicht) **und** den neuen EU-AI-Act-Layer
(`ai-act-classify`, Risk-Level, Art.-52-Transparenz). Der AI Act ist der
Markt-Tailwind 2025–2027 — wir sind nativ darauf gebaut.

---

## 4. Zielgruppe (ICP)

### Primärer ICP — DACH-B2B, reguliert (aus `marketing/icp-und-sales-navigator.md`)
- **Geografie:** DE / AT / CH (DSGVO-Relevanz maximal, EU-Souveränität als Argument)
- **Größe:** 5–500 MA (darunter kein Budget, darüber zu langer Enterprise-Cycle)
- **Branchen:** Rechtsdienstleistung, HealthTech/Med, FinTech/Banking, öffentliche
  Verwaltung, Compliance-Beratung
- **Trigger:** KI bereits im Einsatz *oder* Einführung < 6 Monate; aktives Marketing
  mit Cookie-Banner
- **Buyer:** Geschäftsführung, IT-Leitung, CISO, Datenschutzbeauftragte/r

### Sekundärer ICP / schnellster Kanal — Agenturen & DSB-Dienstleister
Webagenturen, Datenschutzberater, IT-Dienstleister. **1 Agentur = 5–50 End-Domains**
(Tiers `agency` / `scale` in `pricing.ts`). White-Label + Multi-Tenant + API machen
sie zum Hebel-Vertriebskanal statt zum Einzelkunden.

### Bewusste Disqualifier
Solo-Freelancer · reine Privatpraxen ohne IT · Großkonzerne (Sales-Cycle) ·
Pure-US/UK (DSGVO-Hebel schwach).

### Segment-zu-Landing-Mapping (bereits gebaut)
| Segment | Landing | Tier-Fit |
|---|---|---|
| Healthcare/Med | `HealthTechLanding` | Growth → Enterprise |
| Banking/FinTech | `FinTechLanding`, `seo/BaitCompliance`, `seo/MariskAudit` | Growth → Enterprise |
| Kanzleien/Legal | `LegalTechLanding` | Starter → Growth |
| Public Sector | `PublicSectorLanding` | Enterprise |
| E-Commerce/Shops | `EcommerceLanding`, Shopify-App (`shopify-*`) | Starter → Growth |
| Agenturen/DSB | `AgenciesLanding`, `niche/AgenturenLanding` | Agency → Scale |

---

## 5. Wettbewerbsabgrenzung

| Wettbewerber | Deren Fokus | Unsere Abgrenzung |
|---|---|---|
| **Cookiebot / Usercentrics / Borlabs** | Consent-Banner (CMP) | Wir prüfen Pre-Consent-Timing + beheben + decken AI Act ab; CMP ist bei uns ein Baustein, nicht das Produkt |
| **OneTrust** | Enterprise-GRC-Suite (US) | EU-souverän inkl. EU-lokaler Inferenz; DACH-Pricing; kein Enterprise-Overhead für KMU |
| **Iubenda** | Doku-Generatoren (DSE/Impressum) | Wir machen *kontinuierliches* Monitoring + technische Fixes, nicht nur Statik-Texte |
| **DataGuard / Proliance** | DSB-as-a-Service (beratungslastig) | Wir sind die *Plattform/Runtime* darunter — komplementär; Partner-Channel statt Konkurrenz |
| **Vanta / Drata** | SOC2/ISO-GRC (US, Security-Audits) | Wir sind DSGVO+AI-Act-nativ und EU-souverän, nicht SOC2-zentriert |

**Kategorie-Nordstern (langfristig):** näher an *Datadog · Vanta · ServiceNow*
(Runtime/Infrastruktur), bewusst *weg* von generischen DSGVO-Scannern
(siehe `PRODUCT_FOCUS.md`).

---

## 6. Messaging-Architektur

### Wertversprechen (Outcome, nicht Feature)
Wir verkaufen **Risikoreduktion + Nachweisbarkeit + Automatisierung + Monitoring** —
nicht Scans, nicht Banner, nicht HTML.

### Botschaft pro Buyer
- **Geschäftsführung/Inhaber:** „Bußgeld- und Abmahnrisiko quantifiziert und laufend gesenkt — ohne Berater-Dauerkosten."
- **IT-Leitung/CISO:** „Drift-Detection + Auto-Remediation + API/Webhooks für CI/CD. Compliance als Code, nicht als PDF-Friedhof."
- **DSB/Datenschutz:** „VVT, DSFA, DSR, 72h-Meldepflicht-Timer und prüfsichere Evidence in einer mandantenfähigen Konsole."
- **Agentur:** „White-Label-Compliance-Layer für dein gesamtes Domain-Portfolio — neue Recurring-Revenue-Linie."

### Proof-Points (auf Trust-Seiten verlinken)
EU-Region-Hosting (Supabase EU) · EU-lokale Inferenz (Ollama DE) · RLS-Multi-Tenancy ·
Hash-Chain-Evidence · vollständiger Prüfpfad (`ai_tool_runs`/`workflow_runs`) ·
„Made in Germany" (vgl. `PRICING_TRUST_NOTE`).

### Terminologie (aus `CLAUDE.md`-Konventionen)
„Prüfpfad" statt „Audit Trail" · „Herkunftsnachweis" statt „Provenance" · Deutsch als
Primärsprache.

---

## 7. Go-to-Market: die Wertleiter als Funnel

Die vier Verben aus §1 sind zugleich der Monetarisierungspfad. Reihenfolge ist
Disziplin, nicht Parallelität:

1. **Free Audit (0 €) → Reichweite.** URL-Scan + Score + Top-3-Risiken, kein Account.
   SEO-/Vergleichsseiten (`*Alternative.tsx`, `seo/*`) speisen den Funnel.
2. **Starter (79 €) → Einstieg.** Vollständiger Scan + DSE-Generator + monatlicher
   Re-Scan. DACH-Pflicht-Sweet-Spot (Cookiebot Premium ~110 €, Iubenda ~280 €).
3. **Growth (249 €) → Kernprodukt.** Tägliches Monitoring + Drift + Consent-Timing +
   Copy-Paste-Fixes + Risk-Dashboard. *Hier liegt der wiederkehrende Hauptumsatz.*
4. **Agency (699 €) / Scale (1.999 €) → Hebel.** White-Label, Multi-Tenant (10/50
   Mandanten), API. Schnellster DACH-Kanal über Partner.
5. **Enterprise (ab 1.500 €) → hohe MRR.** SLA, dedizierter Runtime-Kanal, EU-AI-Act-Modul,
   DSB-Integration, Evidence Vault. Manuelles Onboarding via `/contact-sales`.

**Vertriebsbewegung:** Product-Led (Free Audit) für KMU + Outbound/Partner-Led
(Sales Navigator, Kanzlei-Outreach, Agentur-Revenue-Share) für reguliert/Agentur.
Beide Motions sind in `marketing/` bereits operationalisiert.

---

## 8. Strategische Risiken & Leitplanken

| Risiko | Leitplanke |
|---|---|
| Scope-Creep zurück Richtung „Creator/C2PA/Agent-OS" | `PRODUCT_FOCUS.md` + dieses Dokument; C2PA bleibt separate, spätere Positionierung |
| Überversprechen („100 % rechtssicher") | Konsequent „technische Unterstützung + Nachweisbarkeit"; Gewähr bei DSB/Jurist |
| US-Wettbewerber-Preisdruck | Nicht auf Preis, sondern auf EU-Souveränität + AI-Act-Nativität konkurrieren |
| Feature-Breite verwässert Story | Außen *eine* Kategorie kommunizieren; Tiefe nur intern/Enterprise zeigen |
| AI-Act-Reife des Markts noch früh | Free-Audit-Funnel + DSGVO-Kernumsatz tragen, bis AI-Act-Budgets reifen |

---

## 9. Folge-Aufgaben (Drift beseitigen)

Damit die Positionierung konsistent ist, sollten die veralteten Artefakte
angeglichen werden (separate, bewusste Commits — nicht beiläufig):

- [ ] `CLAUDE.md`-Header: „Creator & Agenturen / C2PA" → Compliance-Runtime-Positionierung
      (Konventionen-Block bleibt unverändert).
- [ ] Root `ARCHITECTURE.md`: „Agent OS / Copilot / C2PA" → auf `README.md` +
      `docs/ARCHITECTURE.md` ausrichten oder als historisch kennzeichnen.
- [ ] Quer-Verlinkung: `README.md`, `ROADMAP.md`, `PRODUCT_FOCUS.md` auf dieses
      Dokument als kanonische Positionierungsquelle verweisen lassen.
- [ ] C2PA/CreatorSeal als *eigene* spätere Positionierung dokumentieren, getrennt
      vom Compliance-Kern (vgl. `PRODUCT_FOCUS.md`, Phase 4+).

---

## 10. Referenzen

- `docs/PRODUCT_FOCUS.md` — Scope-Disziplin (Kern vs. außerhalb)
- `ROADMAP.md` — Phasen 1–4, Preis-Begründung
- `src/config/pricing.ts` — Single Source of Truth Tiers
- `marketing/icp-und-sales-navigator.md` — ICP + Vertriebs-Operationalisierung
- `README.md` · `docs/ARCHITECTURE.md` — System- und Datenfluss
