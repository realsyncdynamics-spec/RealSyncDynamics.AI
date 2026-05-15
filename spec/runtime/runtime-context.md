# RCS — Runtime Context Standard

**Version:** 1.0
**Status:** Draft
**Schema:** [`schemas/runtime-context.schema.json`](schemas/runtime-context.schema.json)

The **Runtime Context** is the tenant- and request-scoped envelope that every handler in the runtime receives as its first dependency. It is the single source of truth for "where am I, who am I serving, what regulatory profile am I under?"

Without RCS:

- LLM agents hallucinate tenant attributes ("I assume you're in Germany…").
- Cross-tenant leaks happen because the answer to "whose data am I looking at?" lives in five places and one of them is wrong.
- AI-Act profile drift happens because the same agent runs differently for different tenants and nobody noticed.

RCS makes the context **explicit, immutable per request, and machine-readable**.

---

## 1. The envelope

A handler **MUST** receive an object matching this shape on every invocation, before it touches any tenant data:

```yaml
spec_version: "1.0"

tenant:
  tenant_id:    "tenant_123"              # MUST
  slug:         "acme"                    # MUST
  region:       "eu-central-1"            # MUST — one of the runtime's supported regions
  plan:         "pro"                     # MUST — free | starter | pro | enterprise
  status:       "active"                  # active | trial | suspended

user:                                     # MAY be null for system-triggered runs
  user_id:      "user_abc"
  role:         "owner"                   # owner | admin | member | viewer
  email_hash:   "sha256:..."              # never the email itself

governance:
  gdpr_mode:        "strict"              # strict | standard | minimal
  ai_act_profile:   "annex_iii"           # annex_iii | limited_risk | minimal_risk | excluded
  dpo_present:      true                  # boolean
  retention_default_years: 10

finance:                                  # OPTIONAL — present iff tenant uses finance module
  tax_year:         2026
  ust_cadence:      "quarterly"           # monthly | quarterly | none
  legal_form:       "gmbh"                # einzelunternehmer | gbr | gmbh | ug | ag | other

inventory:                                # OPTIONAL — present iff tenant uses operations module
  unit_system:      "metric"              # metric | imperial
  multi_location:   true

correlation:
  trace_id:     "trace_01HXYZ..."         # MUST — propagated end-to-end
  request_id:   "req_01HABC..."           # MUST — distinct per HTTP / RPC request

issued_at:      "2026-05-15T11:23:04Z"    # MUST — for staleness checks
expires_at:     "2026-05-15T11:33:04Z"    # MUST — typically 10 min after `issued_at`
```

The envelope is **immutable for the lifetime of a single handler invocation**. A handler **MUST NOT** mutate it.

---

## 2. How a handler obtains its context

There are three entry points; in each, the runtime is responsible for materialising the envelope before the handler sees byte one of tenant data.

### 2a. HTTP via Traefik forward-auth

1. Client request hits Traefik.
2. Traefik calls `GET realsync-runtime-core/auth/verify` with the client's session token.
3. `realsync-runtime-core` validates the session and responds **200 OK** with these headers:
   - `X-Tenant-ID: <tenant_uuid>`
   - `X-User-ID: <user_uuid>`
   - `X-User-Role: owner | admin | member | viewer`
4. Traefik appends those headers to the original request and proxies it to the target service.
5. The target service builds the RCS envelope from those headers plus a fresh tenant load.

### 2b. NATS event consumer

1. An event arrives carrying `tenant.tenant_id` per ESS.
2. The consumer **MUST** load the full RCS envelope for that tenant before invoking the agent's handler. It **MUST NOT** infer fields from the event payload.

### 2c. Internal RPC (one core service calls another)

The caller **MUST** propagate `correlation.trace_id` and **MAY** propagate a serialised RCS envelope. The callee **MUST** re-validate the envelope freshness (`expires_at > now()`) and **MUST** reject expired envelopes with `RCS_EXPIRED`.

---

## 3. Region scoping

`tenant.region` is the primary residency control. A handler **MUST**:

- Refuse to invoke an upstream provider whose physical location is outside `tenant.region` unless the call's user has explicitly acknowledged cross-region routing.
- Treat `eu-central-1` and `eu-west-3` as members of the same residency zone (EU); `us-east-1` is a different zone.
- Persist a `policy.evaluated` event whenever a cross-zone call is permitted under explicit user acknowledgement, so the chain shows what was approved.

A runtime that supports only `eu-central-1` at v1.0 **MAY** hard-code the value; it **MUST** still emit it on every envelope so future regions can be added without a breaking change.

---

## 4. `gdpr_mode` semantics

| Mode | Meaning |
|---|---|
| `strict` | No PII outside EU. No third-party LLM unless explicitly EU-located. Aggressive minimisation. Default for `plan in (enterprise, pro)`. |
| `standard` | EU residency preferred but not enforced. Anonymisation on egress. Default for `plan = starter`. |
| `minimal` | Best-effort only. Suitable for evaluation / sandbox tenants. Default for `plan = free`. |

A handler **MUST** read `gdpr_mode` before any outbound LLM call and **MUST** apply the matching policy. Hard-coding a mode in handler logic is a contract violation (ACS §5 requires the field to be declared as `required` if read).

---

## 5. `ai_act_profile` semantics

| Profile | Meaning |
|---|---|
| `annex_iii` | Tenant operates a high-risk AI system per Annex III of Regulation (EU) 2024/1689. Triggers HRP for every decision-equivalent event. |
| `limited_risk` | Tenant operates AI with transparency obligations only (chatbot, deepfake disclosure). |
| `minimal_risk` | Tenant uses AI but the use does not trigger AI Act obligations. |
| `excluded` | Tenant has explicitly opted the system out of AI Act scope (research, defence). Requires legal review at tenant onboarding. |

`ai_act_profile = annex_iii` is binding on every agent invocation: a non-conformant skip of HRP is a P0 incident, not a P1 bug.

---

## 6. Staleness and refresh

Envelopes carry `issued_at` and `expires_at`. A handler **MUST**:

- Reject any envelope where `expires_at < now()`.
- Treat the envelope as immutable until expiry — even if the underlying tenant record changes mid-flight.

If a tenant is suspended while a long-running handler holds an envelope, the handler completes its work under the old envelope but its **emitted events** carry the snapshot at issuance time. The next dispatch loads a fresh envelope and the suspended status is visible.

This snapshotting is intentional: half-aborted state machines are worse than completed ones, even if a tenant has just been suspended.

---

## 7. What RCS does NOT carry

Deliberate non-carriers:

- ❌ **API keys / secrets.** Read via `secret.read.{name}` permission (ACS §3), never embedded.
- ❌ **User PII (name, email, address).** Only `email_hash` for correlation. The handler does not need the cleartext.
- ❌ **Application state.** Per-feature state lives in per-feature tables; RCS is identity + posture only.
- ❌ **Mutable feature flags.** Flags are pushed at deploy time, not envelope time.

A field that "feels like it belongs in the envelope" but isn't here is almost always an attempt to use RCS as a state bag. The answer is no.

---

## 8. Worked example — strict-EU tenant invoice scan

```json
{
  "spec_version": "1.0",
  "tenant": {
    "tenant_id": "ac1d8c4f-3a4f-4e3a-9b1a-3f4c5b6a7d8e",
    "slug": "acme",
    "region": "eu-central-1",
    "plan": "pro",
    "status": "active"
  },
  "user": {
    "user_id": "u_01HXYZ8K9M2NQ5P3R7T6V8WJYC",
    "role": "member",
    "email_hash": "sha256:1d7c4f3a4f4e3a9b1a3f4c5b6a7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d"
  },
  "governance": {
    "gdpr_mode": "strict",
    "ai_act_profile": "annex_iii",
    "dpo_present": true,
    "retention_default_years": 10
  },
  "finance": {
    "tax_year": 2026,
    "ust_cadence": "quarterly",
    "legal_form": "gmbh"
  },
  "correlation": {
    "trace_id": "trace_01HXYZ8K9M2NQ5P3R7T6V8WJYC",
    "request_id": "req_01HXYZ8K9M2NQ5P3R7T6V8WJZD"
  },
  "issued_at": "2026-05-15T11:23:04Z",
  "expires_at": "2026-05-15T11:33:04Z"
}
```

An OCR agent receiving this envelope **MUST**:

- Use an EU-resident OCR provider (because `gdpr_mode = strict`).
- Flag the invoice for HRP if its classification confidence is below the agent's documented threshold (because `ai_act_profile = annex_iii`).
- Persist a `tax_document` evidence record under tax year 2026.

It **MUST NOT**:

- Call a US-resident provider without an explicit user acknowledgement event in the chain.
- Auto-finalise a low-confidence classification (HRP §3 forbids this under Annex III).

---

## 9. Conformance checklist

A handler is RCS-conformant at v1.0 if and only if:

- [ ] It refuses to do work without an envelope.
- [ ] It rejects envelopes where `expires_at < now()` with `RCS_EXPIRED`.
- [ ] It rejects envelopes whose `spec_version` MAJOR differs from its supported set.
- [ ] It does not mutate the envelope during the invocation.
- [ ] It only reads fields declared in its ACS manifest's `runtime_context.{required,optional}`.
- [ ] It applies `governance.gdpr_mode` before any outbound LLM / OCR / external call.
- [ ] It triggers HRP when `governance.ai_act_profile = annex_iii` AND the agent's contract has `compliance.decides = true`.
