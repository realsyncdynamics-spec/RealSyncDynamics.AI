# Storage-Befund: offene Policy auf `bilder` und `dokumente`

Gemessen am 2026-09-07 gegen das Live-Projekt `ebljyceifhnlzhjfyxup`, nur mit
`SELECT`. Nichts wurde geändert. Die Behebung liegt als Migration bei und wird
erst nach Freigabe des Eigentümers gemergt.

## 1. Evidenz

**Policy** (`pg_policies`, `storage.objects`):

| Feld | Wert |
|---|---|
| policyname | `vault buckets full access` |
| cmd | `ALL` |
| roles | `{public}` |
| permissive | `PERMISSIVE` |
| qual | `(bucket_id = ANY (ARRAY['dokumente','bilder']))` |
| with_check | `(bucket_id = ANY (ARRAY['dokumente','bilder']))` |

**Buckets** (`storage.buckets`, `storage.objects`):

| Bucket | public | angelegt | file_size_limit | allowed_mime_types | Objekte | Eigentümer |
|---|---|---|---|---|---|---|
| `bilder` | false | 2026-07-15 | — | — | **0** | 0 |
| `dokumente` | false | 2026-07-15 | — | — | **0** | 0 |

## 2. Wirkung

`public` ist die Rolle, die jede Rolle einschließt — auch `anon`. Jeder
Aufrufer der Storage-API kann in beiden Buckets ohne Anmeldung Objekte lesen,
anlegen, überschreiben und löschen. Es gibt keinen Mandanten- und keinen
Nutzerbezug. `public = false` am Bucket verhindert nur den direkten URL-Abruf
ohne Token, nicht den API-Zugriff, der über diese Policy läuft.

Ausgenutzt wurde das nach heutigem Stand nicht: Beide Buckets sind leer.
Ein Missbrauch als anonymer Dateiablage (Upload durch Fremde) wäre aber
jederzeit möglich gewesen und ist es bis zur Behebung weiterhin.

## 3. Herkunft

- Keine Migration im Repo legt diese Buckets oder diese Policy an.
- Kein Code im Repo nutzt sie (`supabase/functions`, `src`, `workers`,
  `platform`, `scripts` durchsucht; Treffer für „dokumente" sind ein
  Skill-Kategoriename und ein Tab-Label, keine Bucket-Zugriffe).
- Damit ist das der dritte belegte Out-of-band-Eingriff in Produktion nach
  dem ACL-Vorfall (2026-08-23) und `onboarding-orchestrator` (2026-08-29),
  vgl. CLAUDE.md §5. Der Actor ist aus dem Log-Fenster nicht mehr
  rekonstruierbar: **UNKNOWN**.

## 4. Wer Zugriff braucht

Niemand im Repo. Der App Builder Workspace (Phase 2) verwendet diese Buckets
ausdrücklich nicht; Medien bekommen in Schritt E einen eigenen,
mandantenskopierten Bucket nach dem Muster von `audit-evidence`
(`<tenant_id>/…`, Policy gegen `memberships`).

## 5. Behebung (Vorschlag, nicht angewandt)

`supabase/migrations/20260907120000_storage_revoke_open_bucket_policy.sql`
entfernt genau diese Policy (`DROP POLICY IF EXISTS`). Buckets bleiben
bestehen; ihr Löschen ist eine Entscheidung des Eigentümers.

Alternative, falls die Buckets für ein geplantes Feature gedacht waren:
Policies nach dem Muster `audit_evidence_storage_tenant_read` mit
Mandantenpfad — dann aber mit einem Aufrufer im Repo, sonst ist es wieder ein
Recht ohne Zweck.

## 6. Nachmessung nach dem Deploy

```sql
select count(*) from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'vault buckets full access';   -- erwartet: 0
```

Und der Drift-Sweep, der diesen Fall künftig sieht: Der `Function ACL Drift
Guard` prüft Funktions-Grants, nicht Storage-Policies — derselbe blinde Fleck
wie beim RLS-Flag (CLAUDE.md §5). Ein Storage-Policy-Sweep gehört auf die
Liste, ist aber nicht Teil dieses PRs.
