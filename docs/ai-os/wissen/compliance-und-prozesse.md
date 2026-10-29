---
title: Compliance und Geschäftsprozesse
owner: Plattform-Betrieb
reviewed: 2026-10-15
status: aktiv
---

# Compliance und Geschäftsprozesse

## Anforderungen → Umsetzung → Beleg

| Anforderung | Umsetzung im Produkt | Beleg |
|---|---|---|
| DSGVO Art. 5/32 — Zugriff nur für Berechtigte | RLS je Mandant über `memberships`; Plattformrechte über `is_platform_operator()` | Migrationen, `test/runtime/db/*rls*` |
| DSGVO Art. 17 — Löschung | pg_cron `dsr-erasure-sweep` | Command Center → Routinen |
| DSGVO Art. 28 — Auftragsverarbeiter | Seite Unterauftragsverarbeiter (E-V6 offen) | `src/features/legal/SubProcessors.tsx` |
| AI Act — Protokollierung, menschliche Aufsicht | Governance-Events (Hash-Kette), Freigabe-Gates (`governance_approvals`, `pdp_approval_gates`) | `append_governance_evidence`, Approval-Tests |
| AI Act — Transparenz gegenüber Nutzern | `ai-disclosure-check`, Implementierungsstatus öffentlich | `src/product/implementation-status.ts` |

Rechtliche Einordnung ist Hinweis, keine Rechtsberatung.

## Verbotene Aussagen

„vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".
Prüfung: `npm run check:landing-claims`, Skill `/aios-compliance-verification`.

## Geschäftsprozesse und Automationen

| Prozess | Ablauf | Automation |
|---|---|---|
| Lead → Kunde | `/audit` (Scan) → `/welcome` → `/app/activation` → Free-Konto (E-F6) → Upgrade | `audit-email-drip-daily`, `audit-recheck-daily` |
| Abrechnung | Stripe Checkout → `stripe-webhook` → `subscriptions` | `stripe-meter-sync-hourly` |
| Monitoring | Governance-Monitoring, Business-Metrics | pg_cron (siehe Routinen) |
| Betrieb | Statusprüfung, CI-Analyse, Wochenbericht, Sicherheitsprüfung, Doku-Kontrolle | AI-OS-Routinen |

Stripe-Änderungen, E-Mail-Versand und Rechnungen sind **kritisch** und laufen
nie über Agenten (Tool-Katalog `packages/ai-os-core/src/tools.ts`).

Verknüpft: [Unternehmen und Produkt](unternehmen-und-produkt.md)
