# Oktober-Plan 2026 — RealSync Build Studio (5.10.–31.10.)

**Stand:** 2026-10-05 · gemessen gegen `main@026ab3d` (CI #6221, E2E #5362, CodeQL grün)
**Fortschreibung:** 2026-10-09 · `main@1aadadf` — siehe Abschnitt 0
**Owner:** Dominik Steiner
**Status:** in Umsetzung · Merge nur nach grünen Pflicht-Checks, kein Deploy/DNS ohne GO

> Leitsatz: Erst müssen **Builder, Tenant-Sicherheit, Entitlements, Publish und
> Governance** zusammenspielen. Keine neuen isolierten AI-Features.

```
Website/Landing + App Builder → Project Model → Governance Engine
  → Build & Verification → Approval → Preview/Production → Evidence
```

**Benennung:** Die Pakete heißen **O-WP1 … O-WP10**, weil `PLAN.md` WP1–WP7
bereits belegt (Funnel). Die Funnel-WPs laufen weiter und sind unten zugeordnet,
nicht dupliziert.

---

## 0. Stand 2026-10-09 (Fortschreibung)

Seit dem 5.10. kamen über 40 PRs auf `main`. Was der Plan für KW 41–44 vorsah,
steht damit so:

| Paket | Stand | Belege / offen |
|---|---|---|
| O-WP1 Stabilisieren | **erledigt** | Security-, Recht- und Laufzeit-Spur gemergt; #1759 (KI-Register-Schreibpfade) fertig, wartet nur auf `Migration validation` (Docker Hub, Fix #1816) |
| O-WP2 Landing v4 halten | läuft | #1812 (Copy-Ehrlichkeit) gemergt; #1813 (keine Fake-KPIs) in Prüfung; #1809 (Neupositionierung) **Design-Freeze — wartet auf Freigabe** |
| O-WP3 `/build` als Einstieg | **erledigt** | #1737, #1738, #1771 (Projektart übersteht Login), #1772 (alte Builder-Links → `/build` bzw. Transformation, Query bleibt) |
| O-WP4 Site Builder | läuft | #1775 (Compliance-Profil nach Redaktion), #1774 (ungespeicherte Änderungen) |
| O-WP5 App Builder Phase 1 | **erledigt (früher als geplant)** | Inhalt von #1746 kam über #1789 auf `main`; #1746 geschlossen → **E-O7 erledigt** |
| O-WP6 Governance-Kette | **offen — 0 PRs** | wichtigste Lücke für KW 42/43 |
| O-WP7 Backend-Verkabelung | läuft | #1745, #1760, #1768 gemergt |
| O-WP8 Monetarisierung | läuft | Jahrespreise (#1744), Plan-Katalog (#1811), Begriffe (#1679) gemergt; #1748 widerspricht E-O3 (§ 19 UStG) |
| O-WP9 Publish Controller | **vorgezogen** | Gate → Preview → Production (Owner/Admin, explizites GO) über #1789 auf `main`; **Rollback fehlt**, Domain/DNS bleibt Preview (E-O5) |
| O-WP10 Live-Readiness | blockiert | Cron: 3 Functions antworten 401 (Function-Secret ≠ Vault, siehe unten); CI: Docker-Hub-Ausfälle (#1816) |

**Abweichung vom Plan:** Voice (6 PRs) und Safety-Drafts (#1802–#1804) sind
„neue Agenten" und waren für Oktober nicht vorgesehen. Sie bleiben geparkt,
bis O-WP6 steht.

**Cron-Befund (O-WP10):** `scheduler-dispatch`, `memory-decay-worker` und
`governance-monitoring-scheduler` lehnen pg_cron seit 2026-10-08 22:00 UTC mit
401 „cron only" ab. Code und Vault sind konsistent; die Function-Secrets
`CRON_SCHEDULER_DISPATCH_KEY`, `CRON_MEMORY_DECAY_KEY`,
`CRON_GOVERNANCE_MONITORING_KEY` (und zur Sicherheit `CRON_WEBSITE_RESCAN_KEY`)
müssen den Wert der gleichnamigen `cron_*`-Vault-Einträge bekommen —
Vorgehen: `docs/runbooks/cron-vault-secrets.md`. Manueller Schritt im
Dashboard, kein Code-Fix.

**Entscheidungen:** E-O2 umgesetzt (Vertrag), E-O4 erledigt, E-O5 eingehalten,
E-O7 erledigt, E-O3 durch die Triage-Policy entschieden (§ 19 UStG). Offen: **E-O6** (Go/No-Go 30.10.), Freigabe
#1809 (Design-Freeze).

**Nächste Schwerpunkte KW 42:** O-WP6 erster Schnitt (Publish-Request →
Approval → Evidence mit Ablehnungstest), Publish-Rollback (O-WP9),
Cron-Secrets setzen.

---

## 1. Ist-Befund (was der Oktober-Plan nicht neu bauen darf)

| # | Befund | Beleg | Konsequenz |
|---|---|---|---|
| O-B1 | `main` ist grün. Rot ist nur der repo-weite Auto-Merge-Check `enable`. | Actions-Runs auf `026ab3d`, Kommentar in #1737 | O-WP1 räumt PRs auf, repariert keine „rote Basis". |
| O-B2 | **Landing v4 ist live** auf `/` (#1751, Nacharbeiten #1753/#1754). | `src/pages/LandingV4.tsx` | O-WP2 = Claims-Hygiene + Design-Freeze, **kein Neubau**. #1752 (WP7 = „#1742 fertigstellen") ist dadurch teilweise überholt → rebasen und WP7 als erledigt führen. |
| O-B3 | `/build` existiert (Preview), `/builder` leitet dorthin. Zwei Engines: SiteOS `/builder/:slug` (Puck) und Code-Builder `/builder/:slug/code`. | `src/App.tsx`, `BuildStudioPage.tsx` | O-WP3 vereinheitlicht den Einstieg, keine dritte Oberfläche. |
| O-B4 | Das „gemeinsame Project Model" ist als **Vertrag** vorgeschlagen, nicht als Tabelle: `siteos_blueprints` und `app_builder_projects` bleiben getrennt, Tenant nur aus der Session. | #1737 (Builder-01), #1738 (Builder-02) | Oktober = TS-Vertrag. Eine `build_projects`-Tabelle nur per **E-O2**. |
| O-B5 | Publish Gate ist **serverseitig** vorhanden (`publish-gate`, `publish-approve`), Publish/Domain bleiben Preview. Workflow `deploy-siteos-preview.yml` existiert. | `supabase/functions/siteos/handlers/publish-gate.ts` | O-WP9 verdrahtet Gate → Approval → CF-Preview → Prod; kein zweites Gate. |
| O-B6 | Builder-Keys `siteos.builder`, `siteos.publish`, `limit.sites` stehen in der SSoT; Client liest sie über `useEntitlements`. Drift-Workflow `entitlement-drift.yml` läuft. | `shared/pricing.ts` Z. 1866 ff., `builderEntitlements.ts` | O-WP8 prüft Server-Durchsetzung und Plan-vs-Funktion, erfindet keine neuen Keys. |
| O-B7 | Kartenlose Testphasen laufen ohne WP2a-Migration nie ab (B11). Migration liegt im Repo, Anwendung auf Produktion offen. | `20260928160000_wp2a_trial_end_expiry.sql` | **E-O4** — Voraussetzung für O-WP8 und Live-Readiness. |
| O-B8 | Steuer-Widerspruch: #1748 stellt auf Regelbesteuerung (Bruttopreise) um; die Hausregel sagt § 19 UStG (Kleinunternehmer). | #1748 | **E-O3** — blockiert Pricing-Copy und Rechnungen, bis entschieden. |
| O-B9 | `docs/` ist auf der Ratsche voll (B10). | `.claude/context-budget.json` | Dieser Plan liegt unter `.claude/os-funnel/`, nicht in `docs/`. |

---

## 2. Zeitplan

| Woche | Zeitraum | Fokus | Pakete |
|---|---|---|---|
| **KW 41** | 5.–11.10. | Basis sauber, Security zuerst | O-WP1, O-WP2, Start O-WP3 |
| **KW 42** | 12.–18.10. | Ein Studio, ein Vertrag, Site Builder | O-WP3, O-WP4, O-WP8 (Teil 1) |
| **KW 43** | 19.–25.10. | Governance-Kette + Backend + App Builder | O-WP6, O-WP7, O-WP5, O-WP8 (Teil 2) |
| **KW 44** | 26.–31.10. | Publish Controller + Readiness-Prüfung | O-WP9, O-WP10 · **Go/No-Go-Runde 30.10.** |

```
O-WP1 Stabilisieren ──┬─► O-WP3 Build Studio ─► O-WP4 Site Builder ─┬─► O-WP6 Governance ─► O-WP9 Publish ─► O-WP10 Readiness
O-WP2 Landing-Claims ─┘                     └─► O-WP5 App Builder ─┘
                        O-WP8 Monetarisierung (parallel, braucht E-O3/E-O4)
                        O-WP7 Backend-Verkabelung (parallel ab KW 42)
```

---

## 3. Arbeitspakete

Jedes Paket: **eine Session, ein Branch von aktuellem `main`, ein Draft-PR** — neue Feature-PRs erst, wenn höchstens 20 PRs offen sind (WIP-Stopp, `.github/PR_TRIAGE_POLICY.md`); Triage-, Ersatz-, Security- und Docs-PRs sind ausgenommen.

### O-WP1 — Stabilisieren (KW 41)
**Ziel:** 31 offene PRs triagiert, Security-Fixes zuerst gemerged (mit GO).

| Reihenfolge | PRs | Grund |
|---|---|---|
| 1 Security/Tenant | #1710, #1721, #1723, #1717, #1719 | Mandantentrennung vor jedem neuen Feature |
| 2 Recht/Claims | #1748 (nach E-O3), #1739, #1665, #1750, #1744 | Keine Aussage, die die Runtime nicht hält |
| 3 Laufzeit-Fixes | #1756, #1745, #1709, #1700, #1718 | Kleine, belegte Fehler |
| 4 SEO | #1740, #1701 | nach Landing-Claims |
| 5 Plan | #1752 rebasen, WP7 als erledigt führen | O-B2 |

- Akzeptanz: jeder PR hat Label **merge / rebase / parken / schließen**; `needs-rebase` per Branch-Update als Merge („Update branch“). `npm run sync:main` rebased und force-pusht — nur mit Einzel-Freigabe (`.github/PR_TRIAGE_POLICY.md`). Auto-Merge-Check `enable` repariert oder bewusst deaktiviert.
- Nicht: Massen-Merge für Tempo, Tests deaktivieren.

### O-WP2 — Landing v4 halten (KW 41)
**Ziel:** v4 bleibt, Aussagen stimmen. Funnel-Zuordnung: ersetzt WP7.
- Claims gegen `src/product/implementation-status.ts` (live/preview/coming-soon) prüfen; „Build Studio" nur als Preview bewerben.
- Navigation zeigt echte Produktpfade: `/audit` → `/build` → `/app/dashboard`.
- Akzeptanz: `test/landing/landing-v4.test.tsx` grün, Lighthouse-CI nicht schlechter, kein Token-/CSS-Umbau (Freeze).

### O-WP3 — Build Studio `/build` als Einstieg (KW 41–42)
**Ziel:** ein Studio für Website/Landing **und** App.
- #1737 (Vertrag) → #1738 (Engine nach Projektart) in dieser Reihenfolge.
- Projektarten `landing`/`website` → SiteOS; `web_app`/`dashboard`/`saas_app` → Code-Builder.
- Akzeptanz: `test/build-studio/contract.test.ts` grün; jeder Builder-Einstieg landet über `/build`; Tenant nie aus Client-Input.

### O-WP4 — Site Builder produktionsfähig (KW 42)
**Ziel:** Seiten, Sections, Komponenten, Themes, Preview, Bearbeitung in `/builder/:slug`.
- Lücken gegen `packages/siteos-core` listen, nur diese schließen.
- Client sendet weiter nur Reihenfolge + redaktionelle Felder an `siteos/edit`.
- AI-Generierung erst, wenn Vertrag + Gate stehen (#1727 AI-Rebuild = parken bis O-WP9 fertig).
- Akzeptanz: E2E „Projekt anlegen → bearbeiten → Preview" grün.

### O-WP5 — App Builder Phase 1 (KW 43)
**Ziel:** React/TS-App-Erzeugung auf **demselben** Vertrag, Gate und Entitlement.
- Basis #1746 (Design-Vorlage speichern, Builder-Gate, Upgrade-Ziel je Grund).
- Akzeptanz: gleiche Publish-Gate-Bewertung wie SiteOS; kein eigener Entitlement-Key.

### O-WP6 — Governance anwenden (KW 43)
**Ziel:** Jeder Publish-/Build-Request läuft durch
`Request → Identity → Tenant → Policy → Risk → Approval → Execution → Verification → Evidence`.
- Publish-Gate-Ergebnis schreibt Approval (`governance-approvals`) und Evidence (`evidence-chain`).
- Modell führt aus, entscheidet aber nie über Policy — Policy-Entscheid serverseitig.
- Funnel-Zuordnung: WP5 (ein Agent-Register) liefert die ehrliche Agenten-Quelle.
- Akzeptanz: ein Publish ohne Approval ist nachweislich abgelehnt (Test); jede Freigabe hat Evidence-Eintrag.

### O-WP7 — Backend-Verkabelung (KW 42–43)
**Ziel:** Design zeigt nur echte Daten.
- #1733 (WP4 OS-Kachelreihe) auf echte RPCs; #1744 entfernt Demo-KPIs.
- Supabase Auth → `memberships` → Tenant → RLS durchgängig; keine Service-Role im Browser.
- Akzeptanz: keine hartkodierte Kennzahl in Dashboard/Studio (grep-Test), RLS-Tests für Builder-Tabellen.

### O-WP8 — Monetarisierung durchsetzen (KW 42–43)
**Ziel:** Preisplan = verfügbare Funktion, serverseitig erzwungen.
- Teil 1: E-O3 entscheiden, #1720 (Plan-Namen-Gates), #1679 (Begriffe), WP2a nach E-O4.
- Teil 2: Matrix `shared/pricing.ts` × `implementation-status.ts` — jedes verkaufte Feature `live` oder klar als Preview markiert; `siteos/site-entitlements.ts` prüft serverseitig.
- Funnel-Zuordnung: WP2 (Funnel auf `/audit`) läuft hier ein.
- Akzeptanz: `entitlement-drift` grün; Upgrade-Flow Free → Starter in Stripe-Testmodus E2E.

### O-WP9 — Publish Controller (KW 44)
**Ziel:** `Build → Verify → Approval → Cloudflare Preview → Production`, mit Rollback und Evidence.
- Aufbauend auf `publish-gate`/`publish-approve` und `deploy-siteos-preview.yml`.
- Production nur nach Approval; Rollback = letzte freigegebene Version; jeder Schritt erzeugt Evidence.
- Custom Domain bleibt Preview (E-O5).
- Akzeptanz: E2E Preview-Deploy eines Test-Tenants; Rollback-Test; Evidence-Export enthält den Publish.

### O-WP10 — Live-Readiness (KW 44)
**Ziel:** belastbare Entscheidungsgrundlage, **kein zugesagtes Live-Datum**.

| Prüfpunkt | Nachweis |
|---|---|
| E2E | Playwright-Suite grün auf `main` |
| Security | CodeQL grün, Security-PRs aus O-WP1 gemerged, `security-review` über Builder-Diff |
| Tenant-Isolation | RLS-Tests für `siteos_*`, `app_builder_projects`, Approvals, Evidence |
| Migrationen | `migration-drift`, `migration-collision`, `migration-reconciliation` grün; WP2a angewendet (E-O4) |
| Cloudflare/Supabase | Preview + Prod-Deploy reproduzierbar, Edge-Function-Drift grün (#1731) |
| Monitoring | `cron-health`, `drift-alert` aktiv, Alarmweg getestet |
| Evidence | ein Publish lückenlos von Request bis Evidence nachvollziehbar |

- Ergebnis: Go/No-Go-Vorlage zur Runde am **30.10.**; „Go" heißt Startfenster festlegen, nicht deployen.

---

## 3a. O-WP1 Triage (Stand 2026-10-05, 31 offene PRs)

Kein PR hat ein Approve. `enable` (rot bei 11 PRs) ist ein **veralteter Lauf**:
`auto-merge.yml` heißt den Job seit 04.10. `auto-merge` und endet „skipped" —
Branch-Update auf `main` räumt ihn ab. Drafts überspringen unit/build/gates/spa,
ihr Grün zählt erst nach „Ready for review".

| Spur | PR | Zustand | Aktion |
|---|---|---|---|
| **1 Security** | #1721 | clean, grün | **merge** (GO) |
| | #1710 | behind, nur `enable` | Branch-Update → merge (GO) |
| | #1723, #1717 | Draft, grün | Ready for review → Branch-Update → merge (GO) |
| | #1719 | behind, nur `enable` | Branch-Update → merge (GO) |
| **2 Recht/Claims** | #1748 | Draft, hot-file | **wartet auf E-O3**; danach Textkonflikt mit #1744 |
| | #1739 | behind, nur `enable` | Branch-Update → merge (GO, Rechtstext) |
| | #1665 | **dirty**, CI vom 28.09. | `main` hineinmergen → neu prüfen |
| | #1744 | behind, **4 Major offen** (Jahres-Toggle ohne Handler, Jahrespreis → Monats-Checkout, 204 mit Body) | **fixen**, dann merge |
| | #1750 | behind | prüfen, ob geänderte v2-Sektionen auf v4 noch rendern — sonst **schließen** |
| **3 Laufzeit** | #1709 | behind, nur `enable` | Branch-Update → merge |
| | #1756, #1745, #1718 | Draft, grün | Ready for review → merge |
| | #1700 | Draft, **Migration collisions** | Zeitstempel fixen; Migration = GO |
| **4 SEO** | #1740 → #1701 | behind; #1701 hot-file (`App.tsx`) | in dieser Reihenfolge |
| **5 Plan** | #1752 | WP7 = #1742 überholt (#1751 gemergt) | WP7 als erledigt führen oder schließen |
| **KW 42 Build Studio** | #1737 → #1738 | behind, nur `enable`, gestapelt | O-WP3 |
| **KW 42–43** | #1733 | behind, nur `enable` | O-WP7 |
| | #1720 → #1679 | hot-file `shared/pricing.ts` | O-WP8, nacheinander, `sync:pricing` nach jedem Merge |
| **KW 44** | #1731 | Draft, grün | O-WP10 (Edge-Function-Drift) |
| **geparkt** | #1724 (+ CodeQL offen), #1729, #1727 (dirty, +16k), #1714 (drift rot), #1712, #1706 | — | nicht rebasen |

**Neuer Konflikt → E-O7:** #1746 (Basis für O-WP5) soll laut PR-Text **nach**
#1727 gemergt werden (6 Dateien Überschneidung) — #1727 ist geparkt.

---

## 4. Bewusst geparkt (November oder später)

#1724 / #1729 Browser-Runtime/Executor · #1714 KI-Automation-Profil · #1727 AI-Rebuild ·
#1712 Einkaufspreis Schritt D · #1706 Claude Code Action · Screenshot-Import ·
WebContainer · neue Agenten. Parken = Draft bleibt offen, kein Rebase-Aufwand im Oktober.

---

## 5. Entscheidungen (offen)

| ID | Frage | Empfehlung | blockiert |
|---|---|---|---|
| E-O1 | O-WP-Nummerierung neben Funnel-WP1–WP7 | O-WP bündelt, Funnel-WPs laufen als Zulieferer weiter | — |
| E-O2 | Project Model: TS-Vertrag (#1737) oder Tabelle `build_projects` | Vertrag im Oktober; Tabelle frühestens nach O-WP10 | O-WP3/5 |
| E-O3 | USt: Regelbesteuerung (#1748) oder § 19 UStG | **festgelegt** in `.github/PR_TRIAGE_POLICY.md` (27.09.): § 19 UStG, Hinweis „Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.“ #1748 widerspricht → Vorschlag schließen (Einzel-Freigabe); eine Änderung der Steuerbasis nur über eine neue Owner-Entscheidung | — |
| E-O4 | WP2a-Migration auf Produktion anwenden | ja, vor O-WP8 Teil 2 | O-WP8, O-WP10 |
| E-O5 | Publish-Ziel: CF-Pages-Preview je Tenant; Custom Domain im Oktober | Domain bleibt Preview | O-WP9 |
| E-O6 | Go/No-Go-Runde | 30.10., Ergebnis = Startfenster, kein Datum vorab | O-WP10 |
| E-O7 | #1746 hängt an geparktem #1727 | **erledigt 09.10.:** Inhalt kam über #1789, #1746 geschlossen | — |

---

## 6. Regeln für alle Pakete

- Branch von aktuellem `origin/main`, **Draft-PR**, CI + Review abwarten, Merge nur mit GO.
- WIP-Stopp: bei mehr als 20 offenen PRs keine neuen Feature-PRs (Ausnahmen laut Triage-Policy).
- Einzel-Freigabe für Security, Migrationen, Schließen, Preise/Steuer/Recht/Landing-Claims, Rebase/Force-Push.
- Keine Migration, kein Deploy, keine Preisänderung ohne separates GO.
- Status-Vokabular nur aus `src/product/implementation-status.ts`.
- Keine Secrets, keine Service-Role im Browser, keine Fake-KPIs.
