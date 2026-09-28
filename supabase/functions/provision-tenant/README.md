# provision-tenant — Tenant-Boot (Release 1)

Ein idempotenter Provisioner: vom Account zum ersten Beweis in der
Evidence-Chain, ohne Setup-Call. Zwei Einstiege, ein Orchestrator.

| Einstieg | Auth | `trigger` |
|---|---|---|
| Self-Service / Free-Audit | User-JWT, Owner/Admin des Tenants | `self_service`, `free_audit` |
| Checkout, Sales, Agency-Child | Service-Role (nur serverseitig) | `checkout`, `sales`, `agency_child` |

`POST { tenant_id?, trigger?, domain? }` — ein zweiter Aufruf legt nichts
doppelt an und meldet den aktuellen Stand. Damit ist dieselbe Function auch
der Status-Endpunkt („ist mein Sensor verifiziert?").

## Schritte

| # | Schritt | Ergebnis | Offen, wenn … |
|---|---|---|---|
| 1 | `identity` | Tenant existiert, hat einen Owner | — |
| 2 | `entitlements` | Plan-Flags geladen (`api.access`) | — |
| 3 | `catalog` | `governance_assets` Website-Asset aus der Domain, letzter Scan-Score angehängt | keine Domain bekannt |
| 4 | `policy_bundle` | Baseline-Packs (DSGVO, TDDDG) + aktivierte Packs **als Tenant-Policies geklont**, `mode = observe` | — |
| 5 | `ingest_key` | ein Boot-Key (`connector_kind = boot`), nur `website_scanner`, 60/min, Klartext genau einmal | Plan ohne `api.access` |
| 6 | `installer` | Cloudflare-Worker-Skript + Verify-Aufruf | noch kein Heartbeat (`issued`) oder `stale` |
| 7 | `first_evidence` | `tenant.lifecycle.*` Events + Evidence nach `_shared/evidence-hash.ts` | Chain leer |

Stand je Tenant in `tenant_provisioning_runs` (lesbar für Mitglieder per RLS).
`completed` erst, wenn alle sieben `done` sind; dann einmalig
`tenant.lifecycle.boot_completed` in die Chain.

## Entscheidungen im Code

- **Observe zuerst.** `block`/`require_approval` werden beim Klonen zu `warn`;
  die Zielaktion steht in `governance_policies.enforce_action`. Scharfschalten
  ist ein bewusster zweiter Schritt, nicht Default.
- **Templates sind Katalog, keine Policies.** `policy_rule_templates` trägt
  keinen `tenant_id`; die Engine wertet weiterhin nur Tenant-Policies aus.
  Leere Bedingungen sind in Code und DB verboten (`{}` matcht jedes Event).
- **Worker statt Browser-Snippet.** Ein Key im Seiten-JS wäre für jeden
  Besucher lesbar. Im Worker ist er ein Secret (`wrangler secret put`).
- **`verified` nur durch ein Event.** `governance-ingest` setzt
  `first_event_at` beim ersten angenommenen Event. Es gibt keinen Klick, der
  „installiert" behauptet.
- **Lauf-Sperre** (2 min) verhindert parallele Boots. Evidence wird über
  `append_governance_evidence` (Compare-and-Swap auf den Kettenkopf, wie
  tenant-audit) angehängt — auch gegen andere Schreiber verzweigt die Chain nicht.
- **Lease-Fencing:** vor jedem Schritt prüft der Lauf, ob er die Sperre noch
  hält; nach einer Übernahme (`BOOT_SUPERSEDED`) erzeugt er keine Seiteneffekte mehr.
- **Nachweis-Pflichten aus dem Zustand:** jeder erledigte Schritt braucht seinen
  Lifecycle-Eintrag. Fehlt er (Abbruch zwischen Ressource und Evidence), trägt der
  nächste Lauf ihn nach und nutzt ein verwaistes Event wieder. `first_evidence`
  ist erst `done`, wenn alle Pflichten erfüllt sind — nicht schon bei irgendeinem
  Kettenkopf.

## Nicht in diesem Release

- **Produktentscheidung offen:** Starter hat kein `api.access`, der Boot endet
  dort `partial` bei `ingest_key`. Entweder Starter bekommt einen
  Sensor-only-Entitlement oder die Landing verspricht den Sensor erst ab Growth.
- Aufruf aus `stripe-webhook` (`trigger: checkout`) und aus dem Signup-Flow.
- Frontend: Boot-Status im Command Center, Worker-Download, Token-Deep-Link.
- Release 2: SDK-Init, gepackte Extension, GitHub App als weitere Sensoren.
- Release 3: Agency provisioniert Child-Tenants (`agency_child`) per Domain-Liste.
- Betriebsloop (Recurring Scan, Stale-Alert, Credit-Meter) und Offboarding
  (Pause → Export → Delete → Key-Revoke) als Gegenstück zum Boot.

Verhältnis zu `onboarding-orchestrator`: der bleibt unverändert (siehe dessen
README, bewusst nicht umformatiert). Er legt Profil, KI-System und Bot an und
aktiviert Packs; `provision-tenant` macht daraus eine laufende
Governance-Runtime. Zusammenführen erst mit einem bewussten Redeploy.
