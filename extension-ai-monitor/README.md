# RSD AI Usage Monitor — Browser Extension MVP

Erkennt AI-Nutzung auf 5 Vendoren, warnt bei sensiblen Daten im Prompt und
protokolliert Events ans RealSyncDynamicsAI Compliance-OS. **Log-only in v0,
kein Blocking.**

## Erkannte Vendoren

| Vendor | Domain |
|---|---|
| OpenAI ChatGPT | `chatgpt.com`, `chat.openai.com` |
| Anthropic Claude | `claude.ai` |
| Microsoft Copilot | `copilot.microsoft.com`, `m365.cloud.microsoft` |
| Google Gemini | `gemini.google.com` |
| Perplexity | `perplexity.ai`, `www.perplexity.ai` |

## Was wird erkannt

- `session_start` einmal pro Tab-Load auf einer Vendor-URL
- `prompt_sent` bei Submit (Enter ohne Shift) im Composer-Input
- `file_upload` bei Datei-Upload-Events (`<input type=file>`)

## Was wird **nicht** geloggt

Wir senden **keinen Prompt-Text** an das Backend. Nur Metadaten:
- Vendor, Modell (best-effort)
- Token-Schaetzung (Laenge / 3.5)
- PII-Hit-Typen (z.B. `["email", "phone_de"]`) — aber nicht die konkreten Werte
- Tab-Origin, Page-Title

## PII-Heuristik (clientseitig, kein Network-Call)

| Pattern | Erkennt |
|---|---|
| `email` | `name@domain.tld` |
| `phone_de` | `+49 …`, deutsche Nummern |
| `phone_intl` | International formatierte Nummern |
| `iban` | EU-IBAN-Format |
| `credit_card` | 13–19-stellige Zahlen mit Trennern |
| `german_tax_id` | Steuer-ID-Layout |
| `date_of_birth` | DD.MM.YYYY-Format |

Bei mind. 1 Hit auf externem Vendor: `risk_level = medium`. Auf MS Copilot
intern: `low`. Ohne Hit: `info`.

## Installation (Dev / Unpacked)

```bash
# 1. Repo clonen
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI
cd RealSyncDynamics.AI/extension-ai-monitor

# 2. Chrome / Edge / Brave öffnen → chrome://extensions/
# 3. "Developer Mode" aktivieren (oben rechts)
# 4. "Load unpacked" → Ordner extension-ai-monitor/ auswählen
# 5. Extension-Icon erscheint in Toolbar; Klick → Popup öffnet
```

Bei erstmaligem Install öffnet sich automatisch die Options-Page. Trage dort
ein:
- **Telemetry-Endpoint** (default: `https://realsyncdynamicsai.de/api/telemetry/ai-event`)
- **Tenant-Key** (UUID aus deinem RealSyncDynamicsAI-Workspace)
- *Optional:* User-Tag, Team

## Architektur

```
extension-ai-monitor/
├── manifest.json              MV3-Manifest, 5 host_permissions
├── src/
│   ├── background.js          Service-Worker: Telemetry-Forwarder + Counter
│   ├── content.js             Vendor-Detection + Submit-Listener + PII-Check
│   ├── popup.html / popup.js  Toolbar-Popup mit Heute-Stats
│   └── options.html / options.js  Tenant-Config-Page
└── README.md                  (diese Datei)
```

Kein Build-Step. Pure-JS, MV3-kompatibel, lädt ohne Bundler.

## Out of Scope (Folge-PRs)

- Policy-Enforcement (warn/block) — kommt mit `#138 Policy Enforcement`
- HMAC-Signing der Telemetry-Requests — kommt mit `tenant_api_keys`-Tabelle
- Batch-Send / Retry / Offline-Queue
- Chrome-Web-Store-Distribution
- Modell-spezifische Kontext-Window-Limits

## Privacy

Alle Konfig-Daten liegen ausschliesslich in `chrome.storage.local` — kein
Cloud-Backup, kein Sync. Telemetry-Events werden direkt an deinen
konfigurierten Endpoint gesendet (default: unsere Cloud, optional
selbst-gehostet).
