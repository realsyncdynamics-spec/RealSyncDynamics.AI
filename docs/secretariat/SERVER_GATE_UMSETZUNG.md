# KI-Sekretariat: serverseitiges Freigabe-Gate (Umsetzung A + B)

**Stand:** 25.11.2026 · **Status:** implementiert und lokal getestet auf Branch `claude/quirky-mayer-v76oqj`.
Nicht gemergt, nicht bereitgestellt, nicht produktiv verifiziert. Konzept: `SERVER_GATE_KONZEPT.md` (#2435).

## 1. Bestand

| Stelle | Ist-Zustand vor dieser Änderung |
|---|---|
| `public.bots` (`20260628121531_bots_foundation.sql`) | RLS `is_tenant_member` für INSERT/UPDATE/DELETE; `enabled` hat Default `true` |
| `bots_enforce_quota` (`20260920130000`) | BEFORE INSERT, Kontingent; bleibt unberührt |
| #2435 (offen) | Entwurf als Bot, Marker `config.secretariat`, Freigabe-Hash im Browser (`approvalPatch`), nicht autoritativ |
| #2178 (offen) | Bot-Schreibrechte nur Owner/Admin, ändert `bots_enforce_quota` |
| `resolveBot` (`supabase/functions/_shared/bots.ts`) | prüft nur Mandant und `enabled` |
| Prüfpfad | `governance_admin_log` (Mandant, Akteur, Aktion, Ziel, Payload) existiert; keine neue Audit-Tabelle |

## 2. Sicherheitsarchitektur (Migration `20261125180000_secretariat_server_gate.sql`)

- **Hash, einzige Implementierung:** `secretariat_bot_content_sha256(...)` = SHA-256 über
  `jsonb_build_object(bot_id, tenant_id, name, channel, persona, greeting, capabilities,
  config #- '{secretariat,approval}')::text`. Bindung an `bot_id`/`tenant_id` verhindert das Kopieren einer Freigabe.
- **Freigaben:** Tabelle `secretariat_bot_approvals` (append-only, RLS, nur SELECT für Mitglieder;
  kein Schreibrecht für `anon`, `authenticated`, `service_role`; UPDATE/DELETE per Trigger gesperrt, DELETE nur als Kaskade).
- **RPC `approve_secretariat_bot(p_bot_id, p_content_sha256, p_activate)`:** `auth.uid()` Pflicht; Owner/Admin des
  Bot-Mandanten; Mandant nur aus der Bot-Zeile; Zeile `FOR UPDATE`; Pflichtangaben; Server-Hash muss dem gesehenen
  Hash entsprechen, sonst `SECRETARIAT_HASH_MISMATCH` ohne Speicherung. Unbekannt/fremd/keine Rolle/abgemeldet:
  gleiche Meldung, SQLSTATE `42501`.
- **RPC `secretariat_bot_gate_status(p_bot_id)`:** `{is_secretariat, content_sha256, approved, approved_at, enabled}`;
  Mitglieder des Mandanten und `service_role`; sonst `42501`.
- **Trigger `bots_secretariat_gate`** (BEFORE INSERT OR UPDATE, jede Rolle inkl. `service_role`):
  Sekretariats-Bot nur deaktiviert anlegen; Marker, `tenant_id`, `id` nicht änderbar; Aktivierung nur mit Freigabe
  zum aktuellen Hash und durch Owner/Admin oder `service_role`; Inhaltsänderung an aktivem Bot ohne passende
  Freigabe → `enabled := false` + Prüfpfad. Deaktivieren immer erlaubt. Andere Bots: unverändert.
- **Reihenfolge (BEFORE, alphabetisch):** INSERT `bots_enforce_quota` → `bots_secretariat_gate`;
  UPDATE `bots_secretariat_gate` → `update_bots_modtime`.
- **Prüfpfad** in `governance_admin_log`: `secretariat.approved`, `secretariat.activated`,
  `secretariat.approval_invalidated`; nur IDs, Hash, Akteur-UUID; `actor_email` bleibt leer.
  Grenze: abgelehnte Versuche werden mit der Transaktion zurückgerollt und erscheinen nicht im Prüfpfad.
- **Runtime (`resolveBot`):** Marker vorhanden → `secretariat_bot_gate_status`; Fehler, keine Antwort oder
  `approved !== true` → `403 secretariat not approved`. Andere Bots ohne zusätzlichen Aufruf.

Pflichtangaben (Abbildung von `approvalBlockers` aus #2435): `fields.businessName.status = 'known'` und
`fields.phone` **oder** `fields.email` `known`. Serverseitig strenger: Wert muss ein nicht leerer Text sein.

## 3. Abweichungen vom Konzept

| Konzept (#2435) | Umsetzung | Grund |
|---|---|---|
| Freigabe in `config.secretariat.approval`, Session-Flag/GUC | eigene Tabelle | Clients können sie nicht schreiben; kein Flag nötig |
| `canonicalHash` über Feldwerte, auch in Edge/Browser | SQL-Hash über den ganzen sicherheitsrelevanten Inhalt | eine Implementierung; Prompt, Begrüßung, Kanal, Fähigkeiten zählen mit |
| RPC ohne Hash-Parameter | `p_content_sha256` als optimistische Sperre | „Änderung zwischen Prüfung und Freigabe“ |
| Freigabe = Aktivierung | getrennt (`p_activate`) | `SECRETARIAT_ACTIVATION_LOCKED` bleibt möglich |
| Hash-Vergleich in `resolveBot` | `resolveBot` fragt die RPC | kein Hash in TypeScript |
| — | `name` im Hash | `bot-voice-webhook` spricht `name`, wenn `greeting` leer ist |

## 4. Zusammenspiel mit #2178

Keine gemeinsamen Objekte: keine Bot-Policy, kein `bots_enforce_quota`. Ohne #2178 ist das Gate dicht, weil
Trigger und RPC die Rolle selbst prüfen; mit #2178 dürfen Editoren gar nicht mehr schreiben. Der DB-Test liest die
installierte UPDATE-Policy und gilt in beiden Welten (lokal geprüft, siehe PR). #2178 trägt die ältere Version
`20261109113141`; `deploy.yml` ruft `supabase db push --include-all` auf und zieht sie nach. Reihenfolge egal.

## 5. Hinweise für Schritt C (Frontend, Folge-PR von #2435)

- Status über `secretariat_bot_gate_status` lesen; Freigabe über `approve_secretariat_bot(bot_id, content_sha256, activate)`
  mit dem zuvor gelesenen `content_sha256`.
- `config.secretariat.approval` und `fieldsSha256` aus dem Browser sind bedeutungslos (nicht im Hash, nicht geprüft).
- `SECRETARIAT_ACTIVATION_LOCKED` bleibt `true` bis zur Abnahme; die RPC dann mit `p_activate = false` aufrufen.
- Fehlercodes: `42501` (keine Berechtigung), `P0001` mit DETAIL `SECRETARIAT_HASH_MISMATCH`, `SECRETARIAT_FIELDS_MISSING`,
  `SECRETARIAT_NOT_FOUND`; Trigger: `SECRETARIAT_NOT_APPROVED`, `SECRETARIAT_ROLE_REQUIRED`, `SECRETARIAT_MARKER_REMOVED`,
  `SECRETARIAT_IDENTITY_CHANGED`.

## 6. Bereitstellung (nur mit Einzel-Freigabe)

**Befund `deploy.yml` (weicht von der Annahme „Edge nur manuell“ ab):** Ein Merge nach `main` startet bei Änderungen unter
`supabase/migrations/**` den Job `db-push` (automatisch `supabase db push`) **und** bei Änderungen unter
`supabase/functions/**` den Job `functions-deploy`, der die Importeure geänderter `_shared`-Dateien automatisch
bereitstellt (`scripts/ops/plan-edge-deploy.mjs`: `appointment-book`, `bot-chat`, `bot-voice-webhook`, `order-intake`,
`whatsapp-webhook`). Beide Jobs laufen ohne `needs:` und ohne Environment-Freigabe parallel. **Merge = A + B produktiv.**

- **Empfohlen:** A (Migration) und B (`_shared/bots.ts`) als getrennte PRs mergen, A zuerst. Commits sind getrennt.
- **B vor A live:** RPC fehlt → `resolveBot` liefert `403` nur für Bots mit Marker `config.secretariat`. Ohne gemergtes
  #2435 gibt es solche Bots nicht. Andere Bots: kein RPC-Aufruf, keine Wirkung.
- **A vor B live:** Trigger und RPC wirken sofort; die alte Runtime beantwortet nur Bots mit `enabled = true`, und
  Sekretariats-Bots werden nur mit gültiger Freigabe aktiv.
- **Vor dem Merge (lesend, Prod):** `SELECT count(*) FILTER (WHERE enabled), count(*) FROM public.bots WHERE config ? 'secretariat';`
  Erwartet `0/0`. Aktive Treffer würden nach B mit `403` antworten und beim nächsten Inhalts-UPDATE pausieren.

## 7. Rückbau (additiv, ohne Datenverlust)

1. Edge: Revert von `_shared/bots.ts` und gezielter Deploy der fünf Functions.
2. DB: `DROP TRIGGER bots_secretariat_gate ON public.bots;` danach optional die Funktionen
   `approve_secretariat_bot`, `secretariat_bot_gate_status`, `bots_secretariat_gate`. Tabelle
   `secretariat_bot_approvals` und `secretariat_bot_content_sha256` behalten (Nachweis).
3. Nur als neue Migration, nie durch Ändern dieser Datei.
