# GOVARD Gateway

Governance-/Evidence-Schicht **vor** austauschbaren KI-Agenten. Govard baut
keine besseren Agenten als OpenAI, n8n oder ein Agent-Framework — Govard
beantwortet die Frage, die keiner von ihnen beantwortet:

> „Darf diese KI-Aktion stattfinden — und lässt sich sechs Monate später
> beweisen, was entschieden, ausgeführt und warum es erlaubt oder blockiert
> wurde?"

> ⚖️ Die regulatorische Einordnung (EU AI Act Art. 12/26, Aufzeichnungs-
> pflichten) wird vor Go-live juristisch anhand des dann geltenden Texts
> verifiziert. Technisch ist das System so gebaut, dass diese Nachweis-
> führung möglich ist — versionierte Policies, gebundene Freigaben,
> hash-verkettete Evidence.

## Architektur

```
EXTERNAL AGENTS (n8n · OpenAI · Claude · Zapier · Custom)
        │
        ▼
POST /api/command ──► Policy Engine (deny by default)
        │                 ALLOW │ DENY │ APPROVAL
        ▼
Command State Machine (zentrale Übergangstabelle)
        │
   PENDING_APPROVAL ──► Approval Inbox/API ──► Freigabe startet
        │                                      serverseitige Ausführung
     APPROVED ──► Executor (v1: Referenz; nächster Schritt: CF Workflows)
        │
        ▼
Evidence Sequencer (Durable Object pro Org, Input-Gate serialisiert)
        │
   Immutable Hash-Chain ──► D1-Projektion (abfragbar) + tägliches R2-Siegel
```

Kernentscheidungen (die vier Korrekturen):

1. **Evidence Sequencer als Durable Object** — eine Instanz pro Org ist die
   *einzige* Stelle, die die Chain fortschreibt. Keine globale Chain über
   konkurrierende D1-Writes; D1 ist nur die abfragbare Projektion
   (idempotent, per Alarm nachgeholt). `GET /api/evidence/verify` rechnet
   jede Position ab GENESIS nach und benennt im Fehlerfall die exakte
   Sequenznummer.
2. **Policy Engine mit vollständigem Evaluation Result** — jede aktive
   Policy-Version erscheint als PASS / VIOLATION / NOT_APPLICABLE im
   Ergebnis; das ist Governance-Evidence, nicht Logging. Deny by default:
   leeres Policy-Set → DENY, unbekannter Regeltyp → VIOLATION, unprüfbare
   Angaben (fremde Währung, unbekannte Zeitzone) → VIOLATION.
3. **Command State Machine** — Übergänge zentral (`TRANSITIONS`), in der DB
   per optimistischer Nebenläufigkeit erzwungen (`WHERE state = ?`).
   `RECEIVED → EXECUTED` ohne Evaluation existiert nicht.
4. **Approval Resume** — die Freigabe beansprucht die Approval-Zeile atomar,
   prüft die Bindung (`evaluation_hash` der Freigabe == `evaluation_hash`
   des Commands) und startet erst dann die serverseitige Ausführung. Nie
   der Browser.

Dazu: **Idempotenz** (Pflicht-Header `Idempotency-Key`, Key wird *vor* der
Verarbeitung reserviert — kein doppelter Command, keine doppelte Kampagne)
und **Multi-Tenancy per Konstruktion** (`OrgRepository`: jede Query
org-gebunden; D1 hat kein RLS, deshalb lebt die Trennung auf
Repository-Ebene — kein roher `env.DB`-Zugriff außerhalb, benannte
Ausnahmen: `auth.ts`, Sequencer-Projektion).

## API

Alle Endpunkte außer `/health` verlangen `Authorization: Bearer <api-key>`.
Rollen: `agent` (Commands einreichen/lesen) < `approver` (+ Inbox,
Entscheidungen, Verify) < `admin` (+ Policies, Seal).

| Methode | Pfad | Rolle | Zweck |
|---|---|---|---|
| POST | `/api/command` | agent | Command einreichen (Header `Idempotency-Key` Pflicht) |
| GET | `/api/command/:id` | agent | Command + Übergänge + Evidence |
| GET | `/api/approvals` | approver | Approval Inbox (offene Freigaben) |
| POST | `/api/approvals/:id/approve` | approver | Freigeben → startet Ausführung |
| POST | `/api/approvals/:id/deny` | approver | Ablehnen (`{ "reason": "…" }` optional) |
| GET | `/api/policies` | approver | Policies mit aktueller Version |
| POST | `/api/policies` | admin | Policy anlegen / neue Version (append-only) |
| GET | `/api/evidence/head` | agent | Aktueller Chain-Head |
| GET | `/api/evidence/verify` | approver | Chain ab GENESIS nachrechnen |
| POST | `/api/evidence/seal` | admin | Head sofort nach R2 siegeln |

```bash
curl -X POST https://govard-gateway.<account>.workers.dev/api/command \
  -H "Authorization: Bearer $GOVARD_KEY" \
  -H "Idempotency-Key: 7c2d9c8a-kampagne-42" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "n8n",
    "intent": "send_campaign",
    "payload": {
      "recipients": ["a@kunde.de"],
      "recipient_count": 4200,
      "budget": { "value": 500, "currency": "EUR" }
    }
  }'
# → { "commandId": "…", "state": "PENDING_APPROVAL", "decision": "APPROVAL",
#     "evaluation": { "policy_set_size": 17, "passed": 14, "not_applicable": 1,
#                     "violations": [ … ] } }
```

Payload-Konventionen für Regeln: `budget: { value, currency }`,
`recipients: string[]` (E-Mail-Adressen), `recipient_count: number`.
Regeltypen: `ALLOWED_INTENTS`, `MAX_BUDGET`, `MAX_RECIPIENTS`,
`REQUIRE_APPROVAL_FOR_INTENT`, `ALLOWED_RECIPIENT_DOMAINS`, `TIME_WINDOW`.

## Provisionierung

```bash
cd workers/govard-gateway

# 1. D1-Datenbank anlegen, database_id in wrangler.jsonc eintragen
npx wrangler d1 create govard-gateway

# 2. R2-Bucket für die Siegel
npx wrangler r2 bucket create govard-evidence-seals

# 3. Schema einspielen
npx wrangler d1 migrations apply govard-gateway --remote --config wrangler.jsonc

# 4. Erste Org + Admin-Key seeden (Key nur als Hash speichern!)
KEY=$(openssl rand -hex 32)
HASH=$(printf '%s' "$KEY" | sha256sum | cut -d' ' -f1)
npx wrangler d1 execute govard-gateway --remote --command "
  INSERT INTO orgs (id, name, created_at)
    VALUES ('org-demo', 'Demo Org', datetime('now'));
  INSERT INTO api_keys (id, org_id, actor_id, name, role, key_hash, enabled, created_at)
    VALUES ('key-1', 'org-demo', 'owner', 'bootstrap-admin', 'admin', '$HASH', 1, datetime('now'));
"
echo "API-Key (einmalig notieren): $KEY"

# 5. Deploy (oder automatisch via .github/workflows/deploy-govard-gateway.yml)
npx wrangler deploy --config wrangler.jsonc
```

Der Deploy-Workflow überspringt sich selbst, solange in `wrangler.jsonc`
der D1-Platzhalter steht (gleiches Guard-Muster wie `siteos-preview`).

## Was v1 bewusst NICHT ist

- **Kein Agent-Hub.** Es gibt keinen Marketing-/Finance-/Sales-Agenten im
  Gateway. Der Executor ist ein Referenz-„echo", der die Kette
  APPROVED → EXECUTING → EXECUTED Ende-zu-Ende beweist. Externe Agenten
  sind austauschbare Consumer *hinter* der Governance-Schicht.
- **Noch keine Cloudflare Workflows.** Der nächste Ausbauschritt ersetzt
  `executor.ts` durch eine Workflow-Definition (durable, Retries bei
  transienten Fehlern). Zustandsübergänge und Evidence-Events bleiben
  identisch — genau deshalb ist der Executor jetzt schon eine eigene Datei.
- **Noch keine externe Verankerung der Siegel.** `evidence_seals.anchor_ref`
  ist der Haken für die bestehende CreatorSeal-Verankerung.

## Entwicklung

```bash
npx tsc --noEmit -p workers/govard-gateway/tsconfig.json   # Typecheck
npm test -- test/govard/                                   # Pure-Logic-Tests (Root)
npx wrangler dev --config workers/govard-gateway/wrangler.jsonc
```

Dieses Verzeichnis ist wie `workers/siteos-preview` eigenständig: eigenes
`tsconfig`, keine Root-Dependencies, vom Root-`tsc` ausgenommen. Die reine
Logik (Hash, State Machine, Policy Engine) wird über `test/govard/` im
Root-Vitest mitgetestet.
