# AI Governance OS — Funnel-Plan Phase 1

**Stand:** 2026-09-27 · gemessen gegen `main@f392939` (Ursprungsbefund §1–§3) · **WP-Fortschritt §4:** 2026-10-10 gegen `main@c90fcdd`
**Owner:** Dominik Steiner
**Status:** Plan verbindlich · E-F1–E-F2 entschieden (2026-09-27), E-F6 entschieden (2026-09-29, ersetzt die Angebotsmechanik aus E-F1) · **E-F3 abgelöst, WP1 geschlossen (2026-10-03)** · WP2–WP6 freigegeben (WP2 derzeit gesperrt bis zur E-F6-Neufassung, §4) · **Nachtrag 2026-10-10:** WP2a, WP3, WP4, WP5 gemergt; offen sind WP2 und WP6 (§4) · **E-V1–E-V4 entschieden (2026-10-04)**, Landing v4 mit #1751 auf `/`

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
| **B4** | Trial-Drift: `shared/pricing.ts` gibt **Starter und Growth** `trialDays: 14`. Edge Function und Copy sagen „nur Growth". `trialDays` steuert neue Stripe-Checkout-Sessions — Starter-Käufer bekommen also 14 Tage, die nirgends beworben sind. | `shared/pricing.ts` Starter-Block, `create-trial-subscription/index.ts`, `TrialOfferPage.tsx` | ✅ Aufgelöst per **E-F6** (2026-09-29): Starter-Trial bleibt und wird im Checkout gezeigt; `stripe-checkout` setzt `trial_period_days` aus `plan.trialDays`, nicht mehr nur bei `pilot`. |
| **B5** | Ein Gratis-Code-System **existiert nicht**. Vorhanden ist nur `allow_promotion_codes: true` in `stripe-checkout`. | `supabase/functions/stripe-checkout/index.ts` | „1 Monat Growth per Code" ist ohne Code-Änderung nur als **Stripe-Promotion-Code** machbar (Karte nötig) — oder als manuelle Freischaltung. |
| **B6** | Agenten stehen in **vier** Quellen: `AGENT_MESH` (ehrlich: nur Compliance preview), `DEMO_AGENTS` (4 × `status: 'active'`, im Register als „Aktiv" gezählt), `AgentsCenterView` (Skills), DB-Tabelle `governance_agent_registry` (nur `active/archived/deprecated`). | `core/realsync-os/agentMesh.ts`, `features/governance/agents/demoAgents.ts`, Migration `20260817000000` | Das Register zeigt heute „4 Aktiv" für Demo-Daten — Overclaim-Risiko. WP5 führt eine Quelle ein. |
| **B7** | `/app/dashboard` ist **bereits** das Command Center mit echten RPCs (`governance_kpi_latest_snapshot`, `governance_24h_summary`, Evidence-Health, Risk-Index, Maßnahmen). Es fehlen Kacheln für KI-Inventar, Agent-Register und Freigaben. Quellen existieren: `ai_systems`, `ai_act_risk_inventory`, `governance_approvals`. | `CommandCenterDashboard.tsx`, `cockpit/cockpitData.ts`, `approvalsApi.ts` | WP4 ergänzt eine Kachelreihe, kein zweites Dashboard. |
| **B8** | Landing unterliegt dem **Design-Freeze** („Papier & Waldgrün", Tokens in `index.css`). **Nachtrag 2026-10-03:** gemessen galt das für `DesignGovernanceAiLanding`. Seit #1686 ist `/` = Landing v2, visuelle Quelle `src/styles/landing-v2.css`; der Freeze gilt jetzt dieser Seite. | `CLAUDE.md` Abschnitt „Website bauen" | WP1 ändert Texte und Struktur, keine Tokens. **Heute:** WP1 geschlossen (§3) — Landing-Änderungen brauchen eine neue Freigabe. |
| **B9** | Oberhalb von Enterprise (1.249 €) steht im SSoT **Partner zu 1.999 €**. | `shared/pricing.ts` | Klären, ob Partner ein Programm (nicht öffentlich) oder eine Stufe ist — sonst widerspricht es „Enterprise ist die höchste Stufe" (**E-F4**). |
| **B10** | Das Doku-Budget ist **exakt voll**: `docs/` 235/235 Dateien, 2.697/2.700 KB (`npm run check:context`, CI). | `.claude/context-budget.json`, `scripts/check-context-budget.mjs` | Jedes neue `docs/`-Dokument bricht CI. Dieser Plan liegt deshalb unter `.claude/`. Neue Specs nur gegen Archivierung eines alten Dokuments. |
| **B11** | Kartenlose Testphasen **laufen nie ab**: `create-trial-subscription` schreibt `status='trialing'` + `trial_end` ohne Stripe-Subscription; der Entitlement-Resolver (`20260920130000_bots_quota_enforcement.sql`, `abo_wirksam`) prüft `trial_end` nicht, und kein Job setzt abgelaufene Testphasen zurück. | Migration `20260920130000`, `create-trial-subscription/index.ts` | Growth-Rechte ohne Ende. **WP2a** (Migration, separates GO): Resolver prüft `trial_end > now()`. WP2 erst danach mergen. **Im Repo:** `20260928160000_wp2a_trial_end_expiry.sql` (liest `trial_end`, ersatzweise `trial_ends_at`; ohne Ende = Stripe-Testphase, läuft weiter), Test `test/runtime/db/trial-expiry.db.test.ts`. Anwendung auf Produktion nur mit GO. **Nachtrag 2026-10-10:** mit #1716 auf `main` gemergt. |

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

**Nachtrag 2026-10-03 (Dominik Steiner): E-F3 ist abgelöst, WP1 ist geschlossen.**
WP1 wurde am 2026-09-27 mit `6523ac2` (#1673) umgesetzt. Einen Tag später hat
`7a8fa8b` (#1686) die Startseite auf `LandingV2` umgestellt. Seither ist WP1
geteilt: Der WP1-**Hero** rendert nur noch auf `/design/governance-ai`; der
WP1-**Zielbild-Abschnitt** (`GovernanceOsTarget` — Control Loop mit Learn als
Coming Soon, Einstiegspfad) läuft auf `/` weiter, weil `LandingV2.tsx`
`ArchitectureSection` einbettet. Die Startseite trägt die Headline des
Landing-v2-Handoffs und die Sechs-Stufen-Schleife, die im Code als „Entscheidung
Dominik, 28.09.2026" vermerkt ist — **nach** E-F3. E-F3 wird deshalb nicht
nachgezogen, sondern als überholt geführt: die spätere Entscheidung gilt.

Damit ist genau ein WP1-Akzeptanzkriterium dauerhaft offen: Die Headline nennt
nicht die Kontroll-/Nachweisschicht. Das ist **keine Lücke, sondern die
getroffene Entscheidung.** Eine Änderung der Startseite braucht eine neue
Freigabe und ein neues Arbeitspaket.

| ID | Frage | Status / Entscheidung | Begründung |
|---|---|---|---|
| **E-F1** | Angebotsmechanik nach dem Scan | ✅ **Entschieden: 14-Tage-Growth-Testphase.** Kein Stripe-Gratis-Code, keine manuelle Freischaltung. Starter-`trialDays` → 0 und Starter-`ctaLabel` ohne Trial-Versprechen. **Blocker:** kartenlose Testphasen laufen heute nie ab (B11) → WP2a vor WP2. | Nutzt die deployte `create-trial-subscription`; kein neuer Zahlungsweg, keine Karte im Einstieg. |
| **E-F2** | Wo lebt das AI-OS-Setup? | ✅ **Entschieden: `/app/activation`.** `/setup-assistant` und `/unified-entry/onboarding` werden nicht erweitert. | Activation persistiert schon Org + Scope, ist live und im Post-Scan-Pfad verlinkt. |
| **E-F3** | Hero-Headline | ⛔ **Abgelöst (2026-10-03).** Entschieden war „Die Kontrollschicht für KI im Unternehmen."; umgesetzt in #1673, dann durch Landing v2 (#1686) von `/` verdrängt. Gilt heute nur noch für `/design/governance-ai`. | Die Headline der Startseite kommt aus dem Landing-v2-Handoff (28.09.2026) — eine spätere Entscheidung als E-F3. |
| **E-F4** | Partner 1.999 € | ⏳ offen: Programm (nicht öffentlich) oder Stufe | Empfehlung: Programm, `sellable`/öffentliche Anzeige prüfen |
| **E-F5** | `/unified-entry/scan` | ⏳ offen: behalten für Builder-Pfad oder auf `/audit` umleiten | Empfehlung: Behalten, aber **nicht** aus Landing/Funnel verlinken |
| **E-F6** | Einstieg nach dem Scan (ersetzt die Angebotsmechanik aus E-F1) | ✅ **Entschieden am 2026-09-29 (Dominik Steiner): dauerhaft kostenloses Konto.** Registrierung ohne Testphase; der Kunde landet im Dashboard auf Free (`free_audit`: Scan, Governance Score, Audit Center) und macht sich in Ruhe vertraut. Growth-Testphase (kartenlos, `create-trial-subscription`) und Starter-Kauf sind Upgrade-Angebote im Dashboard (`FreePlanPanel`) und auf `/pricing`. Abgelaufene Testphase fällt sichtbar auf Free zurück. Starter behält `trialDays: 14` — beworben auf `/pricing`, eingelöst in `stripe-checkout` (B4 damit in die andere Richtung aufgelöst). | Kein Zeitdruck im Einstieg, Trial wird zum Pull-Angebot statt Zwang. `create-trial-subscription` bleibt „nur Growth". |

---

**Nachtrag 2026-10-04 (Dominik Steiner): Landing v4.** Grundlage war die Prüfung des
Claude-Design-Exports Landing v4. Übernommen am 10.10.2026 aus #1752 (geschlossen in
der Triage-Welle vom 10.10., weil der PR nebenbei die Token-Rechte von
`auto-merge.yml` geändert hätte). Status je Zeile: Stand 04.10.2026.

| ID | Frage | Status / Entscheidung | Begründung |
|---|---|---|---|
| **E-V1** | Design für `/` | ✅ **Landing v4 „Classical“** ersetzt v2 auf `/` und ist Vorlage für die weitere Plattform. Nur Dunkel, **kein** Theme-Schalter. | Stärkste Designrichtung; der Schalter war im Export ohnehin nicht bedienbar. |
| **E-V2** | Ablaufkette | ✅ **Die sechs Stufen vom 28.09. bleiben** (Discover → Assess → Govern → Execute → Verify → Prove). Keine Vier-Schritt-Kette als Betriebsschleife. | Eine Kette pro Seite; die Sechs ist entschieden und im Code verankert. |
| **E-V3** | Free in der Preistabelle | ✅ **Ja**: Free (`free_audit`) als erste Spalte, Angebot laut E-F6. | E-F6 macht das kostenlose Konto zum Einstieg. |
| **E-V4** | Hero-Motiv | ✅ **Statisches Europa-Bild als LCP.** 3D-Erde höchstens als späteres Desktop-Extra (nur nach Lighthouse-Messung, self-hosted, Startwinkel Europa). | Der Export-Globus zeigte beim Laden Amerika; ~3,5 MB 3D-Assets. |
| **E-V5** | `eu_local` nach VPS-Abschaltung | ⏳ offen: entfällt oder zieht um (wohin)? | Entscheidet die Überarbeitung der Rechtstexte (Datenschutz, Unterauftragsverarbeiter). |
| **E-V6** | Hostinger als Auftragsverarbeiter | ⏳ offen: bleibt (z. B. Mail) oder entfällt? | Entscheidet `SubProcessors.tsx`. |
| **E-V7** | On-Prem / SCIM | ⏳ offen. Empfehlung: **nicht angeboten → streichen**. | SCIM nicht gebaut (ADR 0008), On-Prem in keinem Plan. |
| **E-V8** | Enterprise-SSO im Katalog | ⏳ offen. Empfehlung: „Single Sign-On (Preview, auf Anfrage)“. Katalogänderung = Einzel-Freigabe. | SSO ist Vorschau, kein Build. |
| **E-V9** | Roadmap-Eintrag `agent-os-hostinger-workers` | ⏳ offen. Empfehlung: **streichen**. | VPS ist ausgelaufen; Produktion = Cloudflare + Supabase. |

**Umsetzung von E-V1–E-V4:** nicht über den damals geplanten WP7 (#1742
fertigstellen, am 04.10. geschlossen), sondern über #1751 („Landing v4 Klassisch,
1:1 aus dem Design-Bundle“, gemergt 04.10.). **Abweichung zu E-V4 (Stand
`main` 10.10.):** `LandingV4.tsx` lädt die 3D-Erde (`heroEarthScene`, three.js im
eigenen Chunk) nach dem ersten Paint auf jedem Gerät, nicht nur auf Desktop und
ohne dokumentierte Lighthouse-Messung. Ob E-V4 nachgezogen oder angepasst wird,
ist eine eigene Freigabe (Design-Freeze in `CLAUDE.md`). E-V3 ist hier nicht neu
gemessen.

## 4. Arbeitspakete und Reihenfolge

```
E-F1–E-F2 ✅ entschieden · E-F3 ⛔ abgelöst (E-F4/E-F5 offen, nicht blockierend)
      │
      ├─X WP1 Landing-Copy ─────────────┐   ERLEDIGT #1673; Hero von #1686 überholt — nicht erneut aufgreifen
      ├─✓ WP5 Agent-Register-Quelle ────┤   ERLEDIGT #1658
      │                                 ▼
      ├─✓ WP2a Trial-Ablauf (#1716) ──✓ WP3 AI-OS-Setup (#1730) ──✓ WP4 Command-Center-Kacheln (#1733)
      │
      ├─⏸ WP2 Funnel auf /audit (OFFEN, GESPERRT bis /wp2-funnel auf E-F6 umgeschrieben ist)
      └─► WP6 Governed Evolution (nur Doku, jederzeit; OFFEN)
```

Stand 2026-10-10 (gegen `main@c90fcdd`): ✓ = gemergt, ► = offen, ⏸ = gesperrt. Tatsächliche Reihenfolge:
WP5, WP2a, WP3, WP4. WP2 lief nicht vor WP3/WP4 und wird von ihnen nicht blockiert.

| WP | Titel | Dateien (Kern) | Risiko | Freigabe nötig für |
|---|---|---|---|---|
| ~~**WP1**~~ | ⛔ **Geschlossen** — Landing schärfen. Umgesetzt in `6523ac2` (#1673). Seit #1686 tragen `GovernanceOsHero.tsx` und `DesignGovernanceAiLanding.tsx` nur `/design/governance-ai`; `HomepageBriefSections.tsx` und `hero-content.ts` laufen über die eingebettete `ArchitectureSection` weiter auf `/`. | `GovernanceOsHero.tsx`, `hero-content.ts`, `HomepageBriefSections.tsx`, `DesignGovernanceAiLanding.tsx` | — | erledigt |
| ~~**WP2a**~~ | ✅ **Erledigt** — Trial-Ablauf erzwingen (Resolver prüft `trial_end`). Gemergt in `f8defb3` (#1716): `20260928160000_wp2a_trial_end_expiry.sql` + `test/runtime/db/trial-expiry.db.test.ts`. | `supabase/migrations/*` (neu), Test gegen `abo_wirksam` | hoch | erledigt |
| **WP2** | Funnel auf `/audit` ausrichten. ⏸ **Gesperrt:** `.claude/commands/wp2-funnel.md` steht noch auf E-F1 (Starter `trialDays` 14 → 0, Growth-Testphase als Einstieg) und widerspricht damit E-F6 (kostenloses Konto, Starter behält 14 Tage). `/wp2-funnel` erst ausführen, wenn der Auftrag auf E-F6 umgeschrieben und freigegeben ist. | `pages/AuditLanding.tsx`, `components/audit/PostScanChoiceRow.tsx`, `TrialOfferPage.tsx`, `SuccessPage.tsx`, `PostRegisterOnboardingPage.tsx` (nur Copy), `shared/pricing.ts` (Starter `trialDays`) | mittel | Preise/Angebot; Neufassung des Auftrags |
| ~~**WP3**~~ | ✅ **Erledigt** — AI-OS-Setup (KI-Systeme, Bots, Daten, Freigaben). Gemergt in `17a716a` (#1730). | `features/activation/*` — speichert in `governance_activations.organization` (JSONB, ohne Constraint) unter `aiSetup` | mittel | erledigt |
| ~~**WP4**~~ | ✅ **Erledigt** — Command Center: Inventar · Agenten · Freigaben · Evidence. Gemergt in `299a743` (#1733), Duplikat #1747 geschlossen. Folgepunkte siehe unten. | `features/governance/dashboard/*`, vorhandene APIs | niedrig | erledigt |
| ~~**WP5**~~ | ✅ **Erledigt** — Ein Agent-Register mit abgeleitetem Reifegrad. Gemergt (#1658, 2026-09-27). | `agentMesh.ts`, `agents/types.ts`, `demoAgents.ts`, `AgentRegistryView.tsx`, `AgentCard.tsx` | niedrig | erledigt |
| **WP6** | Governed-Evolution-Spec. Die Datei liegt seit #1655 vor; ein eigener WP6-Durchgang (`/wp6-governed-evolution`) ist noch nicht gelaufen. | `.claude/os-funnel/governed-evolution.md` | keins | — |
| **WP7** | Landing v4 auf `/`. ✅ **Erledigt über #1751** (04.10.); der geplante Weg über #1742 ist entfallen. ⏸ **Offen bleibt die Abweichung zu E-V4** (3D-Erde auf jedem Gerät, siehe Nachtrag §3): E-V4 nachziehen (3D nur Desktop, nach Lighthouse-Messung) oder E-V4 anpassen — Entscheidung Dominik Steiner, eigene Freigabe (Design-Freeze); bis dahin zurückgestellt. | `LandingV4.tsx`, `heroEarthScene.ts` | niedrig | Design-Freeze |
| **WP7a** | SSoT-Bereinigung: Bot-Laufzeit eine Wahrheit, toter `PLANS`-Export, SSO-/SCIM-/On-Prem-Claims, Hostinger-Roadmap. ⏳ **Offen.** Der Auftrag stand in #1752 (`.claude/commands/wp7a-ssot-cleanup.md`) und ist vor einem Neustart gegen den aktuellen `main` zu prüfen; Teile warten auf E-V7–E-V9. | `platform-capabilities.ts`, `implementation-status.ts`, `runtimeVocab.ts`, `GovernanceFooter.tsx`, `seo.ts`, `EnterpriseKonfigurator.tsx` | mittel | Katalog (E-V8), Claims (E-V7, E-V9) |

**WP4-Folgepunkte (bewusst nicht in #1733):**

- **Zwei KI-Zahlen auf `/app/dashboard`:** `HandoffOverview` zählt „KI-Systeme“ aus
  `governance_assets` (`isAiSystemAsset`), die Kachel „KI-Inventar“ zählt `ai_systems`.
  Beide nennen ihre Quelle, können aber voneinander abweichen. Produktentscheidung offen.
- **Mandantenwechsel:** `HandoffOverview` und `ComplianceStatusView` zeigen beim Wechsel
  einen Render lang die Cockpit-Zahlen des vorigen Mandanten (Bestand, vor WP4). Fix als
  eigener kleiner PR mit demselben `dataTenantId`-Guard wie die Kachelreihe.
- **Abgelaufene Freigaben:** `pending`-Einträge mit abgelaufenem `expires_at` zählen mit,
  solange ihr gespeicherter Status `pending` bleibt (gleiches Verhalten wie der bestehende
  Badge). Für `governance_approvals` gibt es derzeit **keinen** Ablaufjob; `expired` setzt
  `governance-approvals` nur für `pdp_approval_gates`, die Browser-Reservierung prüft
  `expires_at` nur beim Einlösen.

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
