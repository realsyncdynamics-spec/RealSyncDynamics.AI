# Hostinger MCP-Server — Integration

Projekt-Scope MCP-Konfiguration für die Hostinger-Infrastruktur (VPS, DNS, Domains).
Die Server laufen **nur lokal in der Entwickler-Session** (Claude Code, Cursor, Claude
Desktop) — sie sind kein Teil des Frontend-Bundles, keiner Edge Function und keines
Deploy-Pfads.

Konfigurationsdatei: [`.mcp.json`](../../.mcp.json) im Repo-Root.

## Warum Projekt-Scope

Die Produktions-Infrastruktur läuft auf einem Hostinger-VPS (siehe
`.github/workflows/deploy-hostinger.yml`, `deploy/` — Traefik, Ollama, n8n) sowie auf
Hostinger-verwalteten Domains/DNS. `.mcp.json` liegt deshalb im Repo, damit jede/r im
Team dieselben Server-Definitionen bekommt; der **Token bleibt lokal** und wird per
`${HOSTINGER_API_TOKEN}` zur Laufzeit expandiert.

> **Niemals** einen echten Token in `.mcp.json` schreiben. Die Datei ist eingecheckt —
> ein Literal wäre ein committetes Secret.

## Konfigurierte Server

| Server | Binary | Zweck |
|---|---|---|
| `hostinger-hosting` | `hostinger-hosting-mcp` | Shared/Cloud-Hosting-Accounts, Websites |
| `hostinger-domains` | `hostinger-domains-mcp` | Domain-Portfolio, Registrierung, Transfer |
| `hostinger-dns` | `hostinger-dns-mcp` | DNS-Zonen und Records (Cutover, Verifikation) |
| `hostinger-billing` | `hostinger-billing-mcp` | Abos, Rechnungen, Zahlungsmethoden |
| `hostinger-reach` | `hostinger-reach-mcp` | E-Mail-Marketing (Hostinger Reach) |
| `hostinger-vps` | `hostinger-vps-mcp` | VPS-Instanzen, Snapshots, Firewall, Aktionen |
| `hostinger-ecommerce` | `hostinger-ecommerce-mcp` | Store-/Produktdaten |

Alle sieben stammen aus demselben npm-Paket `hostinger-api-mcp`, das pro Domäne ein
eigenes Binary ausliefert. Die Aufteilung statt eines einzelnen `hostinger-api-mcp`
(„all") hält die Tool-Liste pro Server klein und erlaubt, einzelne Bereiche
abzuschalten.

## Setup

1. **Token erzeugen** — hPanel → *Account* → *API* → *Generate new token*.
   Scope so eng wie möglich wählen: der Token kann DNS, VPS, Domains und Billing
   **schreibend** verändern.

2. **Token lokal hinterlegen** — in `.env.local` (gitignored, siehe `.gitignore` `.env*`):

   ```bash
   HOSTINGER_API_TOKEN="..."
   ```

   Damit Claude Code die Variable beim Server-Start sieht, muss sie in der Shell-Umgebung
   stehen, aus der die Session startet — z. B. via `set -a; source .env.local; set +a`
   oder über die Shell-Profil-/direnv-Konfiguration.

3. **Session neu starten.** Claude Code liest `.mcp.json` beim Start und fragt einmalig
   nach Freigabe der Projekt-Server (`/mcp` zeigt den Status).

Fehlt der Token, startet der Server, liefert aber bei jedem Aufruf einen Auth-Fehler von
der Hostinger-API — kein stiller Fallback.

## Betrieb

- `npx --package=hostinger-api-mcp@latest` zieht bei jedem Start die aktuelle Version.
  Für reproduzierbare Umgebungen kann `@latest` gegen eine feste Version getauscht werden.
- Node.js 20+ (identisch zum CI, siehe `deploy-hostinger.yml`).
- Server einzeln deaktivieren: Eintrag aus `.mcp.json` entfernen oder in der lokalen
  `.claude/settings.local.json` über `disabledMcpjsonServers` abschalten — so bleibt die
  geteilte Konfiguration unverändert.

## Sicherheit / Compliance

- Der Token ist ein **Infrastruktur-Credential**, kein Anwendungs-Secret: er gehört weder
  in Supabase-Vault noch in Edge-Function-Secrets, sondern ausschließlich in die lokale
  Entwickler-Umgebung.
- Kein `VITE_`-Prefix → keine Chance, ins Frontend-Bundle zu geraten.
- Schreibende Aktionen (DNS-Records, VPS-Neustart, Domain-Transfer) sind nicht
  transaktional und werden nicht in `ai_tool_runs` / `workflow_runs` geloggt — sie laufen
  außerhalb der Governance-Runtime. Änderungen an Produktions-DNS/VPS deshalb vorher
  ansagen und im jeweiligen Runbook dokumentieren (`docs/infra/`).
- Bei Verdacht auf Leak: Token im hPanel sofort widerrufen und neu erzeugen.
