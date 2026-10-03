# ADR 0012 — Decision-Intelligence Calibration

> **Status:** Proposed · 2026-09-21
> **Entscheid:** Eigentümer (GO 2026-09-21)
> **Related:** `ARCHITECTURE.md`, ADR 0001, ADR 0011 (D1: Policy autorisiert, Agent nicht)
> **Bindet:** den Slot `decision-intelligence` als Mess- und Freigabevertrag
>
> Schwellen, Stichproben und Drift-Gates leben nur hier und werden versioniert
> (`calibration_policy_version`). `ARCHITECTURE.md` verweist auf diese ADR.

**Scope:** Mess- und Freigabevertrag für den Slot `decision-intelligence`.

**Nicht im Scope:** Provider-Wiring (Jev oder andere), Execution-Pfad,
Auth (`enterprise-ai-os-agents-run`), `ai_policies`-Runtime, Migration, Deploy.

## Entscheidung

LLM / System Two erzeugt Text.
`decision-intelligence` liefert typisierte Decision + Confidence.
Die Policy Engine autorisiert.
Der Executor führt nur Freigegebenes aus.
Evidence beweist Input, Decision, Policy, Gate und Wirkung.

Der Provider autorisiert keine `tenant_id`, umgeht keine Policy und leitet
aus Confidence keine Execution ab.

Fail-closed: Timeout, ungültiges Schema, unbekannte Decision, fehlende
Confidence, nicht zugelassene Modell-/Schema-Version, fehlende Tenant-Policy,
fehlende Approvals, nicht bestandener Calibration-Gate.

Shadow-Ausgaben dürfen den Execution-Pfad nicht berühren.

Automatik gilt nie global für einen Provider. Freigabe-Schlüssel:

```
provider × model_id × schema_version × decision × policy_version
```

Kalibriertes `low_risk` impliziert nichts für `high_risk`. Modell- oder
Schema-Wechsel setzt die Kombination auf `shadow` zurück.

Vier getrennte Prädikate:

1. `schema_valid` — technische Zulässigkeit
2. `calibration_passed` — empirische Eignung
3. `policy_authorized` — Governance-Autorität
4. `execution_verified` — tatsächliche Wirkung

Kalibrierung ist Evidenz für die Verlässlichkeit eines Decision-Providers,
keine Autorisierung.

## Event (Shadow / Evidence)

Mindestfelder:

- `provider`, `model_id`, `schema_version`, `policy_version`
- `calibration_policy_version`
- `automation_gate_result` (`shadow` | `denied` | `human` | `automatic_permitted` | `automatic_blocked`)
- `input_hash` (Roh-PII nicht im Klartext)
- `decision`, `confidence`, `probabilities` falls geliefert
- `realsync_decision`
- `outcome` (`correct` | `incorrect` | `unknown`), `outcome_source`, `labeled_at`
- `latency_ms`, `error` / `timeout`

Ohne `outcome` zählt der Event nur für Coverage, nicht für ECE, Brier oder False-auto.

Segmente nicht mischen: Messung getrennt nach `schema_version`, Decision-Klasse,
und — wo Policies divergieren — Tenant-Segment.

## Metriken

### ECE und MaxCE

Bins: 10 gleich breite Intervalle oder adaptive Quantile bei dünnen Rändern.

```
ECE   = Summe_b  (n_b / N) * |acc(b) - conf(b)|
MaxCE = max_b |acc(b) - conf(b)|
```

### Brier gegen Prior-Baseline

Für die gewählte Decision gegen y_i in {0,1}:

```
Brier = (1/N) * Summe_i (c_i - y_i)^2
```

Baseline: konstante Klassenprior `p = (1/N) * Summe_i y_i`, Vorhersage `p`
für jedes Event.

Gate, eindeutig kleiner:

```
Brier_model <= Brier_baseline - Δ
```

`Δ` steht in Policy (`min_brier_improvement`, Default 0.02).
Die Formulierung „besser als Prior + Δ“ ist unzulässig.

### Threshold-Betrieb

Für jeden Kandidaten `t`:

| Metrik | Nenner | Frage |
|---|---|---|
| Coverage@t | N | Wie oft würden wir automatisieren? |
| Precision@t | Events mit c ≥ t | Wie oft stimmt Auto? |
| FalseAuto@t | Events mit c ≥ t | Wie riskant sind die Auto-Fälle? |
| FalseAutoPopulation@t | N | Wie viel Schaden erzeugt Automation insgesamt? |
| Escalation rate | N | Anteil c < t |

Definition:

```
FalseAuto@t            = (# falsch und c ≥ t) / (# Events mit c ≥ t)
                       = 1 - Precision@t
FalseAutoPopulation@t  = (# falsch und c ≥ t) / N
```

Beide gehören in den Report. Das Sicherheits-Gate für Automation nutzt
FalseAuto@t plus Untergrenze der Stichprobe oberhalb von `t`.

### Over-/Underconfidence

```
Bias = mean(c) - acc
```

- Bias > 0: zu sicher → Schwelle hoch oder Automation aus.
- Bias < 0: zu vorsichtig → Coverage-Verlust, kein Sicherheitsbeleg.

### Drift

Wöchentlich gegen letzte Baseline: ECE, Brier, mean(c), Klassenprior.

Bei ECE-Anstieg > `max_ece_delta` oder Prior-Shift über Policy-Δ:
`mode` dieser Kombination → `shadow`.

## Gates

Globale Kalibrierung (gelabeltes Segment der Kombination):

```
n_labeled            >= policy.calibration.min_labeled_events   // Default 200
ECE                  <= policy.calibration.max_ece              // Default 0.05
MaxCE                <= policy.calibration.max_maxce            // Default 0.10
Brier_model          <= Brier_baseline - policy.calibration.min_brier_improvement
schema_error_rate    == 0
```

`n >= 200` allein reicht nicht für hohe Schwellen. Zusätzlich pro Decision und `t`:

```
auto_samples(t)              >= policy.decisions[d].min_auto_samples
false_auto_upper_bound_95(t) <= policy.decisions[d].max_false_auto
```

`false_auto_upper_bound_95` = Wilson-Obergrenze (Default `confidence_level: 0.95`)
von FalseAuto@t. „0 Fehler aus 17 Auto-Fällen“ erfüllt ≤ 1 % nicht.

Schema-Validität ist kein Kalibrierungsbeleg. Roh-Accuracy ohne Bins ebenfalls nicht.

## Policy-Form (Verantwortungsgrenze)

`mode` gilt nicht für den Provider insgesamt, sondern für eine Freigabe-Kombination.

```yaml
decision_intelligence:
  # per provider × model_id × schema_version × decision × policy_version
  mode: shadow | human | automatic

  calibration:
    min_labeled_events: 200
    max_ece: 0.05
    max_maxce: 0.10
    min_brier_improvement: 0.02

  decisions:
    low_risk:
      threshold: 0.98
      min_auto_samples: 300
      max_false_auto: 0.01
      confidence_level: 0.95

  drift:
    max_ece_delta: 0.03
    max_prior_shift: 0.10
    action: shadow
```

Defaults oben sind Startwerte der ADR, keine Runtime-Wahrheit.
Änderung = neue `calibration_policy_version`.

## Freigabe-Reihenfolge

1. Nur Shadow. Execution unberührt.
2. Outcomes labeln.
3. Gates gegen gehaltenen Zeitraum, nicht gegen das Tuning-Set.
4. Schwelle und `min_auto_samples` in Policy, nicht im Code-Default.
5. `automatic` nur für die Decision-Werte der bestandenen Kombination.
6. Drift-Guard an; bei Rot diese Kombination auf `shadow`.

## Evidence-Zusatz

Neben den Event-Feldern verpflichtend:

- `calibration_policy_version` — welche statistische Regel galt
- `automation_gate_result` — warum Auto erlaubt oder blockiert wurde

Damit ist später belegbar, unter welcher Messregel eine automatische Ausführung
überhaupt zulässig war.

## Explizit nicht diese ADR

- Jev- oder sonstige Provider-Integration
- automatischer Execution-Pfad
- Änderung an `enterprise-ai-os-agents-run` / `verify_jwt`
- Änderung an `ai_policies`, Runtime, Auth oder Tenant-Logik
- Deploy oder Migration
