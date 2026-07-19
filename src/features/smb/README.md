# SMB Experience Layer

Zusätzliche Produkt- und Benutzeransicht für **Einzelunternehmer und kleine
Unternehmen (1–10 Mitarbeiter)** — aufgebaut **auf** der bestehenden
Enterprise-Infrastruktur, nicht daneben.

## Grundsätze

1. **Nichts wird ersetzt.** Die Enterprise-Architektur (API-first,
   mandantenfähig, AI-Act-/DSGVO-konform) bleibt vollständig unverändert.
   Enterprise-Kunden sehen weiterhin Governance, Policies und
   Compliance-Details unter `/app/dashboard`.
2. **Keine doppelten Funktionen.** Diese Schicht konsumiert ausschließlich
   vorhandene, RLS-geschützte Tabellen und Services:

   | Business-Kachel              | Enterprise-Quelle                                   |
   |------------------------------|-----------------------------------------------------|
   | Website-Gesundheit           | Audit Module (`audit_jobs.result_summary`)          |
   | Website-Überwachung          | Governance Runtime (`runtime_events`)               |
   | Sicherheitsstatus            | Governance Runtime (`runtime_events.severity`)      |
   | Datenschutz im Hintergrund   | Policy Packs / Auto-Mapping (`ai_evidence_events`)  |
   | Google-Sichtbarkeit          | Audit Module (Score-Signale)                        |
   | Vertrauen & Nachweise        | Evidence Vault (`ai_evidence_events`, Hash-Chain)   |

3. **Keine Fachbegriffe auf der Oberfläche.** DSGVO, AI Act, Evidence
   Vault, Runtime, Policy Engine, Prüfpfad usw. erscheinen nirgends im UI —
   sie werden in geschäftlichen Mehrwert übersetzt (Website-Gesundheit,
   Sichtbarkeit, Vertrauen, Handlungsempfehlungen).
4. **In 60 Sekunden verständlich.** Maximal 8 Hauptkacheln (aktuell 6),
   Ampel-Status in Alltagssprache, aufklappbare „Was heißt das?"-Erklärung.

## Aufbau

- `src/config/smb-experience.ts` — Single Source of Truth: Kachel-Definitionen,
  Übersetzungstabelle (Technik → Business), Branchen-Pakete (Erweiterungspunkt
  für Tattoo, Friseur, Handwerk, Gastronomie, …).
- `lib/businessSignals.ts` — pure, unit-getestete Übersetzungslogik
  (Scores/Severities/Zähler → Business-Signale und Empfehlungen).
- `useSmbBusinessData.ts` — Daten-Adapter (Supabase-Reads unter RLS,
  Demo-Fallback für frische Accounts, `live`-Flag).
- `SmbDashboardView.tsx` — Dashboard unter `/app/mein-geschaeft`
  (auth-gated, Light-Trust-Theme). Link „Zur Expertenansicht" führt zur
  unveränderten Enterprise-Ansicht.

## Branchen erweitern

Neue Branche = neuer Eintrag in `SMB_INDUSTRY_PACKS`
(`src/config/smb-experience.ts`). UI und Empfehlungslogik lesen
ausschließlich aus dieser Liste — keine Änderungen an Komponenten nötig.
