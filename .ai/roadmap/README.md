# Roadmap M0–M19 — konsolidierte Planung

**Stand:** 2026-10-29 · **Status dieses Dokuments:** Planung, nicht Umsetzung.
Ablage unter `.ai/` statt `docs/`, weil `docs/` an der Ratschengrenze liegt (235/235 Dateien,
`npm run check:context`). Regeln: `AGENTS.md` > `CLAUDE.md` > `.ai/README.md` (Worker-Regeln).

## Verbindlichkeit

- **M0–M9:** verbindlich. **Aktiver Entwicklungsstrang ist ausschließlich M1-a** (und dessen
  Folgearbeit M1-b als Draft). M1-a wird nicht ausgeweitet.
- **M10–M19:** **nur Planung.** Keine eigenständige Implementierung ohne separates Go je Meilenstein.
- Immer verboten ohne Einzel-Freigabe: Merge, Production-Deploy, Live-DB-Migration,
  Stripe-/Preisänderung, kostenpflichtige Calls/Credits.

## Belegte Ist-Lage (nur Repo-Fakten)

| Element | Beleg |
|---|---|
| M1-a Agentenregister + Agentenübersicht | PR #2071 gemergt, Squash `0e346d1`; Route `/app/command-center`; VIEW `agent_registry_v` (Migration im Repo, Anwendung auf Live-DB nicht belegt) |
| M1-b Tests, A11y, mobile Nav, 3. Quelle | PR #2073 offen, Draft |
| M2–M4 Decision Inbox | im UI nur Platzhalter („wird in M2–M4 angebunden“) |
| Entscheidung C (SaaS vs. Studio) | PR #2069 (`.ai/`-Gedächtnis, Ledger) · PR #2070 (`AGENTS.md`, Draft, nicht freigegeben) |

**Offene Entscheidung (Nummernkonflikt):** PR #2036 nutzt „Masterplan M2, M7, M8“ (WP11:
Kunden-Dashboard, Router-Guards, Compliance-Ampel). Die Command-Center-Reihe nutzt M1-a/M1-b/M2–M4.
Es existieren also zwei M-Nummerierungen. Namen und DoD von M0, M5–M9 sind im Repo nicht
belegt und müssen vom Eigentümer bestätigt werden — unten als **„zu bestätigen“** markiert,
nicht erfunden.

## Konsolidierte Tabelle

Prio: P0 = blockiert anderes · P1 = nächste Welle · P2 = später. Rollen: **Grok** (Orchestrierung,
Audit, MCP, Reports, Box) · **Claude Code** (Implementierung auf HOMEPAD) · **Dominik** (Freigaben).

| ID | Name | Phase | Prio | Status | DoD (Kurz) | Abhängigkeiten | Verantwortlich | Erster Draft-PR-Slice |
|---|---|---|---|---|---|---|---|---|
| M0 | zu bestätigen | – | P0 | unbelegt | zu bestätigen | – | Dominik | – |
| M1-a | Agentenregister + Übersicht | Umsetzung | P0 | gemergt (#2071) | View + UI + Tests; Live-Migration nur mit Go | – | Claude Code | erledigt |
| M1-b | Tests, A11y, mobile Nav | Umsetzung | P0 | Draft #2073 | RLS-/E2E-/axe-Tests grün | M1-a | Claude Code | #2073 |
| M2–M4 | Decision Inbox (Anbindung) | geplant | P0 | Platzhalter im UI | zu bestätigen | M1-a/b | Claude Code | zu bestätigen |
| M5–M6 | zu bestätigen | – | P1 | unbelegt | zu bestätigen | – | – | – |
| M7 | zu bestätigen (Konflikt: in #2036 „Router-Guards/SuperAdminRoute“) | – | P0 | Nummer mehrdeutig | zu bestätigen | Nummerierung klären | Dominik | – |
| M8–M9 | zu bestätigen | – | P1 | unbelegt | zu bestätigen | – | – | – |
| M10 | Autonomous Agent Operations | Planung | P1 | geplant | siehe M10–M19.md | M1–M4, M7 | Grok + Claude Code | Planungs-Slice |
| M11 | CEO Executive Cockpit | Planung | P2 | geplant | s. u. | M10, M16 | Claude Code | Planungs-Slice |
| M12 | SEO & Growth Intelligence | Planung | P2 | geplant | s. u. | M10 | Grok | Planungs-Slice |
| M13 | Customer & Sales Operations | Planung | P1 | geplant | s. u. | M10, M15 | Claude Code | Planungs-Slice |
| M14 | AI Creative & 3D Production Studio | Planung | P2 | geplant | s. u. | Entscheidung C, #2070 | Grok + Claude Code | Planungs-Slice |
| M15 | Central Bot Configuration Manager | Planung | P1 | geplant | s. u. | M1-a/b, M10 | Claude Code | Planungs-Slice |
| M16 | Financial & Pricing Intelligence (read-only Stripe) | Planung | P2 | geplant | s. u. | M10 | Grok | Planungs-Slice |
| M17 | Multichannel Content Operations | Planung | P2 | geplant | s. u. | M10, M12 | Grok | Planungs-Slice |
| M18 | Proactive Infrastructure & Governance | Planung | P2 | geplant | s. u. | M10, M7 | Grok | Planungs-Slice |
| M19 | Enterprise Readiness | Planung | P2 | geplant | s. u. | M18 | Claude Code | Planungs-Slice |

## Reihenfolge nach M1–M4

Spätere Umsetzung **nicht numerisch**: **M10 → M15 → M13**, danach nach Bedarf (M16, M11, M18,
M12, M17, M14, M19). Begründung: M10 liefert Lauf-/Freigabe-Mechanik für alle Agenten; M15 baut
direkt auf dem Agentenregister (M1) auf; M13 braucht beide (Agenten + Bot-Konfiguration).

## Abhängigkeiten (Analyse)

- **M7:** Nummer doppelt belegt → vor jeder M10/M18-Arbeit klären, welches M7 gemeint ist.
- **#2069:** Grundlage `.ai/` (Ledger, Handoffs, Locks). Diese Roadmap setzt darauf auf.
- **#2070:** Studio-Ausnahme in `AGENTS.md` — Voraussetzung für M14 (Studio-Kundenseiten mit
  eigenem Design). Nicht gemergt, nicht freigegeben → M14 bleibt blockiert.
- **Entscheidung C:** M11/M16 dürfen Studio-Umsätze nur getrennt zeigen; Studio-Preise nie in
  `shared/pricing.ts`/Stripe. M14 ist Studio, alle anderen M10–M19 sind SaaS-intern.

Details je Meilenstein: [`M10-M19.md`](M10-M19.md) · Dashboard-Spec: [`dashboard-spec.md`](dashboard-spec.md)
