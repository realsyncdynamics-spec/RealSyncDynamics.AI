# ai-risk-agent — Baseline-Deploy Klick-Checkliste

**Ziel:** Vom heutigen Commit `0299ddc` zum ersten gemessenen Eval-Baseline-Run, mit so wenig manuellem Tippen wie möglich. Vier Schritte. Drei Klicks. Eine Skript-Ausführung.

---

## Schritt 1 — Anthropic API Key besorgen

→ **[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)**

In der Anthropic-Konsole: `Create Key` → einen Namen wie `realsync-ai-risk-prod` → kopieren.

Der Key beginnt mit `sk-ant-`. Im nächsten Schritt verdeckt einfügen, nirgendwo speichern.

---

## Schritt 2 — Bootstrap-Script laufen lassen

```bash
bash scripts/deploy-ai-risk.sh
```

Was das Script macht (in dieser Reihenfolge):

1. Voraussetzungen prüfen (`supabase`, `openssl`, `jq`, `curl`)
2. **Save-Feld für den Anthropic-Key** — `read -s`, kein Echo, nicht auf Disk
3. `AI_RISK_AGENT_TOKEN` selbst erzeugen (`openssl rand -hex 32`)
4. Beide Werte als Supabase-Function-Secrets setzen (`supabase secrets set`)
5. Migrations pushen (`supabase db push`)
6. Edge Function deployen (`supabase functions deploy ai-risk`)
7. **Smoke-Test 1** — Healthcheck ohne Anthropic-Cost
8. **Smoke-Test 2** — High-Risk-Sample mit echtem Anthropic-Call
9. Die vier GitHub-Repo-Secret-Werte zum Copy-Paste ausdrucken

Dauer: ~30 Sekunden für die ersten 6 Schritte, plus ~3 Sekunden Smoke-Tests.

**Bei Fehler:** Script bricht mit klarer Fehlermeldung ab. Output an mich, wir debuggen.

---

## Schritt 3 — GitHub Repo Secrets eintragen

→ **[Repo-Settings → Secrets and variables → Actions → New repository secret](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/settings/secrets/actions/new)**

Vier Secrets. Die genauen Werte druckt das Script am Ende aus:

| Name | Quelle |
|---|---|
| `SUPABASE_URL` | Script-Output, z. B. `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | **[Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/_/settings/api)** → `service_role` (NICHT der anon key) |
| `AI_RISK_AGENT_URL` | Script-Output, z. B. `https://<ref>.supabase.co/functions/v1/ai-risk` |
| `AI_RISK_AGENT_TOKEN` | Script-Output, der frisch erzeugte 64-hex-char Token |

Reihenfolge spielt keine Rolle. Jeweils auf den Klick-Link oben, `New repository secret`, Name + Wert eintragen, `Add secret`.

---

## Schritt 4 — Workflow triggern

→ **[Actions → ai-risk-agent-eval → Run workflow](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/workflows/risk-agent-eval.yml)**

- Branch: `claude/review-project-status-umBWS` wählen
- `Run workflow` klicken

Dauer: ~2–3 Minuten für 30 Goldset-Cases.

Ergebnis erscheint als rollendes Kommentar auf [PR #331](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/331) plus 90-Tage-Artifact am Action-Run.

---

## Was danach kommt

Sobald der Baseline-Report da ist, schickst Du ihn mir (PR-Kommentar oder Artifact-Link). Wir gehen gemeinsam:

1. **Confusion Matrix lesen** — wo sind die Fehlklassifikationen?
2. **Misklassifizierte Cases manuell prüfen** — `agent_raw_output` zeigt das _Warum_. Bei n=30 sind das ~10 Minuten.
3. **Diagnose**: Prompt-Lücke, Goldset-Fehl-Label, oder AI-Act-Interpretation-Konflikt.
4. **Aktion**: Goldset ausbauen (häufigster Fall), Prompt-Disambiguierung (zweithäufigster), oder Tier-Verteilung anpassen.

CLAUDE.md §6 Hard Rule #1 bleibt in Kraft: **keine Prompt-Optimierung vor der ersten stabilen Baseline.** „Stabil" heißt drei aufeinanderfolgende Runs mit `passed`-Status — also: ein einzelner roter Lauf rechtfertigt noch keinen Tuning-Versuch.

---

## Fallback: alles manuell

Falls das Script bei Dir nicht läuft (z. B. weil `supabase` lokal nicht eingeloggt ist und Du es lieber per Dashboard machst), liegt jeder Einzelschritt mit Klick-Link in `docs/qa/ai-risk-eval.md` Setup-Sektion.
