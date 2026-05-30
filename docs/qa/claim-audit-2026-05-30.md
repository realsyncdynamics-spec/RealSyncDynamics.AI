# Claim-Audit — Capability vs. Marketing (2026-05-30, Phase 4)

> Prüft Marketing-/UI-Texte gegen echte Features. Ziel: keine Über-Claims. Ergänzt `docs/qa/claim-to-feature-audit.md`.

## Geprüfte Claim-Klassen + Befund
| Claim-Muster | Befund | Maßnahme |
|---|---|---|
| **„Runtime Enforcement" / „enforced"** | `GovernancePage` zeigt `status: 'enforced'` — ist aber **explizit als Demo gerahmt** („Demo-Runtime · simulierte Werte · keine Kundendaten"). Kein Live-Über-Claim. | **Keine Änderung** (korrekt gelabelt). IST-Enforcement ist Observe/Evidence (ADR/P0c). |
| **„Echtzeit / Real-time"** (Monitoring ist cron-basiert) | `ToolsHub` „Echtzeit-Warnungen" war irreführend (Monitoring = periodische Re-Scans). | **Geändert** → „kontinuierliches DSGVO-Monitoring (geplant-zyklische Re-Scans) … Drift-Warnungen". |
| „Real-time" in Vertical-Landings (HealthTech/FinTech Triage/Fraud) | beschreibt **Kunden-Use-Case** (deren KI), nicht unser Monitoring. | **Keine Änderung** (kein Eigen-Claim). |
| „Realtime-Biometrie / Realtime" in AI-Act-Texten | **regulatorische Terminologie** (Art. 5). | **Keine Änderung**. |
| **„Vollautomatisch / vollständig automatisiert"** | Einziger Treffer `PartnersPage:226` **verneint** Vollautomatik aktiv („…keine menschliche Prüfung" → Human Oversight Art. 14). | **Keine Änderung** (bereits ehrlich). |
| `HumanVerificationGate`-Flows (DatenschutzGenerator/BusseldRechner/AuditShare) | bereits in früherem Self-Service-Audit auf „automatisch vorbereitet" / „ersetzt keine Rechtsberatung" gesetzt. | **Bestätigt sauber**. |

## Ergebnis
**1 substantielle Korrektur** (ToolsHub „Echtzeit" → „geplant-zyklisch"). Alle übrigen geprüften Claims sind entweder als Demo gerahmt, regulatorische Terminologie, Kunden-Use-Case oder bereits ehrlich entschärft. Die Plattform über-claimt im IST **nicht** „Runtime-Enforcement" oder „Vollautomatik" als Live-Fähigkeit.

## Leitlinie (für künftige Copy)
- Monitoring = „kontinuierlich/geplant-zyklisch", **nicht** „Echtzeit" (bis Streaming-Telemetrie live).
- Enforcement = „Monitoring/Evidence-Mode" / „Observe", **nicht** „erzwingt/blockiert" (bis P0c hard-enforce live).
- Generatoren mit Human-Gate = „automatisch vorbereitet", **nicht** „vollautomatisch".
