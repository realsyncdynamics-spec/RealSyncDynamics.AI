# Kanonischer Trichter — Entscheid und Integrations-Audit

**Entschieden am**: 2026-08-23
**Grundlage**: Messung gegen das Live-Projekt `RealSyncDynamicsLive`
(`ebljyceifhnlzhjfyxup`, eu-central-1, PostgreSQL 17)
**Status**: Entscheid verbindlich. Keine Implementierung — dieses Dokument
hält den Ist-Zustand und die Verträge fest, nicht einen Zielentwurf.

---

## 1. Der Entscheid

| | |
|---|---|
| **Kanonischer anonymer Einstieg** | `/audit` |
| **Kanonischer Audit-Datensatz** | `gdpr_audits` |
| **Kanonische Kennung** | `audit_id := gdpr_audits.id` |
| **Verworfen als kanonisch** | `/unified-entry/scan`, `/scan` + `public_site_scans` |
| **Aus dem verworfenen Pfad übernommen** | Analyse-Engine (`_shared/public-scan/*`), URL-/Host-Auswertung, Sicherheitskorrekturen, Tests |

### Verbindliche Verbote

- **Kein zweiter Audit-Datensatz.** `gdpr_audits` ist die Quelle.
- **Kein blindes Umbenennen** von `gdpr_audits.id`. Der externe Begriff
  lautet `audit_id`, die Spalte heisst weiterhin `id`. Der Vertrag bildet die
  Abbildung ab; eine Migration dafür wäre Aufwand ohne Gegenwert.
- **Kein zweites Claim-Modell.**
- **Kein zweites Pilot-Modell.**

### Warum `/audit` und nicht `/scan`

Nicht wegen architektonischer Überlegenheit, sondern wegen der gemessenen
Integrationslücke. `/audit` fehlt **ein** Baustein; `/scan` fehlt die
gesamte nachgelagerte Kette:

| | `/audit` | `/unified-entry/scan` | `/scan` |
|---|---|---|---|
| Function | `gdpr-audit` (deployt) | `cookie-scan` (deployt) | `public-site-scan` (**nicht deployt**) |
| Datensatz | `gdpr_audits` — **159 Zeilen** | **keiner** | `public_site_scans` — **Tabelle existiert live nicht** |
| Kennung | UUID, serverseitig | `urlscan-<Zeitstempel>` — **erfunden** | UUID, serverseitig |
| Teilen | RPC `audit_share_get` (SECURITY DEFINER) | — | — |
| Claim-Spalten | vorhanden | — | vorhanden |
| Claim-Writer | **fehlt** | — | vorhanden |
| Nachgelagert | E-Mail-Drip, PDF, Dokumente, `/onboarding/:scanId` | Weiche | — |

`/unified-entry/scan` scheidet zwingend aus: ohne Persistenz und mit
erfundener Kennung kann er per Definition nicht kanonisch sein.

---

## 2. Begriffsvertrag

```
audit_id  :=  gdpr_audits.id        (uuid, serverseitig erzeugt)
```

**Achtung, häufige Falle**: `gdpr_audits` hat **keine** Spalte `audit_id`.
Die Antwort von `gdpr-audit` nennt das Feld `audit_id`, die Datenbank nennt
es `id`. Wer im SQL nach `audit_id` sucht, findet nichts und schliesst
daraus fälschlich, die Zuordnung fehle.

Ebenso ist der Share-Weg **kein** eigener Token: `/audit/share/:token`
übergibt dieselbe UUID an `audit_share_get(p_id uuid)`. Die Spalte
`is_shareable` steuert die Freigabe, nicht ein zweites Geheimnis.

---

## 3. Integrations-Audit — vier Lücken, gemessen

> **Der wichtigste Befund**: Drei der vier Lücken lauten
> „existiert, wird aber nicht aufgerufen" — nicht „fehlt". Der Aufwand
> liegt im Verdrahten, nicht im Bauen.

### 3.1 Audit Claim — **fehlt** (der einzige echte Neubau)

Gemessen an 159 Zeilen in `gdpr_audits`:

| Merkmal | Wert |
|---|---|
| Zeilen gesamt | 159 |
| davon mit `tenant_id` | **0** |
| davon mit `claimed_at` | **0** |
| mit E-Mail | **159 (100 %)** |
| mit `ip_hash` | 159 |
| mit `sales_lead_id` | 159 |
| distinkte Domains | 20 |
| jüngster Eintrag | 2026-08-11 15:58 UTC |

**Autorisierungsgrundlage ist vorhanden**: Jeder Audit trägt eine E-Mail.
Der Server kann die Beziehung damit an einer eigenen Tatsache prüfen —
`gdpr_audits.email` gegen die **verifizierte** E-Mail des angemeldeten
Nutzers — statt einer Behauptung aus URL oder Client zu vertrauen.

**Der Haken hängt bereits an der richtigen Stelle und greift nicht zu**:
`src/pages/Welcome.tsx` liest nach dem Login `sessionStorage['rsd_pending_audit']`
— dort liegt die `audit_id`. Verwendet wird sie ausschliesslich für einen
Eintrag in `user_consents`; danach wird der Eintrag gelöscht. Die Kennung ist
im richtigen Moment vorhanden und wird weggeworfen.

**RLS ist bereits vorbereitet**: `gdpr_audits tenant_read` verlangt
`tenant_id IS NOT NULL AND is_tenant_member(tenant_id)`. Sobald der Claim
schreibt, wird der Audit für den Mandanten automatisch sichtbar; anonyme
Zeilen bleiben unsichtbar.

**Fehlt**: genau ein serverseitig autorisierter Writer auf
`(user_id, tenant_id, claimed_at)`.

### 3.2 Domain Enrollment — **existiert, kein Aufrufer**

`pilot_enroll_monitoring_source(p_tenant_id uuid, p_url text, p_name text)`
ist live vorhanden, `SECURITY DEFINER`, mit `search_path`-Bindung, und
sauber idempotent: Advisory-Lock auf `tenant_id + url`, Wiederverwendung
einer bestehenden Quelle, sonst Neuanlage mit `status='active'`,
`next_scan_at=now()`, `scan_frequency='daily'`.

| Messung | Wert |
|---|---|
| Aufrufer in `src/` und `supabase/functions/` | **0** |
| `monitoring_sources` | **0 Zeilen** |
| `monitored_domains` | 0 Zeilen |
| `websites` | 0 Zeilen |
| `scan_schedules` | 0 Zeilen |

**Wichtige Abgrenzung**: Die RPC schreibt `monitoring_sources` — **nicht**
`websites` und **nicht** `governance_assets`. Das ist der in
`reality-matrix.md` §2 beschriebene entkoppelte Monitoring-Stack. Wer sie
verdrahtet, erzeugt damit **keine** Governance-Assets. Beides muss die
Pipeline getrennt leisten.

### 3.3 Governance Initialization — **existiert vollständig, wird nie aufgerufen**

Das ist der überraschendste Befund. `supabase/functions/tenant-audit` ist
**deployt** und genau als Brücke gebaut:

```
Body:    { url, website_id? }
Header:  Authorization: Bearer <jwt>,  X-Tenant-Id: <uuid>
         (verify_jwt = true, Member-Check vor Pipeline-Start)

ruft intern gdpr-audit auf   → gdpr_audits bleibt Single Source of Truth
schreibt scan_runs           ← startScanRun(detector='gdpr-audit')
schreibt findings            ← recordScanFinding je Issue
schreibt runtime_events      ← audit.scan_started / _completed / _failed
liefert   { scan_run_id, correlation_id, finding_count, severity_max,
            gdpr_audit_id, score, severity }
```

Ein Aufrufer existiert sogar im Frontend:
`src/features/governance/scans/scansApi.ts` ruft `tenant-audit` über
`/functions/v1/tenant-audit`.

| Messung | Wert |
|---|---|
| `scan_runs` | **0 Zeilen** |
| `findings` | **0 Zeilen** |
| `governance_assets` | 1 Zeile |
| `tenant-audit` deployt | ja |

**Folgerung**: Die Governance-Initialisierung ist nicht zu bauen, sondern in
den Kundenpfad zu hängen. Sie liefert `gdpr_audit_id` zurück — die Brücke
zum kanonischen Datensatz ist bereits Teil ihres Vertrags.

### 3.4 Pilot — **eine Tabelle, zwei Erzeugungswege, zwei Karteileichen**

| Messung | Wert |
|---|---|
| `subscriptions` gesamt | 4 |
| `free_audit` / `active` | 3 |
| `growth` / `trialing` | 1 (mit Stripe-ID) |
| `tenants` / `memberships` | 4 / 4 |
| `entitlement_grants` | 0 |
| `customer_onboarding` | 0 |
| `tenant_activation` | 0 |

Die befürchteten „zwei unvereinbaren Trial-Modelle" bestehen **nicht auf
Datenebene**. Es gibt eine Tabelle und zwei Wege, sie zu füllen:

1. `create-trial-subscription` — kartenlos, ausschliesslich `growth`,
   14 Tage. Migration `20260811020648` hat eigens
   `subscriptions.stripe_customer_id` von `NOT NULL` befreit, damit ein
   Pilot ohne Stripe-Kunden existieren kann.
2. Stripe-Checkout mit `pilot=true` → Webhook.

Beide schreiben dieselben Felder. **Kanonische Semantik**:

```
plan_key      Plan            (befüllt)
status        Lebenszyklus    (active | trialing | …)
trial_start   Beginn          (befüllt, wo trialing)
trial_end     Ende            (befüllt, wo trialing)
```

**Zwei Karteileichen — nicht verwenden**:

| Spalte | Live-Befund | Code |
|---|---|---|
| `trial_ends_at` | in **keiner** Zeile gesetzt | 1 Datei |
| `plan_id` | in **allen** Zeilen NULL | 7 Dateien |

Wer den Claim oder das Gating auf `trial_ends_at` oder `plan_id` stützt,
baut auf einer Spalte, die in Produktion nie befüllt wurde.

---

## 4. Was das für PR #1129 bedeutet

Der PR bleibt fachlich wertvoll, aber sein **Persistenzmodell ist nicht
kanonisch**. Die Trennung:

**Übernehmen** — `_shared/public-scan/*` (Analyse-Engine-Anbindung, sechs
Kundenkategorien über acht Prüfdimensionen, Sprachregel als Test),
URL-/Host-Auswertung mit exaktem Hostvergleich, die drei
Sicherheitskorrekturen (Weiterleitungsprüfung je Sprung, begrenzte
Rückverfolgung, Streaming-Obergrenze), sämtliche Tests.

**Nicht zum Fundament machen** — `public_site_scans`, der Claim in
`public-site-scan`, `/scan` als eigener Trichter.

Das folgt der Reihenfolge **REUSE → FIX → EXTEND → MIGRATE → CREATE**:
Übernommen wird die Analysefähigkeit, nicht der vollständige Ablauf.

---

## 5. Nebenbefund: `production-edge-functions.ts` ist überholt

Gemessen am 2026-08-23 gegen das Live-Projekt: **177 von 177 Functions sind
deployt.** Das bestätigt `CLAUDE.md` §5 und widerlegt
`src/config/production-edge-functions.ts`, das weiterhin „103 deployt,
74 fehlend" (Messung 2026-08-19) und `EDGE_FUNCTIONS_OBSERVED_MAX = 103`
führt.

Die Datei mahnt diese Neumessung selbst an. Sie ist noch **nicht**
korrigiert, weil das eine Änderung an einer Messliste ist und in einen
eigenen Schritt gehört — nicht in einen Architekturentscheid.

Betroffen: Jede Oberfläche, die `isEdgeFunctionInProduction()` fragt, hält
74 laufende Functions für nicht verfügbar.

---

## 6. Reihenfolge — was als Nächstes gilt

Noch **keine** Implementierung. Die Verträge stehen jetzt; offen bleibt
eine Entscheidung, bevor gebaut wird:

**Zu entscheiden**: Welcher der beiden Pilot-Erzeugungswege gilt nach dem
Claim — der kartenlose 14-Tage-Growth-Pilot oder der Stripe-Weg mit
`pilot=true`. Erst danach ist definiert, in welchen Zustand ein
übernommener Audit seinen Mandanten versetzt.

**Danach** in dieser Reihenfolge, weil jeder Schritt den vorigen braucht:

1. **Claim-Writer** — der einzige echte Neubau. Autorisierung über die
   verifizierte E-Mail, nicht über `audit_id` aus der URL oder `tenant_id`
   aus dem Client. Einhängepunkt existiert (`Welcome.tsx`).
2. **Governance Initialization verdrahten** — `tenant-audit` in den
   Kundenpfad hängen. Kein Neubau.
3. **Domain Enrollment verdrahten** — `pilot_enroll_monitoring_source`
   aufrufen, und getrennt davon klären, wer `governance_assets` erzeugt.

Erst wenn diese Kette eine nachweisbare Spur erzeugt
(`scan_runs > 0`, `findings > 0`), ist der Boden für den Verdict Layer
tragfähig.
