# MVP-Scope — Multi-Website Governance Workflow

Was *muss* funktionieren, damit ein Pilotkunde 5–50 Mandanten-Websites
monatlich produktiv überwacht. Mehr nicht.

## Workflow Ende-zu-Ende

```
Agentur legt Mandant an
  ↓
Mandant bekommt 1..n Websites zugeordnet
  ↓
RealSync scannt Website (initial + wöchentlich)
  ↓
Findings entstehen (Tracker / Vendor / AI-Widget / fehlende Pflichtelemente)
  ↓
Findings werden priorisiert (Severity × Häufigkeit)
  ↓
Risk Score je Website + je Mandant
  ↓
Evidence Bundle (SPEC-001) wird signiert
  ↓
Report (PDF + Markdown) wird generiert
  ↓
Agentur lädt Report herunter oder leitet Link an Mandant weiter
  ↓
Optional: Mandant/Auditor verifiziert Bundle lokal mit realsync-cli
```

## Datenmodell (minimal)

```
agency        — Tenant (RLS-Wurzel)
  └─ client   — Mandant der Agentur
       └─ site — Website (URL + Konfig)
            └─ scan — einzelner Scan-Lauf (status, started_at, finished_at)
                 └─ finding — Tracker/Vendor/AI/Missing (severity, evidence)
            └─ evidence_bundle — signiertes SPEC-001 Bundle pro Reporting-Zyklus
```

**RLS-Regel:** Jeder Read/Write ist auf `agency_id` des authentifizierten
Users gepinnt. Cross-Tenant-Leakage = harter Test (Vitest + Playwright).

## Komponenten (was wir wiederverwenden)

| Bestehend | Wiederverwendet für MVP | Anpassung |
|---|---|---|
| `src/pages/CookieScanner.tsx` + Backend | Site-Scan-Engine | Multi-Site-Trigger, Batch |
| `src/pages/AuditResultPage.tsx` | Findings-Darstellung pro Site | Agency-Sicht (Mandant-Filter) |
| `supabase/functions/audit-*` | Scan-Pipeline | Cronjob für wöchentliche Re-Scans |
| `tools/realsync-cli` | Evidence-Verifier | unverändert (conceptual reference) |
| `src/core/runtime/evidence.ts` | Bundle-Erzeugung | minimaler Report-Renderer |
| `runtime_events` Tabelle | Append-only Event-Log | Scan-Events einreihen |

## Was wir *neu* bauen

Strikt minimal:

1. **`/agency` Dashboard-Route**
   Liste Mandanten · Sites · letzter Scan · Risiko · Report-Link.
   Eine Tabelle, keine Charts.

2. **Mandant/Site-Verwaltung**
   Create/Edit/Delete für `client` und `site`. Kein Bulk-Import in MVP
   (kommt, wenn Pilot es verlangt).

3. **Scan-Scheduler**
   n8n- oder Supabase-Cron-Workflow, der wöchentlich alle aktiven Sites
   pro Tenant scannt.

4. **Findings-Priorisierung**
   Regel-Tabelle `severity = f(finding_type, pre_consent, vendor_known)`.
   Persistiert in `services/governance/severity.ts`.

5. **Report-Renderer**
   Markdown → PDF (via vorhandenes PDF-Modul in `src/pdf/`).
   Pro Site eine Seite, Cover je Mandant.

6. **Evidence-Bundle-Export**
   Bestehender `evidence.ts` Output → SPEC-001 JSON-Datei zum Download.
   `realsync-cli verify` muss `PASSED` liefern.

## Detection-Coverage (MVP)

Wir erkennen — und *nicht mehr*:

| Kategorie | Erkennung | False-Positive-Strategie |
|---|---|---|
| Pre-Consent Tracking | Skripte/Pixel laden vor Consent-Klick | Whitelist „technisch notwendig" |
| Unbekannte Vendor-Domain | Domain nicht in `known_vendors.json` | Manuell ergänzbar pro Tenant |
| Fehlendes Impressum/Datenschutz | Linkprüfung im Footer + `/impressum`, `/datenschutz` | Tenant-Override für Custom-Pfade |
| AI-/Chatbot-Widget | Bekannte Selektoren/Skripte (Intercom, Drift, Tidio, …) | Liste in `known_ai_widgets.json` |
| Cookie ohne Kategorisierung | Cookies ohne Mapping in Consent-Manager | Bekannte CMP-Konfigurationen erkennen |

**Explizit nicht im MVP:**
- Server-Side-Tracking-Detection
- Mobile-App-Scans
- Tiefere AI-Modell-Klassifikation (Risikoklassen EU AI Act Art. 6+)
- Real-Time-Browser-Extension-Daten

## Akzeptanzkriterien (Hard-Gate)

Der MVP ist „fertig", wenn:

1. Agentur-User legt in < 5 Min 1 Mandant + 5 Sites an.
2. Erster Scan läuft in < 60 s pro Site durch (oder wird async mit Status-UI gehandhabt).
3. Wöchentlicher Re-Scan läuft autonom 4 Wochen ohne Ops-Eingriff.
4. Report (PDF) ist mandantenfähig (Logo/Header pro Agentur).
5. `realsync-cli verify` auf exportiertem Bundle: `PASSED`.
6. Cross-Tenant-Read-Test (Vitest): **FAIL** = Test grün.
7. Pilot-Onboarding ist von 1 nicht-technischen Person durchführbar
   (Schritt-für-Schritt-Doku in `docs/pilot/onboarding.md` — Phase 2).

## Was den MVP *nicht* zum MVP macht

- Custom-Branding über Logo+Name hinaus
- API für Drittsysteme
- Bulk-CSV-Import (kommt, wenn 2 Piloten es schriftlich verlangen)
- White-Label-Domains
- SSO / SAML
- Slack-/Teams-Webhooks (auch wenn 1 Tag Arbeit)

Diese Liste lebt in `non-goals.md`.
