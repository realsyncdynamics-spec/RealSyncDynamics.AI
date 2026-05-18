# RealSync Dynamics AI
## Die Governance-Laufzeitumgebung für KI- und Tracking-Systeme im EU-Datenraum.

---

### Was wir nicht sind. Was wir sind.

| Wir sind nicht | Wir sind |
|---|---|
| OneTrust, Usercentrics, Cookiebot — Banner-Tools mit PDF-Export | Eine Runtime, die ihren eigenen Zustand kontinuierlich reported |
| Statische Compliance-Software mit jährlichem Audit-Zyklus | Ein Event-Feed mit kryptografisch versiegelter Evidence-Chain |
| Klassische AI-Scanner, die Modelle einmalig klassifizieren | Eine agentische Governance-Schicht, die in CI/CD und Approval-Flows eingreift |

---

### Drei Beweispunkte

**1. Event-Feed-Architektur.**
Jeder Scan, jede Drift-Detection, jede Agent-Action landet append-only auf
dem globalen Runtime-Feed. Kein Dashboard-Refresh, kein Aggregations-Job —
das System reported seinen eigenen Zustand in Echtzeit, vollständig
replaybar und historisierbar.

**2. Kryptografische Evidence-Chain.**
Jeder Audit-Trail-Eintrag wird heute mit einer SHA-256-Hash-Chain verkettet
(per-Tenant-Advisory-Lock, append-only). Manipulation am Audit-Log ist
nachweisbar — eine Eigenschaft, die für ISO 27001, EU AI Act Art. 12 und
DSGVO Art. 30 nicht verhandelbar ist. Ed25519-Signatur und RFC-3161-externes
Zeitstempeln stehen auf der Evidence-Roadmap.

**3. EU-Lokalisierung by Default.**
Datenebene auf Supabase Frankfurt (eu-central-1). AI-Inferenz wahlweise via
Cloud-Provider (Anthropic / Google / OpenAI) oder vollständig lokal via
Ollama (qwen3:4b) auf EU-Servern. Der `eu_local`-Toggle pro User und die
Workspace-Policy `enforce_eu_local` (siehe `profiles.ai_data_residency`)
entziehen die Verarbeitung dem CLOUD-Act-Risiko.

---

### Die vier Agenten

- **`website-drift-agent`** — erkennt strukturelle und tracking-relevante Änderungen auf überwachten Domains und schreibt Drift-Events in den Runtime-Feed.
- **`ai-risk-agent`** — klassifiziert AI-Systeme nach EU AI Act Annex III (minimal / limited / high / prohibited) und löst bei Risikostufenwechsel Approval-Gates aus.
- **`policy-agent`** — wertet deklarative Policies gegen den aktuellen Runtime-Zustand aus und blockiert non-compliant Deployments vor dem Build.
- **`evidence-agent`** — versiegelt Findings zu Evidence-Bundles, schreibt sie in den Vault und stellt sie als prüffähiges Paket für Auditoren bereit.

---

### Pricing-Logik

Wir verkaufen keine Seats. Wir verkaufen eine laufende Governance-Pipeline.

Enterprise-Lock-in entsteht nicht durch User-Lizenzen, sondern durch die
Evidence-Historie. Wer sechs Monate operative Compliance-Telemetrie in
unserer Chain liegen hat, hat einen prüffähigen Audit-Trail, den keine
Migration auf ein Konkurrenzprodukt rekonstruieren kann.

**Tier-Struktur** (Single Source of Truth: `src/config/pricing.ts`):
Free Audit (€0, einmalig) → Starter (€49/Mo) → Growth (€179/Mo) →
Agency (€499/Mo) → Enterprise (ab €998/Mo, individuell) —
gestaffelt nach Scan-Volumen, Evidence-Retention, Agent-Konfiguration
und Multi-Domain-Skalierung.

---

### Compliance-Anker

- **EU AI Act** — Risikoklassifikation Annex III, Art. 9 Risikomanagement, Art. 12 Logging, Art. 14 Human Oversight.
- **DSGVO** — Art. 30 Verzeichnis der Verarbeitungstätigkeiten, Art. 32 technische Maßnahmen, Art. 35 DSFA-Unterstützung.
- **ISO 27001** — Readiness durch manipulationssichere Audit-Logs und Evidence-Sealing.
- **DACH-Recht** — TTDSG, BDSG, DSG (CH/AT) im Policy-Katalog vorkonfiguriert.

---

### Audit gratis. Runtime kostet.

Kostenloser Erst-Audit unter **realsyncdynamicsai.de/audit** —
DSGVO-Scan, Tracker-Inventar, Risk-Score in unter 90 Sekunden.

Der Audit ist das Modul. Die Runtime ist das Produkt.

**Kontakt:** dominik@realsyncdynamics.de
**Web:** realsyncdynamicsai.de
**Sitz:** Neuhaus am Rennweg, Thüringen — Datenhaltung Frankfurt (eu-central-1)

---

**Nächster Schritt für Dominik:**

1. Datei reviewen, Korrekturen an Pricing-Sektion (5 Tier statt 6) und Evidence-Sektion (SHA-256 heute, Ed25519+RFC-3161 als Roadmap) bestätigen.
2. PDF rendern: `pandoc docs/positioning/positioning-onepager-de.md -o positioning-onepager-de.pdf --pdf-engine=xelatex -V mainfont="Syne" -V monofont="DM Mono" -V geometry:margin=2cm` (pandoc + xelatex müssen lokal installiert sein; Fonts: Syne und DM Mono sind Google-Fonts-Open-Source).
3. PDF an die ersten 3 Enterprise-Leads schicken — Betreff: „RealSync Dynamics AI — Governance Runtime, nicht Compliance-Tool".
4. SPA-Seite `/manifesto` oder `/positioning` als React-Route anlegen, die diesen Markdown rendert — damit eingehende Investor-Recherche direkt das richtige Narrativ findet.
