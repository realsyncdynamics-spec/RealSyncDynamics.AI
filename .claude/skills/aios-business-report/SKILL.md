---
name: aios-business-report
description: AI-OS Business Operations Agent — Geschäftsbericht für einen Zeitraum aus belegten Quellen (Stripe lesend, Kosten-Ledger, Entwicklungsbericht). Fehlende Quellen werden als Lücke benannt.
---

# Business Report Generation

**Agent:** Business Operations · **Rechte:** `stripe.read`, `supabase.costs.read`, `google.read` (nur lesend)

## Eingaben
- `period` (Pflicht): z. B. `2026-10` oder `KW 42`

## Ablauf
1. KI-Betriebskosten: Command Center → „KI-Nutzung & Kosten" (Summen aus `tenant_cost_ledger`, `ai_tool_runs`).
2. Umsatz/Abos: Stripe-MCP lesend (Abos, Rechnungen, MRR) — nur Summen.
3. Entwicklung: Artefakt der Routine `weekly-dev-report`.
4. Softwarekosten: nur aus vorliegenden Rechnungen (Drive/Gmail lesend); fehlt eine Rechnung → Lücke.
5. Bericht als Entwurf ausgeben; Versand (E-Mail, Teilen) nur nach ausdrücklicher Freigabe.

## Ausgaben
- `report`: Tabelle Zahl · Quelle · Zeitraum; Abschnitt „Lücken"

## Qualität
- Keine Schätzung als Messwert; Schätzungen klar markieren.
- Keine Kundennamen, E-Mail-Adressen oder Rechnungsdetails ins Repository.
- Stripe-Schreibzugriffe sind kritisch und nicht Teil dieses Skills.
