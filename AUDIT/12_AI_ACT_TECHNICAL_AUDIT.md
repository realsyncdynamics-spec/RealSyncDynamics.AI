# 12 — EU AI Act: technische Umsetzung

**Kein Rechtsrat (Rule 11).** Geprüft wird ausschließlich, ob die *Software* die
beworbenen Governance-Mechanismen implementiert und ob sie in Produktion läuft.

---

## 1. Mechanismen

| Mechanismus | Implementierung | Repo | Produktion |
|---|---|---|---|
| KI-System-Registry | `ai_systems`, `enterprise_ai_system_registry`, `governance_assets` | ✅ | ✅ Tabellen vorhanden |
| Risikoklassifizierung | `ai_act_class ∈ {minimal, limited, high, prohibited, unknown}`, `ai-act-classify` | ✅ | ✅ Function deployt |
| Auto-Klassifizierung | `ai-act-auto-classify` | ✅ | ❌ **404** |
| Risiko-Metadaten | `data_types`, `contains_personal_data`, `contains_sensitive_data`, `external_usage` | ✅ | ✅ |
| Risiko-Score | `governance-risk-score` — transparent gewichtet, dokumentiert | ✅ | ⚠️ deployt, **ohne Auth (F-04)** |
| Risiko-Historie | `asset_risk_history` mit Begründung + beitragenden Event-IDs | ✅ | ✅ |
| Modell-/Provider-Registry | `governance_agent_registry`, `vendors` | ✅ | teilweise |
| Verwendungszweck | `usage_context`, `intended_purpose` | ✅ | ✅ |
| Menschliche Aufsicht | `governance_approvals` + `governance-approvals` (Approval erzeugt Evidenz) | ✅ | ✅ **funktioniert** |
| Protokollierung | `runtime_events` (Hash-Chain), `ai_tool_runs`, `workflow_runs` | ✅ | ✅ |
| Tool-Call-Logging | `log-tool-run` | ✅ | ❌ **404** |
| Transparenz | Policy `human_review`, `logging_required` in `POLICY_TYPES` | ✅ | ✅ |
| Dokumentation | `dpias`, `generate-compliance-report`, ISO-42001-Familie | ✅ | ❌ Reports **404** |
| Incident-Management | `governance_incidents`, `incidents`, `governance-risk-escalate` | ✅ | ❌ **Tabelle + Function fehlen** |
| Monitoring | Sentinel-Loop, SLO-Tracking | ✅ | ⚠️ Scheduler **404** |
| Versionierung | `governance_agent_registry.version`, `spec_version` auf Events | ✅ | ✅ |
| Evidenz | Hash-Chain + Ed25519 | ✅ | ⚠️ Vault-Layer **404** |

---

## 2. Test: erzeugt ein Modellwechsel die geforderten Artefakte?

| Erwartet | Befund |
|---|---|
| Versions-Event | `governance_agent_registry.version` existiert; **kein Trigger/Hook gefunden**, der bei Änderung automatisch ein `runtime_event` erzeugt |
| Risiko-Neubewertung | `governance-risk-score` kann neu rechnen — **wird aber nicht automatisch durch einen Modellwechsel ausgelöst** |
| Evidenz | entstünde nur, wenn ein Event geschrieben wird — siehe oben |
| Prüfpfad | `governance_admin_log` wird bei CRUD über `governance-resources` bedient ✅ |
| Benachrichtigung | `governance_webhooks` vorhanden; Zustellung (`webhook-deliver`) **nicht deployt** |

**Ergebnis: TEILWEISE.** Die Datenstrukturen sind vollständig, die *automatische
Verkettung* Modelländerung → Neubewertung → Evidenz → Benachrichtigung ist nicht
implementiert. Das ist eher ein Orchestrierungs- als ein Modellierungsproblem.

---

## 3. Test: was protokolliert ein KI-Aufruf tatsächlich?

Anforderung aus dem Auftrag vs. `runtime_events` / `ai_tool_runs`:

| Feld | Vorhanden | Quelle |
|---|---|---|
| MODEL | ✅ | `ai_tool_runs` |
| VERSION | ⚠️ | `spec_version` bezieht sich auf das Event-Schema, nicht auf das Modell |
| PROVIDER | ✅ | `ai_tool_runs` |
| TIMESTAMP | ✅ | `ts`, `ingested_at` |
| USER | ⚠️ | nur pseudonymisiert über `subject_ref` |
| TENANT | ✅ | `tenant_id` |
| PURPOSE | ✅ | `type`, `source` |
| INPUT CLASSIFICATION | ⚠️ | `data_types` auf Asset-Ebene, nicht pro Aufruf |
| RISK | ✅ | `severity`, `risk_level` |
| OUTPUT | ⚠️ | `payload`, nicht standardisiert |
| POLICY | ✅ | `policy_action` |
| DECISION | ✅ | `review_status` |
| HUMAN REVIEW | ✅ | `governance_approvals` |
| EVIDENCE ID | ✅ | `evidence_refs[]` |

**9 von 14 vollständig, 5 teilweise.** Für ein Produkt, das genau diese Nachweiskette
verkauft, sind „Modellversion pro Aufruf" und „Input-Klassifikation pro Aufruf" die
wichtigsten Lücken — beide sind mit additiven Spalten schließbar.

---

## 4. Bewertung

**AI Governance Readiness: 45/100.**

Das Datenmodell ist das stärkste Element des gesamten Produkts — durchdacht,
EU-AI-Act-nah, mit echter Evidenzverkettung und funktionierender menschlicher
Aufsicht. Es scheitert an drei Stellen:

1. Zentrale Module laufen nicht in Produktion (F-01/F-02).
2. Die Automatisierung zwischen den Bausteinen fehlt (§2).
3. Der Risiko-Score, das sichtbarste Governance-Artefakt, ist **von außen
   fälschbar** (F-04) — was den Nachweiswert des gesamten Moduls untergräbt.
