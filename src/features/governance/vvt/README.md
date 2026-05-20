# Runtime-VVT

Technisch generiertes Verfahrensverzeichnis aus Runtime-Ereignissen.

## Was ist das?

Ein **VVT-Entwurf** im Sinne von Art. 30 DSGVO, der aus echten Runtime-Events abgeleitet wird (Tracker-Detection, Form-Detection, KI-Endpunkt-Erkennung etc.). Das Ergebnis ist **kein finales VVT** und ersetzt **keine** Rechtsberatung — es ist eine technisch begründete Vorarbeit, die ein DSB oder die Geschäftsführung freigeben muss.

## Welche Events werden gemappt?

Quelle: `src/features/governance/vvt/runtimeVvtMapper.ts`

| Event | → Verfahren | Rechtsgrundlage-Hinweis | Risk |
|---|---|---|---|
| `tracker.pre_consent.detected` | `website_tracking` | `consent` | high |
| `cookie.banner.detected` | `website_tracking` | `consent` | medium |
| `form.email.detected` | `contact_form` | `unknown` | medium |
| `form.newsletter.detected` | `newsletter_form` | `consent` | medium |
| `ai.endpoint.found` | `ai_endpoint` | `unknown` | high · AI-Act `possible` |
| `vendor.unknown.detected` | `third_party_script` | `unknown` | high |
| `payment.endpoint.detected` | `payment` | `contract` | medium |
| `media.embedded.detected` | `embedded_media` | `consent` | medium |
| `analytics.endpoint.detected` | `analytics` | `consent` | medium |
| *(alles andere)* | `unknown` | `unknown` | medium |

Aggregation: Mehrere Events mit gleicher (`sourceUrl`, `processingType`, `vendor.domain`)-Kombination werden zu **einem** Eintrag zusammengefasst. Risk-Level eskaliert monoton (einmal `high` → bleibt `high`).

## Warum nur Hinweise, keine Rechtsfreigabe?

Die Wahl der Rechtsgrundlage (Art. 6 DSGVO), die Bestimmung der Zwecke und die Risikoeinstufung sind **juristische Bewertungen**. Sie hängen vom Geschäftsmodell, der konkreten Datennutzung und der Branche ab. Eine reine Pattern-Erkennung kann das nicht ersetzen.

Deshalb liefert jeder Eintrag:
- `legalBasisHint` (nicht „legalBasis")
- `aiActRelevance` als 4-stufige Heuristik mit Default `possible` bei Unsicherheit
- `reviewStatus: 'review_required'` als Standard

## Warum Human Review nötig ist

Aus dem Direktiv: **keine automatische Rechtsfreigabe**. Konkret:
- Der Mapper darf nie `reviewStatus: 'approved'` setzen
- AI-Act-Klassifikation als `high_risk_review_required` löst zwingend Review aus
- Der Export ist als Entwurf gelabelt: *„Technisch generierter VVT-Entwurf — aus Runtime-Ereignissen abgeleitet. Keine Rechtsfreigabe."*

## JSON-Export

Komponente: `RuntimeVvtExportButton.tsx`.

- Dateiname: `realsync-runtime-vvt-export-YYYY-MM-DD.json`
- Inhalt: Disclaimer + Context + Entries
- Kein Server-Roundtrip; rein clientseitig (Blob + `URL.createObjectURL`)

Beispiel-Schema:
```json
{
  "generatedAt": "2026-05-19T...",
  "disclaimer": "Technisch generierter VVT-Entwurf — ...",
  "context": { "scope": "review_required", "demo_data": true },
  "entries": [
    {
      "id": "vvt-draft-...",
      "processingName": "Website-Tracking vor Consent",
      "processingType": "website_tracking",
      "legalBasisHint": "consent",
      "riskLevel": "high",
      "reviewStatus": "review_required",
      "vendors": [{ "name": "Google Tag Manager", "domain": "googletagmanager.com", "countryHint": "US", "dpaRequired": true }],
      "detectedFromEventIds": ["evt-001"]
    }
  ]
}
```

## Route

`/governance/vvt` (lazy-loaded, siehe `src/App.tsx`)

## Erweitern

Neuen Event-Typ mappen:
1. `seedForEvent` in `runtimeVvtMapper.ts` → neuer `case`
2. Demo-Event in `demoRuntimeVvtData.ts` ergänzen
3. Test in `test/governance/runtimeVvtMapper.test.ts` ergänzen
