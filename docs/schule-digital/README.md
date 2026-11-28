# Schule DIGITAL – Bestandsanalyse

**Status:** KONZEPT  
**Stand der Analyse:** 27.11.2026, 23:55 (Europe/Berlin)  
**Geprüfter `main`:** [`a53dce7c`](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/commit/a53dce7c4dd166d29c66a3e2fe21a95a71564774) (26.11.2026, 07:53 Europe/Berlin, #2460)

## Zweck

Diese Dateien dokumentieren die lesende Bestandsanalyse zu **Schule DIGITAL** als geplantes Branchenprodukt auf der bestehenden Infrastruktur von RealSync Dynamics & AI. Sie dienen als gemeinsame Grundlage für Review (NOVA), Architekturentscheidungen und spätere Draft-PRs. Sie sind kein Implementierungsauftrag und kein Nachweis, dass Module bereits gebaut oder live sind.

Arbeitsprinzip (aus dem Master-Prompt): Bestand prüfen → planen → integrieren → testen → dokumentieren → freigeben → monetarisieren. Dieser Ordner deckt den ersten Schritt und die Planung ab.

## Status

**KONZEPT.** Keine Migration, kein Anwendungscode, keine Änderung an Workflows oder Produktionsdaten. Ein Merge dieses Dokumentationsstands ändert nur Dateien unter `docs/schule-digital/`.

Statuslabels in den Dokumenten:

| Label | Bedeutung |
|---|---|
| LIVE | Öffentlich oder in Produktion nachgewiesen (HTTP-Status, gemergter Stand, Registry-Status `live`) |
| IMPLEMENTIERT | Code oder Schema im Repo vorhanden, aber nicht als produktiv geschaltet nachgewiesen |
| PREVIEW | Im Produktstatus oder als offener/Draft-PR als unvollständig gekennzeichnet |
| NICHT VERIFIZIERT | Aussage ohne Live-Beleg (kein Kontozugriff, keine Messung) |
| fehlt / vorhanden / teilweise | Mapping im Register (Bestand relativ zu Schule DIGITAL) |

ANNAHME, Vorschlag und offene Entscheidung sind keine Fakten.

## Wichtiger Hinweis zum Register

Das Register in [`REGISTER.md`](./REGISTER.md) ist **vorläufig, abgeleitet aus dem Master-Prompt t30u, nicht aus V3.1**. Die acht hinterlegten Projektdateien und die Master Infrastructure V3.1 (17 Blöcke) wurden nicht gefunden (Suche in Google Drive, Notion und `/workspace`). Die IDs heißen `SD-B01` bis `SD-B17`, damit sie später gegen `B01`–`B17` aus V3.1 abgeglichen werden können. B01–B17 aus V3.1 wurden nicht erfunden.

## Dateien in diesem Ordner

| Datei | Inhalt |
|---|---|
| [REGISTER.md](./REGISTER.md) | Hierarchisches Register SD-B01–SD-B17 mit Sub-IDs und Bestand-Mapping |
| [ROLLEN_UND_SORGERECHT.md](./ROLLEN_UND_SORGERECHT.md) | Rollen- und Berechtigungsmatrix sowie Sorgerechts- und Einwilligungsmodell (Konzept) |
| [MANDANTENMODELL_ENTSCHEIDUNG.md](./MANDANTENMODELL_ENTSCHEIDUNG.md) | `tenants` vs. `organizations`, Optionen, Empfehlung, offene Entscheidung |
| [P0_SICHERHEIT.md](./P0_SICHERHEIT.md) | P0-1 bis P0-8 mit Belegen; NOVA-Befunde als solche gekennzeichnet |
| [RLS_MESSUNG.sql](./RLS_MESSUNG.sql) | Rein lesende SQL-Abfrage für die Produktionsdatenbank |

## Quellen

- Master-Prompt Schule DIGITAL (Nachricht t30u): Module ID, PAY, LEARN, CONNECT, ADMIN, CLUB, PHOTO, FOOD, SHOP, EVENTS, SYNC, VOICE, GOVERNANCE; Rollen; Kinderschutz; Phasen 1–6.
- Arbeitspakete A, B, C, F (Nachricht t31u).
- Repository [realsyncdynamics-spec/RealSyncDynamics.AI](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI) auf `main` @ `a53dce7c`, nur lesend.
- Live-HTTP-Prüfungen gegen `https://realsyncdynamicsai.de` (27.11.2026).
- NOVA-Bericht `/workspace/nova-reports/baseline-2026-11-23.md` (geprüfter Stand damals `9e5a0d86`, 23.11.2026). Aussagen von NOVA sind als solche gekennzeichnet. Die wichtigsten Punkte (H1-Liste, fehlende `dependabot.yml`, `vite` in `dependencies`) wurden auf `a53dce7c` stichprobenartig nachgeprüft.
- Zwischen `9e5a0d86` und `a53dce7c` lag in `supabase/migrations/` nur die zusätzliche Datei `20261123210000_rsd013_stagger_cron_jobs.sql` (69 Zeilen, hotfix #2412). Die RLS-Schuldenliste blieb unverändert.

Ohne Konto-Connector und deshalb nur aus dem Repo bzw. aus HTTP-Headern belegt: Supabase, Stripe, Cloudflare.

## Methodik

Nichts erfinden. Jede Aussage trägt einen Beleg (`Datei:Zeile` auf `main`, PR-, Issue- oder Run-Link, HTTP-Status) oder ist als ANNAHME, Vorschlag oder NICHT VERIFIZIERT gekennzeichnet.

Der lokale Klon unter `/workspace/realsync-repo` stand zum Analysezeitpunkt auf `9e5a0d86` und war 11 Commits hinter `main`. Alle Belege stammen aus `origin/main`.

## Kurzbefund

- `/schulen` ist LIVE (HTTP 200). `/schule-digital` antwortet mit HTTP 404.
- Es gibt zwei Mandantenmodelle (`tenants` / `organizations`) und keine Schul-, Schüler- oder Sorgerechtstabellen in den 437 Migrationsdateien unter `supabase/migrations/`.
- Wiederverwendbar sind unter anderem Governance OS, Evidence Vault, DSR-Funktionen, AI Gateway, SYNC, Stripe/Entitlements und die App-Shell.
- Vor Schulfunktionen stehen die P0-Sicherheitsblocker in [`P0_SICHERHEIT.md`](./P0_SICHERHEIT.md), darunter RLS, Mandantentrennung, Sorgerechtsmodell und Gateway-Härtung.

Nächster sicherer Schritt: die Abfrage in [`RLS_MESSUNG.sql`](./RLS_MESSUNG.sql) nur lesend in der Produktionsdatenbank ausführen (durch Dominik oder nach Freigabe eines Lesezugriffs). Danach bleibt dieser Ordner ein Konzept, bis Dominik weitere Arbeit freigibt.
