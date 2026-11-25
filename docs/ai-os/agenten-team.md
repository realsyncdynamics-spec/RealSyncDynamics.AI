---
title: Agenten-Team (10 Rollen) — Zielbild, Ist-Stand, Berechtigungen
owner: Plattform-Betrieb
reviewed: 2026-11-25
status: preview
---

# Agenten-Team — CHIEF bis FLOW

Zielbild: zehn Claude-Agenten für den **Betrieb** von RealSync Dynamics AI. Dieses Dokument
trennt das Zielbild vom Ist-Stand. Die Agenten sind als Claude-Code-Subagenten angelegt
(`.claude/agents/*.md`). Eine Managed-Agents-Laufzeit, eigene MCP-Dienste und Budgetgrenzen sind
**noch nicht** vorhanden (§3, §6).

Abgrenzung: Das Register `packages/ai-os-core` beschreibt die Betriebsrollen des Command Center
(`development`, `compliance`, `infrastructure`, `business-ops`, `knowledge`). Das Team hier ist die
Ausführungsebene in Claude Code. Die Zuordnung steht in §2. Eine Zusammenführung ist offen (§7).

## 1. Aufruf

| Weg | Wann |
|---|---|
| `claude --agent chief` | Vorhaben steuern, CHIEF darf Fachagenten starten |
| `claude --agent flow` | Automationsketten, FLOW darf `rea`, `nova`, `deputy`, `atlas`, `data` starten |
| In einer Sitzung: „Nutze den Agenten `deputy` für …“ | Einzelauftrag an einen Fachagenten |
| `/rea <Arbeitspaket>` | Arbeitspaket an REA (bestehend) |

Die Liste `Agent(…)` im `tools`-Feld begrenzt die startbaren Agenten nur, wenn der Agent als Hauptsitzung
läuft. Als Subagent gilt sie nicht ([Claude-Code-Doku „Subagents“](https://code.claude.com/docs/en/sub-agents),
abgerufen 25.11.2026).

## 2. Rollen

| Agent | Datei | Modell | Profil | AI-OS-Rolle | Vorgeladene Skills | Darf ändern (Regel, §4.1) |
|---|---|---|---|---|---|---|
| CHIEF | `chief.md` | opus | – | – | core | nur `docs/ai-os/` |
| DEPUTY | `deputy.md` | sonnet | QA | development (Review) | core | nichts |
| REA | `rea.md` | sonnet | je Auftrag | development | core | Code auf eigenem Branch |
| NOVA | `nova.md` | sonnet | Security | compliance, infrastructure | core, `aios-security-audit`, `aios-compliance-verification` | nichts |
| VIO | `vio.md` | haiku | Voice Runtime | – | core | `apps/agent-runtime/` |
| MOTION | `motion.md` | sonnet | Website | – | core | Briefings/Prompts in `docs/content/` |
| ATLAS | `atlas.md` | sonnet | – | knowledge | core, `aios-knowledge-update` | `docs/ai-os/` |
| MIRA | `mira.md` | sonnet | Website | – | core | Entwürfe in `docs/content/`, `docs/sales/` |
| DATA | `data.md` | sonnet | – | business-ops | core, `aios-business-report` | Analyse-Skripte im Scratchpad |
| FLOW | `flow.md` | sonnet | DevOps | infrastructure | core, `aios-ci-failure-analysis` | Routinen/Functions auf Branch |

`core` = `.claude/skills/realsync-agent-core/SKILL.md`. Dort sind die 20 Pflichtskills gebündelt (§5).
Modellwahl nach Zielbild: Opus nur für CHIEF. NOVA nutzt Sonnet, kritische Bewertungen gehen per
CHIEF zusätzlich an Opus. VIO nutzt Haiku, FLOW Sonnet, weil Agentenketten Zuverlässigkeit brauchen.

## 3. Systeme und MCP — Ist-Stand

Stand 25.11.2026, aus der Claude-Code-Cloud-Sitzung des Kontoinhabers. „Gelistet“ heißt, der Connector
taucht als Tool auf. Funktionstests gab es dafür nicht.

| System | Ist | Bemerkung |
|---|---|---|
| GitHub | gelistet (Sitzungs-MCP) | Plugin-Variante scheitert an der Autorisierung, der Sitzungs-MCP ist maßgeblich |
| Supabase | gelistet | Werkzeug kann schreiben (`execute_sql`, `apply_migration`), lesend nur per Regel |
| Cloudflare | gelistet (veraltet) bzw. Plugin braucht Anmeldung | Deploy-Status liest das AI-OS aus GitHub-Workflows |
| Stripe | gelistet | Schreibzugriffe bleiben im Stripe-Dashboard |
| Google Drive, Docs, Sheets, Gmail, Calendar | gelistet | Nur in Sitzungen des Kontoinhabers |
| Canva, Figma, Higgsfield, ElevenLabs, HubSpot, Tavily | gelistet | kostenpflichtige Aufrufe nur nach Freigabe |
| Playwright | Bibliothek vorinstalliert, kein MCP | DEPUTY nutzt `require('playwright')` per Bash |
| Chrome DevTools, Context7, Sentry, Brave, Exa, Firecrawl | nicht vorhanden | Ersatz: Playwright, WebSearch/WebFetch, Tavily |
| n8n | auf dem VPS, kein MCP | `docs/growth-agent-stack.md` |
| Twilio, Vapi, Retell | kein MCP (Twilio nur Doku-Plugin) | Voice über `apps/agent-runtime` |
| Metricool, Google Analytics, Search Console | kein MCP gelistet | offen |
| RealSync Evidence Vault | `apps/mcp-server` (nur lesend: `evidence_list`, `evidence_get`) | **nicht nutzbar**: Key-Function `mcp-api-key-manager` nicht deploybar (`docs/MCP_GOVERNANCE_SERVER.md`) |
| RealSync Memory | kein Dienst | Ersatz heute: `docs/ai-os/` per PR |
| RealSync Agent Registry | `packages/ai-os-core` (Code-Register, kein MCP) | Team nicht eingetragen (§7) |
| RealSync Task Manager | kein Dienst | Ersatz heute: GitHub Issues/PRs |
| RealSync Voice Runtime, Automation OS, AI Gateway, Billing | Code vorhanden (`apps/agent-runtime`, `supabase/functions/ai-os-control/`, `src/core/ai-gateway`) | kein MCP |

`.mcp.json` bleibt leer (Regel in `CLAUDE.md`). Connectoren kommen aus dem claude.ai-Konto.

## 4. Berechtigungsmatrix

Zielbild-Matrix. W = Arbeitszugriff innerhalb der Rolle · R = lesend · – = kein Zugriff.
**W schließt nie ein**, was `AGENTS.md` → „Freigaben“ einer Einzel-Freigabe vorbehält (Merge, Deploy,
Migration, Produktionsdaten, Workflows, Berechtigungen, Preise, Recht, Claims, kostenpflichtige Dienste).

| System | CHIEF | DEPUTY | REA | NOVA | VIO | MOTION | ATLAS | MIRA | DATA | FLOW |
|---|---|---|---|---|---|---|---|---|---|---|
| GitHub | R | R | W | R | R | – | R | – | R | W |
| Supabase | R | R | W | R | W | R | R | R | R | W |
| Cloudflare | R | R | W | R | – | – | – | – | – | W |
| Stripe | R | R | – | R | – | – | – | R | W | R |
| Browser (Playwright) | – | W | W | W | W | – | W | W | – | W |
| Google Drive | W | R | R | R | R | W | W | W | W | W |
| Gmail | R | – | – | – | – | – | – | W | – | W |
| Google Calendar | W | – | – | – | W | – | – | W | – | W |
| Higgsfield | – | – | – | – | – | W | – | – | – | – |
| Canva | – | – | – | – | – | W | – | W | – | – |
| Voice-Provider | R | R | R | R | W | R | – | – | R | W |
| Suche/Recherche | W | W | W | W | W | W | W | W | W | W |
| Wissensbasis (`docs/ai-os`) | W | R | W | W | W | W | W | W | W | W |
| Evidence Vault (heute nicht nutzbar, §3) | R | R | R | R | R | R | R | R | R | R |
| Agentenregister | W | R | R | R | R | R | R | R | R | W |

Präzisierungen zu W:

- Supabase und Cloudflare: Branch, lokale Tests, Entwurf von Migrationen und Functions — kein Produktions-SQL, kein Deploy.
- Gmail und Calendar: nur Entwürfe bzw. Terminvorschläge, Versand und Einladung nach Freigabe.
- Voice-Provider: Konfiguration im Testmodus, keine echten Anrufe und keine Nummernkäufe.
- DATA auf Stripe: Berichte und Analysen, keine Zahlungen, Erstattungen oder Preispläne.
- Evidence Vault: `apps/mcp-server` ist nur lesend gebaut. Ein Schreibweg für Nachweise existiert nicht als Agentenzugriff.

**Technische Durchsetzung heute:**

1. **Subagent-Tools sind hart begrenzt, Pfade nicht.** Jeder Agent hat eine feste `tools`-Liste aus
   Kern-Tools (Read, Bash, Edit, WebSearch, …). MCP-Tools stehen bewusst **nicht** darin. Grund: Ein
   Eintrag, der nicht auflöst, lässt den Subagent-Start in der Regel fehlschlagen (Claude-Code-Doku
   „Subagents“, s. o.), und Connector-Namen gibt es nur in Sitzungen des Kontoinhabers.
   Technisch erzwungen ist nur, **welche** Tools ein Agent hat. Wer `Write`, `Edit` oder `Bash` hat,
   kann damit jeden Pfad erreichen. Die Spalte „Darf ändern“ in §2 und die Aussage „ändert nichts“
   bei DEPUTY und NOVA (beide mit `Bash`) sind **Regeln**, keine Sperren.
2. **MCP läuft über die Hauptsitzung.** Braucht ein Agent einen Connector, fordert er ihn
   per Übergabe an. Die Hauptsitzung (bzw. CHIEF) führt ihn nach Bestätigung aus. Die Matrix
   oben ist also eine **Regel**, keine technische Sperre.
3. **„R“ auf Supabase ist nicht erzwingbar**, solange der Connector `execute_sql` mit Schreibrechten
   anbietet. Echte Lese-Trennung braucht einen eingeschränkten DB-Nutzer oder den `apps/mcp-server`
   (Key je Tenant, nur lesend).
4. Was im Repo bereits technisch gilt: `.claude/settings.json` (Deny-Liste) und das AI-OS-Gateway
   (Default-Deny, kritische Aktionen nie über das Gateway). Ob `main` per Ruleset geschützt ist, ist
   hier nicht geprüft.

## 5. Pflichtskills

Die 20 Pflichtskills (realsync-core-instructions … status-reporting) stehen als nummerierte Abschnitte in
`realsync-agent-core` und werden von allen zehn Agenten vorgeladen. Ein Skill statt 20 Dateien hat zwei Gründe:
keine Kopie von `AGENTS.md` und kein zusätzlicher Kontext je Sitzung.
Fachskills: die vorhandenen `aios-*`-Skills. Weitere Fachskills (z. B. Voice-Tests, Kampagnenplanung)
kommen nur dazu, wenn ein wiederkehrender Ablauf belegt ist.

## 6. Installationscheckliste — Stand

| # | Schritt | Stand |
|---|---|---|
| 1 | Tools und MCP inventarisieren | erledigt (§3) |
| 2 | CHIEF und DEPUTY konfigurieren | implementiert (Subagent-Dateien) |
| 3 | GitHub MCP anbinden | in Sitzungen des Kontoinhabers gelistet |
| 4 | Supabase MCP anbinden | gelistet, Lese-Trennung offen (§4.3) |
| 5 | Chrome DevTools und Playwright | Playwright als Bibliothek, DevTools-MCP fehlt |
| 6 | REA und NOVA konfigurieren | implementiert |
| 7 | ATLAS als Wissensbasis | implementiert (Ablage `docs/ai-os/wissen/`) |
| 8 | Memory und Evidence Vault integrieren | **offen**: kein Memory-Dienst, Evidence-MCP nicht deploybar |
| 9 | FLOW und Koordination | implementiert (`--agent chief`/`flow`) |
| 10 | VIO und Voice-Provider | Agent implementiert, Provider-Anbindung offen |
| 11 | DATA und Stripe | Agent implementiert, Stripe lesend über Hauptsitzung |
| 12 | MIRA und Marketing-Tools | Agent implementiert, Metricool/GA/GSC offen |
| 13 | MOTION und Kreativ-Provider | Agent implementiert, Ausführung über Hauptsitzung |
| 14 | Skills versioniert | implementiert (`realsync-agent-core` v1, Git) |
| 15 | Berechtigungen technisch absichern | **teilweise** (§4) |
| 16 | Multiagent-Workflows testen | **offen** |
| 17 | API-Budgetgrenzen | **offen**: nur Regel, keine technische Grenze in Claude Code |
| 18 | Unabhängige Abnahme durch DEPUTY | offen (nach Merge, erster echter Auftrag) |

## 7. Offene Entscheidungen

1. **Register zusammenführen?** Die zehn Rollen als `AgentId` in `packages/ai-os-core` eintragen
   (das ändert Command Center und Tests) oder die bestehenden fünf Rollen beibehalten und das Team
   nur darauf abbilden (§2).
2. **Budget:** Das Monatslimit (z. B. 100 $ Claude-API) muss in der Anthropic-Konsole am API-Schlüssel gesetzt werden.
   `Annahme` (nicht geprüft): Sitzungen mit Abo-Anmeldung statt API-Schlüssel zählen nicht gegen dieses Guthaben.
3. **Supabase lesend:** eingeschränkte Rolle oder `apps/mcp-server` deployen
   (Edge-Function-Kontingent, `docs/runbooks/edge-function-kontingent.md`).
