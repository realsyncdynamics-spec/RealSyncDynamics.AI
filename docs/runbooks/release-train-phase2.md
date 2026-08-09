# Operator-Runbook — Release-Zug Phase 2 → Produktion

**Erhoben**: 2026-08-04 · **Basis**: `origin/main` @ `541dafd` · **Live-Projekt**: `ebljyceifhnlzhjfyxup` (eu-central-1)
**Entscheidungsgrundlage**: [`pr-merge-matrix.md`](./pr-merge-matrix.md)

Dieses Runbook ist für den Operator, der den Zug tatsächlich fährt. Jede Stage hat
**Vorbedingung → Schritte → Gate → Rollback**. Ein Gate, das nicht grün ist, stoppt den Zug;
die nächste Stage wird nicht begonnen.

> Grundsatz: Kein Merge ohne erfüllte Vorbedingung. Kein Deploy ohne verifiziertes Gate.
> Bei jeder Abweichung von diesem Dokument: Abweichung notieren, nicht improvisieren.

---

## Stage 0 — Doku & Deploy-Hygiene

**Risiko**: niedrig · **Produktionswirkung**: keine · **Reversibel**: ja (Revert)

### Vorbedingung
Keine.

### Schritte

```bash
# 1. #963 — Runbook Rollback (PITR), 1 Datei, +36/-4
gh pr ready 963 && gh pr merge 963 --squash

# 2. #961 — Deploy Fail-Fast VPS, Workflow + Runbook
gh pr ready 961 && gh pr merge 961 --squash

# 3. #960 — JSR-Pin-Aufräumen
#    ACHTUNG: inhaltlich von #978 überholt (bereits auf main).
#    #960 löscht die deno.json-Dateien, die #978 gerade korrigiert hat.
#    Entscheidung Operator: mergen (redundante Import-Maps entfernen) ODER schließen.
gh pr view 960 --json files
```

### Gate 0

```bash
npm run lint && npm run build
gh run list --branch main --limit 3        # kein neuer roter Lauf
```

### Rollback
`git revert <sha>` je PR. Keine Datenwirkung, keine Migration, kein Function-Deploy.

---

## Stage 0.5 — Kapazität schaffen ⚠️ blockiert alles Weitere

**Risiko**: mittel · **Produktionswirkung**: ja (Löschen von Live-Functions) · **Reversibel**: bedingt

### Warum diese Stage existiert

Das Live-Projekt hat **exakt 100 ACTIVE Edge Functions**. Der Deploy-Job scheitert mit

```
402 — Max number of functions reached for project
```

**Jeder PR, der eine neue Edge Function mitbringt, ist bis dahin nicht deploybar.**
Betroffen: #970 (`agent-browser`) und #896 (`mcp-server-management`) — also sowohl
Stage 1 als auch Stage 3.

### Vorbedingung

```bash
# Ist-Stand bestätigen — nicht auf diese Zahl vertrauen, neu messen
supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l   # erwartet: 100
ls supabase/functions | wc -l                                        # erwartet: 173
```

### Schritte

Drei Functions stammen **nicht aus dem Repo** (`entrypoint_path` = `file:///tmp/user_fn_…`,
also manuell übers Dashboard deployt) und werden von keinem Code aufgerufen — nur von
Doku-Snapshots und der Drift-Allowlist.

```bash
# Vor dem Löschen: letzte Aufrufe prüfen. Erst löschen, wenn 0 Aufrufe.
#   Supabase Dashboard → Edge Functions → <name> → Invocations (30d)

supabase functions delete debug-secret-shape      --project-ref ebljyceifhnlzhjfyxup
supabase functions delete stripe-webhook-fixer    --project-ref ebljyceifhnlzhjfyxup
supabase functions delete stripe-webhook-provision --project-ref ebljyceifhnlzhjfyxup

# Allowlist nachziehen, sonst meldet der Drift-Check die Löschung als Abweichung
$EDITOR scripts/edge-function-drift-allowlist.json
npm run check:edge-functions
```

**Nicht löschen:**

| Function | Grund |
|---|---|
| `vault-set-secret` | wird von `stripe-production-checkout.md` und `resend-production-email.md` gebraucht — **Stage 2 hängt daran** |
| `vault-key-setter` | referenziert von `scripts/check-edge-function-drift.mjs` und `supabase/config.toml`; erst nach Skript-Anpassung entfernbar |

### Gate 0.5

```bash
supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l   # erwartet: 97
npm run check:edge-functions                                         # grün
```

Drei freie Slots. Das reicht für `mcp-server-management` (Stage 1) und `agent-browser`
(Stage 3), mit einem Slot Reserve.

### Rollback
Gelöschte Functions sind **nicht wiederherstellbar** — der Quellcode lag nur live vor,
nicht im Repo. Deshalb: **vor dem Löschen den Code sichern.**

```bash
# Sicherung anlegen, bevor gelöscht wird
mkdir -p .archive/deleted-edge-functions
for f in debug-secret-shape stripe-webhook-fixer stripe-webhook-provision; do
  supabase functions download "$f" --project-ref ebljyceifhnlzhjfyxup \
    --output-dir ".archive/deleted-edge-functions/$f"
done
```

---

## Stage 1 — Governance & Evidence wiederherstellen

**Risiko**: hoch · **Produktionswirkung**: ja (Migration + Function-Deploy) · **Reversibel**: teilweise

### Ausgangslage

Die Kette **#874 → #890 → #896** wurde vollständig geschlossen, **ohne dass ein Glied
gemerged wurde**. Der Archive-Button im Evidence Vault ist in Produktion sichtbar und
ohne Funktion (`Iso42001EvidenceVaultView.tsx:549`).

### Entscheidung: Reopen, nicht neu implementieren — gemessen, nicht geschätzt

| Prüfung | Ergebnis |
|---|---|
| Branches auf `origin` vorhanden? | **alle vier ja** (auch `feat/evidence-archive`) |
| Merge gegen aktuelles `main`? | **alle drei konfliktfrei** (`git merge-tree`, 179 Commits Rückstand) |
| Drift auf berührten Dateien seit Fork? | **0 Commits** auf `Iso42001EvidenceVaultView.tsx`, `iso42001-evidence-vault/index.ts`, `GovernanceRuntimeDashboard.tsx` |
| Verhältnis der drei PRs? | **#889 ⊂ #890 ⊂ #896** — geteilte Dateien byte-identisch (Blob-SHA-Vergleich) |

**Konsequenz: #896 allein stellt die Arbeit aller drei PRs wieder her.**
#890 und #889 sind dann redundant und bleiben geschlossen.

```bash
git checkout -B claude/governance-runtime-completion-h9k3m2 \
  origin/claude/governance-runtime-completion-h9k3m2
git merge origin/main          # konfliktfrei laut Vorprüfung — verifizieren
```

### ⚠️ Zwei Blocker, die vor dem Merge zu beheben sind

Der Code ist 179 Commits alt und trifft **zwei Annahmen, die in Produktion nicht gelten.**
Live verifiziert gegen `information_schema`:

**Blocker 1 — `profiles.tenant_id` existiert nicht.**
`supabase/functions/mcp-server-management/index.ts:45-54` liest:

```ts
const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
```

`public.profiles` hat in Produktion diese Spalten — **kein `tenant_id`**:
`id, full_name, organization_name, role, eu_compliance_mode, avatar_url, created_at, updated_at, ai_data_residency, is_super_admin, welcome_email_sent_at, onboarding_completed_at, onboarding_dismissed_at, onboarding_step`

→ `getUserTenantId()` wirft bei **jedem** Aufruf `User profile not found`. Die Function ist
nach dem Deploy zu 100 % nicht funktionsfähig.

**Blocker 2 — die RLS-Policies referenzieren `auth.users.tenant_id`.**
`20260726000000_mcp_servers.sql` verwendet durchgängig:

```sql
tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
```

`auth.users` hat keine Spalte `tenant_id`. Zum Beleg, dass dieses Muster nie funktioniert hat:
44 Migrationen im Repo verwenden es, und in Produktion referenziert **0** aktive Policy
`FROM auth.users` — diese Migrationen gehören zum nie angewendeten Rückstand
(Stand 2026-08-09: 133 von 270, siehe `p0-2-migration-reconciliation.md`).

**Korrektes Muster** (in Produktion vorhanden und wirksam):

```sql
-- public.is_tenant_member(uuid) — STABLE SECURITY DEFINER, existiert live
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships
                 WHERE tenant_id = p_tenant_id AND user_id = auth.uid());
$$;
```

### Schritte

```bash
# 1. RLS-Policies auf is_tenant_member() umstellen
$EDITOR supabase/migrations/20260726000000_mcp_servers.sql
#    tenant_id = (SELECT tenant_id FROM auth.users …)   →   public.is_tenant_member(tenant_id)

# 2. Edge Function auf memberships umstellen
$EDITOR supabase/functions/mcp-server-management/index.ts
#    profiles.tenant_id  →  memberships (tenant_id, user_id = auth.uid())

# 3. Credential-Klartext beheben (siehe unten)

# 4. Verifizieren
npm run lint && npm run build && npm test
supabase db reset && npm run test:db
```

### 🔴 Zusätzlicher Befund: Credentials liegen im Klartext

`mcp-server-management/index.ts:198-206`:

```ts
// Store credential (encrypted via RLS + edge function context)
credential_value_encrypted: payload.credential_value,
```

Der Wert wird **unverschlüsselt** in eine Spalte geschrieben, deren Name Verschlüsselung
behauptet. RLS ist Zugriffskontrolle, keine Verschlüsselung. Betroffen sind API-Keys,
Tokens und OAuth-Credentials fremder MCP-Server.

Für ein Produkt mit ISO-27001-Anspruch ist das vor dem Merge zu beheben — entweder über
Supabase Vault (`vault.create_secret()`, Referenz in der Spalte) oder pgsodium. **Nicht
mergen und später nachziehen**: einmal geschriebene Klartext-Credentials bleiben in
Backups und WAL erhalten.

### Was an #896 gut ist

Die Auth der Edge Function ist im Gegensatz zu #971 **strukturell korrekt**: echte
`supabase.auth.getUser(token)`-Prüfung, `tenant_id` serverseitig ermittelt statt aus dem
Body übernommen, jede Query mit `.eq('tenant_id', tenantId)`. Nur die Quelle des
`tenant_id` stimmt nicht — das ist eine Zeile, kein Neuentwurf.

### Gate 1

```bash
npm run lint && npm run build && npm test
supabase db push --dry-run --project-ref ebljyceifhnlzhjfyxup   # muss die 3 mcp_* Tabellen zeigen
supabase functions list --project-ref ebljyceifhnlzhjfyxup | grep mcp-server-management
```

Danach fachlich prüfen — der Grund, warum diese Stage überhaupt existiert:

- Evidence Vault öffnen → Archive-Button klicken → Eintrag verschwindet aus der Liste
- Prüfpfad enthält `evidence_archived`
- `#972` erst danach mergen (siehe Stage 1b)

### Rollback

Migration ist additiv (`CREATE TABLE`, keine Änderung bestehender Tabellen). Rückbau:
`DROP TABLE public.mcp_server_usage, public.mcp_server_credentials, public.mcp_servers;`
Auf dem Free-Plan gibt es **kein PITR** — siehe `p0-2-migration-reconciliation.md`
(korrigiert durch #963).

---

## Stage 1b — Browser-Agent (#972)

**Risiko**: mittel · **Produktionswirkung**: keine (keine Migration, keine Function)

### Vorbedingung

Domänenkonflikt entscheiden: **#972 und #970 implementieren dasselbe mit zwei
Datenmodellen** (`browser_actions` + bestehende `browser-action-log` vs. neue
`agent_browser_*` + neue Function). Beide auf `main` zu haben, erzeugt zwei konkurrierende
Prüfpfade für dieselben Vorgänge — das ist in einem Governance-Produkt teurer als jede
Doppelarbeit im Code.

**Empfehlung**: #972 als Basis (nutzt vorhandene, live deployte Infrastruktur, kostet
keinen Function-Slot), #970 darauf reduzieren oder schließen.

### Schritte

```bash
# Handler am Orchestrator registrieren — sonst ist es Bibliothekscode ohne Aufrufer (§14)
$EDITOR src/core/…/orchestrator            # createBrowserAgentHandler registrieren
npm test -- test/core/browser-agent/       # 18 Tests müssen grün bleiben

# PR-Body korrigieren: "#896 merged" / "#889 merged" ist falsch — beide waren geschlossen
gh pr edit 972 --body-file <korrigiert>
gh pr ready 972 && gh pr merge 972 --squash
```

### Gate 1b
`npm test` grün · Handler über den Orchestrator erreichbar · `browser_actions` erhält Einträge.

---

## Stage 2 — Infrastruktur & Hybrid Merge (#932)

**Risiko**: hoch · **Produktionswirkung**: **126 Migrationen auf Produktion** · **Reversibel**: nein

### Vorbedingung: Vault-Secrets

Ohne diese ist der Merge sinnlos — E-Mail-Zustellung und Stripe-Checkout scheitern weiter.

```bash
# via vault-set-secret (deshalb in Stage 0.5 NICHT gelöscht)
# Runbooks: docs/runbooks/stripe-production-checkout.md, resend-production-email.md
#   resend_api_key · stripe_secret_key · stripe_webhook_secret
```

### ⚠️ Der eigentliche Blocker

`deploy.yml` triggert auf Push nach `main` mit Treffer in `supabase/migrations/**` und
führt `supabase db push --include-all` aus — **126 pending Migrationen, ohne menschliches Gate.**

#932 dokumentiert einen zweifachen Audit gegen die Live-DB (das eine `DROP TABLE` ist ein
No-op, 0 `DROP COLUMN`, 0 `ADD COLUMN NOT NULL` ohne Default) und benennt die verbleibende
Lücke selbst: **Spalten-Typ-Drift ungeprüft, `db push --include-all` nicht transaktional
über Migrationen hinweg.** Bricht Migration 87 ab, sind 86 angewendet und es gibt kein PITR.

### Schritte

```bash
# 1. Trockenlauf — nicht optional
supabase db push --dry-run --project-ref ebljyceifhnlzhjfyxup | tee /tmp/dryrun.log
#    Auf DROP, ALTER COLUMN TYPE, NOT NULL ohne Default prüfen.
#    Bei irgendeinem Treffer: STOPP, Stage 2 nicht fortsetzen.

# 2. Backup ziehen (Free-Plan hat kein PITR)
supabase db dump --project-ref ebljyceifhnlzhjfyxup -f backup-pre-932.sql

# 3. Erst dann mergen
gh pr ready 932 && gh pr merge 932 --squash
```

### Gate 2

```bash
supabase migration list --project-ref ebljyceifhnlzhjfyxup   # 0 pending
npm run smoke:production
npm run check:production
```

**Erwartete Rotfärbung, keine Regression**: Der tägliche Drift-Lauf auf `main` geht rot —
die Direction-2-Prüfung schlägt bei Migrationen fehl, die über 7 Tage unangewendet sind.
#932 beschreibt das. Nach erfolgreichem Push sollte sie wieder grün werden; tut sie das
nicht, ist der Push unvollständig.

### Rollback
`backup-pre-932.sql` einspielen. Datenverlust ab Backup-Zeitpunkt. Deshalb Stage 2 in einem
Wartungsfenster fahren, nicht nebenbei.

---

## Stage 3 — Runtime nach Sicherheits-Fix

**Risiko**: hoch · **Vorbedingung**: Stage 0.5 (freier Slot) und Stage 2 abgeschlossen

### #970 — Agent Browser: drei Auflagen

Die Migration ist unkritisch (additiv, RLS aktiviert, korrekt über `is_tenant_member`,
alle FK-Ziele vorhanden). Die Edge Function ist der Blocker:

| # | Befund | Fundstelle | Auflage |
|---|---|---|---|
| 1 | `tenant_id` kommt ungeprüft aus dem Request-Body, Function läuft auf Service-Role, kein `getUser()` → RLS wirkungslos | `supabase/functions/agent-browser/index.ts:195` | JWT prüfen, `tenant_id` serverseitig aus `memberships` ermitteln — Muster von #896 nach Fix übernehmen |
| 2 | `policy_override?: boolean` im Body hebt die Policy-Enforcement auf | ebd. Z. 30 / Z. 218 | ersatzlos entfernen |
| 3 | 1.055 Zeilen Frontend + Executor nirgends importiert, Executor von der Function nicht genutzt | `AgentBrowserMonitor.tsx`, `AgentBrowserPolicyManager.tsx`, `src/lib/agent-browser/executor.ts` | verdrahten oder aus dem PR nehmen (§14) |

### #971 — MCP Control Plane

| # | Befund | Fundstelle | Auflage |
|---|---|---|---|
| 1 | Auth akzeptiert jeden Token mit `rsmcp_`-Präfix, vergibt feste Scopes bei `tenantId: ''`; Server läuft auf Service-Role → RLS wirkungslos | `apps/mcp-server/src/auth/api-key.ts` | DB-gestützte Key-Auflösung mit echtem `tenant_id`; RLS-scoped Client statt Service-Role |
| 2 | Governance-Endpoints liefern Konstanten (`score: 0`) statt DB-Abfragen | `apps/mcp-server/src/tools/governance.ts` | implementieren oder aus dem Router entfernen — ein erfundener Compliance-Score darf nicht ausgeliefert werden |
| 3 | PR-Body behauptet „RLS Enforced" / „Tenant Isolation" | PR-Beschreibung | korrigieren |

**Überschneidung beachten**: #971 und das über #896 zurückkommende `mcp-server-management`
lösen dieselbe Aufgabe. #896 hat die strukturell richtige Auth. **Eine Lösung wählen,
bevor beide auf `main` liegen.**

### Gate 3
Sicherheitsreview durch einen Menschen — kein CI-Check dieses Repos erkennt fehlende
JWT-Prüfung, Service-Role-Missbrauch oder nicht verdrahteten Code.

---

## Stage 4 — Production Release

```bash
npm run check:production
npm run smoke:production
npm run qa:governance
npm run diagnose:domain
```

### Abschluss-Gate

- [ ] `supabase migration list` → 0 pending
- [ ] `supabase functions list` → alle im Repo erwarteten Functions ACTIVE
- [ ] Evidence-Vault-Archive funktioniert (Stage 1)
- [ ] Stripe-Checkout und E-Mail-Zustellung live verifiziert (Stage 2)
- [ ] Keine Function mit Service-Role ohne JWT-Prüfung (Stage 3)
- [ ] `DEBUG_ROOT_CAUSE_2026-08-02.md` und CLAUDE.md §5 auf neue Zahlen aktualisiert

---

## Kennzahlen zum Nachmessen

Diese Werte veralten. Vor jedem Zug neu erheben — nie aus diesem Dokument zitieren.

```bash
supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l   # 2026-08-04: 100 (Cap)
ls supabase/functions | wc -l                                        # 2026-08-04: 173
supabase migration list --project-ref ebljyceifhnlzhjfyxup           # 2026-08-04: 126 pending
gh pr list --state open --json number,title,isDraft,mergeStateStatus
```
