# PR-Backlog-Triage — 2026-06-05

> Snapshot-Analyse des offenen PR-Backlogs (**48 offene PRs**) gegen
> `origin/main` @ `109cf47`. Ziel: Merge-Reihenfolge, Konflikt-Risiken und
> Stale-Erkennung — **ohne** fremde PRs zu mergen oder zu schließen. Alle
> Aktionen unten sind Empfehlungen; Verifikation durch Maintainer.
>
> Methodik: pro PR-Branch `git merge-base`/`git diff`/`git merge-tree` gegen
> `origin/main`. „net-zero" = Branch-Tree identisch zum Abzweigpunkt (Merge
> bringt keine Änderung). „CONFL" = `merge-tree` meldet Konflikt gegen main.

---

## 🔴 Kritisch: Migrations-Timestamp-Kollisionen

Mehrere offene PRs vergeben **identische** Migration-Timestamps. Das ist exakt
das Muster, das bereits 3× zu Hotfixes führte (#438, #441, #467). Mergt man den
zweiten PR mit gleichem Timestamp, bricht `supabase db push` /
`migration-drift`-Guard.

| Timestamp | Kollidierende PRs | Datei(en) |
|---|---|---|
| `20260620000005` | **#480**, **#464** | `advisor_cost_cap_hardening.sql` ↔ `tenant_branding.sql` |
| `20260621000000` | **#489**, **#464**, **#412** | `security_definer_views_invoker.sql` ↔ `claim_anonymous_audits_on_signup.sql` ↔ `agency_multi_website_governance.sql` |

**#464 ist in beiden Kollisionen der gemeinsame Nenner.** Empfehlung: vor jedem
Merge die Timestamps der noch nicht gemergten PRs neu vergeben (monoton, eine
pro PR). Reihenfolge fixieren und Timestamps **erst beim Merge** final ziehen.
Mittelfristig: CI-Guard, der kollidierende Timestamps über offene PRs hinweg
erkennt (verwandt: #454 `DUPLICATE_TIMESTAMP_ALLOWLIST`, #468 migration-drift).

Weitere migrations-berührende PRs (aktuell **kollisionsfrei**, aber beim
Sequenzieren beachten): #520 (`20260623000000`), #517 (`20260623000001`),
#455 (`20260526100000`, `20260526200000`), #436 (`20260612000000`).

---

## 🟡 Merge-Konflikte gegen main (Rebase nötig)

Diese vier PRs lassen sich aktuell **nicht** sauber auf `main` mergen:

| PR | Branch | Hinweis |
|---|---|---|
| #518 | `public-entry-product-frontend` | Konflikt + 1 Migration |
| #478 | `landing-page-stabilization-2` | Konflikt (Landing — überlappt mit Positionierungs-PRs) |
| #469 | `landing-enterprise-positioning` | Konflikt (Landing/Positionierung) |
| #436 | `findings-fingerprint` | Konflikt + Migration `20260612000000` |

#478/#469 konfligieren vermutlich miteinander/über die Positionierungs-Welle —
siehe nächster Abschnitt.

---

## ⚪ Stale / Net-Zero — Schließ-Kandidaten (verifizieren)

Diese **11 PRs** haben einen **net-zero Diff** gegen ihren Abzweigpunkt: ein
Merge nach `main` würde **nichts** ändern. Typisches Squash-Merge-Leftover —
die Arbeit ist bereits in `main`. Auffällig: der Großteil der **Phase-A-Runtime-PRs**
liegt in diesem Bucket, d. h. der Governance-Kern ist offenbar schon gelandet
(zuletzt z. B. #484 Pipeline-Contract-Test-Harness).

`#453` `#416` `#402` `#395` `#363` `#359` `#336` `#335` `#334` `#332` `#331`

| PR | Branch | Thema |
|---|---|---|
| #395 | `runtime-event-writer-tier-discipline-p0-3` | Phase A: kernel-v1 writer |
| #334 | `zen-fermi` | Phase A: capability-layer PermissionChecker |
| #332 | `phase-a-governance-event-ingest` | Phase A: event ingest |
| #359 | `runtime-vvt-slice` | Runtime VVT-Slice |
| #363 | `runtime-ui-leitstand-migration` | Governance-Leitstand UI |
| #335 | `infrastructure-restructure` | Doku-Alignment README/ROADMAP |
| #336 | `seo-derive-from-pricing` | SEO aus pricing.ts SSoT |
| #331 | `review-project-status` | Status-Review |
| #453 | `ops-stabilization-audit` | Ops-Stabilisierung |
| #416 | `go-setup` | OAuth-Provider-Reduktion |
| #402 | `openclaw-hostinger-setup` | VPS-Setup |

> **Empfehlung:** je PR 30 s gegenchecken (Diff leer? Inhalt in main?) und dann
> schließen. Das senkt den Backlog von 48 auf ~37 ohne Risiko und beseitigt
> tote Phase-A-Drafts, die fälschlich „offene Kern-Arbeit" suggerieren.

---

## Thematische Cluster (Rest)

- **Positionierung/Doku-Welle** (überlappen stark, sollten als Gruppe
  sequenziert/konsolidiert werden): #488, #483, #481, #477, #475, #469, #335*,
  #331*, #523 (diese Branch — Docs-Alignment, bereits grün). *= net-zero.
  → **Risiko:** mehrere PRs editieren dieselben Landing-/Doku-Dateien →
  Konfliktkette (#478/#469 bereits konfliktbehaftet). Einen „Lead"-PR wählen,
  Rest darauf rebasen oder schließen.
- **Security/Hardening:** #472 (security-headers, P0), #474 (CORS-Allowlist,
  P1), #470 (AVV/Sub-Processor), #480 (cost-cap — **Kollision!**),
  #496 (AAL2 enforce), #454 (timestamp-allowlist-lint).
- **Deploy/DNS/Ops:** #487, #485, #479, #517 (Telegram-Agent + Migration).
- **Frontend/Assistant/Demo:** #525, #526, #524, #527, #511, #520, #522, #518*,
  #333 (enhanced conversions).
- **Business/Features:** #464 (white-label — **Kollision!**), #455 (beta-launch
  + 2 Migrations), #412 (agency-pilot — **Kollision!**), #433 (knowledge
  foundation, 28 Dateien), #510/#497/#522 (governance-os product/visibility).

---

## Empfohlene Reihenfolge

1. **Backlog entschlacken:** 11 net-zero PRs verifizieren & schließen (oben).
2. **Security-Welle (konfliktfrei) zuerst:** #472 → #474 → #470. (#523 Docs +
   react-router-RCE-Bump ist bereits grün und unabhängig mergebar.)
3. **Migrations-Kollisionen auflösen** bevor irgendein migrations-PR mergt:
   #489/#464/#412 (ts `…21000000`) und #480/#464 (ts `…20000005`) neu
   nummerieren; Merge-Order fixieren (Vorschlag: #480 → #489 → #464 → #412,
   jeweils Timestamp beim Merge frisch).
4. **Positionierungs-Welle konsolidieren:** einen Lead-PR (z. B. #475 Strategie)
   bestimmen, #477/#483/#488/#469/#478 darauf rebasen oder als Duplikat
   schließen.
5. **Rest-Konflikte rebasen:** #518, #436.
6. **Feature-PRs zuletzt**, je nach Reife.

---

## Caveats

- Per-PR-**CI-Status** wurde hier nicht erneut geprüft (nur Merge-Geometrie).
- „net-zero" ist starkes, aber kein hinreichendes Schließ-Signal — kurz
  gegenchecken (evtl. wollte der PR Änderungen tragen, die durch Rebase auf main
  geklobbert wurden).
- Snapshot vom 2026-06-05; `main` bewegt sich — vor Aktion neu `git fetch`.
