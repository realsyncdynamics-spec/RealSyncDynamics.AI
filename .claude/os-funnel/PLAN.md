# AI Governance OS — Funnel-Plan Phase 1

**Stand:** 2026-09-27 · gemessen gegen `main@f392939`
**Owner:** Dominik Steiner
**Status:** Plan verbindlich · E-F1–E-F3 entschieden (2026-09-27), WP1–WP6 freigegeben

> Leitsatz: Kein neuer KI-Hype-Layer. Das bestehende Produkt wird so geschärft,
> dass realsyncdynamicsai.de einen klaren SaaS-Funnel verkauft:
> **kostenloser Scan → Governance Core → kontrollierte Bots/Agenten → Agent OS Premium.**

Dieser Ordner (`.claude/os-funnel/`) ist die Arbeitsgrundlage für die Claude-Code-Sessions. Pro
Arbeitspaket (WP) gibt es genau **eine Session, einen Branch und einen PR**, damit
jede Abweichung einem Change zugeordnet bleibt.

| Datei | Inhalt |
|---|---|
| `PLAN.md` | Ist-Befund, Entscheidungen, Reihenfolge, Gates (diese Datei) |
| `../commands/wp1-landing.md` … `wp6-governed-evolution.md` | Session-Auftrag je WP, in Claude Code als `/wp1-landing` … `/wp6-governed-evolution` aufrufbar |
| `governed-evolution.md` | Zielbild-Spec Governed Evolution (nur Doku) |

---

## 1. Ist-Befund — was der Auftrag vom 2026-09-27 übersieht

Der Umsetzungsauftrag nennt die richtigen Ziele, zeigt aber an vier Stellen auf
den falschen Bestand. Wer ihn wörtlich ausführt, baut einen zweiten Trichter.

| # | Befund | Beleg im Repo | Konsequenz |
|---|---|---|---|
| **B1** | `/unified-entry/scan` ist **als kanonischer Einstieg verworfen**. Die Seite erfindet `auditId = urlscan-<Zeitstempel>` und schreibt keinen Datensatz. Kanonisch sind `/audit` + `gdpr_audits`. | `docs/product/canonical-funnel-decision.md` §1 · `ScanEntryPage.tsx` Z. 69 | Funnel-Arbeit läuft über `/audit` (`AuditLanding` mit `PostScanChoiceRow`) → `/welcome` → `/app/activation`. `ScanEntryPage` wird **nicht** ausgebaut. |
| **B2** | Die Landing-CTA zeigt **bereits** auf `/audit`. | `src/config/public-nav.ts` `PUBLIC_CTA.to = '/audit'` | WP1 ist reine Copy-Arbeit, keine Routing-Änderung. |
| **B3** | Es gibt **drei** Einrichtungsstrecken: `/unified-entry/onboarding` (Branche + 3 Fragen + Trial), `/setup-assistant` (setzt `onboarded_at`, dorthin leitet `/welcome`), `/app/activation` (Governance Activation, live, Org + Scope persistiert). | `PostRegisterOnboardingPage.tsx`, `features/onboarding/SetupAssistant.tsx`, `docs/product/governance-activation.md` | Das AI-OS-Setup (KI-Systeme, Bots, Daten, Freigaben) gehört in **eine** davon — Entschieden (**E-F2**): `/app/activation`. Keine vierte Strecke. |
| **B4** | Trial-Drift: `shared/pricing.ts` gibt **Starter und Growth** `trialDays: 14`. Edge Function und Copy sagen „nur Growth". `trialDays` steuert neue Stripe-Checkout-Sessions — Starter-Käufer bekommen also 14 Tage, die nirgends beworben sind. | `shared/pricing.ts` Starter-Block, `create-trial-subscription/index.ts`, `TrialOfferPage.tsx` | Starter-`trialDays` → 0 in WP2 (**E-F1** entschieden). |
| **B5** | Ein Gratis-Code-System **existiert nicht**. Vorhanden ist nur `allow_promotion_codes: true` in `stripe-checkout`. | `supabase/functions/stripe-checkout/index.ts` | „1 Monat Growth per Code" ist ohne Code-Änderung nur als **Stripe-Promotion-Code** machbar (Karte nötig) — oder als manuelle Freischaltung. |
| **B6** | Agenten stehen in **vier** Quellen: `AGENT_MESH` (ehrlich: nur Compliance preview), `DEMO_AGENTS` (4 × `status: 'active'`, im Register als „Aktiv" gezählt), `AgentsCenterView` (Skills), DB-Tabelle `governance_agent_registry` (nur `active/archived/deprecated`). | `core/realsync-os/agentMesh.ts`, `features/governance/agents/demoAgents.ts`, Migration `20260817000000` | Das Register zeigt heute „4 Aktiv" für Demo-Daten — Overclaim-Risiko. WP5 führt eine Quelle ein. |
| **B7** | `/app/dashboard` ist **bereits** das Command Center mit echten RPCs (`governance_kpi_latest_snapshot`, `governance_24h_summary`, Evidence-Health, Risk-Index, Maßnahmen). Es fehlen Kacheln für KI-Inventar, Agent-Register und Freigaben. Quellen existieren: `ai_systems`, `ai_act_risk_inventory`, `governance_approvals`. | `CommandCenterDashboard.tsx`, `cockpit/cockpitData.ts`, `approvalsApi.ts` | WP4 ergänzt eine Kachelreihe, kein zweites Dashboard. |
| **B8** | Landing unterliegt dem **Design-Freeze** („Papier & Waldgrün", Tokens in `index.css`). | `CLAUDE.md` Abschnitt „Website bauen" | WP1 ändert Texte und Struktur, keine Tokens. |
| **B9** | Oberhalb von Enterprise (1.249 €) steht im SSoT **Partner zu 1.999 €**. | `shared/pricing.ts` | Klären, ob Partner ein Programm (nicht öffentlich) oder eine Stufe ist — sonst widerspricht es „Enterprise ist die höchste Stufe" (**E-F4**). |
| **B10** | Das Doku-Budget ist **exakt voll**: `docs/` 235/235 Dateien, 2.697/2.700 KB (`npm run check:context`, CI). | `.claude/context-budget.json`, `scripts/check-context-budget.mjs` | Jedes neue `docs/`-Dokument bricht CI. Dieser Plan liegt deshalb unter `.claude/`. Neue Specs nur gegen Archivierung eines alten Dokuments. |
| **B11** | Kartenlose Testphasen **laufen nie ab**: `create-trial-subscription` schreibt `status='trialing'` + `trial_end` ohne Stripe-Subscription; der Entitlement-Resolver (`20260920130000_bots_quota_enforcement.sql`, `abo_wirksam`) prüft `trial_end` nicht, und kein Job setzt abgelaufene Testphasen zurück. | Migration `20260920130000`, `create-trial-subscription/index.ts` | Growth-Rechte ohne Ende. **WP2a** (Migration, separates GO): Resolver prüft `trial_end > now()`. WP2 erst danach mergen. **Im Repo:** `20260928160000_wp2a_trial_end_expiry.sql` (liest `trial_end`, ersatzweise `trial_ends_at`; ohne Ende = Stripe-Testphase, läuft weiter), Test `test/runtime/db/trial-expiry.db.test.ts`. Anwendung auf Produktion nur mit GO. |

**Was schon richtig ist und bleibt:** Tenant-Auflösung über `memberships`
(`create-trial-subscription`, `save-company-profile`), ehrliche
`ImplementationStatus`-Labels, `PostScanChoiceRow` mit live/preview/coming-soon-Badges,
Enterprise 1.249 € im SSoT.

---

## 2. Kanonische Kette (eine Datenstruktur, mehrere Sichten)

```
Authority-Pfad (kanonisch, im Code):
Request → Identity → Tenant → Policy → Risk → Approval → Execution → Verification → Evidence

Sicht „Repo-Wording":   Intent → Policy Check → Permission Check → Agent Action → Result Validation → Evidence → Audit Log
Sicht „Control Loop":   Observe → Evaluate → Decide → Act → Verify → Record → Learn*
                                                                              * Learn = Governed Evolution, Roadmap
```

Die Sichten sind Labels auf dem Authority-Pfad. Kein zweites Enum, kein zweites Schema.

---

## 3. Entscheidungen

**Entschieden am 2026-09-27 (Dominik Steiner):** E-F1 = (a), E-F2 = (a), E-F3 = „Die Kontrollschicht für KI im Unternehmen." — WP1–WP3 sind damit freigegeben. E-F4 und E-F5 bleiben offen und blockieren WP1–WP3 nicht.

| ID | Frage | Status / Entscheidung | Begründung |
|---|---|---|---|
| **E-F1** | Angebotsmechanik nach dem Scan | ✅ **Entschieden: 14-Tage-Growth-Testphase.** Kein Stripe-Gratis-Code, keine manuelle Freischaltung. Starter-`trialDays` → 0 und Starter-`ctaLabel` ohne Trial-Versprechen. **Blocker:** kartenlose Testphasen laufen heute nie ab (B11) → WP2a vor WP2. | Nutzt die deployte `create-trial-subscription`; kein neuer Zahlungsweg, keine Karte im Einstieg. |
| **E-F2** | Wo lebt das AI-OS-Setup? | ✅ **Entschieden: `/app/activation`.** `/setup-assistant` und `/unified-entry/onboarding` werden nicht erweitert. | Activation persistiert schon Org + Scope, ist live und im Post-Scan-Pfad verlinkt. |
| **E-F3** | Hero-Headline | ✅ **Entschieden: „Die Kontrollschicht für KI im Unternehmen."** | Beschreibt, was heute läuft; die Agenten-Variante wäre überwiegend Coming Soon. |
| **E-F4** | Partner 1.999 € | ⏳ offen: Programm (nicht öffentlich) oder Stufe | Empfehlung: Programm, `sellable`/öffentliche Anzeige prüfen |
| **E-F5** | `/unified-entry/scan` | ⏳ offen: behalten für Builder-Pfad oder auf `/audit` umleiten | Empfehlung: Behalten, aber **nicht** aus Landing/Funnel verlinken |

---

## 4. Arbeitspakete und Reihenfolge

```
E-F1–E-F3 ✅ entschieden (E-F4/E-F5 offen, nicht blockierend)
      │
      ├─► WP1 Landing-Copy ─────────────┐
      ├─► WP5 Agent-Register-Quelle ────┤   (parallel möglich, keine Datei-Überschneidung)
      │                                 ▼
      └─► WP2a Trial-Ablauf (GO) ─► WP2 Funnel auf /audit ──► WP3 AI-OS-Setup in Activation ──► WP4 Command-Center-Kacheln
                                                                              │
                                                             WP6 Governed Evolution (nur Doku, jederzeit)
```

| WP | Titel | Dateien (Kern) | Risiko | Freigabe nötig für |
|---|---|---|---|---|
| **WP1** | Landing schärfen | `GovernanceOsHero.tsx`, `hero-content.ts`, `HomepageBriefSections.tsx`, `DesignGovernanceAiLanding.tsx` | niedrig | Landing-Claims (Einzel-Freigabe) |
| **WP2a** | Trial-Ablauf erzwingen (Resolver prüft `trial_end`) | `supabase/migrations/*` (neu), Test gegen `abo_wirksam` | hoch | **Migration = separates GO** |
| **WP2** | Funnel auf `/audit` ausrichten | `pages/AuditLanding.tsx`, `components/audit/PostScanChoiceRow.tsx`, `TrialOfferPage.tsx`, `SuccessPage.tsx`, `PostRegisterOnboardingPage.tsx` (nur Copy), `shared/pricing.ts` (Starter `trialDays`) | mittel | Preise/Angebot |
| **WP3** | AI-OS-Setup (KI-Systeme, Bots, Daten, Freigaben) | `features/activation/*` — speichert in `governance_activations.organization` (JSONB, ohne Constraint) unter `aiSetup` | mittel | — (keine Migration) |
| **WP4** | Command Center: Inventar · Agenten · Freigaben · Evidence | `features/governance/dashboard/*`, vorhandene APIs | niedrig | — |
| **WP5** | Ein Agent-Register | `agentMesh.ts`, `agents/types.ts`, `demoAgents.ts`, `AgentRegistryView.tsx`, `AgentCard.tsx` | niedrig | — |
| **WP6** | Governed-Evolution-Spec | `.claude/os-funnel/governed-evolution.md` | keins | — |

Dieser Plan läuft **neben** der Enforcement-Master-Reihenfolge (AP-1a → AP-1b →
AP-1c → AP-1d → AP-2 → AP-3). Keine Session mischt WP-x mit AP-x.

---

## 5. Leitplanken für jede Session

- Kein Deploy, kein Merge, kein Push auf `main`, keine Supabase-Migration, keine Stripe-, Cloudflare-, KV-Änderung ohne separates GO.
- Tenant-Autorität nur `JWT user → memberships → tenant_id → role/policy`. Nie aus URL, Body oder `localStorage`.
- Keine Service-Role im Browser. Provider (OpenAI, Anthropic, Google, xAI, lokal) sind austauschbarer Execution-Layer, nie Governance-Autorität.
- Keine Fake-KPIs: fehlt eine Quelle, dann Empty State oder `Preview`-Label.
- Status-Vokabular ausschließlich aus `src/product/implementation-status.ts`: `live` · `preview` · `coming-soon`.
- Verbotene Claims: „vollständig revisionssicher" (ohne Beleg), „autonome Agenten live", „EU-konform garantiert".
- Design-Freeze auf `/`: keine Token-Änderungen.
- Prüfung: `npm run lint`, `npm test` (betroffene Suites), bei Preisänderung `npm run check:pricing` und `npm run check:offer-prices`.

## 6. Definition of Done je PR

PR-Text beantwortet: geänderte Dateien · wiederverwendete Strukturen · was ist
**live** · was ist **preview** · was bleibt **coming soon** · welche Checks liefen
(oder warum nicht).
