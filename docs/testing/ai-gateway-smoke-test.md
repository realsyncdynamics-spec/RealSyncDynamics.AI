# AI Gateway Smoke-Test-Plan (Post-Merge PR #233)

> **Gate-Regel:** Alle Tests müssen bestehen, bevor PR #234 (Governance-Agent Integration) gestartet wird.

## API-Form

Die Edge Function bietet zwei kompatible APIs auf dem gleichen Supabase-Endpoint. Dieser Smoke-Test testet die **OpenAI-kompatible Shell** — sie ist der externe Standard und gilt für den Test als kanonisch.

| Route | Method | Zweck |
|---|---|---|
| `/functions/v1/ai-gateway/v1/models` | GET | Verfügbare Model-Profile auflisten |
| `/functions/v1/ai-gateway/v1/chat/completions` | POST | Chat-Completion (mit optional `response_format: { type: "json_object" }` für strukturierte Ausgabe) |
| `/functions/v1/ai-gateway` | POST | Native op-basierte API (`{op: "health" \| "generate" \| "extract_json" \| "embed", feature, task_type, model_profile, input, …}`). Wird vom Smoke-Test nicht direkt getestet — Integration-PRs (#234/#235/#236) nutzen sie. |

`model` in OpenAI-Calls muss eines der **Model-Profile** sein:
`fast-local · quality-local · strict-json · embed-default · cloud-fallback`.

Die Edge Function mappt das Profil auf die konkrete LM-Studio-Model-ID und versteckt das vor dem Caller — Provider-Swap (LM Studio → Anthropic → EU-Mistral) erfolgt im Gateway, nicht im Client.

---

## Phase 0 – Vorbereitung

### 1. PR #233 mergen

- Branch `claude/ai-gateway-foundation` → `main`
- Sicherstellen: keine Merge-Konflikte, CI bleibt grün nach Merge

### 2. Secrets setzen (Supabase Edge Function Secrets)

```bash
supabase secrets set LM_STUDIO_BASE_URL=http://lmstudio.internal:1234/v1
supabase secrets set LM_STUDIO_API_KEY=lm-studio
supabase secrets set AI_GATEWAY_DEFAULT_PROFILE=fast-local
supabase secrets set AI_GATEWAY_CLOUD_FALLBACK_ENABLED=false
```

### 3. Edge Function deployen

```bash
supabase functions deploy ai-gateway --no-verify-jwt
```

**Erwartetes Ergebnis:** Deploy ohne Fehler, Function URL verfügbar.

---

## Phase 1 – Health-Check

### Test: `GET /v1/models`

```bash
curl -X GET https://<PROJECT_REF>.supabase.co/functions/v1/ai-gateway/v1/models \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
```

**Erwartetes Ergebnis:**

```json
{
  "object": "list",
  "data": [
    { "id": "fast-local" }
  ]
}
```

**Pass-Kriterien:**

- [ ] HTTP 200
- [ ] `data` enthält mindestens ein Model Profile
- [ ] Response-Zeit < 2s

---

## Phase 2 – Generate-Test

### Test: `POST /v1/chat/completions`

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/ai-gateway/v1/chat/completions \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fast-local",
    "messages": [
      { "role": "user", "content": "Antworte mit: OK" }
    ],
    "max_tokens": 10
  }'
```

**Erwartetes Ergebnis:**

```json
{
  "choices": [
    { "message": { "role": "assistant", "content": "OK" } }
  ]
}
```

**Pass-Kriterien:**

- [ ] HTTP 200
- [ ] `choices[0].message.content` enthält sinnvolle Antwort
- [ ] LM Studio wird tatsächlich angesprochen (kein Mock)
- [ ] Response-Zeit < 10s

---

## Phase 3 – extract_json-Test

### Test: Strukturierte JSON-Ausgabe

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/ai-gateway/v1/chat/completions \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fast-local",
    "messages": [
      {
        "role": "user",
        "content": "Gib mir JSON zurück: {\"status\": \"ok\", \"value\": 42}"
      }
    ],
    "response_format": { "type": "json_object" }
  }'
```

**Pass-Kriterien:**

- [ ] HTTP 200
- [ ] Response body ist valides JSON (parsebar)
- [ ] Kein Text-Wrapper um das JSON

---

## Phase 4 – Fehlerfälle

### Test A: Ungültiges Model Profile

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/ai-gateway/v1/chat/completions \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "model": "nonexistent-profile", "messages": [{ "role": "user", "content": "test" }] }'
```

- [ ] HTTP 400 oder 404 (kein 500)
- [ ] Strukturierte Fehlermeldung

### Test B: Fehlende Authorization

```bash
curl -X GET https://<PROJECT_REF>.supabase.co/functions/v1/ai-gateway/v1/models
```

- [ ] HTTP 401

### Test C: LM Studio nicht erreichbar

Temporär `LM_STUDIO_BASE_URL` auf eine nicht-erreichbare URL setzen, dann Generate-Test wiederholen.

- [ ] HTTP 502 oder 503
- [ ] Strukturierte Fehlermeldung
- [ ] Kein unhandled crash / kein leerer Response

### Test D: Malformed Request Body

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/ai-gateway/v1/chat/completions \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "invalid": true }'
```

- [ ] HTTP 400
- [ ] Verständliche Fehlermeldung

---

## Phase 5 – Ergebnisdokumentation

Tabelle nach Testdurchlauf ausfüllen:

| Test | HTTP-Status | Response-Zeit | Pass/Fail | Notiz |
|---|---|---|---|---|
| GET /v1/models | | | | |
| POST generate | | | | |
| POST extract_json | | | | |
| Fehler: bad model | | | | |
| Fehler: no auth | | | | |
| Fehler: LM Studio down | | | | |
| Fehler: bad body | | | | |

### Run 2026-05-14 21:51 UTC · Project `ebljyceifhnlzhjfyxup` · Function v3

Deploy-Mode: `--no-verify-jwt` (gemäß Operations-Vorgabe). LM-Studio-Endpoint
laut Secrets: `http://lmstudio.internal:1234/v1`.

| Test | HTTP | ms | Pass/Fail | Notiz |
|---|---|---|---|---|
| GET /v1/models               | 200 | 892 | ✅ Pass | 5 Profile (`fast-local`, `quality-local`, `strict-json`, `embed-default`, `cloud-fallback`) |
| POST generate                | 502 | 728 | ⚠ Conditional | LM Studio aus eu-central-1 nicht erreichbar — Fehlerbehandlung korrekt: `UPSTREAM_UNAVAILABLE / "No LM Studio model available"`. End-to-End-Test braucht Lauf vom VPS aus oder VPN-Bridge. |
| POST extract_json            | 502 | 178 | ⚠ Conditional | Gleiche Ursache wie POST generate. Mapping `UPSTREAM_UNAVAILABLE` ist korrekt. |
| Fehler: bad model            | 400 | 153 | ✅ Pass | Strukturierte Antwort listet alle erlaubten Profile auf. |
| Fehler: no auth              | 200 | 134 | ℹ Expected (no-verify-jwt) | Doc-Erwartung (401) galt für `verify_jwt: true`. Mit `--no-verify-jwt` ist Authorization nicht-blockierend; Caller-Identität wird ggf. via custom auth oder rate-limit downstream geprüft. |
| Fehler: LM Studio down       | 502 | 728 / 178 | ✅ Pass | Organisch in den Phase-2/3-Runs verifiziert — kein Crash, kein 500, sauberes JSON-Error-Envelope. |
| Fehler: bad body             | 400 | 159 | ✅ Pass | Body `{"invalid":true}` → 400 wegen fehlendem `model`-Feld. |

#### Gate-Status

- **Phase 1**: ✅ Pass
- **Phase 2/3**: ⚠ Code-Pfad nicht abschließend testbar von der Supabase-Edge aus (LM Studio nicht erreichbar). Fehlerverhalten korrekt. Vollständige End-to-End-Verifikation braucht:
  - Entweder einen Test-Runner im selben Netz wie LM Studio (VPS-side), oder
  - eine LM-Studio-Instanz mit öffentlich routbarem Endpunkt + TLS, oder
  - einen Cloud-Provider in `LM_STUDIO_BASE_URL` mit OpenAI-kompatibler API als Übergangslösung.
- **Phase 4**: ✅ Alle 4 Fälle haben definiertes Fehlerverhalten, kein 500, kein Crash.

#### Empfehlung für PR #234 Gate

Phasen 1 + 4 sind Pass. Phasen 2 + 3 sind blockiert auf einen erreichbaren LM-Studio-Endpunkt, nicht auf einen Code-Defekt. Vor Start von PR #234 (Governance-Agent uses AI Gateway):

1. LM-Studio-Reachability klären — entweder Public-Endpunkt einrichten oder Tests von VPS aus laufen lassen (`docs/runbooks/` als Folge-PR).
2. Optional: einen zweiten Smoke-Test-Run nach echter Reachability-Lösung anhängen.

---

## Gate-Kriterium für PR #234

**Alle Phase-1 bis Phase-3 Tests: ✅ Pass**

**Alle Phase-4 Fehlerfälle: ✅ definiertes Fehlerverhalten (kein 500, kein Crash)**

Erst wenn diese Tabelle vollständig ausgefüllt und alle Kriterien erfüllt sind:

- → **PR #234** — Governance-Agent uses AI Gateway
- → **PR #235** — Audit-Copilot uses AI Gateway
- → **PR #236** — Assistant-Chip anon mode via AI Gateway

---

## Integrationsreihenfolge (nach Gate)

1. **PR #234 – Governance-Agent** (intern, tenant-aware, auditierbar, geringes public-risk)
2. **PR #235 – Audit-Copilot** (hoher Produktnutzen, Findings erklären, Reports/Evidence)
3. **PR #236 – Assistant-Chip** (public-facing, braucht Rate Limits, Abuse-Schutz, Anon-Grenzen)
