# Promotion Engine (MVP)

Typsicheres Content-Repository für die Kampagne **„Was Ihre Website wirklich tut"**.

Diese Engine liefert **Inhalte**, **kein Auto-Posting**. Posten, Hochladen und Versenden bleibt manuell oder über separate Automation. Die Trennung ist Absicht: solange wir kein verifiziertes Approval-Workflow + Plattform-API-Risk-Profil haben, posten wir nicht aus dem Repo heraus.

## Struktur

```
src/marketing/
  types.ts                            ← gemeinsame Typen, CTA-Mapping
  campaigns/
    governance-runtime-launch.ts      ← Kampagnen-Metadaten, Ziele, Channel-Mix
  content/
    linkedin-posts.ts                 ← 20 LinkedIn-Posts (DE)
    email-sequences.ts                ← 10 Cold-Email-Templates (DE)
    youtube-shorts.ts                 ← 10 Shorts-Skripte (DE)
  landing/
    seo-keywords.ts                   ← 20 Keyword/Landing-Page-Ideen
```

## Verbindliche Regeln

| Regel | Warum |
|---|---|
| Deutsch | Zielmarkt DACH; englische Posts performen aktuell schlechter. |
| Keine 100 %-Rechtsgarantie | Versprechen wir nicht. Verboten in jedem Asset. |
| Kein Fearmongering | „Bußgeld droht" verkauft kurzfristig, schadet Marke langfristig. |
| Evidence/Runtime-Positioning | Was zeigen, nicht behaupten. Rule-ID · Zeitpunkt · Quelle · Hash. |
| Immer CTA | `Kostenlosen Check starten` → `/audit`. Andere CTAs nur wenn semantisch passender (z. B. Partner-Mail → `/partners`). |

## Nutzung

```ts
import { LINKEDIN_POSTS } from '@/marketing/content/linkedin-posts';
import { COLD_EMAILS }    from '@/marketing/content/email-sequences';
import { YOUTUBE_SHORTS } from '@/marketing/content/youtube-shorts';
import { SEO_LANDING_IDEAS } from '@/marketing/landing/seo-keywords';
import { GOVERNANCE_RUNTIME_LAUNCH } from '@/marketing/campaigns/governance-runtime-launch';
import { CTA_TARGETS } from '@/marketing/types';

// Beispiel: nächsten LinkedIn-Post für Persona „founder" finden
const post = LINKEDIN_POSTS.find((p) => p.persona.includes('founder'));
```

## Posting-Workflow (manuell, vorerst)

1. **LinkedIn (täglich, Mo–Fr 8:00)**: 1 Post aus `LINKEDIN_POSTS` rotieren. Pin-Comment mit Free-Audit-URL.
2. **YouTube Shorts (3×/Woche, Di/Do/Sa)**: 1 Short aus `YOUTUBE_SHORTS` produzieren (echter Scan, echtes Finding). Pin-Comment + Bio-Link.
3. **Cold Email (20/Woche)**: aus `COLD_EMAILS` Templates ziehen, Platzhalter per Hand füllen, kein Bulk-Send. Antwort-Quote zählen, nicht Open-Rate.
4. **SEO (1 neue Landing/Woche)**: aus `SEO_LANDING_IDEAS` einen Eintrag mit `existsAsRoute: false` priorisieren. Page bauen, dann Eintrag auf `true` flippen.
5. **Newsletter (Fr 10:00)**: Mix aus 1 Markt-Trigger + 1 Finding der Woche + 1 Fix.

## Ziele (90 Tage)

| Metric | Ziel |
|---|---|
| Free Audits | **1.000** |
| Trials | **100** |
| Zahlende Accounts | **20** |
| Agency-/DSB-Partner | **3** |

Werte werden manuell in `governance-runtime-launch.ts → goals[i].measured` gepflegt, nicht aus Live-Telemetrie.

## Erweitern

Neuen Content-Typ hinzufügen:

1. Type erweitern in `types.ts` (`Channel`, ggf. `ContentAsset`-Variante).
2. Neue Datei unter `content/` oder `landing/`.
3. Im README oben ergänzen.
4. CTA über `CTA_TARGETS` referenzieren — keine Inline-URLs.
5. Tests in `test/marketing/` ergänzen.

## Was diese Engine **nicht** ist

- ❌ Kein Auto-Poster (kein LinkedIn-API-Call, kein YouTube-Upload).
- ❌ Keine Live-Telemetrie (Ziele werden manuell gepflegt).
- ❌ Kein Approval-Workflow (das gehört in n8n oder einen Editor-Cockpit, nicht hier).
- ❌ Kein A/B-Testing der Copy (bei diesem Volumen Overkill).

Sobald 100+ Posts/Woche live gehen, lohnt sich eine zweite Iteration mit dedizierter Pipeline.
