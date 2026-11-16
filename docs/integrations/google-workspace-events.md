# Google-Workspace-Eingang `workspace-events`

Stand 16.11.2026 · Phase 4 des Masterplans „Google Workflow Automation“ (RSD-01 … RSD-06).

Status: **implementiert und getestet (CI), nicht deployt, Migration nicht angewendet.**
Signatur, `workspace-approvals` und `workspace-execute` (nur Prüfmodus): gestapelter Draft-PR,
lokal getestet, in der CI noch nicht gelaufen.
Ob Workspace Studio die nötigen Header mitsenden kann, ist nicht geprüft (siehe „Offen“).

## Ablauf

1. Ein Studio-Flow sendet `POST /functions/v1/workspace-events` mit `x-rsd-tenant-key: rsd_gov_…`.
2. Der Schlüssel wird gehasht nachgeschlagen (`governance_ingest_keys`). Er muss die Quelle
   `google_workspace` **ausdrücklich** erlauben; ein Schlüssel ohne Quellenbindung wird abgewiesen.
3. Der Mandant kommt nur aus der Schlüsselzeile. `tenant_id` im Body → 403.
4. Body ≤ 32 KB, `metadata` ≤ 4 KB, Schema `1.0`, unbekannte Felder → 400.
5. Serverseitige Einstufung der Aktion (`_shared/workspaceEvents.ts`):
   - `allow` – intern (Entwurf, Bericht, Register, interne Meldung)
   - `require_approval` – Außenwirkung (`send_email`, `send_offer`, `create_calendar_event`)
   - `forbidden` – löschen, bezahlen, veröffentlichen, KDP-Upload, mergen, deployen, unbekannte Aktionen → 403
6. `ingest_workspace_event` speichert idempotent pro `(tenant_id, event_id)`, begrenzt auf
   600 Ereignisse pro Schlüssel und Stunde und legt bei `require_approval` eine Freigabe `PENDING` an
   (Ablauf 24 h).

Die Funktion führt **keine** externe Aktion aus.

## Freigaben

| Schritt | Wer | Funktion |
|---|---|---|
| Anfrage | Edge Function (service_role) | `ingest_workspace_event` |
| Genehmigen / Ablehnen | Owner/Admin des Mandanten (angemeldet) | `decide_workspace_approval(id, approve)` |
| Einlösen | künftiger Ausführer (service_role) | `consume_workspace_approval(tenant, id, payload_hash, execution_id)` |

Die Einlösung gelingt genau einmal, nur bei `APPROVED`, vor `expires_at`, im selben Mandanten und
mit exakt demselben `payload_hash` (SHA-256 über Mandant, Agent, Aktion, Ressource, Metadaten).
Jede Änderung der Nutzdaten macht die Freigabe unbrauchbar. Das Sheet `APPROVALS` in
`RSD_AUTOMATION_CONTROL` ist nur Anzeige, keine Sicherheitskontrolle.

## Signierte Requests (HMAC)

Der Ingest-Schlüssel steht in jedem Request. Wer einen Request mitliest oder den Schlüssel aus
einem Log zieht, könnte damit Ereignisse einliefern. Ein zweites Geheimnis, das nie übertragen wird,
signiert deshalb Zeitstempel, Nonce und den rohen Body (`_shared/workspaceSignature.ts`,
Migration `20261116040000_workspace_request_signing.sql`).

```
signing_string = "v1:" + <function> + ":" + <unix-sekunden> + ":" + <nonce> + ":" + <roher body>
x-rsd-signature = hex(HMAC_SHA256(signing_secret, signing_string))
x-rsd-timestamp = <unix-sekunden>      (höchstens ±300 s)
x-rsd-nonce     = 16–128 Zeichen [A-Za-z0-9_-], je Request neu
```

| Fall | Ergebnis |
|---|---|
| Für den Schlüssel ist ein Signatur-Geheimnis eingerichtet | Signatur ist Pflicht (fehlt/falsch → 401) |
| Nichts eingerichtet, `workspace-events`, kein `WORKSPACE_EVENTS_REQUIRE_SIGNATURE=true` | unsigniert zulässig (Verhalten wie bisher) |
| Nichts eingerichtet, aber Signatur-Header gesendet oder Signatur verlangt | 401 `SIGNATURE_NOT_CONFIGURED` |
| `workspace-execute` | Signatur immer Pflicht |
| Nonce für diesen Schlüssel schon gesehen | 409 `REPLAY` |
| Mehr signierte Requests pro Minute als `governance_ingest_keys.rate_limit_per_minute` | 429 |
| Nachschlagen oder Anmelden scheitert | 503 (nie unsigniert durchlassen) |

Die Nonce wird erst nach gültiger Signatur verbraucht. Wiederholung nach Netzfehler: gleiche
`event_id`, gleicher Body, **neue Nonce, neue Signatur**. Das Geheimnis liegt nur in Supabase Vault;
`workspace_signing_secrets` hält je Schlüssel den Vault-Namen. Clients haben auf beide neuen
Tabellen keinen Zugriff (FORCE RLS, keine Policy, keine Tabellenrechte).

Einrichten (Operator, nach Freigabe der Migration; `<…>` ersetzen, Geheimnis nie ins Repo):

```sql
select vault.create_secret('<mind. 32 Zeichen, z. B. openssl rand -hex 32>', 'workspace_signing_<name>');
insert into public.workspace_signing_secrets (ingest_key_id, tenant_id, vault_secret_name)
values ('<ingest_key_id>', '<tenant_id>', 'workspace_signing_<name>');
```

## `workspace-approvals` (Freigaben entscheiden)

`POST /functions/v1/workspace-approvals` mit User-JWT. `{ op: 'list', status?, tenant_id? }`,
`{ op: 'approve' | 'reject', approval_id }`. Arbeitet nur mit dem JWT des Aufrufers, ohne
Service-Role: Sichtbarkeit über RLS, Entscheidung über `decide_workspace_approval` (Owner/Admin).
Eine Entscheidung führt nichts aus.

## `workspace-execute` (nur Prüfmodus)

`POST /functions/v1/workspace-execute` mit Ingest-Schlüssel und Pflicht-Signatur.
`{ schema_version: '1.0', approval_id, payload_hash, mode?: 'dry_run' }` → `200 { status: 'ready', … }`,
wenn die Freigabe jetzt einlösbar wäre (Mandant, `APPROVED`, nicht abgelaufen, gleicher Hash, Aktion
weiterhin freigabefähig). Die Funktion ruft `consume_workspace_approval` nicht auf und führt nichts
aus; `mode: 'execute'` → 403 `EXECUTION_DISABLED`.

## Einrichtung (nach Freigabe von Migration und Deploy)

1. Ingest-Schlüssel über `governance-keys` mit `allowed_sources: ["google_workspace"]` anlegen.
   Der Klartext erscheint einmal — nur im Secret-Speicher von Workspace Studio ablegen.
2. Studio-Webhook auf `https://<PROJECT_REF>.supabase.co/functions/v1/workspace-events`,
   Header `x-rsd-tenant-key: <WORKSPACE_INGEST_KEY>`.
3. Testereignis aus dem Masterplan (`evt-test-0001`, `create_review`) senden → 202, ein zweites Mal → `duplicate: true`.

Keine neuen Umgebungsvariablen: die Funktion nutzt `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY`
der Edge-Runtime. Schlüssel nie in Repo, Logs oder Sheets.

## Offen

- Ob Workspace-Studio-Webhooks eigene Header senden können, ist nicht geprüft. Falls nicht: Apps-Script-Adapter
  mit dem Schlüssel aus den Skripteigenschaften.
- Workspace Studio kann voraussichtlich keine HMAC-Signatur berechnen (nicht geprüft). Signierte
  Requests brauchen dann einen Apps-Script-Adapter (`Utilities.computeHmacSha256Signature`).
- Es gibt noch keine Oberfläche und keinen Endpunkt, um Signatur-Geheimnisse anzulegen oder zu
  wechseln (derzeit SQL durch den Operator).
- Entscheidungen über Workspace-Freigaben stehen noch nicht in der Nachweis-Kette
  (`append_governance_evidence`).
- Oberfläche für Freigaben und der Ausführer für `send_email` usw. folgen gesondert. Der Ausführer
  braucht einen Zustand zwischen „eingelöst“ und „ausgeführt“ (heute setzt `consume_workspace_approval`
  direkt `EXECUTED`).
