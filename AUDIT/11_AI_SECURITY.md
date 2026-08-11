# 11 — AI / LLM Security

## 1. Integrationspunkte

| Ort | Provider | Auth | Prod |
|---|---|---|---|
| `ai-gateway` | provider-neutral (Ollama/LM Studio/Cloud) | **öffentlich, `verify_jwt=false`** | ✅ |
| `website-operations-agent` | Anthropic | **keine** | ❌ |
| `website-maintenance-agent` | Anthropic | **keine** | ❌ |
| `enterprise-ai-os-agents-run` | intern | **keine** | ✅ |
| `bot-chat`, `bot-voice-webhook` | LLM | **keine** | ✅ |
| `market-scanner`, `legal-embed`, `legal-retrieve` | div. | teilweise | ✅ |
| weitere 12 Functions mit `ANTHROPIC_API_KEY` | Anthropic | gemischt | gemischt |

---

## 2. Bedrohungen

| Bedrohung | Befund | Bewertung |
|---|---|---|
| **Prompt Injection (direkt)** | Nutzertext geht ungefiltert in Prompts (`website-operations-agent`, `bot-chat`). Keine Delimiter-Strategie, kein Injection-Filter gefunden | ⚠️ offen |
| **Indirekte Injection** | `cookie-scan-deep`, `market-scanner`, `website-maintenance-agent` verarbeiten **fremde Website-Inhalte**. Eine präparierte Seite kann Anweisungen in das Modell einschleusen | ⚠️ offen |
| **System-Prompt-Leak** | Keine Schutzmaßnahme; Prompts enthalten keine Secrets (geprüft) | ⚠️ gering |
| **Tool-Missbrauch / Excessive Agency** | ✅ **Positiv:** `skills`-Function ist explizit „Routing only. KEIN externer LLM-Call, KEINE Persistenz, KEINE Auto-Aktion." `enterprise-ai-os-agents-run` prüft `agentId` gegen eine 8er-Whitelist. Kein Modell kann beliebige Tools aufrufen | ✅ gut begrenzt |
| **Daten-Exfiltration** | Kunden-Governance-Daten gehen an US-Provider (D-3). Kein tenant-weiter „EU-only"-Schalter | ⚠️ |
| **Tenant-Kontext-Leak** | `ai-gateway` ist tenant-los; `enterprise-ai-os-agents-run` nimmt `tenantId` aus dem Body ohne Prüfung (F-05) | ⚠️ |
| **Cross-Session-Memory-Leak** | RFC-003 `governance_memory` ist tenant-skaliert — aber **nicht in Produktion** | GRAU |
| **SSRF über Tools** | `cookie-scan-deep` (**ohne Auth**) und `market-scanner` holen client-gelieferte URLs. Kein Private-IP-/Metadata-Endpoint-Blocker gefunden | ⚠️ **relevant** |
| **Shell-Ausführung** | ✅ Nur `kodee` — JWT + Action-Allowlist + `shellQuote()`. **Kein Modell kann Shell-Argumente beeinflussen** | ✅ sauber getrennt |
| **Credential-Exposure** | ✅ Keys ausschließlich in Deno-Env / Vault, nie im Prompt | ✅ |
| **Unsichere Auto-Remediation** | `compliance-remediation-execute` führt Aufgaben aus; `requires_approval`/`approved_by` sind im Datenmodell vorhanden → Human-in-the-Loop ist vorgesehen. Function **nicht deployt** | ✅ Design ok, ⚠️ ungetestet |

---

## 3. Die vier Kernfragen

**„Welche Tools kann das Modell aufrufen?"**
Keine im klassischen Sinn. Es gibt keine LLM-Tool-Loop mit dynamischem Tool-Aufruf —
die Agenten sind fest verdrahtete Ablaufketten mit `agentId`-Whitelist. Das begrenzt
die Angriffsfläche erheblich und ist eine bewusste, gute Designentscheidung.

**„Auf welche Credentials haben diese Tools Zugriff?"**
Die Edge-Function-Umgebung hält `SUPABASE_SERVICE_ROLE_KEY` und
`ANTHROPIC_API_KEY`. Ein Modell erreicht sie nicht direkt — aber jede
Prompt-Injection, die den Ablauf beeinflusst, wirkt in einem Prozess, der den
Service-Role-Key besitzt.

**„Kann Nutzerinhalt Tool-Argumente beeinflussen?"**
Bei `kodee`: **nein** (Allowlist + Quoting). Bei `website-operations-agent` und
`cookie-scan-deep`: **ja**, URLs und Freitext fließen ungefiltert ein.

**„Kann ein Modell auf einen fremden Tenant zugreifen?"**
Über `enterprise-ai-os-agents-run` ist `tenantId` client-kontrolliert und ungeprüft
(F-05) — die Antwort lautet also **ja**, nicht durch das Modell, sondern durch den
Aufrufer.

**„Kann es Produktion verändern?"**
`kodee` kann per SSH auf den VPS wirken, aber nur über die Action-Allowlist und nur
für Verbindungen, deren Eigentümer der authentifizierte Nutzer ist. **Keine
unbeschränkte Shell-Fähigkeit gefunden** — das ist der wichtigste positive Befund
dieses Kapitels.

---

## 4. Findings

| ID | Sev | Kurz |
|---|---|---|
| F-AI1 | P1 | `cookie-scan-deep` ist unauthentifiziert und holt beliebige URLs → SSRF-Proxy |
| F-AI2 | P2 | Keine Prompt-Injection-Abwehr bei der Verarbeitung fremder Website-Inhalte |
| F-AI3 | P2 | Kein tenant-weiter „EU-only-Inferenz"-Schalter trotz vorhandenem Ollama |
| F-AI4 | P3 | Kein einheitliches Logging aller Provider-Calls (`ai-gateway` wird nicht von allen Aufrufern genutzt) |
| F-AI5 | — | ✅ Keine dynamische Tool-Loop, keine modellgesteuerte Shell — Excessive Agency strukturell vermieden |
