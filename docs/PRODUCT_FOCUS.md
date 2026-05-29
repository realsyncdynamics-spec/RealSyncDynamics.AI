# RealSyncDynamics.AI — Produkt-Fokus

> Diese Datei ist die Scope-Disziplin. Bevor neuer Code zu einer ungelisteten
> Domäne hinzugefügt wird, muss diese Datei zuerst geändert werden — als
> bewusster Architektur-Entscheid, nicht beiläufig.

## Was wir sind

**Realtime Governance Runtime.**

Eine laufzeit-getriebene Plattform, die bestehende Systeme der Kunden
revisionssicher und AI-Governance-fähig macht. Jedes Business-Event wird zu
einem Governance-Event mit Evidence, Severity und (wenn nötig) Remediation.

## Was wir nicht sind

| Nicht | Warum |
|---|---|
| ERP / Warenwirtschaft | Connector-Ziele, nicht Kern. |
| Buchhaltung | Connector-Ziele, nicht Kern. |
| Eigenes CRM | Wir konsumieren CRM-Events, wir bauen keins. |
| Eigenes IAM | Wir nutzen Supabase Auth + Tenant-RLS. |
| Eigenes Ticket-System | Wir öffnen Tickets in Jira/Linear/GitHub via Webhook. |
| AI-OS für allgemeine Agentenausführung | Wir führen Governance-Skills aus, keine offenen Workflows. |
| LLM-only-Datenschutzerklärungen | Regelengine + Templates + Evidence, kein Freitext-LLM. |
| Generische Website-Builder | Wir verkaufen Risikoreduktion, keine Webseiten. |

## Kern-Bausteine (Phase A — laufend)

Diese vier Komponenten sind der Kern. Alles andere ist Anwendung darauf.

1. **Event-Bus mit eingefrorenen Schemata**
   - Quelle: `src/core/runtime/governanceEvents.ts`
   - Persistenz: `public.runtime_events` (append-only, RLS-isoliert)
   - Subscriber müssen idempotent sein.

2. **Evidence-Chain**
   - Append-only, immutable, deterministische Hashes (SHA-256 über kanonisches JSON).
   - Quelle: `src/core/runtime/evidence.ts`
   - Replay-fähig via `runtime_events` + `runtime_executions.input_hash/output_hash`.

3. **Agent-Contracts**
   - Quelle: `src/core/runtime/types.ts` + `src/lib/enterprise-ai-os/agents/`
   - Jeder Agent: typisierte Inputs/Outputs, explizite Capabilities,
     explizite Autonomie-Stufe. Keine "intelligenten Super-Agenten".

4. **Remediation-Layer**
   - Quelle: `src/core/runtime/remediation.ts`
   - Erkanntes Problem → typisierter Fix-Vorschlag → Delivery-Kanal
     (Webhook / Ticket / Snippet / manueller Review). Niemals nur Alert.

## Was *nicht* in Phase A gehört

Diese Features sind später wichtig — aber sie blockieren Phase A nicht:

- CMS-Plugins (WordPress, Shopify, Webflow) — Phase 3.
- Vollständiges Evidence-Vault mit Ledger-Anchoring — Phase 4.
- AI-Act-Modul mit allen Art.-52-Pflichten — Phase 4.
- DSB-Dashboards, Meldepflicht-Timer — Phase 4.
- CreatorSeal / C2PA / Provenance-Branding — separate Positionierung, nicht jetzt.

## Monetarisierungsachsen (Reihenfolge, nicht parallel)

1. Free Audit Funnel — Reichweite.
2. Monitoring Subscription — wiederkehrender Umsatz.
3. Remediation Packs — direkte Problemlösung, höchste Marge.
4. Agency Runtime — Skalierung über Partner.
5. Enterprise Runtime — hohe MRR.

## Kategorie-Positionierung

Langfristig näher an: **Datadog · Vanta · CrowdStrike · ServiceNow.**
Nicht an: Cookiebot, generische DSGVO-Scanner.

## Entscheidungs-Heuristik

Bevor ein neues Feature, Modul oder Dependency in den Kern wandert:

1. Lässt sich das als **Event** ausdrücken? (Wenn ja: Governance-Event-Schema erweitern.)
2. Lässt sich das als **Connector** ausdrücken? (Wenn ja: in `connectors/`.)
3. Lässt sich das als **Remediation-Aktion** ausdrücken? (Wenn ja: in `remediation.ts`.)
4. Wenn keines davon: ist es wirklich Kern — oder eigentlich Phase 3/4?

## Referenzen

- `docs/POSITIONING_STRATEGY.md` — kanonische Positionierung, USP, ICP, GTM (die *Story*; diese Datei regelt den *Scope*).
- `ROADMAP.md` — Phasen 1–4, Preisstruktur.
- `docs/architecture/agent-os.md` — Runtime-Architektur (Quelle der DB-Migration).
- `AGENTS.md` — Agent-Katalog.
