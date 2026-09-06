# browser-agent-x07

Beobachtet den ausgelieferten Browser-Zustand der Plattform und eröffnet
strukturierte Tickets. Er behebt nichts — X07 meldet (Modell §02).

Modell: Artifact „Organisationsmodell für ein hierarchisches Multi-Agent-System"
v0.2, §02/§03/§09. Datenschicht und Entscheid: ADR 0011.

## Was läuft wo

```
pg_cron  →  browser-agent-x07 (Edge Function, Deno)
                 │
                 ├─ HTTP →  playwright-scanner  POST /observe   (Container, Chromium)
                 │
                 └─ Service-Role →  agent_tickets  (Platform Scope, tenant_id IS NULL)
```

Die Edge Function startet **keinen** Browser. Modell §09 spricht von einer
„Playwright-basierten Edge Function"; das geht nicht, weil Edge Functions in
einem Deno-Isolat ohne Browser-Binary laufen. Chromium steht im Container-Dienst
`services/playwright-scanner`, den `cookie-scan-deep` und `audit-monitor-cron`
schon genauso ansprechen.

## Betreiberschritte

Ohne diese drei Schritte tut die Function nichts — sie meldet das dann ehrlich
mit HTTP 503 statt still zu bleiben.

1. **Migration anwenden.** `20260904011000_browser_agent_x07_seed.sql` legt die
   Kette CEO → AGI Manager → Platform Director → Browser Team → X07 im
   Platform Scope an. Ohne die Agenten-Zeile gibt es keinen Melder, und
   `agent_tickets.source_agent_id` ist NOT NULL.

2. **Secrets setzen.**

   | Variable | Zweck |
   |---|---|
   | `PLAYWRIGHT_SCANNER_URL` | Basis-URL des Scanner-Dienstes. Fehlt sie → HTTP 503 |
   | `PLAYWRIGHT_SCANNER_KEY` | Bearer für `/observe`, muss `SCANNER_SECRET` des Dienstes entsprechen |
   | `X07_BASE_URL` | Zu beobachtende Basis-URL, Vorgabe `https://realsyncdynamicsai.de` |

3. **Cron registrieren.** Bewusst **nicht** als Migration mitgeliefert:

   ```sql
   SELECT cron.schedule(
     'browser-agent-x07-hourly',
     '0 * * * *',
     $$ SELECT net.http_post(
       url := 'https://<projekt>.supabase.co/functions/v1/browser-agent-x07',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ) $$
   );
   ```

   **Warum nicht automatisch:** Der Cron-Dispatch dieses Projekts braucht das
   Vault-Secret `service_role_key`. Es fehlt — gemessen am 2026-09-01 ist der
   Job `memory-decay-hourly` seit dem 2026-08-12 registriert, aktiv und **in
   allen 470 Läufen gescheitert** (CLAUDE.md §5). Ein zweiter Job in derselben
   Lage wäre eine Registrierung, die aussieht wie Betrieb. Erst das Secret,
   dann der Job.

   Prüfen dann nicht an `cron.job`, sondern an `cron.job_run_details.status`.

## Beobachtete Routen

`WATCHED_ROUTES` in `index.ts` — heute `/`, `/pricing`, `/audit`, je bei 1280 px
und 390 px. Bewusst eine Konstante: Eine Konfigurationstabelle, die niemand
pflegt, ist eine leere Tabelle, und ein Agent, der nichts beobachtet, sieht aus
wie einer, der nichts findet.

`expectVisible` nimmt CSS-Selektoren, die sichtbar **und vollständig im
Viewport** liegen müssen — der Fall aus §02 („Der CTA-Button ist auf 390px
Bildschirmbreite nicht sichtbar"). Heute ist die Liste leer: Ein Selektor auf
die eingefrorene Startseite wäre eine Annahme über Markup, das ich nicht
geändert habe. Wer einen setzt, prüft ihn vorher am gerenderten Bild.

## Befunde und Tickets

| Beobachtung | Code | severity | category |
|---|---|---|---|
| unbehandelte Ausnahme | `js.page-error` | `critical` | `ui_bug` |
| Konsolenfehler | `js.console-error` | `warn` | `ui_bug` |
| fehlgeschlagene Anfrage | `net.request-failed` | `warn` | `ui_bug` |
| Breite lädt nicht | `ui.viewport-load-error` | `critical` | `ui_bug` |
| Element nicht sichtbar | `ui.element-not-visible` | `warn` | `ui_bug` |
| horizontaler Überlauf | `ui.horizontal-overflow` | `warn` | `ui_bug` |
| Ladezeit über Grenze | `perf.slow-load` | `info` | `performance` |

Der Ticket-Code ist deterministisch je (Route, Befundart) — `X07:pricing:js.console-error`.
Damit ist der Lauf idempotent: Derselbe Fehler erzeugt bei stündlichem Cron ein
Ticket, nicht 24 pro Tag. Verschwindet der Befund, schließt der nächste Lauf das
Ticket (Verifikation, §03); kehrt er zurück, wird dasselbe Ticket auf
`reopened` gesetzt.

**Die Function entscheidet nicht über Autonomie.** Sie schreibt `severity` und
`category`; ob daraus ein Deploy ohne Freigabe folgt, prüft die Policy Engine
serverseitig (ADR 0011 D1). Ein Agent, der seine eigene Grenze auswertet, ist
kein Gate, sondern eine Selbstauskunft.

## Was heute fehlt

- **Lighthouse.** §02 nennt es; es ist im Scanner weder installiert noch
  Dependency. `timings` liefert stattdessen die echten Werte der
  Navigation-Timing-API. Ein selbst gerechneter „Performance-Score" wäre mit
  den historischen Lighthouse-Zahlen nicht vergleichbar.
- **Accessibility** (bräuchte axe-core) und **WebMCP** — beides steht in §02,
  beides ist nicht gebaut.
- **Rohbefunde in `runtime_events`.** §09 sagt das, aber
  `runtime_events.tenant_id` ist NOT NULL mit Fremdschlüssel auf `tenants`
  (`20260602100000`). X07 arbeitet im Platform Scope ohne Tenant. Die
  Rohbefunde stehen deshalb in `agent_tickets.evidence`. Ein Platzhalter-Tenant
  nur für einen Fremdschlüssel wäre eine erfundene Mandantenzeile.
- **Eine Baseline über die Zeit.** Der Ladezeit-Schwellenwert (4000 ms) ist eine
  grobe Beobachtungsgrenze, kein gemessener Wert; er erzeugt nur `info`. Der
  Vergleich „Score von 91 auf 78 gefallen" aus §02 braucht Historie, die es
  noch nicht gibt.
