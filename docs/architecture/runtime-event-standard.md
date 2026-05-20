# Runtime Event Standard v0

**Status:** Phase 1 (type adoption) · `spec_version='0.1'`
**Owner:** Governance Runtime
**Last updated:** 2026-05-20

Eine gemeinsame Sprache zwischen Scannern, Agenten, Policy Engine, Evidence Engine und Surfaces.

## 1. Warum Runtime Events existieren

Vor diesem Standard sprechen die Subsysteme aneinander vorbei:

- **Scanner** (gdpr-audit, cookie-scanner, ai-endpoint-probe) emittieren ad-hoc-Payloads.
- **Agenten** (Drift, AI-Risk, Evidence, Policy) erwarten je nach Implementation andere Felder.
- **Policy Engine** ruled über lose typisierte Records.
- **Evidence Engine** packt Findings je nach Quelle unterschiedlich.
- **Surfaces** (Audit-Result-View, Triage, /governance/vvt) müssen pro Subsystem eigene Adapter halten.

Resultat: jede neue Datenquelle braucht O(n) neue Mappings. Tests sind nicht teilbar. Drift-Detection ist hart, weil „selbes Ereignis" je nach Quelle anders aussieht.

**RuntimeEvent** ist das gemeinsame Envelope:
- Pflichtfelder (id, spec_version, type, source, severity, actor, payload, review_status, created_at)
- Optionale Tracking-Felder (tenant_id, session_id, correlation_id, causation_id)
- Optionale Evidence-Anker (evidence_refs)

Wer mit RuntimeEvents sprechen kann, ist automatisch mit jedem anderen Subsystem kompatibel.

## 2. Runtime Events vs. Policy Rules vs. Evidence

Drei verwandte aber **unterschiedliche** Konzepte. Verwechslung verursacht 80 % aller Architektur-Diskussionen.

| Konzept | Beantwortet die Frage | Beispiel |
|---|---|---|
| **Runtime Event** | **Was ist passiert?** | „Tracker `googletagmanager.com` lud um 08:14:11 vor Consent." |
| **Policy Rule** | **Was wäre erlaubt?** | „Kein Drittanbieter darf vor expliziter Einwilligung Requests senden." |
| **Evidence** | **Wie beweisen wir das, was passiert ist?** | DOM-Snapshot mit SHA256, Network-HAR, Header-Capture. |

Mapping:
- Ein Event referenziert null oder mehr **Evidence Refs** (für spätere Audit-Beweisbarkeit).
- Eine **Policy Rule** wird gegen einen Strom von Events evaluiert. Match → neues Event vom Typ `policy.violation_detected`.
- **Evidence** wird in einem unveränderlichen Speicher persistiert (Hash-Chain, geplant Evidence Vault). Ihr Referenz-Snapshot (`RuntimeEvidenceRef`) reist mit dem Event.

## 3. Versionierung

`spec_version` ist Pflicht im Envelope und aktuell hartcodiert auf `'0.1'`.

**Konsumenten MÜSSEN die Version prüfen, bevor sie auf Payload-Felder zugreifen.** Wer das nicht tut, kann sich später nicht beschweren.

Regel:

```ts
if (event.spec_version !== '0.1') {
  // log + skip — keine harten Annahmen über payload-Shape
  return;
}
```

Bumps:
- `0.1` → `0.2`: additive Änderungen (neue optionale Felder, neue enum-Werte). Bestehender Code bleibt grün, nutzt neue Felder einfach nicht.
- `1.0`: erste stabile Major-Version. Vor 1.0 keine Backwards-Compat-Versprechen — das ist beabsichtigt, damit wir das Vokabular noch verfeinern können, ohne Drittsysteme zu brechen.

## 4. Keine Reject-Logik in diesem PR

Phase 1 ist absichtlich **passiv**:
- Kein Ingest-Endpoint lehnt Events ab.
- Keine AJV/Zod-Schema-Validierung läuft.
- Kein Surface verlässt sich darauf, dass ein Event syntaktisch perfekt ist.

Das ist gewollt — würden wir sofort strikt validieren, müssten wir alle existierenden Emitter im selben PR migrieren. Stattdessen: Type-Disziplin auf Compile-Time, Verhaltens-Disziplin später.

## 5. Rollout-Plan

| Phase | Was | Status |
|---|---|---|
| **Phase 1 — type adoption** | `RuntimeEvent`-Type + `createRuntimeEvent`-Helper + Doku. Bestehender Code wird **nicht** migriert. Neue Surfaces können den Type sofort verwenden. | **JETZT** |
| **Phase 2 — shadow validation** | Ingest-Endpoint validiert ein **JSON-Schema** (Zod oder AJV) und **loggt** Mismatches, ohne abzulehnen. Erlaubt einen Soak-Test mit echtem Traffic, bevor wir strikt werden. | geplant |
| **Phase 3 — tenant-gated strict** | Ein Feature-Flag `runtime_event_strict` pro Tenant lässt early-adopters in den strikten Modus. Mismatches → 422 mit Rejection-Reason. | geplant |
| **Phase 4 — default rejection** | Strikte Validation für alle Tenants. Schema-Bump-Migrations dokumentieren Breaking Changes. | geplant |

## 6. Was JETZT zu tun ist (für andere Subsysteme)

Wenn dein Modul Events emittiert oder konsumiert:

1. **Emittiert:** Wo möglich `createRuntimeEvent(...)` aus `src/types/runtime-event.ts` verwenden. Falls dein Output noch ein anderes Shape hat, wickel es nicht zwanghaft ein — Phase 2 bringt das Mapping.
2. **Konsumiert:** Falls du gegen einen vorhandenen Adapter (z. B. `src/lib/runtimeMockEvents.ts`) sprichst, lass das so. Beim nächsten Refactor migriere auf `RuntimeEvent<T>`.
3. **Type-Refinement:** Wenn dein Payload eine feste Struktur hat (z. B. tracker.pre_consent_detected hat immer `{vendor_domain, vendor_country}`), exportiere ein konkretes `T`-Interface aus deinem Modul. Konsumenten typisieren dann `RuntimeEvent<TrackerPreConsentPayload>`.

## 7. Referenz-Implementation

- Type-Modul: `src/types/runtime-event.ts`
- Tests: `test/types/runtime-event.test.ts`
- Nicht in diesem PR: `_shared/governanceEvent.ts` (Edge-Function-Schema, getrennt versioniert — Phase-2-Convergence steht aus).

## 8. Nicht-Ziele in v0

- Keine Realtime-Subscription auf `runtime_events` (Datenmodell-Tabelle ist eigene Verantwortlichkeit).
- Keine Cross-Tenant-Event-Aggregation.
- Kein Auto-Retry / Dead-Letter-Queue.
- Keine PII-Scrubbing-Pipeline (separat geplant für Phase-2-Hardening, siehe Phase-2-Reality-Report).
