# Google-Workspace-Eingang `workspace-events`

Stand 16.11.2026 · Phase 4 des Masterplans „Google Workflow Automation“ (RSD-01 … RSD-06).

Status: **implementiert und getestet (CI), nicht deployt, Migration nicht angewendet.**
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
- HMAC-Signatur und Zeitstempel gegen Replay sind noch nicht umgesetzt (Idempotenz deckt Wiederholungen derselben `event_id`).
- Oberfläche für Freigaben und der Ausführer für `send_email` usw. folgen gesondert.
