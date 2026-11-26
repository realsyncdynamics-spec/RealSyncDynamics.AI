# KI-Sekretariat: serverseitiges Freigabe-Gate (Konzept, zur Freigabe)

**Stand:** 25.11.2026 · **Status:** IMPLEMENTIERT im Security-Draft-PR (Branch
`claude/tender-carson-iib6mf-security`), **nicht gemergt, nicht deployt**. Freigabe für die
Umsetzung erteilt; Merge und Deploy brauchen je eine Einzel-Freigabe (`AGENTS.md` › Freigaben).

### Umsetzung (Abweichungen vom Konzept unten)

| Konzept | Umsetzung |
|---|---|
| Freigabe in `config.secretariat.approval` | eigene Tabelle `public.bot_approvals` (Prüfpfad), nur über SECURITY-DEFINER-Funktionen schreibbar |
| Hash über die Feldwerte | Hash über den Prüfgegenstand: Persona, Begrüßung, Kanal, Fähigkeiten, Konfiguration (ohne Alt-Freigabe), Mandant – serverseitig in SQL |
| Hash-Vergleich bei jeder Prüfung | zusätzlich: jede Änderung macht die Freigabe dauerhaft ungültig (`invalidated_at`), auch nach Rücksetzen |
| Session-Flag in der RPC | nicht nötig: Trigger erlaubt `enabled = true` nur mit gültiger Freigabe und nur Owner/Admin (oder ohne Nutzerkontext) |
| Hash im Edge-Code nachrechnen | `resolveBot` fragt `bot_runtime_approval_ok` (nur `service_role`), keine zweite Hash-Implementierung |
| Frontend | `approve_secretariat_bot` per RPC mit geprüftem Stand (`updated_at`); `SECRETARIAT_ACTIVATION_LOCKED` bleibt `true` |

Bestand vor der Migration (Produktion, Lesezugriff 25.11.2026): 0 Bots mit `config ? 'secretariat'`;
der Trigger verändert oder deaktiviert keinen bestehenden Bot.

## 1. Ist-Zustand (belegt)

| Stelle | Verhalten | Folge |
|---|---|---|
| RLS `bots tenant-update` (`supabase/migrations/20260628121531_bots_foundation.sql:145`, laut Repo; Prod-Stand nicht neu gemessen) | `UPDATE` für jedes Mandantenmitglied, auch auf `enabled` und `config` | Jedes Mitglied kann einen Sekretariats-Bot ohne Freigabe aktivieren oder den Freigabe-Hash fälschen |
| `resolveBot` (`supabase/functions/_shared/bots.ts:91`) | prüft nur `enabled` | `bot-chat` und `whatsapp-webhook` beantworten Anfragen ohne gültige Freigabe |
| `approvalPatch` (`src/features/secretariat/secretariatBot.ts`) | Hash wird im Browser berechnet und gespeichert | Hash und `approvedBy` sind vom Client bestimmt, also kein Nachweis |
| PR #2178 (offen) | Schreibrechte auf `bots` nur Owner/Admin | löst die Rollenfrage, aber nicht die Freigabe-Prüfung |

Übergang in #2435: `SECRETARIAT_ACTIVATION_LOCKED = true`. Die Freigabe speichert nur den
Hash, der Bot bleibt `enabled = false`. Das schließt die Aktivierung über die Sekretariats-
Oberfläche, **nicht** über den allgemeinen Bot-Editor oder die API, solange RLS sie erlaubt.

## 2. Zielbild

Freigabe und Aktivierung sind **serverseitig** gebunden an:
1. **Rolle:** nur Owner/Admin des Mandanten (über `memberships`, nie aus dem Request).
2. **Inhalt:** Hash über die Feldwerte, **serverseitig** berechnet (gleiche Kanonisierung
   wie `canonicalHash` in `packages/siteos-core/src/canonical`).
3. **Laufzeit:** Ein Sekretariats-Bot antwortet nur, wenn der gespeicherte Hash zu den
   aktuellen Feldwerten passt. Sonst fail-closed mit `403`.

## 3. Änderungen (je eigener PR, je Einzel-Freigabe)

**A. Migration (additiv, kein DROP):**
- RPC `approve_secretariat_bot(p_bot_id uuid)`, `SECURITY DEFINER`, `search_path = ''`:
  - prüft `auth.uid()` als Owner/Admin des Mandanten des Bots, sonst Fehler;
  - berechnet den Hash über `config->'secretariat'->'fields'` serverseitig;
  - schreibt `config.secretariat.approval = {approvedBy: auth.uid(), approvedAt: now(), fieldsSha256}`
    und setzt `enabled = true`;
  - schreibt einen Prüfpfad-Eintrag (bestehende Audit-Tabelle).
- `REVOKE EXECUTE … FROM anon, public`, `GRANT EXECUTE … TO authenticated`.
- Trigger `BEFORE UPDATE ON public.bots`: Bei Sekretariats-Bots
  (`config ? 'secretariat'`) dürfen `enabled → true` und Änderungen an
  `config.secretariat.approval` nur aus der RPC kommen (Session-Flag per
  `set_config('app.secretariat_approval', 'on', true)` innerhalb der RPC). Sonst Fehler.
- Ergänzt #2178 (Rollen). Reihenfolge: #2178 → A.

**B. Edge Functions (`_shared/bots.ts`):**
- `resolveBot`: Ist `config.secretariat` gesetzt, Hash der aktuellen Felder berechnen
  und mit `approval.fieldsSha256` vergleichen. Fehlt die Freigabe oder passt der Hash
  nicht: `BotError('secretariat not approved', 'FORBIDDEN', 403)`. Gilt damit für
  `bot-chat` und `whatsapp-webhook` zugleich.
- Ein gemeinsamer Hash-Baustein für Browser, RPC-Test und Edge, keine zweite Implementierung.

**C. Frontend (#2435-Nachfolger):**
- `approvalPatch` ruft die RPC auf statt `updateBot`.
- `SECRETARIAT_ACTIVATION_LOCKED = false` erst, wenn A und B LIVE und verifiziert sind.

## 4. Tests (Abnahmekriterien)

- DB-Test (`test/runtime/db/`):
  - Mitglied ohne Owner/Admin-Rolle → RPC verweigert.
  - Direktes `UPDATE enabled = true` auf einem Sekretariats-Bot → verweigert.
  - Gefälschter Hash per `UPDATE` → verweigert.
  - Owner → RPC erfolgreich, Hash entspricht dem serverseitig berechneten.
  - Fremder Mandant → verweigert.
- Edge-Test: Bot mit veralteten Feldern oder ohne Freigabe → `403`; mit gültiger
  Freigabe → `200`.
- Negativtest: `tenant_id`, `approvedBy` oder Hash im Request-Body werden ignoriert.

## 5. Deployment-Wirkung

- A: Ein Merge in `main` führt über `deploy.yml` automatisch `supabase db push` aus
  (Job `db-push`, ohne Environment-Freigabe, siehe #2336). **Merge = Produktionsänderung.**
- B: Edge Functions deployen nur per `workflow_dispatch` mit Auswahl, nicht automatisch.
- C: Frontend-Merge deployt über Cloudflare Pages.

## 6. Offene Entscheidungen (Dominik)

1. Freigabe von A, B, C einzeln.
2. Soll der allgemeine Bot-Editor Sekretariats-Bots überhaupt aktivieren dürfen?
   Vorschlag: nein, nur über die Freigabe.
3. Reihenfolge mit #2178 und #2336 (Environment-Freigabe für `db push`).
