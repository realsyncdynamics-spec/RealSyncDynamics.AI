# 19 — Executive Summary

**Audit-Datum:** 2026-08-10 · **Commit:** `6f5ca5c` · **Ziel:** https://realsyncdynamicsai.de

---

## Das Wichtigste in drei Sätzen

RealSyncDynamicsAI ist **kein Vaporware-Projekt** — die Substanz existiert, und
Teile davon (Hash-Chain, Stripe-Webhook, DSGVO-Pseudonymisierung, SSH-Härtung) sind
handwerklich überdurchschnittlich.
Das zentrale Problem ist, dass **47 % des Backends nie in Produktion gelangt ist**:
83 von 178 Edge Functions antworten mit HTTP 404, und über zwölf Kern-Tabellen
fehlen in der Produktionsdatenbank — darunter die des Evidence Vault, der Policy
Packs und der Berechtigungsverwaltung.
Dazu kommt eine strukturelle Sicherheitslücke: weil `verify_jwt` für 61 Functions am
Gateway abgeschaltet ist und die Prüfung im Code nicht einheitlich nachgeholt wird,
akzeptieren sechs Functions **jedes beliebige Bearer-Token** und achtzehn prüfen
**gar nichts** — bei gleichzeitiger Verwendung des `service_role`-Keys, der RLS
vollständig umgeht.

---

## Scores

| Dimension | Score |
|---|---|
| Security | **42** / 100 |
| Architecture | **68** / 100 |
| Reliability | **45** / 100 |
| Testing | **55** / 100 |
| SaaS Readiness | **40** / 100 |
| Multi-Tenancy | **50** / 100 |
| GDPR Technical | **48** / 100 |
| AI Governance | **45** / 100 |
| Billing | **55** / 100 |
| **Production Readiness** | **32** / 100 |
| **Gesamt** | **46** / 100 |

**Der Durchschnitt darf nicht über die P0-Befunde hinwegtäuschen:** fünf davon sind
einzeln go-live-blockierend. Ein Score von 46 mit fünf offenen P0 ist schlechter als
ein Score von 40 ohne.

| Severity | Anzahl |
|---|---|
| P0 | 5 |
| P1 | 7 |
| P2 | 8 |
| P3 | 5 |
| P4 | 5 |

---

## Was tatsächlich funktioniert

Diese Punkte wurden gezielt angegriffen und haben gehalten:

1. **Mandantentrennung in der Datenbank** — anonyme Reads gegen 14 Kern-Tabellen
   liefern durchgehend `[]`. Kein Datenabfluss.
2. **Stripe-Webhook** — HMAC-Signaturprüfung über den Rohtext, Idempotenz mit
   Rollback, Tenant-Bindung über `metadata.tenant_id`. Der sauberste Code im Repo.
3. **Hash-Chain** — deterministische Kanonisierung, Advisory-Lock pro Tenant,
   Append-Only-Trigger, Verifier-RPC. Echte Kryptografie, kein Etikett.
4. **Human Oversight** — Approvals funktionieren in Produktion und erzeugen Evidenz.
5. **DSGVO-Betroffenenrechte** — Auskunft und Löschung sind implementiert, deployt
   und konzeptionell klug gelöst (HMAC-Pseudonymisierung statt Event-Löschung).
6. **Keine Secrets im Repo oder in der Git-History** — nur Platzhalter.
7. **SSH-Zugriff (`kodee`)** — JWT, Action-Allowlist, `shellQuote()`. Keine
   Command-Injection.
8. **Keine dynamische LLM-Tool-Loop** — Excessive Agency ist strukturell vermieden.
9. **Typecheck grün, 2867 Unit-Tests grün, Pricing-Single-Source verifiziert.**

---

## Die drei Ursachen

**1. Der Deploy-Pfad ist seit Monaten gebrochen.**
Dokumentiert in `DEBUG_ROOT_CAUSE_2026-08-02.md`, erste Ursache über #941 behoben,
Migrations-Seite offen (`docs/runbooks/p0-2-migration-reconciliation.md`). Das Team
kennt das Problem — es ist nur nicht abgearbeitet.

**2. Der Wächter, der es hätte melden müssen, meldet Erfolg.**
`npm run check:edge-functions` gibt ohne `SUPABASE_ACCESS_TOKEN` aus:
„✅ Kein blockierender Edge-Function-Drift" — Exit-Code 0, ohne irgendetwas geprüft
zu haben. So konnte die Lücke auf 83 Functions wachsen, während CI grün blieb.

**3. Die richtigen Tests existieren und laufen nicht.**
18 DB-Sicherheitstests (RLS, Hash-Chain, Append-Only, Entitlements) und 47
Playwright-Specs sind geschrieben — und in keinem CI-Workflow eingebunden. Ein
CI-Job von etwa 15 Zeilen hätte mehrere P0-Befunde dieses Audits vorweggenommen.

---

## Was das für Claims bedeutet

Von 30 geprüften technischen Aussagen der Website sind **3 belegt**, 8 teilweise,
**14 nicht belegt** und **4 widerlegt**.

Der Bruch liegt nicht zwischen Marketing und Code — die Claims beschreiben das
Repository weitgehend zutreffend. Er liegt zwischen **Code und Produktion**. Das ist
die gute Nachricht: es ist ein Auslieferungs- und Verifikationsproblem, kein
Substanzproblem.

Bis zur Schließung von F-01/F-02 sind „Evidence Vault", „Policy Packs", „C2PA",
„API", „Webhooks", „Scheduler", „White Label", „Partner Mode", „ISO 42001" und
„14 Tage kostenlos" auf der öffentlichen Website nicht haltbar.

Unabhängig davon sind **„unveränderlich" und „revisionssicher" auch nach dem Deploy
nicht belegbar**, solange keine externe Verankerung der Kettenspitze existiert: wer
`service_role` besitzt, kann eine vollständig selbstkonsistente Ersatzkette
erzeugen, die der eigene Verifier bestätigt.

---

## Empfehlung

**Kein Go-Live mit echten Kundendaten vor Abschluss der fünf P0.**

Reihenfolge ist entscheidend: **erst Sicherheit, dann Deploy.** Die 83 Functions zu
deployen, ohne vorher F-04 und F-05 zu beheben, würde sechs Authentifizierungs-
Bypässe gleichzeitig scharf schalten — der Zustand wäre danach schlechter als heute.

Realistischer Zeitrahmen bis zur Produktionsreife: **4–6 Wochen** bei fokussierter
Abarbeitung.

Der wirtschaftlichste erste Schritt ist nicht der Deploy, sondern **einen Tag in die
CI zu investieren** (F-06 + F-07). Danach zeigt die Pipeline zum ersten Mal die
Wahrheit — und jede weitere Korrektur ist überprüfbar statt geglaubt.
