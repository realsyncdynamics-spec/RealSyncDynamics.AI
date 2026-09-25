# Anbieter-/Deployment-Registry

Versionierte, quellenbelegte Fakten über KI-Anbieter und ihre Deployments. Die Registry ist die
Routing-Grundlage für das spätere Gateway v2. Sie enthält **nur Fakten**. Bewertungen gibt es
ausschließlich als Assessment-Snapshot (Tabelle `deployment_assessments`), die
Routing-Zulässigkeit wird immer **abgeleitet**.

> Grundsatz: Die Richtlinie entscheidet vor dem Aufruf, der Provider hat keine Autorität.
> Ausgewichen wird nur innerhalb der erlaubten Residency. Gibt es keinen Kandidaten, lautet das
> Ergebnis `NO_COMPLIANT_PROVIDER_AVAILABLE` mit `attemptedProviders`.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `schema/common.schema.json` | Gemeinsame Bausteine (Fakt, Quelle, Region, Fähigkeit, Zertifikat, Claim …) |
| `schema/vendor.schema.json` | Rechtsträger (z. B. `schwarz-digits-cloud`), nicht die Marke (STACKIT) |
| `schema/deployment.schema.json` | Das bewertbare Deployment: Produkt, Region, Connector, Jurisdiktion, Fähigkeiten, Claims, Preise, Modelle |
| `schema/assessment.schema.json` | Assessment-Snapshot (nur Beispiele/Fixtures im Repo, echte Snapshots liegen in der DB) |
| `vendors/<vendor_id>.json` | eine Datei je Rechtsträger |
| `deployments/<deployment_id>.json` | eine Datei je Deployment |
| `assessments/` | leer, siehe `assessments/README.md` |

Reiner Code, ohne DB, Netz oder Uhr:
`supabase/functions/_shared/registry/` (`types.ts`, `residency.ts`, `invariants.ts`,
`inputsHash.ts`). Gates: `scripts/registry/`.

Die Validierung läuft als **echtes JSON Schema Draft 2020-12** (`ajv/dist/2020` + `ajv-formats`,
`strict: true`). `strictRequired` ist abgeschaltet, weil `if/then`-Zweige Properties verlangen, die
im Elternschema definiert sind. Das ist das übliche 2020-12-Muster, etwa „verified ⇒ verification“.
Gelesen wird nur `.json`, YAML ist noch nicht freigegeben: Das Parse-Gate meldet solche Dateien
als `UNSUPPORTED_EXTENSION`.

## Form eines Fakts

```json
{ "value": ..., "status": "claimed", "sources": [{ "url": "https://…", "captured_at": "2026-09-26", "locator": "…" }], "captured_at": "2026-09-26", "note": "…" }
```

- `verified`: von RealSyncDynamics unabhängig geprüft. Braucht einen `verification`-Nachweis
  (Methode, Zeitpunkt, Prüfer, `evidence_ref`).
- `claimed`: durch eine Anbieterquelle belegte Selbstauskunft. Mindestens eine Quelle ist Pflicht
  (Evidence-Gate).
- `unknown`: keine belastbare Quelle. Der Wert ist dann `null` bzw. `[]`.

Regeln: Nichts ergänzen, was die Quelle nicht sagt. Kontextfenster wie „128k“ werden als
`128000` erfasst, also als Untergrenze. Zertifikate zählen nur für die Produkte in
`applies_to_sku`; eine leere Liste heißt „keinem Produkt zurechenbar“. Vererbung von der Marke auf
ein Produkt gibt es nicht. Der Drittstaatenzugriff ist ein Fakt (`no_access_claimed` |
`access_possible` | `access_confirmed` | `unknown`), nie ein Immunitäts-Flag, und wird nie aus der
Region abgeleitet. Felder wie `cloud_act_safe`, `routing_allowed` oder `result` verbietet das
Schema (`additionalProperties: false`), zusätzlich prüft das Policy-Gate sie in allen Werten.

## Residency-Klassen und Ableitungsregel

`residency.ts` ist rein und fail-closed. Außerhalb von `GLOBAL_ALLOWED` gilt:

| Klasse | zulässig, wenn die (Modell-, sonst Deployment-)Inferenzregion … |
|---|---|
| `DE_ONLY` | `scope=country` und alle Ländercodes = `DE` |
| `EU_ONLY` | `scope=eu` oder `scope=country` mit allen Codes in der EU-27 |
| `EU_EFTA` | zusätzlich `scope=eu_efta` oder Codes in EFTA (IS, LI, NO, CH) |
| `GLOBAL_ALLOWED` | immer |

Nie zulässig (außer `GLOBAL_ALLOWED`) sind: Region `unknown`, `europe` oder `global`, eine Region
ohne Quelle und `external_inference_egress = true`. Ist der Egress unbelegt oder der
Drittstaatenzugriff nicht ausgeschlossen, führt die Ableitung das als Bedingung
(`conditions`), nicht als Zulassung. Monotonie: DE_ONLY ⊂ EU_ONLY ⊂ EU_EFTA ⊂ GLOBAL_ALLOWED.
`routeCandidates()` wendet danach allowed/denied vendors, geforderte Fähigkeiten (nur
`support=yes` mit Quelle zählt), Kontextlänge, Sprachen und Modellverfügbarkeit an.

Stand der fünf Dateien vom 2026-09-26:
- DE_ONLY: IONOS und STACKIT
- EU_ONLY: zusätzlich Scaleway und OVHcloud
- EU_EFTA: zusätzlich Mistral EU. Die Region ist zulässig, aber die Modellverfügbarkeit am
  EU-Endpunkt ist unbelegt, deshalb gibt es bis zur Prüfung per `/v1/models` keinen Kandidaten.

## Gates

| Script | prüft |
|---|---|
| `npm run registry:parse` | lesbares JSON, keine leeren Dateien, keine nicht freigegebenen Formate |
| `npm run registry:schema` | JSON Schema 2020-12 |
| `npm run registry:referential-integrity` | Dateiname = ID; IDs eindeutig; Vendor, Betreiber, Modell, Preiskategorie, Claim-Subjekt, Zertifikats- und Siegel-SKU existieren; `captured_at` nicht in der Zukunft; `valid_until ≥ valid_from`; Assessment-Referenzen |
| `npm run registry:evidence` | jeder `claimed`/`verified`-Wert hat eine Quelle; kein PASS/CONDITIONAL aus unbelegten Claims; `inputs_hash` stimmt; Snapshot stellt Evidenz nicht besser dar als die Registry |
| `npm run registry:policy-invariants` | Invarianten (a)–(e) auf Snapshots; Residency-Ableitung monoton und fail-closed; keine abgeleiteten Werte in Fakten |
| `npm run registry:check` | alle fünf |
| `npm run registry:import:dry-run` | Import-Plan Datei → Tabellenzeilen, **schreibt nichts** |

Die Gates laufen im `unit`-Job über `test/registry/registry-gates.test.ts` gegen `registry/`, ein
leeres Verzeichnis, das gültige Fixture und gezielte Negativ-Mutationen. Ein eigener Schritt im
`gates`-Job ist optional und kann nur mit Workflow-Scope ergänzt werden:

```yaml
      - name: Registry-Gates
        run: npm run registry:check
```

## Import-Pfad (Datei → Tabelle)

Migration `supabase/migrations/20260926020000_vendor_deployment_registry.sql`, ohne Seeds.
Der Import-Job (service_role, eigener Schritt) übernimmt genau die Zeilen aus
`scripts/registry/import-dry-run.ts`:

| Datei | Tabelle | Spalten (Auszug) |
|---|---|---|
| `vendors/*.json` | `registry_vendors` | `vendor_id`, `display_name`, `legal_name(_status)`, `legal_seat_country`, `brands`, `control_change_status`, `facts` (ganze Datei), `source_file`, `source_sha256` |
| `vendors/*.json` → `certifications[]` | `registry_certifications` (`owner_kind=vendor`) | `cert_id`, `scheme`, `scope`, `applies_to_sku`, `status`, `sources`, `captured_at`, `valid_from/until` |
| `deployments/*.json` | `registry_deployments` | Identität, `connector_type`, `api_base_url`, `inference_region_*`, `external_inference_egress(_status)`, `third_country_access_status`, `third_country_requires_review`, `eu_commission_seal_*`, `pricing_scheme`, `capabilities`, `pricing`, `jurisdiction`, `facts` |
| `deployments/*.json` → `models[]` | `registry_models` | `model_id`, `api_model_id`, `model_type`, `availability`, Modellregion, `price_category` **oder** `price`, `capabilities`, `facts` |
| `deployments/*.json` → `certifications[]` | `registry_certifications` (`owner_kind=deployment`) | wie oben |
| `deployments/*.json` → `claims[]` | `registry_claims` | `claim_id`, `claim_type`, `model_ids`, `value`, `statement`, `status`, `sources`, `captured_at` |

Mandantendaten (`tenant_deployment_configs`) und Snapshots (`deployment_assessments`) kommen nicht
aus Dateien.

## Neuen Anbieter aufnehmen

1. `vendors/<vendor_id>.json` für den Rechtsträger anlegen, Belege aus der Quelle übernehmen.
2. `deployments/<deployment_id>.json` je Produkt und Region anlegen. Nur Belegtes eintragen,
   den Rest als `unknown` erfassen.
3. `npm run registry:check` und `npx vitest run test/registry` ausführen.
