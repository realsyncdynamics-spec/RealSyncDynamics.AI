# ai-risk-agent — Goldset & Evaluation

Qualitätssicherung für den `ai-risk-agent`. Ohne diese Eval ist die
Klassifikation des Agents nicht messbar — und damit sind die
Compliance-Claims der Plattform nicht verteidigbar.

> **Stand 2026-05-18:** Migration + Goldset + Eval-Skript + CI-Workflow
> + Edge Function liegen im Repo. Klassifikator ist **Anthropic
> Haiku 4.5 mit Tool-Use** (siehe `supabase/functions/ai-risk/classifier.ts`).
> Entgegen der ursprünglichen Rule-Based-Vereinbarung wurde direkt auf
> LLM-Variante gegangen — die fünf Production-Review-Punkte
> (Tool-Name-Check, `reasons`-Validierung, AbortError-Mapping,
> Healthcheck-Shortcut, getrennte Deno-Tasks) sind eingebaut.
> ADR-003 zur LLM-Wahl + Bedrock-Migrationspfad ist Folge-PR.

## Warum das existiert

Ab dem Growth-Tier (€179/Monat) erwartet der Kunde produktions-taugliche
Klassifikation. Eine falsche Risiko-Klassifikation eines AI-Systems ist:

- **Bei False Positive (z. B. minimal → high):** Kunde wird zu unnötigen
  Konformitätsverfahren gedrängt. Vertrauensverlust, Churn.
- **Bei False Negative (z. B. high → minimal):** Kunde betreibt
  hochrisiko-AI ohne EU-AI-Act-Konformität. Bußgeld bis €35M oder 7%
  Welt-Jahresumsatz nach Art. 99. Haftungsrisiko für RealSync.
- **Bei False Negative (prohibited → irgendetwas anderes):** Kunde
  betreibt verbotene AI weiter. Existenzielle Haftung.

Deshalb sind die Schwellen für `high` und `prohibited` strikter als für
`minimal` und `limited`.

## Dateien

| Datei | Zweck |
|---|---|
| `supabase/migrations/20260602000000_ai_risk_goldset.sql` | Schema + 30 Seed-Einträge |
| `scripts/eval-ai-risk-agent.ts` | Eval-Runner (Node + tsx) |
| `.github/workflows/risk-agent-eval.yml` | CI-Integration |

## Akzeptanz-Schwellen (Release-Blocker)

| Metrik | Schwelle | Begründung |
|---|---|---|
| Accuracy (gesamt) | >= 80% | Basis-Qualitätsschwelle |
| F1 (`high`) | >= 0.85 | High-Risk-Fehlklassifikation = Haftungsrisiko |
| F1 (`prohibited`) | >= 0.90 | Verbotene Systeme dürfen nicht durchrutschen |
| FP-Rate (`prohibited`) | <= 5% | Falsche Verbots-Klassifikation = Kunden-Churn |
| FN-Rate (`high`) | <= 10% | High-Risk muss erkannt werden |

Unterschreitet ein Eval-Run **eine** dieser Schwellen, blockiert der
GitHub-Action-Workflow den Merge nach `main`.

## Goldset-Verteilung (Initial)

| Tier | Anzahl | Quelle |
|---|---|---|
| minimal | 10 | EU AI Act Recital 53, klassische Spam/Game/Routing-Fälle |
| limited | 10 | EU AI Act Art. 50 — Chatbots, Synthetic Content, Biometrie |
| high | 8 | EU AI Act Annex III — HR, Credit, Education, Law Enforcement, Insurance |
| prohibited | 2 | EU AI Act Art. 5 — Real-time RBI, Social Scoring |

**Wachstumsplan:** Goldset auf 60 Einträge ausbauen vor dem ersten
Enterprise-Vertrag (15 pro Tier). Quellen: reale Kunden-Fälle
(anonymisiert, mit Reviewer-Approval), Annex-III-Subkategorien einzeln
durchgehen.

## Setup

### 1. Migration einspielen

```bash
# Lokal gegen Supabase-Dev:
supabase db push

# Oder direkt gegen Produktion:
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260602000000_ai_risk_goldset.sql
```

### 2. GitHub-Secrets setzen

In Settings → Secrets and variables → Actions des Repos
`realsyncdynamics-spec/RealSyncDynamics.AI`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (Service-Role, nicht Anon)
- `AI_RISK_AGENT_URL` (Form: `https://<project>.supabase.co/functions/v1/ai-risk`)
- `AI_RISK_AGENT_TOKEN` (selbst generiert, z. B. `openssl rand -hex 32`;
  derselbe Wert auch in Supabase Function-Secrets)

Zusätzlich als **Supabase Function-Secrets** (nicht GitHub-Secrets):

- `ANTHROPIC_API_KEY` — Anthropic-API-Key mit Zugriff auf Haiku 4.5
- `AI_RISK_AGENT_TOKEN` — derselbe Wert wie oben

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set AI_RISK_AGENT_TOKEN=$(openssl rand -hex 32)
supabase functions deploy ai-risk --no-verify-jwt
```

`--no-verify-jwt` ist beim Deploy nicht zwingend, weil `supabase/config.toml`
bereits `verify_jwt = false` für `[functions.ai-risk]` gesetzt hat.

### 3. Lokal ausführen

```bash
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_KEY=eyJ...
export AI_RISK_AGENT_URL=https://xxx.supabase.co/functions/v1/ai-risk
export AI_RISK_AGENT_TOKEN=...
export AGENT_VERSION=local-dev
npx tsx scripts/eval-ai-risk-agent.ts
```

Exit-Codes:
- `0` — passed
- `1` — failed (Schwellen verletzt — Release blockieren)
- `2` — error (Infrastruktur — Setup prüfen)

## Erwartete Agent-API

Der `ai-risk-agent` ist heute noch nicht implementiert. Geplante
Adresse: Supabase Edge Function unter
`https://<project>.supabase.co/functions/v1/ai-risk`.

Die SPA läuft auf GitHub Pages und hat keine `/api`-Routes — die
Variante "POST `https://realsyncdynamicsai.de/api/agents/ai-risk`" ist
nicht erreichbar. Edge-Function-Variante ist der korrekte Pfad.

**Request:**
```http
POST /functions/v1/ai-risk
Authorization: Bearer <token>
Content-Type: application/json

{
  "payload": {
    "system_name": "...",
    "purpose": "...",
    "data_types": [...],
    "automation_level": "...",
    "human_oversight": "...",
    "sector": "...",
    "decisions_affect_persons": true,
    "context": "..."
  }
}
```

**Response:**
```json
{
  "risk_tier": "high",
  "reasons": ["annex_iii_4a_employment", "..."],
  "raw": { "...optional internal trace..." }
}
```

`risk_tier` muss exakt einer von `minimal | limited | high | prohibited` sein.

## Review-Kadenz

- **Bei jedem PR auf `main`** mit Touch an `supabase/functions/ai-risk/**`
  oder `scripts/eval-ai-risk-agent.ts` oder der Migration → automatisch.
- **Nightly um 02:30 UTC** → fängt Regression durch externe Modell-Updates.
- **Quartalsweise** → Goldset-Review: neue Einträge aus Kunden-Cases ergänzen,
  veraltete deaktivieren (`is_active = false`), Schwellen evaluieren.

## Bewusste Abweichungen vom Repo-Standard

- **Keine `tenant_id`-Spalte** auf den drei neuen Tabellen — interne
  QA-Daten ohne Kundenbezug. RLS schränkt deshalb auf `service_role` ein
  statt auf `is_tenant_member()`.
- **Migration-Filename** folgt der `YYYYMMDDHHMMSS_name.sql`-Konvention
  (`20260602000000`), liegt nach `20260601100000_ai_governance_rls_policies.sql`.

## Owner

Dominik Steiner — bis Hire eines Quality/ML-Engineers.

Bei jedem failed Run: Issue im Repo
`realsyncdynamics-spec/RealSyncDynamics.AI` mit Label `agent-regression`
automatisch erstellen (TODO: in Workflow ergänzen, sobald GitHub-Token
mit `issues:write` Scope verfügbar ist).
