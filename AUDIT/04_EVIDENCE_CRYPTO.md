# 04 — Evidence Vault & kryptografische Integrität

## 1. Was tatsächlich implementiert ist

### 1.1 Hash-Chain (`runtime_events`)
Migration `20260602100000_runtime_events_backbone.sql`. **Handwerklich stark.**

| Element | Umsetzung | Bewertung |
|---|---|---|
| Algorithmus | SHA-256 via `extensions.digest` (pgcrypto) | ✅ |
| Kanonisierung | `runtime_events_canonical_bytes(...)`, `IMMUTABLE`, feste Feldreihenfolge, UTC-Zeitformat `YYYY-MM-DD"T"HH24:MI:SS.US"Z"` | ✅ deterministisch |
| Verkettung | `event_hash = sha256(canonical(envelope, prev_hash))`, `prev_hash = NULL` bei Genesis | ✅ |
| Sequenz | `tenant_seq` lückenlos pro Tenant über `runtime_event_tenant_counters` | ✅ |
| Nebenläufigkeit | `pg_advisory_xact_lock(hashtextextended(tenant_id))` — serialisiert die Kette ohne Table-Lock | ✅ korrekt gelöst |
| Korruptionserkennung | `RAISE EXCEPTION 'chain corruption'` bei fehlendem Vorgänger-Hash | ✅ |
| Append-Only | `BEFORE UPDATE` + `BEFORE DELETE` Reject-Trigger (`runtime_events_block_mutation`) | ✅ |
| Retention | Partition-`DROP` umgeht die Row-Trigger — **bewusst dokumentiert** | ✅ transparent |
| Verifier | `runtime_events_verify_chain(tenant, from, to)` — rechnet nach, prüft `prev_hash`-Kontinuität, Membership-gated | ✅ |
| Constraints | `octet_length(event_hash) = 32` / `prev_hash = 32 or null` | ✅ |

### 1.2 Signatur (Provenance / C2PA)
`supabase/functions/_shared/crypto.ts`, `_shared/provenanceCore.ts`.

- Ed25519 über WebCrypto (`crypto.subtle.sign/verify`) — real, kein Stub
- HMAC-SHA256 als dokumentierter Legacy-Fallback
- Key-ID über `PROVENANCE_ED25519_KEY_ID` (Default `rsd-ed25519-1`)
- Privater Schlüssel als PKCS8 aus Env, `extractable: false`

---

## 2. Kryptografisches Bedrohungsmodell

| # | Angreifer | Fähigkeit | Ergebnis | Bewertung |
|---|---|---|---|---|
| A1 | Anonym / Kunde | Evidenz ändern | `BEFORE UPDATE`-Trigger blockt | ✅ verhindert |
| A2 | Anonym / Kunde | Evidenz löschen | `BEFORE DELETE`-Trigger blockt | ✅ verhindert |
| A3 | Kunde | Reihenfolge ändern | `tenant_seq` fix, `prev_hash` verkettet | ✅ verhindert |
| A4 | Kunde | Falsche Evidenz einfügen | RLS + Ingest-Key-Auth (`rsd_gov_`) | ✅ verhindert |
| A5 | Kunde | Timestamp fälschen | `ts` geht in den Hash ein; Backdating würde die Kette brechen | ✅ erkennbar |
| A6 | Kunde | Metadaten ändern | im Hash enthalten | ✅ erkennbar |
| A7 | Kunde | Hash ersetzen | `event_hash` wird im Trigger berechnet, Client-Wert überschrieben | ✅ verhindert |
| A8 | **Kompromittierter `service_role`** | Partition droppen + Ersatzkette einfügen | Trigger berechnet gültige Hashes → **Verifier meldet OK** | ❌ **nicht verhindert** |
| A9 | **DB-Superuser** | Trigger deaktivieren, Rows umschreiben, Hashes neu rechnen | Kanonisierungsfunktion ist öffentlich und deterministisch | ❌ **nicht verhindert** |
| A10 | Angreifer | Signierte Evidenz replayen | keine Nonce/Replay-Erkennung im Provenance-Pfad gefunden | ⚠️ ungeprüft |
| A11 | Angreifer | Alte Signaturen nach Key-Rotation prüfen | Key-ID wird geführt, aber **kein Key-Register / keine Rotationsprozedur** im Repo | ⚠️ offen |

---

## 3. Kernfrage

> **Kann das System kryptografisch beweisen, dass Evidenz sich nicht verändert hat?**

**Nein — nicht gegenüber einem privilegierten Insider.**

Die Kette beweist Konsistenz *innerhalb* der Datenbank. Sie ist **tamper-evident**
gegen Anwendungsfehler, Kunden, kompromittierte Nutzerkonten und einzelne
Row-Manipulationen — das ist mehr, als die meisten vergleichbaren Produkte liefern.

Sie ist **nicht tamper-proof**, weil:
1. der Anker (die Kettenspitze) ausschließlich in derselben Datenbank liegt,
2. die Kanonisierung öffentlich und deterministisch ist,
3. `service_role` in 170 Edge Functions verwendet wird — die Angriffsfläche für A8
   ist groß,
4. keine externe Zeitstempelung (RFC 3161), kein Off-Site-Log und kein
   Write-Once-Storage existiert (Suche nach `rfc3161|opentimestamps|notariz|anchor`
   ergab keine Implementierung).

**Konsequenz für die Claims:** „unveränderlich" und „revisionssicher" sind in dieser
Form nicht belegbar (Rule 6). Tragfähig ist: *„kryptografisch verkettet,
append-only erzwungen, jede nachträgliche Änderung ist nachweisbar."*

---

## 4. Produktionsrealität

Unabhängig von der Kryptografie gilt: **das Evidence-Vault-Modul läuft nicht.**

| Komponente | Repo | Produktion |
|---|---|---|
| `runtime_events` (Chain) | ✅ | ✅ Tabelle vorhanden |
| `ai_evidence_events` | ✅ | ✅ |
| `evidence-vault` (Function) | ✅ | ❌ **404** |
| `evidence_vault_items` (Tabelle) | ✅ | ❌ **PGRST205** |
| `evidence-vault-export` | ✅ | ✅ deployt |
| `export-audit` | ✅ | ❌ 404 |
| `audit-determinism-verify` | ✅ | ❌ 404 |
| `provenance` / `c2pa-manifest-generate` | ✅ | ❌ 404 |

Der Chain-Unterbau steht in Produktion; die Vault-Oberfläche darüber nicht.

---

## 5. Empfehlungen (nach Priorität)

1. **Externe Verankerung** — Kettenspitze je Tenant täglich signiert an einen
   unabhängigen Zeitstempeldienst; Anchor-Referenz im Verifier ausweisen. Erst danach
   ist „revisionssicher" haltbar.
2. **Key-Management dokumentieren** — Rotationsprozedur, Key-Register mit
   Gültigkeitszeiträumen, Verifikation historischer Signaturen nach Rotation (A11).
3. **`service_role`-Fläche reduzieren** — 170 von 178 Functions nutzen den Key.
   Für reine Leseoperationen den Caller-scoped Client verwenden (wie in
   `evidence-export` bereits korrekt getan).
4. **Replay-Schutz** im Provenance-Pfad prüfen und ggf. Nonce ergänzen (A10).
5. **`hash-chain.db.test.ts` und `hash-chain-corruption.db.test.ts` in CI ausführen** —
   die Tests existieren bereits (F-07).
