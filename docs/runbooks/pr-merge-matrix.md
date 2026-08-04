# PR-Merge-Matrix — Release-Zug Phase 2 → Produktion

**Stand der Erhebung**: 2026-08-04 · **Basis**: `origin/main` @ `541dafd`
**Methode**: read-only — GitHub API (Status, Checks, Reviews), lokaler Diff gegen `main`,
Live-Abgleich gegen Supabase-Projekt `ebljyceifhnlzhjfyxup` (eu-central-1).

Diese Matrix ersetzt jede frühere MERGE/HOLD/REVIEW-Liste. Zahlen mit Datum sind
Messwerte, keine Schätzungen. Vor jedem Merge-Zug neu erheben — siehe §6.

---

## 1. Der harte Blocker zuerst: Function-Slots sind voll

`supabase functions list` gegen das Live-Projekt liefert **exakt 100 ACTIVE Functions**.
Der `Deploy`-Workflow bricht beim Function-Deploy mit

```
402 — Max number of functions reached for project
```

ab (dokumentiert in der Commit-Message von #978, bereits auf `main`).

**Konsequenz für den Release-Zug: Jeder PR, der eine neue Edge Function mitbringt,
ist nicht deploybar — unabhängig von seiner Code-Qualität.** Die Function wird gemerged,
landet im Repo, und der Deploy-Job scheitert weiter. Das vergrößert exakt die Lücke,
die in `DEBUG_ROOT_CAUSE_2026-08-02.md` beschrieben ist.

Repo-Stand zum Vergleich: **173** Verzeichnisse unter `supabase/functions/`.
Lücke Repo ↔ Produktion: **73 Functions nie deployt.**

### Freigebbare Slots

Fünf Live-Functions stammen nicht aus dem Repo (`entrypoint_path` zeigt auf
`file:///tmp/user_fn_…`, also manuell übers Dashboard deployt) und stehen auf der
Drift-Allowlist `scripts/edge-function-drift-allowlist.json`:

| Function | Im Repo? | Noch referenziert von | Löschbar |
|---|---|---|---|
| `debug-secret-shape` | nein | nur Doku-Snapshot + Allowlist | **ja** |
| `stripe-webhook-fixer` | nein | nur Doku + Allowlist | **ja** |
| `stripe-webhook-provision` | nein | nur Allowlist | **ja** |
| `vault-key-setter` | nein | `scripts/check-edge-function-drift.mjs`, `supabase/config.toml` | erst nach Skript-Anpassung |
| `vault-set-secret` | nein | **aktive Runbooks** (`stripe-production-checkout.md`, `resend-production-email.md`) | **nein — für Stage 3 gebraucht** |

→ **3 Slots sofort freigebbar**, ein vierter nach Anpassung des Drift-Skripts.
Das ist Voraussetzung für Stage 1, nicht Teil davon.

---

## 2. Merge-Matrix

Legende Entscheidung: **MERGE** = mergefähig, sobald Voraussetzung erfüllt ·
**HOLD** = blockiert, Ursache benannt · **REOPEN** = geschlossen, Arbeit nicht gelandet.

| PR | Titel (Kurz) | Entscheidung | Risiko | Voraussetzung | Reihenfolge |
|---|---|---|---|---|---|
| **#963** | Runbook: Rollback ohne PITR (Free-Plan) | **MERGE** | niedrig | Draft→Ready. Reines Doku-Delta (1 Datei, +36/−4), kein Code | **1** |
| **#961** | Deploy-Fail-Fast bei nicht erreichbarem VPS | **MERGE** | niedrig | Draft→Ready. Workflow + Runbook, CI grün | **2** |
| **#960** | JSR-Pin 2.39.8 entfernen (5× `deno.json`) | **MERGE** | niedrig | **Von #978 überholt** — Wirkung bereits auf `main`. Nur noch Aufräumen redundanter Import-Maps. Alternativ schließen | **3** |
| **#972** | Browser-Agent (#899) | **MERGE** | mittel | Handler am Orchestrator registrieren; PR-Body korrigieren (siehe §3); Domänen-Entscheid gegen #970 | **4** |
| **#970** | Agent Browser + Governance | **HOLD** | **hoch** | 3 Sicherheitsauflagen (§3) **und** freier Function-Slot | nach Slot-Freigabe + Fix |
| **#971** | MCP Governance Control Plane | **HOLD** | **hoch** | Auth-Stub ersetzen, Service-Role entfernen, Fake-Compliance-Endpoints entfernen (§3) | nach Fix |
| **#932** | Phase 2 Hybrid Merge (SiteOS, C2PA, AI Builder) | **HOLD** | **hoch** | Vault-Secrets **und** `supabase db push --dry-run` gegen 126 pending Migrationen | nach Infra |
| **#890** | Evidence Vault Archive | **REOPEN** | hoch | Neu öffnen oder neu implementieren — Arbeit ist nirgends gelandet (§4) | Stage 1, blockiert |
| **#896** | Governance Runtime: Live-Daten | **REOPEN** | hoch | dito | Stage 1, blockiert |
| **#889** | MCP Server Authentication | **REOPEN** | hoch | dito; überschneidet sich mit #971 — eine Lösung wählen | Stage 1, blockiert |
| **#874** | Evidence Archive (Duplikat von #890) | **geschlossen lassen** | — | Inhaltlich in #890 enthalten | — |

**#926** existiert nicht als Pull Request (`GET /pulls/926` → 404). Falls es eine Issue-Nummer
ist, gehört sie nicht in diese Matrix — das Revenue-Gate hängt an Vault-Secrets, nicht an einem PR.

### Formalstatus der offenen PRs

| PR | draft | mergeable_state | Checks | Reviews | Dateien | Migrationen | Edge Functions |
|---|---|---|---|---|---|---|---|
| #960 | ja | clean | 9/9 grün | 0 | 5 | 0 | 0 |
| #961 | ja | clean | 8/8 grün | 0 | 2 | 0 | 0 |
| #963 | ja | clean | 7/7 grün | 0 | 1 | 0 | 0 |
| #970 | **nein** | clean | 11/11 grün | **0** | 8 | 1 | **+1** |
| #971 | ja | clean | 13/13 grün | **0** | 16 | 0 | 0 |
| #972 | ja | clean | 7/7 grün | **0** | 9 | 0 | 0 |
| #932 | ja | clean | — | 0 | 49 | **126 pending** | 0 |

Grünes CI heißt hier wenig: kein aktiver Check deckt Auth-Fehler in Edge Functions,
Service-Role-Missbrauch oder nicht verdrahteten Code ab. **Kein einziger PR hat ein Review.**

---

## 3. Blocker im Detail

### #970 — Agent Browser · drei Auflagen

Die Migration `20260803000000_agent_browser_sessions.sql` ist unkritisch: additiv,
`create table if not exists`, drei Tabellen mit `tenant_id NOT NULL REFERENCES tenants(id)`,
RLS aktiviert, SELECT-Policies über `public.is_tenant_member(tenant_id)`, alle FK-Ziele
existieren auf `main`. **Keine bestehende Policy wird verändert.**

Die Edge Function ist der Blocker:

1. **Keine Authentifizierung.** `supabase/functions/agent-browser/index.ts` liest `tenant_id`
   aus dem Request-Body und arbeitet mit `SUPABASE_SERVICE_ROLE_KEY`. Kein `getUser()`,
   keine JWT-Prüfung, keine Mitgliedschaftsprüfung. Der Service-Role-Key umgeht RLS —
   die RLS-Policies der Migration schützen an dieser Stelle nichts.
2. **Client-gesteuerter Governance-Bypass.** `policy_override?: boolean` (Z. 30) hebt in
   Z. 218 die komplette Policy-Enforcement auf. Ein vom Aufrufer setzbares Flag, das die
   Governance abschaltet, ist in einem EU-AI-Act-Produkt nicht haltbar.
3. **Toter Code.** `AgentBrowserMonitor.tsx` und `AgentBrowserPolicyManager.tsx` (687 Zeilen)
   sind nirgends importiert — keine Route, kein Einstiegspunkt. `src/lib/agent-browser/executor.ts`
   (368 Zeilen) wird von der Edge Function nicht verwendet. Verstoß gegen CLAUDE.md §14.

Zusätzlich: die neue Function ist wegen §1 derzeit **nicht deploybar**.

### #971 — MCP Control Plane · Auth ist ein Stub

`apps/mcp-server/src/auth/api-key.ts` prüft ausschließlich, ob der Bearer-Token mit
`rsmcp_` beginnt, und vergibt dann fest `scopes: ['evidence.read','governance.read']`
bei `tenantId: ''`. Der Kommentar sagt es selbst: *„In Phase 1: placeholder."*
Der Server läuft dabei auf `SUPABASE_SERVICE_ROLE_KEY` (`services/supabase.ts`) — RLS greift nicht.

Die PR-Beschreibung behauptet „✅ RLS Enforced" und „✅ Tenant Isolation". Beides trifft nicht zu.

Praktisch verhindert ein Folgefehler den Datenabfluss: `.eq('tenant_id', '')` gegen eine
UUID-Spalte lässt Postgres jeden Endpoint mit 500 abbrechen. Der Dienst ist damit
gleichzeitig nicht funktionsfähig und nicht sicher.

**Zusätzlich — fabrizierte Compliance-Werte.** `tools/governance.ts` fragt die Datenbank
nicht ab, sondern gibt Konstanten zurück (`score: 0, totalControls: 0, …`). Ein
Governance-Endpoint, der einen erfundenen Compliance-Score ausliefert, darf nicht deployen.
Die referenzierte Tabelle `governance_controls` existiert auf `main` nicht.

### #972 — Browser-Agent · sauber, aber unverdrahtet

Keine Migration, keine Edge Function, kein RLS-Eingriff, keine Secrets im Code
(Konfiguration per Options-Objekt injiziert). 18 Tests grün. Abhängigkeiten existieren:
Edge Function `browser-action-log` ist live (Version 3), Tabellen `agent_tasks` und
`browser_actions` sind migriert.

Zwei Punkte vor dem Merge:

- **Nicht registriert.** `src/core/browser-agent/*` wird nur von den eigenen Tests importiert.
  Ohne Registrierung am Orchestrator ist es Bibliothekscode ohne Aufrufer (§14).
- **Falsche Prämisse im PR-Body.** Die „Satisfies Gate 2"-Checkliste behauptet
  „✅ #896 merged" und „✅ #889 merged". **Beide wurden geschlossen, nicht gemerged.**
  Gate 2 ist nicht erfüllt. Wer die Merge-Reihenfolge auf dieser Checkliste aufbaut,
  baut auf einer falschen Grundlage.

**Domänenkonflikt mit #970**: Beide implementieren agentengesteuertes Browsen, mit zwei
konkurrierenden Datenmodellen (`agent_browser_*` + neue Function vs. `browser_actions` +
bestehende `browser-action-log`). Kein Git-Konflikt (disjunkte Dateien) — aber das ist
zu entscheiden, bevor beide auf `main` liegen, nicht danach.

### #932 — Hybrid Merge · zwei unabhängige Blocker

- **Vault-Secrets** (`resend_api_key`, `stripe_secret_key`, `stripe_webhook_secret`) fehlen.
  Der PR benennt das selbst als einzigen echten P0.
- **126 pending Migrationen** werden beim Merge durch `deploy.yml`
  (`supabase db push --include-all`) ohne menschliches Gate auf Produktion angewandt.
  Der PR dokumentiert einen zweifachen Audit gegen die Live-DB und nennt die verbleibende
  Lücke selbst: Spalten-Typ-Drift ungeprüft, `db push --include-all` nicht transaktional.
  **`supabase db push --dry-run` vor dem Merge** schließt das günstig.

---

## 4. Verlorene Arbeit: die geschlossene Kette #874 → #890 → #896

Drei PRs mit zusammen rund 4.800 geänderten Zeilen wurden geschlossen, **keiner gemerged**:

| PR | geschlossen | Begründung |
|---|---|---|
| #874 | 2026-07-27 | „duplicate — identisch zu #890, carried forward into #896" |
| #890 | 2026-08-02 | ohne Kommentar |
| #896 | 2026-08-02 | ohne Kommentar |

#874 wurde also zugunsten einer Kette geschlossen, deren beide Folgeglieder danach
ebenfalls geschlossen wurden. Am Code auf `main` verifiziert:

```
src/features/governance/Iso42001EvidenceVaultView.tsx:546  const handleArchive = async () => {
src/features/governance/Iso42001EvidenceVaultView.tsx:549    // TODO: Implement archive API call
src/features/governance/Iso42001EvidenceVaultView.tsx:659    onClick={handleArchive}
```

Die Edge Function `iso42001-evidence-vault` hat weiterhin keinen PATCH- und keinen
DELETE-Handler. **Der Archive-Button ist in Produktion sichtbar und tut nichts** — genau
der Fall, den CLAUDE.md §14 ausschließt.

Analog #889: kein `supabase/functions/mcp-server-management`, keine `mcp_servers`-Migration
auf `main`.

**Das ist kein Reihenfolge-Problem, sondern offene Arbeit.** Stage 1 ist deshalb faktisch leer.

---

## 5. Release-Zug (korrigiert)

```
Stage 0 — Doku & Deploy-Hygiene, kein Produktionsrisiko
├── #963  Runbook Rollback (PITR)
├── #961  Deploy Fail-Fast VPS
└── #960  JSR-Pin-Aufräumen (oder schließen, da von #978 überholt)

Stage 0.5 — Kapazität schaffen        ← NEU, blockiert alles Weitere
├── 3 verwaiste Live-Functions löschen (debug-secret-shape,
│   stripe-webhook-fixer, stripe-webhook-provision)
└── Drift-Allowlist nachziehen

Stage 1 — Governance/Evidence         ← derzeit LEER
├── #890 / #896 / #889 neu öffnen oder neu implementieren
└── #972 nach Orchestrator-Registrierung

Stage 2 — Infrastruktur
├── Vault-Secrets setzen (resend, stripe, stripe_webhook)
├── supabase db push --dry-run gegen 126 pending
└── #932 Hybrid Merge

Stage 3 — Runtime nach Sicherheits-Fix
├── #970 (nach Auth + policy_override + Verdrahtung)
└── #971 (nach echter API-Key-Auth)

Stage 4 — Production Release
```

Gegenüber der ursprünglichen Planung: **Stage 0.5 ist neu und blockierend**, **Stage 1 ist
leer statt gefüllt**, und **#970/#971 rutschen von Stage 1 nach Stage 3**.

---

## 6. Erhebung wiederholen

```bash
# Formalstatus + Checks je PR
gh pr view <N> --json number,title,isDraft,mergeable,mergeStateStatus,statusCheckRollup,reviews

# Live-Function-Zahl (Slot-Auslastung)
supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l

# Repo-Stand
ls supabase/functions | wc -l

# Migrations-Rückstand vor jedem Merge mit Migrationen
supabase db push --dry-run --project-ref ebljyceifhnlzhjfyxup
```
