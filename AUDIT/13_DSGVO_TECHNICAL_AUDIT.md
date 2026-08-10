# 13 — DSGVO: technische Umsetzung

**Kein Rechtsrat (Rule 11).** Bewertet wird die technische Implementierung.

---

## 1. Grundsätze

| Grundsatz | Umsetzung | Bewertung |
|---|---|---|
| Datenminimierung | `subject_ref` als HMAC statt Klartext-PII in Events — **konzeptionell stark** | ✅ |
| Zweckbindung | `usage_context`, `intended_purpose` auf Asset-Ebene | ✅ |
| Einwilligung | `user_consents`, `CookieConsent.tsx` mit `CONSENT_VERSION`, Consent Mode v2 default `denied` | ✅ |
| Widerruf | `realsync:consent-changed`-Event, Pixel werden nachgezogen | ✅ |
| Speicherbegrenzung | `evidence_retention`, `memory_retention_policies`, Partition-DROP | ⚠️ `memory_retention_policies` **nicht in Prod** |
| Integrität | Hash-Chain, Append-Only | ✅ |
| Zugriffskontrolle | RLS — **aber 35 Tabellen ohne** (F-08) | ⚠️ |
| Verschlüsselung | TLS 1.3 + HSTS preload; at-rest über Supabase | ✅ |
| Prüfpfad | `governance_admin_log`, `runtime_events` | ✅ |

---

## 2. Betroffenenrechte

### Art. 15 — Auskunft
`governance-dsr` mit `op: 'export'` (deployt ✅). Liefert Datenbestand + Event-Timeline
über `subject_ref`. **Implementiert und erreichbar.**

### Art. 17 — Löschung
Zweistufig, sauber konstruiert:
1. `process_subject_erasure_queue()` — Soft-Erase der `subject_ref_mappings` nach
   Ablauf der Retention-Sperre
2. `dsr_finalize_erased_requests()` — Redaktion des Klartext-PII in `dsr_requests`

Ausgelöst durch `governance-erasure-sweeper` (deployt ✅, Vault-Token-geschützt ✅,
idempotent ✅). Der Ansatz — Löschen des Pseudonymisierungs-Mappings statt der
append-only Events — ist die technisch richtige Antwort auf den Konflikt zwischen
Art. 17 und Unveränderlichkeit.

**Aber:** Die Löschung propagiert **nicht** nach (siehe `07_DATA_FLOW.md` D-1):

| Ziel | Propagiert |
|---|---|
| `dsr_requests`, `subject_ref_mappings` | ✅ |
| `runtime_events` | ✅ per Depseudonymisierungs-Verlust (bewusst) |
| **Supabase Storage** | ❌ keine Löschlogik gefunden |
| **`tax_documents` + 34 RLS-lose Tabellen** | ❌ |
| **KI-Anbieter (Anthropic/OpenAI/Google)** | ❌ |
| **Backups / PITR** | ❌ nicht dokumentiert |
| **Sentry** | ❌ PII-Scrubbing nicht verifiziert |
| **Queues (n8n)** | ❌ |

### Art. 20 — Portabilität
`evidence-vault-export` (deployt ✅) liefert PDF/JSON. `export-audit` **404**.
Teilweise erfüllt.

### Art. 30 — Verzeichnis von Verarbeitungstätigkeiten
`src/features/governance/vvt/` mit `runtimeVvtMapper.ts` — leitet das VVT aus
Runtime-Events ab. Elegante Idee, im Repo vorhanden.

### Art. 35 — DSFA
`dpias`-Tabelle + `governance-dpias` (deployt ✅). Workflow vorhanden.

---

## 3. Retention

| Mechanismus | Zustand |
|---|---|
| `evidence_retention` | Tabelle vorhanden |
| Compliance-Hold / Legal Hold | im Evidence-Vault-Design vorgesehen — **Modul nicht deployt** |
| Partition-DROP für `runtime_events` | implementiert, umgeht bewusst die Append-Only-Trigger, dokumentiert ✅ |
| RFC-003 Memory-Decay (`active → cooling → archived → expired → purged`) | vollständig im Repo, **`governance_memory` fehlt in Prod**; der `pg_cron`-Job `memory-decay-hourly` kann nicht laufen |
| Automatische Retention-Durchsetzung | **kein laufender Cron in Produktion nachweisbar** |

---

## 4. Account-/Tenant-Löschung

Kein `delete-account`- oder `delete-tenant`-Endpunkt im Function-Inventar gefunden.
`ON DELETE CASCADE` auf `tenant_id` existiert im Schema — es fehlt aber der
bedienbare Pfad, über den ein Nutzer sein Konto oder ein Owner seinen Tenant
löschen kann. **Lücke** für Art. 17 auf Kontoebene.

---

## 5. Bewertung

**GDPR Technical Readiness: 48/100.**

Die Architektur ist überdurchschnittlich durchdacht — HMAC-Pseudonymisierung,
zweistufige Löschung, VVT aus Runtime-Daten, sauberes Consent-Gating der eigenen
Pixel. Das sind Entscheidungen, die man selten sieht.

Die Umsetzung bleibt dahinter zurück:
- **F-08** — 35 Tabellen, darunter Steuerdokumente, ohne Zugriffskontrolle
- **D-1** — Löschung erreicht Storage, Backups und KI-Anbieter nicht
- **kein Account-Löschpfad**
- **Retention läuft in Produktion nicht** (Cron + Tabellen fehlen)

| ID | Sev | Kurz |
|---|---|---|
| F-G1 | P1 | Löschung propagiert nicht nach Storage / KI-Anbieter / Backups |
| F-G2 | P1 | Kein Selbstbedienungs-Löschpfad für Konto und Tenant |
| F-G3 | P2 | Retention-Automatik in Produktion nicht aktiv (`memory_retention_policies` fehlt, Cron unbelegt) |
| F-G4 | P2 | Keine technische Erzwingung, dass `payload` frei von Klartext-PII bleibt |
| F-G5 | P3 | Sentry-PII-Scrubbing nicht konfiguriert/verifiziert |
