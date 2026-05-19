# Runtime-VVT — Web &amp; AI Verfahrensverzeichnis

Dieser Slice erzeugt aus tatsächlichen Runtime-Signalen ein **lebendes,
technisch generiertes Verfahrensverzeichnis** für Web- und AI-Systeme.

> **Wichtig:** Der Runtime-VVT-Slice ersetzt keine rechtliche Prüfung,
> keine DSB-Freigabe und keine finale Art.-30-Dokumentation. Felder mit
> „-Hinweis"-Suffix sind explizit Vorschläge, die ein:e
> Datenschutzbeauftragte:r oder Admin prüfen muss.

## Was ist Runtime-VVT?

Statt ein VVT manuell zu pflegen, leitet RealSync VVT-Entwürfe aus echten
Runtime-Ereignissen ab — etwa Tracking-Aufrufen vor Einwilligung,
erkannten Formularen, AI-Endpunkten oder unbekannten Drittanbieter-Skripten.

Das Ergebnis ist ein Compliance-Artefakt, das sich automatisch
aktualisiert und das jede:r DSB als technische Vorbereitung für Art. 30 DSGVO
und EU AI Act nutzen kann.

## Gemappte Events

Der Mapper (`runtimeVvtMapper.ts`) verarbeitet folgende Event-Typen:

| Event                              | Verarbeitungstyp          | Rechtsgrundlage-Hinweis        | Risiko |
|------------------------------------|---------------------------|--------------------------------|--------|
| `tracker.pre_consent.detected`     | `website_tracking`        | `consent`                      | high   |
| `form.email.detected`              | `contact_form`            | `unknown`                      | medium |
| `ai.endpoint.found`                | `ai_endpoint`             | `unknown` · KI-Relevanz möglich | high   |
| `vendor.unknown.detected`          | `third_party_script`      | `unknown`                      | medium |
| `cookie.banner.detected`           | `website_tracking`        | `consent`                      | low    |

Unbekannte Event-Typen werden ignoriert.

## Aussagen sind nur Hinweise

- `legal_basis_hint`, `ai_act_relevance`, `risk_level` sind heuristische
  Vorbereitungen.
- `third_country_transfer` ist eine Heuristik auf Basis von
  `country_hint`. Keine endgültige Bewertung.
- Alle abgeleiteten Einträge starten als `review_required` oder `draft`.

## Warum Human Review nötig ist

Der Mapper kennt nur Signale, nicht Kontext: Er weiß nicht, welche
Vereinbarungen mit Vendoren bestehen, welche Zwecke konkret verfolgt
werden, ob bereits AVVs vorliegen. Erst ein:e Datenschutzbeauftragte:r
kann auf Basis der Entwürfe eine belastbare Art.-30-Dokumentation
formulieren.

## Export

Der Button **„JSON-Export"** lädt die aktuell gefilterten Einträge als
strukturierte JSON-Datei herunter:

```
realsync-runtime-vvt-export-YYYY-MM-DD.json
```

Inhalt: `schema`, `generated_at`, `disclaimer`, `entry_count`, `entries`.

Kein PDF, keine Behördenmeldung, kein finales Rechtsdokument — der
Export ist ausschließlich technische Vorbereitung.

## Route

Die View ist unter `/governance/vvt` eingebunden (siehe `src/App.tsx`).

## Manueller Test

1. `npm run dev`
2. `http://localhost:3000/governance/vvt` öffnen
3. Demo-Einträge erscheinen (4 Beispiele).
4. Filter testen (Review · KI-Relevanz · Risiko · Verarbeitungsart).
5. „JSON-Export" klicken → Download startet.

## Was später kommt

- PDF-Export inkl. Art.-30-Mapping
- Mandanten-spezifischer Export
- DSB-Freigabe-Workflow
- Verlinkung in Evidence-Bundle
- Persistenz in Supabase mit RLS
