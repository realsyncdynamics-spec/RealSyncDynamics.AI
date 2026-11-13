# K4 — Produktstrategie vom 27.10.2026

Dieses Dokument hält den Founder-Entscheid **K4** vom **27.10.2026** fest und
formuliert, wie `ROADMAP.md` daran auszurichten ist. Es ist ein
Entscheid- und Angleichungsdokument, keine neue Parallelstrategie.

Der historische Mai-2026-Text in `ROADMAP.md` bleibt in diesem Schritt
unverändert; dort steht nur ein Hinweis auf dieses Dokument. Eine
byteweise Ersetzung des ROADMAP-Rumpfs ist nicht Gegenstand dieser Änderung
und wäre ein eigener, gesondert freizugebender Doku-PR.

**Keine** Preis-, Stripe-, Schema- oder Deploy-Änderungen. Bestehende
Module werden integriert, nicht gelöscht.

## Quellen

Maßgeblich ist der Entscheid-Record
[`docs/PRODUCT_PRIORITIZATION.md`](../PRODUCT_PRIORITIZATION.md)
auf `main`. Fundstellen (Zeilenstand des Basis-Commits, gegen den diese
Änderung erstellt wurde):

| Thema | Fundstelle |
|---|---|
| Neupositionierung / Entscheid K4 | `docs/PRODUCT_PRIORITIZATION.md:122–169` |
| Formulierung „Plattform für KI-Mitarbeiter mit eingebauter Governance“ | `:124–129` |
| Aufhebung von K2 und des älteren Kern-Entscheids (soweit Scan + Monitoring + Evidence das einzige Produkt setzte); Mechanik „ein Produkt, eine Codebase, ein Billing“ bleibt | `:131–133` |
| Produktebenen 1–4 | `:135–142` |
| Erster Kundenablauf: AI Receptionist für Handwerksbetriebe | `:144–147` |
| Umsetzungsfolge PR A / PR B / PR C | `:149–157` |
| Leitplanken (nur Belegbares, keine erfundenen Referenzen) | `:159–163` |
| Preise, Stripe, Verträge, Entitlements unverändert (K1 bleibt) | `:164–166` |
| Auftrag, `ROADMAP.md` und weitere Doku in eigenen PRs anzugleichen | `:167–169` |
| S3 — schlanker Evidence-Trail im ersten zahlenden Tier | `:45–53`, erledigt `:178–181` |
| S4 — AI Vendor Registry vor dem vollen AI Governance OS | `:56–60` |
| Ältere Phasen-Reihenfolge (Juni 2026), durch K4 überlagert | `:64–73` |
| K1 — Starter bleibt 79 €, SSoT `src/config/pricing.ts` | `:84–91` |
| Fußzeile: K4 am 27.10.2026 | `:195` |

Weitere Bezüge, die der Angleichungstext verwendet, aber nicht K4 selbst sind:

- Scope-Disziplin: [`docs/PRODUCT_FOCUS.md`](../PRODUCT_FOCUS.md) (laut K4 in einem eigenen PR anzugleichen).
- Interne Runtime-Konsolidierung: [`docs/architecture/agent-manager-roadmap.md`](../architecture/agent-manager-roadmap.md).
- Belegter Frontend-Hosting-Stand auf `main`: [`docs/infra/frontend-staging.md`](../infra/frontend-staging.md).

---

## Positionierung (K4, 27.10.2026)

Plattform für KI-Mitarbeiter mit eingebauter Governance. Kunden kaufen mehr
erreichbare Anfragen, qualifizierte Leads, einfachere Terminbuchung und
weniger Routinearbeit. Datenschutz, Nachweise und Kontrollmöglichkeiten sind
Infrastruktur und Bindungsgrund, nicht die Hero-Botschaft.

Entscheid-Record: [`docs/PRODUCT_PRIORITIZATION.md`](../PRODUCT_PRIORITIZATION.md)
(`:124–129`).

**Scope-Disziplin:** Was im Kern liegt und was bewusst draußen bleibt, bleibt
in [`docs/PRODUCT_FOCUS.md`](../PRODUCT_FOCUS.md) festzuhalten und in einem
eigenen PR an K4 anzugleichen. Governance und Sicherheit bleiben verbindlicher
Bestandteil der gesamten Plattform. Eine Codebase, ein Dashboard, ein Billing;
keine Parallelplattform, keine zweite Datenbank oder Benutzerverwaltung
(`:131–133`, `:167–169`).

**Bestand:** Bestehende Module (Audit/Monitoring, Evidence-Trail, Agent-Runtime,
Builder, Bot-Kanäle) werden integriert, nicht gelöscht oder durch eine zweite
Architektur ersetzt. Interne Runtime-Konsolidierung siehe
[`docs/architecture/agent-manager-roadmap.md`](../architecture/agent-manager-roadmap.md).

---

## Fundament — Runtime und Governance (weiterhin Voraussetzung)

Die bisher in ROADMAP als „Phase A“ beschriebenen Bausteine (Governance
Signals, Evidence-Hashing, Agent-Contracts, Remediation-Skelett) bleiben
Voraussetzung für neue kundenwirksame Funktionen. Was bewusst nicht im
Fundament liegt: eigene CMS-Plugins als Erstlieferumfang, eigenes
CRM/IAM/Ticket-System, vollständiges Evidence-Vault mit Ledger-Anchoring,
AI-Act-Vollumfang.

## Produkt-Struktur (K4)

Quelle: `docs/PRODUCT_PRIORITIZATION.md:135–142`.

| Ebene | Inhalt | Rolle |
|---|---|---|
| 1 Einstieg | Kostenlose Checks (Website, WhatsApp, Telefon, AI Act) | Lead, reibungsloser Einstieg |
| 2 Builder | Landingpage-, Telefon-, WhatsApp- und Serviceassistent | Einrichtung des KI-Mitarbeiters |
| 3 Geschäftsbetrieb | Wissensbasis, Leads/Anfragen, Dialoge, Terminbuchung | Alltagswert |
| 4 Governance | Berechtigungen, Freigaben, Nachweise, Monitoring | mitgeliefert, Bindungsgrund |

Monetarisierung bleibt eine Linie (ein Billing). Die frühere Aufteilung
„Audit Engine / Compliance Monitoring / Auto-Remediation / Agency Suite“
beschreibt Arbeitspakete und Paketstufen, keine zweiten Produkte.

## Erster Kundenablauf

Quelle: `docs/PRODUCT_PRIORITIZATION.md:144–147`.

AI Receptionist für Handwerksbetriebe: Anfrage entgegennehmen, Anliegen und
Kontaktdaten erfassen, Terminwunsch aufnehmen, an einen Menschen übergeben.
Erst wenn dieser Ablauf durchgängig funktioniert und verkauft wird, folgen
weitere Branchen und Assistenten.

---

## Reihenfolge der Umsetzung

Maßgeblich ist der Founder-Entscheid vom 27.10.2026
(`docs/PRODUCT_PRIORITIZATION.md:149–157`):

1. Sicherheit und Kosten der Bot-Kanäle (WhatsApp-Signatur fail-closed,
   Budget-Reservierung für `bot-chat`, harte Telefonminuten-Limits).
2. Doku-Angleichung (diese Strategie, ROADMAP-Hinweis, später PRODUCT_FOCUS,
   ICP, Triage-Policy — jeweils eigene PRs).
3. Anfragen-Posteingang mit Übergabe an Menschen.
4. Den Receptionist-Ablauf für Handwerk durchgängig nutz- und verkaufbar machen.
5. Danach weitere Branchen und Assistenten; Governance bleibt in jedem Schritt
   mitgeliefert.

Der schlanke, revisionssichere Evidence-Trail bleibt im ersten zahlenden Tier
(S3, `:45–53`, `:178–181`). Das volle Vault (HAR-Archiv, Ledger-Anchoring,
Langzeit-Retention) bleibt Ausbau. Eine AI Vendor Registry bleibt ein späterer
Governance-Baustein (S4, `:56–60`), nicht das erste KI-Produkt.

Historische Phasenbezeichnungen (Audit-Plattform, Auto-Remediation,
CMS-Integrationen, Continuous Compliance) gelten als Arbeitspakete unter den
Ebenen 1–4, nicht als konkurrierende Roadmap.

---

## Tech-Stack (aktueller, belegter Stand)

Die frühere Angabe in `ROADMAP.md` („SPA auf Hostinger VPS / Traefik +
Hostinger VPS“) ist überholt. Auf `main` dokumentiert
[`docs/infra/frontend-staging.md`](../infra/frontend-staging.md):

| Bereich | Technologie |
|---|---|
| Öffentliche Domain (Apex/www) | Cloudflare Pages, Projekt `realsync-landing`, Branch `landing-live` (statischer Export) |
| Vite/React-SPA | Cloudflare Pages, Projekt `realsyncdynamics-ai`, Branch `main` bzw. PR-Previews |
| Backend | Supabase (Postgres EU, Edge Functions, Auth) — bestehendes Live-Projekt, kein Zweitsystem |
| Deployment-Wahrheit Frontend | Pages-Previews als Staging; Production-Deploy nur nach Freigabe |

Einzelne Altbestandteile (etwa n8n auf einem VPS) bleiben Bestand, wenn sie
bereits existieren; sie werden nicht als aktuelles Frontend-Hosting dargestellt.

---

## Was wir NICHT tun

Quelle der Leitplanken: `docs/PRODUCT_PRIORITIZATION.md:159–163`.

- ❌ „100 % rechtssicher“ versprechen → technische Datenschutz-Unterstützung
  mit nachvollziehbaren Nachweisen.
- ❌ LLM-only Datenschutzerklärungen → strukturierte Daten, Regelengine, Templates.
- ❌ Unbelegte Live-Aussagen, erfundene Referenzen, Kennzahlen oder Zertifikate.
  Demos und geplante Angebote bleiben als solche gekennzeichnet.
- ❌ Eine zweite Plattform, zweite Datenbank oder zweite Benutzerverwaltung
  aufbauen, wo geeignete Bestandteile schon existieren.
- ❌ Den Landingpage-Builder als „KI generiert sofort die komplette Website“
  vermarkten, solange das nicht durch Code, Konfiguration und Tests belegt ist.
  Der Builder selbst ist nach K4 Bestandteil von Ebene 2 (`:139–140`).

## Das eigentliche Geschäftsmodell

Wir verkaufen **KI-Mitarbeiter, die Anfragen annehmen, Leads qualifizieren,
Termine vorbereiten und Routine abnehmen** — mit eingebauter Governance
(Berechtigungen, Freigaben, Nachweise, Monitoring).

Wir verkaufen nicht isoliert „eine Webseite“, „ein Cookie-Banner“ oder
„ein Audit-PDF“. Evidence und Compliance bleiben der Bindungsgrund und die
technische Härte, nicht die alleinige Hero-Botschaft (`:127–129`, `:142`).

---

## Bewusst unverändert

- Preistabelle und Verweis auf `src/config/pricing.ts` (K1 / K4 `:164–166`,
  `:84–91`). Neue Paketideen gelten als Hypothesen, bis eine gesonderte
  Preisfreigabe vorliegt.
- Consent-Timing und Auto-Remediation als technische Differenzierer, sofern
  als belegte bzw. geplante Fähigkeiten gekennzeichnet.
- Konkrete Checklisten der alten Phase 1 (Scanner, Reports, Tabellen), solange
  sie den Bestand beschreiben — sie sind Arbeitspakete unter den Ebenen 1–4,
  kein zweites Produkt.

---

*Dokumentiert K4 vom 27.10.2026. Der historische Mai-2026-Stand von
`ROADMAP.md` bleibt in der Git-Historie und — in diesem Schritt — im
Dateiinhalt nachvollziehbar. RealSyncDynamics.AI*
