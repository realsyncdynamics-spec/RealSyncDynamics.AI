# RFC-002 — Subject Reference Lifecycle (§13)

**Status:** Draft
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:** [`runtime-kernel-rfc.md`](./runtime-kernel-rfc.md) §P2,
[SPEC-001 Migration](../../supabase/migrations/20260602000000_runtime_events_backbone.sql)
**Scope:** Datenstrukturen, SQL für Rotation/Deletion, Audit-Trigger,
Compliance-Mapping. Kein Code-Change in dieser RFC; die Implementierung
folgt als eigene Migration `{TIMESTAMP}_subject_ref_lifecycle.sql`.

---

## §13.0 Was diese RFC liefert

Die §P2 des Kernel-RFCs hat den Scope umrissen. Diese RFC macht ihn
**abschlussreif**: jede Entscheidung hat eine Datenstruktur, einen
SQL-Lebenszyklus, eine Audit-Spur und eine DSGVO/AI-Act-Zuordnung.

Phase-2-Reihenfolge der Lieferartefakte:

| Sub-§ | Liefergegenstand | Form |
|---|---|---|
| §13.1 | HMAC Identity Structure | DDL + Helper-Funktion |
| §13.2 | Key Rotation Policy | DDL + RPC + Cron-Anweisung |
| §13.3 | Deletion Semantics | DDL-Spalten + RPC + Trigger |
| §13.4 | Export Behavior (DSGVO Art. 20) | View + Edge-Function-Vertrag |
| §13.5 | Incident Correlation | Query-Pattern + Index-Begründung |
| §13.6 | RLS × subject_ref Interaction | Policy-Beweis + Negativtests |
| §13.7 | Compliance Mapping | DSGVO/AI-Act-Tabelle |

---

## §13.1 HMAC Identity Structure

### Modell

Ein `subject_ref` ist **tenant-skopiertes, deterministisches HMAC-SHA-256**
über ein kanonisches Identitäts-Tupel:

```
subject_ref = hex( HMAC-SHA-256(
    key       = tenant_key( tenant_id, key_version ),
    message   = canonical_identifier
) )

canonical_identifier =
    subject_kind + '\x1f' + lower(trim(value))
```

Eigenschaften:

- **Replay-stabil:** identischer Klartext → identischer `subject_ref`,
  solange der Key dieselbe Version hat.
- **Deterministisch:** keine Salts pro Event — Korrelation über Events
  desselben Subjects möglich.
- **Keine Cross-Tenant-Korrelation:** verschiedene Tenants nutzen
  verschiedene Keys → identischer Klartext ergibt verschiedene Refs.
- **DSGVO-freundlich:** ohne den Key ist `subject_ref` praktisch
  unumkehrbar. Löschung des Keys ⇒ kryptografische Auslöschung (§13.3).

### Datenstrukturen

```sql
-- Aktive HMAC-Keys pro Tenant. Material liegt im Supabase Vault;
-- diese Tabelle hält nur die Lifecycle-Metadaten.
CREATE TABLE IF NOT EXISTS public.subject_ref_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_version         INT  NOT NULL,
    algorithm           TEXT NOT NULL DEFAULT 'HMAC-SHA-256'
                          CHECK (algorithm = 'HMAC-SHA-256'),
    vault_secret_name   TEXT NOT NULL,
    status              TEXT NOT NULL
                          CHECK (status IN ('active','rotating','retired','destroyed')),
    activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    retiring_at         TIMESTAMPTZ,
    retired_at          TIMESTAMPTZ,
    destroyed_at        TIMESTAMPTZ,
    UNIQUE (tenant_id, key_version)
);

CREATE INDEX IF NOT EXISTS subject_ref_keys_active_idx
    ON public.subject_ref_keys (tenant_id, status, key_version DESC);

-- Optionales explizites Reverse-Mapping (verschlüsselt) — nur für DSR.
CREATE TABLE IF NOT EXISTS public.subject_ref_mappings (
    subject_ref            TEXT PRIMARY KEY,
    tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_version            INT  NOT NULL,
    subject_kind           TEXT NOT NULL
                              CHECK (subject_kind IN ('email','ip','user_id','session','device')),
    encrypted_value        BYTEA,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_class        TEXT NOT NULL DEFAULT '3y'
                              CHECK (retention_class IN
                                ('forever','7y','3y','1y','90d','30d','7d')),
    deletion_requested_at  TIMESTAMPTZ,
    erased_at              TIMESTAMPTZ,
    FOREIGN KEY (tenant_id, key_version)
        REFERENCES public.subject_ref_keys (tenant_id, key_version)
);

CREATE INDEX IF NOT EXISTS subject_ref_mappings_tenant_kind_idx
    ON public.subject_ref_mappings (tenant_id, subject_kind);
CREATE INDEX IF NOT EXISTS subject_ref_mappings_pending_erase_idx
    ON public.subject_ref_mappings (deletion_requested_at)
    WHERE erased_at IS NULL AND deletion_requested_at IS NOT NULL;

ALTER TABLE public.subject_ref_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_ref_mappings  ENABLE ROW LEVEL SECURITY;

-- Default-deny — Zugriff exklusiv über service-role / DSR-RPC.
DROP POLICY IF EXISTS "subject_ref_keys service-role only" ON public.subject_ref_keys;
CREATE POLICY "subject_ref_keys service-role only"
    ON public.subject_ref_keys FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "subject_ref_mappings service-role only" ON public.subject_ref_mappings;
CREATE POLICY "subject_ref_mappings service-role only"
    ON public.subject_ref_mappings FOR ALL USING (false) WITH CHECK (false);
```

### Compute-Helper

```sql
CREATE OR REPLACE FUNCTION public.subject_ref_compute(
    p_tenant_id     UUID,
    p_subject_kind  TEXT,
    p_value         TEXT,
    p_key_version   INT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_key_version INT;
    v_secret_name TEXT;
    v_key         BYTEA;
    v_message     BYTEA;
BEGIN
    -- Auflösen der aktuellen Key-Version, falls nicht explizit.
    IF p_key_version IS NULL THEN
        SELECT key_version, vault_secret_name
          INTO v_key_version, v_secret_name
          FROM public.subject_ref_keys
         WHERE tenant_id = p_tenant_id AND status = 'active'
         ORDER BY key_version DESC
         LIMIT 1;
    ELSE
        SELECT key_version, vault_secret_name
          INTO v_key_version, v_secret_name
          FROM public.subject_ref_keys
         WHERE tenant_id = p_tenant_id AND key_version = p_key_version
           AND status IN ('active','rotating');
    END IF;

    IF v_key_version IS NULL THEN
        RAISE EXCEPTION 'no usable subject_ref key for tenant=%', p_tenant_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- Vault-Lookup (siehe 20260505230000_app_secret_rpc.sql).
    v_key := convert_to(public.get_app_secret(v_secret_name), 'UTF8');

    v_message := convert_to(
        p_subject_kind || E'\x1f' || lower(trim(p_value)),
        'UTF8'
    );

    RETURN encode(extensions.hmac(v_message, v_key, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.subject_ref_compute(UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subject_ref_compute(UUID, TEXT, TEXT, INT)
    TO service_role;
```

---

## §13.2 Key Rotation Policy

### Rotations-Fenster

| Phase | Dauer (Default) | Verhalten |
|---|---|---|
| `active` | 90 Tage (quarterly) | Neue `subject_ref` werden mit diesem Key berechnet |
| `rotating` | 30 Tage (Dual-Read-Window) | Neuer Key ist `active`. Alter Key bleibt für Verify-Pfade gültig |
| `retired` | bis zur Erasure-Trigger | Keine neuen Berechnungen, kein Verify mehr |
| `destroyed` | terminal | Vault-Secret physisch gelöscht ⇒ kryptografische Erasure |

### Rotation-RPC

```sql
CREATE OR REPLACE FUNCTION public.rotate_subject_ref_key(
    p_tenant_id UUID
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_version INT;
    v_secret_name TEXT;
BEGIN
    -- Service-role-only path; UI ruft das nie direkt auf.
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    -- 1. nächste Version ermitteln
    SELECT COALESCE(MAX(key_version),0) + 1
      INTO v_new_version
      FROM public.subject_ref_keys
     WHERE tenant_id = p_tenant_id;

    v_secret_name := format('subject_ref_key_%s_v%s', p_tenant_id, v_new_version);

    -- 2. Vault befüllen (Edge-Function übernimmt das mit pgsodium /
    --    supabase secrets) — hier nur Metadaten anlegen.
    INSERT INTO public.subject_ref_keys
        (tenant_id, key_version, vault_secret_name, status, activated_at)
    VALUES
        (p_tenant_id, v_new_version, v_secret_name, 'active', now());

    -- 3. vorherigen aktiven Key in Dual-Read-Window schieben
    UPDATE public.subject_ref_keys
       SET status      = 'rotating',
           retiring_at = now() + INTERVAL '30 days'
     WHERE tenant_id = p_tenant_id
       AND key_version < v_new_version
       AND status = 'active';

    -- 4. ältere `rotating`-Keys, deren Fenster abgelaufen ist, retiren
    UPDATE public.subject_ref_keys
       SET status     = 'retired',
           retired_at = now()
     WHERE tenant_id = p_tenant_id
       AND status = 'rotating'
       AND retiring_at < now();

    RETURN v_new_version;
END;
$$;
```

### Re-HMAC-Semantik bei Rotation

Wir **re-HMAC-en alte Events nicht**. Begründung:

- `runtime_events` ist append-only (§SPEC-001). Eine Re-Berechnung würde
  die Hash-Chain brechen.
- Stattdessen hält jedes `subject_ref_mappings`-Row die `key_version`,
  mit der es erzeugt wurde. Verify- und DSR-Pfade nutzen genau diese
  Version aus dem Dual-Read-Window.
- Neue Events nach Rotation tragen den neuen `subject_ref`. Korrelation
  über die Rotation hinweg erfolgt über `subject_ref_mappings`
  (gleicher Klartext → zwei Refs, ein Mapping pro Version).

### Cron

```sql
-- Quarterly per Tenant. Idempotent.
SELECT cron.schedule(
    'subject_ref_rotation_quarterly',
    '0 3 1 */3 *',
    $$ SELECT public.rotate_subject_ref_key(id) FROM public.tenants $$
);
```

---

## §13.3 Deletion Semantics

### Zustandsdiagramm

```text
   ┌────────────┐  DSR-Antrag eingegangen  ┌──────────────────┐
   │  present   │ ────────────────────────▶│ deletion_pending │
   └────────────┘                          └──────────────────┘
                                                  │
                                                  │ retention_hold abgelaufen?
                                                  ▼
                                          ┌────────────────┐
                                          │  erased (soft) │  encrypted_value=NULL
                                          └────────────────┘
                                                  │
                                                  │ Key destroyed?
                                                  ▼
                                          ┌──────────────────────┐
                                          │ cryptographic_erasure│  subject_ref bleibt,
                                          │       (hard)         │  ist aber nicht mehr
                                          └──────────────────────┘  rückführbar
```

### RPC

```sql
CREATE OR REPLACE FUNCTION public.request_subject_erasure(
    p_tenant_id     UUID,
    p_subject_ref   TEXT,
    p_retention_hold INTERVAL DEFAULT INTERVAL '30 days',
    p_reason        TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id UUID := gen_random_uuid();
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    -- 1. Mapping markieren
    UPDATE public.subject_ref_mappings
       SET deletion_requested_at = now()
     WHERE tenant_id = p_tenant_id AND subject_ref = p_subject_ref;

    -- 2. Audit-Event in runtime_events emittieren (T0, replayable=true).
    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status,
         subject_ref, payload)
    VALUES
        (p_tenant_id, 'dsr.erasure_requested', 'high', 'governance', 'auto',
         p_subject_ref,
         jsonb_build_object(
             'request_id',      v_request_id,
             'retention_hold',  p_retention_hold,
             'reason',          p_reason
         ));

    RETURN v_request_id;
END;
$$;

-- Worker, der nach Ablauf des Retention-Hold die Soft-Erasure ausführt.
CREATE OR REPLACE FUNCTION public.process_subject_erasure_queue()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    r       RECORD;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    FOR r IN
        SELECT subject_ref, tenant_id
          FROM public.subject_ref_mappings
         WHERE erased_at IS NULL
           AND deletion_requested_at IS NOT NULL
           AND deletion_requested_at < now() - INTERVAL '30 days'
         FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.subject_ref_mappings
           SET encrypted_value = NULL,
               erased_at       = now()
         WHERE subject_ref = r.subject_ref;

        -- Audit-Trail
        INSERT INTO public.runtime_events
            (tenant_id, type, severity, source, review_status,
             subject_ref, payload)
        VALUES
            (r.tenant_id, 'dsr.erasure_completed', 'medium',
             'governance', 'auto', r.subject_ref,
             jsonb_build_object('method','soft'));

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;
```

### Cryptographic Erasure (hart)

Wird ein gesamter Key auf `destroyed` gesetzt (z. B. nach Tenant-Offboarding
+ Retention-Ablauf), löscht ein Edge-Function-Step das Vault-Secret. Ohne
das Key-Material ist jeder `subject_ref` dieser Version mathematisch nicht
mehr rückführbar. **`runtime_events`-Zeilen bleiben unangetastet** —
Audit-Trail-Konsistenz schlägt Deletion-Aggressivität (siehe §13.4 und
DSGVO Art. 17 Abs. 3 lit. b).

---

## §13.4 Export Behavior (DSGVO Art. 20)

### Format: JSON-LD mit Proof-Chain

```json
{
  "@context": "https://schema.realsync.eu/v1/subject-export.jsonld",
  "@type":    "SubjectDataExport",
  "subject_ref": "8f3a...e21",
  "key_version": 7,
  "exported_at": "2026-05-21T10:00:00Z",
  "events": [
    {
      "global_seq": 184213,
      "tenant_seq": 4421,
      "type": "tracker.pre_consent_detected",
      "ts": "2026-04-30T09:11:02Z",
      "payload": { ... },
      "evidence_refs": [
        { "evidence_id": "evd_01H...", "sha256": "ab12..." }
      ],
      "prev_hash":  "00bf...",
      "event_hash": "9d31..."
    }
  ],
  "proof": {
    "chain_algorithm": "sha256",
    "verifier_signature": {
      "alg":   "Ed25519",
      "value": "MEYCIQ...",
      "signed_over": ["events[*].event_hash", "exported_at"],
      "key_id": "realsync-export-2026-q2"
    }
  }
}
```

### Export-View + Edge-Function

```sql
-- View, die genau die für DSR-Export erlaubten Spalten exponiert.
CREATE OR REPLACE VIEW public.subject_dsr_export_v
WITH (security_invoker = true)
AS
SELECT e.tenant_id, e.subject_ref, e.global_seq, e.tenant_seq,
       e.type, e.ts, e.payload, e.evidence_refs,
       e.prev_hash, e.event_hash
  FROM public.runtime_events e
 WHERE e.subject_ref IS NOT NULL;
```

Die Edge-Function `dsr-export`:
1. Authentifiziert den Anfragenden (RBAC + Membership).
2. Liest aus `subject_dsr_export_v` (RLS erzwingt Tenant-Scope).
3. Validiert die Hash-Chain mit `runtime_events_verify_chain()`.
4. Signiert das Bundle (Ed25519, Schlüssel separat verwaltet).
5. Loggt ein `dsr.export_completed`-Event mit Bundle-SHA-256.

---

## §13.5 Incident Correlation

### Query-Pattern

```sql
-- Alle Events eines Subjects über die letzten 90 Tage, ordnet nach
-- Tenant-Sequence (= chronologisch, lückenfrei).
SELECT global_seq, tenant_seq, type, ts, severity, payload, evidence_refs
  FROM public.runtime_events
 WHERE tenant_id   = $1
   AND subject_ref = $2
   AND ts > now() - INTERVAL '90 days'
 ORDER BY tenant_seq ASC;
```

Genutzte Indexe:

- `runtime_events_subject_ref_idx` (partial, `WHERE subject_ref IS NOT NULL`) —
  Lookup auf `subject_ref` ist O(log n) auch bei mehreren Mio. Events.
- `runtime_events_tenant_seq_idx` — Sort & Range-Scan auf `tenant_seq`.

### Incident-Export

```sql
CREATE OR REPLACE FUNCTION public.incident_correlation_export(
    p_tenant_id   UUID,
    p_subject_ref TEXT,
    p_since       TIMESTAMPTZ DEFAULT now() - INTERVAL '90 days'
) RETURNS TABLE (
    global_seq    BIGINT,
    tenant_seq    BIGINT,
    ts            TIMESTAMPTZ,
    type          TEXT,
    severity      TEXT,
    payload       JSONB,
    evidence_refs JSONB,
    prev_hash     TEXT,
    event_hash    TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT e.global_seq, e.tenant_seq, e.ts, e.type, e.severity,
           e.payload, e.evidence_refs,
           encode(e.prev_hash,  'hex'),
           encode(e.event_hash, 'hex')
      FROM public.runtime_events e
     WHERE e.tenant_id = p_tenant_id
       AND e.subject_ref = p_subject_ref
       AND e.ts >= p_since
     ORDER BY e.tenant_seq;
END;
$$;
```

---

## §13.6 RLS × subject_ref Interaction

### Aussage

> Ein Tenant-Mitglied sieht **alle** Events seines Tenants. Cross-Tenant
> sieht **niemand** etwas. `subject_ref` selbst ist unter HMAC, also
> bedeutet ein Leak des Refs **nicht** automatisch ein Leak der Identität —
> aber die RLS-Schicht verhindert den Leak des Refs als erste Linie.

### Beweisskizze

1. `runtime_events` SELECT-Policy: `USING (public.has_tenant_membership(tenant_id))`.
2. `has_tenant_membership` liest **nur** `tenant_memberships`-Rows, die zu
   `auth.uid()` gehören (SECURITY DEFINER, deshalb keine RLS-Rekursion).
3. Es gibt keine SELECT-Policy auf `runtime_events`, die `tenant_id`
   umgeht. → Eine Query ohne Membership liefert 0 Zeilen, ungeachtet von
   `subject_ref`.
4. `subject_ref` ist tenant-skopiert HMAC'd (§13.1). Selbst wenn ein Ref
   versehentlich exfiltriert würde, lässt er sich ohne den
   Tenant-spezifischen Key nicht in eine Identität invertieren.

### Negativtest (zu schreiben)

```ts
// test/runtime/subject_ref.rls.test.ts
test('cross-tenant subject_ref lookup returns empty', async () => {
  const a = await asTenant('tenantA');
  const ref = await a.emit({ subject_kind: 'email', value: 'x@example.com' });

  const b = await asTenant('tenantB');
  const rows = await b.supabase
    .from('runtime_events')
    .select('id')
    .eq('subject_ref', ref);
  expect(rows.data).toEqual([]);
});
```

---

## §13.7 Compliance Mapping

| Anforderung | Quelle | Umsetzung in dieser RFC |
|---|---|---|
| **Datenminimierung** | DSGVO Art. 5 (1) c | Nur HMAC-Ref in `runtime_events`, kein Klartext |
| **Speicherbegrenzung** | DSGVO Art. 5 (1) e | `retention_class` + monatliches Partition-DROP |
| **Integrität & Vertraulichkeit** | DSGVO Art. 5 (1) f | Hash-Chain (SPEC-001 §7) + Vault-Keys |
| **Recht auf Auskunft** | DSGVO Art. 15 | `subject_dsr_export_v` + `incident_correlation_export()` |
| **Recht auf Datenübertragbarkeit** | DSGVO Art. 20 | JSON-LD Export §13.4 mit Signatur |
| **Recht auf Löschung** | DSGVO Art. 17 | `request_subject_erasure()` + `process_subject_erasure_queue()` |
| **Audit-Trail-Erhalt trotz Löschung** | DSGVO Art. 17 (3) b | `subject_ref` bleibt im Event-Log; Klartext-Mapping wird ausgenullt; Key-Destroy ⇒ kryptografische Erasure |
| **AI-Act Art. 12 Aufbewahrungspflicht** | EU AI Act | T0/T1-Events mit `retention_class = '7y'`, Hash-Chain belegt Unveränderlichkeit |
| **AI-Act Art. 13 Transparenz** | EU AI Act | Subject-Export-Bundle enthält alle Modellinteraktionen mit subject_ref |
| **Sicherheits-Logs** | NIS2 / TR-03161 | Append-Only DDL-Trigger + Verifier (SPEC-001 §2, §7) |

---

## §13.8 Acceptance Criteria

- [ ] DDL aus §13.1, §13.2, §13.3 in Migration `{TS}_subject_ref_lifecycle.sql`
- [ ] `subject_ref_compute()` Helper geprüft gegen Vault-Mock
- [ ] Rotation-RPC + Cron (`subject_ref_rotation_quarterly`) registriert
- [ ] Erasure-Queue-Worker als Edge-Function `subject-ref-erasure-worker`
- [ ] `dsr-export` Edge-Function mit Ed25519-Signatur + JSON-LD-Output
- [ ] Negativtest §13.6 grün
- [ ] Compliance-Matrix §13.7 ins Hauptdokument `docs/compliance/` verlinkt
- [ ] `npm run lint` + `npm test` grün

---

## §13.9 Open Questions

1. **Vault-Backend** — pgsodium vs. externes KMS (AWS/GCP)? Aktuell nutzt
   das Repo `get_app_secret` (Supabase Vault). Für AI-Act-konforme
   Cryptographic Erasure brauchen wir nachweisbar gelöschten
   Key-Speicher — pgsodium reicht, KMS wäre defense-in-depth.

2. **Re-HMAC kritischer Datensätze** — wollen wir eine optionale
   Re-HMAC-Migration für `runtime_events`-Zeilen, die mit einem
   destroyed Key entstanden sind? Bricht die Hash-Chain — Tradeoff
   gegen Discoverability.

3. **Subject-Kind-Erweiterung** — `device`, `org`, `vehicle`? Jede neue
   Kind verlangt Canonicalization-Spec. Vorschlag: separates RFC-Sub-§
   pro Kind.

4. **Signing-Key-Rotation** — Ed25519-Key für Export-Signaturen rotiert
   wann? `key_id` schon im Format, aber Rotation-Cron fehlt noch.

5. **Cross-Tenant Erasure-Anfragen** — Konsumenten-DSR-Portal-Anfragen
   können mehrere Tenants betreffen (z. B. Konzern-Mitglieder). Wir
   delegieren das aktuell an die Anfrage-Routing-Logik — separate RFC.
