# CEO-Schaltzentrale: Produkte einzeln, ein Dashboard

Stand: 17.11.2026. Founder-Entscheid: Jedes Produkt ist einzeln über die Landingpage
erreichbar. Das Governance OS unter `/app/dashboard` ist die Schaltzentrale des
Geschäftsführers. Es bleibt bei einem Konto, einem Dashboard und einem Billing
(`docs/PRODUCT_PRIORITIZATION.md`, Kern-Entscheid). Governance ist nach K4 eingebaute
Absicherung; öffentlich heißt die Zentrale „Schaltzentrale“.

## Bestandsaufnahme

| Baustein | Befund | Quelle |
|---|---|---|
| Zentrale | vorhanden: `CommandCenterDashboard` unter `/app/dashboard`, Status `live` | `src/features/governance/dashboard/`, Registry `command-center` |
| CEO-Ausdruck | vorhanden: `/app/cockpit/brief` (`CeoBriefPrintView`), `/app/cockpit` → `/app/dashboard` | `src/App.tsx` |
| Modul-Übersicht | vorhanden: `/app/modules` (`ModulesHubView`, je Entitlement), `/app/marketplace` | `src/App.tsx` |
| Produktseiten | vorhanden: `/phonebot/start`, `/chatbot/start`, `/frontend-builder`, `/audit`, `/ai-act-klassifikator`, `/automations`, `/claude-code-optimizer` | `src/App.tsx` |
| Produktliste auf `/` | fehlte: Landing zeigte Ablauf-Stufen (`#produkt`), keine Produktkarten | `LandingV6View.tsx` |
| Status-Quelle | zwei Register: `implementation-status.ts` (Oberflächen) und `config/platform-capabilities.ts` (Backend-Messung) | beide Dateien |
| Agent Command Center | separat: `/app/command-center` (Preview), Abnahme M9 offen | `docs/command-center/M9-abnahme-und-rollout.md` |

Widersprüche und offene Punkte:

- **KI-Empfang ist der erste Ablauf nach K4, aber noch nicht live.** `voice-telephony`
  steht auf `coming-soon`, `channel-bots` auf `preview`. Die Landing zeigt das als
  „Geplant“ bzw. „In Arbeit“.
- **Zwei Status-Register.** Der Produktkatalog liest aus `implementation-status.ts`.
  `platform-capabilities.ts` misst Edge-Function-Deployments. Bei Abweichung gilt die
  strengere Angabe; Abgleich als eigener Schritt.
- Die Produktseiten haben unterschiedliche Designstände (`/phonebot/start` noch mit runden
  Ecken und Cyan). Angleichen an Hard-Edge ist ein eigener PR.

## PR-Schnitt

| PR | Inhalt | Status |
|---|---|---|
| 1 | Produktkatalog `src/product/product-catalog.ts` + Sektion `#produkte` auf `/` + Nav-Links | in Arbeit (dieser Branch) |
| 2 | Schaltzentrale Ebene „Heute“: offene Freigaben mit Aktion, offene Übergaben, kritische Hinweise | offen |
| 3 | Ebene „Meine KI-Mitarbeiter“: Kachel je Katalogprodukt mit Status aus Mandantendaten oder ehrlichem Leerzustand | offen |
| 4 | Landing → Zentrale: Produkt-CTA über Registrierung/Login nach `/app/dashboard?product=<id>` | offen |

Neue Tabellen oder Migrationen werden nur als Vorschlag beschrieben und brauchen eine
Einzel-Freigabe.
