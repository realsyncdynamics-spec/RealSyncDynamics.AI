# Erteilte Design-Freigaben (Archiv)

> Ausgelagert aus `CLAUDE.md` §10, damit der Kern-Kontext klein bleibt.
> **Verbindlich bleibt der Design-Freeze in `CLAUDE.md` §10.** Diese Datei ist
> das vollständige Protokoll der bereits erteilten Freigaben — mit ihrem Umfang,
> denn jede gilt nur für diesen. Vor einer Änderung an bereits Vorhandenem hier
> nachsehen, ob sie schon abgestimmt war.

**2026-08-19 — Enterprise-Ebene der Startseite**

| Frage | Antwort |
|---|---|
| 1. Zweiter Akzent (Champagner/Gold) als neues Token, nur für VIP-Flächen | **Nein** |
| 2. Neues Materialbild für bestehende Panels (Glas, Haarlinien, gestaffelte Schatten) | **Ja** |
| 3. Eigene Enterprise-Sektion plus gestaffeltes Einblenden und Parallax auf der Weltkugel | **Ja** |

Zur ersten Frage kam der Zusatz „komplett next level Frontend und allgemeines
Webdesign". Der Umfang ist damit **breiter** als die drei Fragen, aber die
Farbentscheidung steht: Es bleibt bei Cyan auf Obsidian, ein zweiter
Farbakzent ist ausdrücklich abgelehnt.

Umgesetzt: `.surface-panel` / `.hairline` und die Reveal-Regeln in
`src/index.css`, `src/hooks/useStagedReveal.ts`, `src/hooks/useHeroParallax.ts`,
`src/components/landing/EnterpriseAccessSection.tsx`.

Was **nicht** freigegeben ist und weiterhin unter §10.1 fällt: Sektionsreihenfolge,
Grid, Typografie-Skala, Icon-Set, Farbpalette.

**2026-08-23 — CTA-Hierarchie der Startseite auf den Scan-Trichter**

Freigegeben durch die ausdrückliche Anweisung des Eigentümers im Auftrag
„Landingpage / Scan / Dashboard / Marketplace Refactor" (§2 und §24: „Der
wichtigste CTA der Landingpage ist: Website kostenlos scannen", Priorität 1
Scan, 2 Demo, 3 Preise).

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Reihenfolge im Hero | Schaltflächenreihe, darunter Scan-Formular | Scan-Formular zuerst, Schaltflächenreihe darunter |
| „Präsenz & App bauen" | gefüllte Fläche (primär) | Umriss (sekundär) — Text und Ziel unverändert |
| Scan-Schaltfläche | „Audit starten" | „Website kostenlos scannen" |
| Ziel des Scan-Formulars | `/unified-entry/scan` | `/scan` |
| Navigation oben rechts | „Free Audit starten" → `/unified-entry/scan` | „Kostenlos scannen" → `/scan` |

Nicht berührt und weiterhin gesperrt: Farben, Typografie, Grid,
Sektionsreihenfolge der Seite, Icon-Set, sämtliche Abschnitte unterhalb des
Hero. `/unified-entry/scan` bleibt bestehen und erreichbar — es ist nur nicht
mehr das Tor von der Startseite aus.

Damit ist auch die seit Phase 1 offene Freigabe aus
`docs/product/reality-matrix.md` §5.1 erteilt: Der Scan führt jetzt in den
Trichter statt in die Gestaltungsauswahl.

**2026-08-23 (2) — Landing-CTA von `/scan` auf `/audit`**

Auf die Fragepflicht nach §10.3 („Achtung, Funktionsänderung — sollen wir dies
machen?") hat der Eigentümer ausdrücklich mit **Ja** geantwortet, mit der
Begründung: „Das ist zwar eine Funktionsänderung, aber eine gewollte
Produktkorrektur, keine kosmetische Änderung. Der Funnel soll künftig eindeutig
sein. Nicht zwei parallele Scan-Einstiege weiter mitschleppen."

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Ziel des Scan-Formulars im Hero | `/scan` | `/audit` |
| Navigation oben rechts, „Kostenlos scannen" | `/scan` | `/audit` |

Die Freigabe vom selben Tag (Reihenfolge im Hero, Umriss statt Fläche,
Beschriftung „Website kostenlos scannen") bleibt unverändert gültig — es ändert
sich allein das Ziel. Farben, Typografie, Grid, Sektionsreihenfolge und
Icon-Set sind unberührt.

Die Freigabe wird **wirksam mit dem Schnitt von PR #1129**, weil `/scan` erst
dann entfällt. Hintergrund und Zielmatrix:
`docs/architecture/canonical-builder-target-matrix.md`.

**2026-08-24 — AP2, Paketumbau auf drei Self-Service-Stufen**

Freigegeben durch die ausdrückliche Anweisung des Eigentümers: „Paketmodell auf
drei bezahlte Pakete umbauen · `policy.packs` ab Starter · WhatsApp als
99-€-Add-on · AP1 als kanonische Entitlement-Basis verwenden · die beiden in
AP1 sichtbar gewordenen Widersprüche gezielt bereinigen."

Zwei Änderungen an bereits Sichtbarem sind darin enthalten und damit gedeckt:

| Was | Vorher | Nachher |
|---|---|---|
| WhatsApp-Kachel in `/app/marketplace` | 39 € | **99 €** — derselbe Betrag wie das Add-on |
| CTA der Enterprise-Karte | `/checkout/enterprise` | `/contact-sales?plan=enterprise` |

Alles Übrige ist Datenschicht: Entitlements, Katalog, Berechtigungen.

**2026-08-24 (2) — Preisseite auf drei Stufen**

Auf die Fragepflicht nach §10.1 (Grid) und §10.3 (Text) hat der Eigentümer
mit drei ausdrücklichen **Ja** geantwortet:

| Frage | Antwort |
|---|---|
| 1. Raster von fünf auf drei Spalten (`lg:grid-cols-5` → `lg:grid-cols-3`) | **Ja** |
| 2. Teaser-Überschrift ohne Agency und Partner | **Ja** |
| 3. Agency und Partner ganz aus dem Verkauf nehmen | **Ja** |

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Spaltenzahl in `PricingPage`, `PricingTeaserSection`, `RuntimeActivationSection`, `PlanSelector`, `GovernanceBotsSection`, `BillingView`, `UnifiedPricingGrid` | `lg:grid-cols-5` | `lg:grid-cols-3` |
| Überschrift `PricingTeaserSection` | „Free Audit · Starter · Growth · Agency · Enterprise · Partner" | „Free Audit · Starter · Growth · Enterprise" |
| Anzeige-Listen | `PUBLIC_PRICING_TIERS` / `ORDERED_PLANS` | `SELLABLE_PRICING_TIERS` / `SALES_PLANS` |

Kartengröße, Farben, Typografie, Abstände, Icon-Set und Sektionsreihenfolge
sind unberührt. Rangvergleiche (`PlanUpgradeModal`, `planRank()`) laufen
weiterhin über die vollständige Leiter — sonst bekäme ein Bestandskunde auf
Agency falsche Antworten. Hintergrund: `docs/product/ap2-paketumbau.md` §7.

**2026-08-30 — Texte und Buttons an die Route- und Pricing-Infrastruktur**

Auf die Fragepflicht nach §10.3 hat der Eigentümer dreimal mit **Ja**
geantwortet:

| Frage | Antwort |
|---|---|
| 1. Erfundene Plannamen (Scale, Pro, Business, Premium) auf echte Plannamen korrigieren | **Ja** |
| 2. Legacy-Pläne (Agency, Partner) auf die verkäuflichen Stufen umstellen | **Ja** |
| 3. Falsche Kontingente auf `/agenturen-conversion` an die SSoT angleichen | **Ja** |

Umfang — und **nur** dieser: Beschriftungen, Fließtext und Link-Ziele. Kein
Layout, kein Grid, keine Farben, keine Typografie, keine Sektionsreihenfolge.

Die Zuordnung ist aus `shared/pricing.ts` abgeleitet, nicht gewählt:
White-Label (`whitelabel.reports`) gibt es nur in Agency, Enterprise und
Partner — davon ist Enterprise der einzige verkäufliche Plan, deshalb geht
jede White-Label-Aussage dorthin. `provenance.advanced`, `bulk.jobs`,
`scheduler.enabled` und `evidence.advanced` beginnen bei Growth,
`policy.packs` seit AP2 bei Starter, die Kodee-Tools (`ai.tool.vps_*`) bei
Agency und damit verkäuflich erst bei Enterprise.

**2026-08-30 (2) — WhatsApp-Preisseite auf drei Stufen**

Auf die Drei-Fragen-Regel nach §10.4 hat der Eigentümer dreimal mit **Ja**
geantwortet:

| Frage | Antwort |
|---|---|
| 1. Karte „Agency WhatsApp" (699 €) aus `WHATSAPP_TIERS` entfernen | **Ja** |
| 2. Raster von `lg:grid-cols-4` auf `lg:grid-cols-3` | **Ja** |
| 3. Agency-Nennung in der FAQ derselben Seite auf Enterprise ziehen | **Ja** |

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Tarifkarten | Starter · Growth · Agency · Enterprise | Starter · Growth · Enterprise |
| Raster der Tarifsektion | `lg:grid-cols-4` | `lg:grid-cols-3` |
| FAQ „Setup-Dauer" | „Agency/Enterprise: Dedicated Onboarding" | „Enterprise: Dedicated Onboarding" |

Damit entfällt `/checkout/agency?channel=whatsapp` — die letzte Stelle im
Frontend, an der ein Legacy-Plan über Self-Service kaufbar war. Nichts geht
verloren: Die Enterprise-Karte führt bereits mehr Bots (20 statt 10), mehr
Antworten (50.000 statt 25.000) und White-Label. Kartengröße, Farben,
Typografie, Abstände, Icon-Set und Sektionsreihenfolge sind unberührt; die
beiden anderen Raster der Seite (`md:grid-cols-2`, `md:grid-cols-3`) ebenso.

**2026-08-30 (3) — DORA-Karte als „In Vorbereitung"**

Auf die Fragepflicht nach §10.3 hat der Eigentümer entschieden, die Karte
zu behalten und als noch nicht verfügbar auszuweisen, statt sie zu
entfernen. `path` ist jetzt `null` statt `/app/governance/dora` — diese
Route existiert im Repo nicht —, die Karte navigiert nicht mehr und trägt
das Abzeichen „In Vorbereitung". Das Schloss-Symbol entfällt dort, weil es
„per Tarif gesperrt" bedeutet und nicht „noch nicht gebaut". Kartenzahl und
Raster bleiben unverändert.

**Korrektur am selben Tag**: Die vier CTAs, die AP2 folgend auf
`/contact-sales?plan=enterprise` gelegt worden waren, lesen sich dort nicht
— `src/pages/ContactSales.tsx` wertet `tier`, `source` und `intent` aus,
**nicht** `plan`. Sie tragen jetzt `?tier=enterprise`. Der Eintrag zu AP2
oben nennt weiterhin `plan=enterprise`; das ist die dort dokumentierte
Absicht, nicht der Parameter, den die Seite liest.

**Erledigt, gemessen am 2026-08-31**: Der hier zuvor als offen geführte
Punkt zu `/realsync-landing` („fünf Plan-Karten mit hart codierten Preisen
im JSX, inklusive Agency und Partner") trifft auf den Code nicht mehr zu.
`src/marketing/landing/RealSyncDynamicsLanding.tsx` führt vier Karten —
Free Audit · Starter · Growth · Enterprise —, die Beträge kommen aus der
Quelle (`planById('starter').price.monthlyEur`, ebenso Growth), Agency und
Partner sind als Karten entfallen, Enterprise steht auf „Auf Anfrage".

**2026-08-31 — Build Studio: Speicherort und Übernehmbarkeit an den Sitzungsmodus**

Auf die Fragepflicht nach §10.3 hat der Eigentümer zweimal mit **Ja**
geantwortet:

| Frage | Antwort |
|---|---|
| 1. Textänderung: Den Satz zum Speicherort des Entwurfs an `session.mode` koppeln | **Ja** |
| 2. Funktionsänderung: „Website übernehmen" im Rückfallmodus sperren | **Ja** |

Umfang — und **nur** dieser, in `src/unified-entry/pages/BuildStudioPage.tsx`:

| Was | Vorher | Nachher |
|---|---|---|
| Hinweis zum Speicherort | fest „Der Entwurf liegt nur in diesem Browser." | je Modus: serverseitig gespeichert (`server`) bzw. nur im Browser (`local`) |
| „Website übernehmen" | immer aktiv | im Modus `local` deaktiviert, mit Begründung als `title` |
| Abzeichen im Kopf | — | neu: „Nur lokal — nicht übernehmbar", nur im Modus `local` |

Anlass ist kein Geschmack, sondern zwei Falschaussagen der Oberfläche. Der
feste Satz behauptete den **falschen Speicherort für Kundendaten**: Im
Servermodus liegt der Entwurf in `siteos_anonymous_builds` und wird beim
Claim nur verschoben — so sagen es `buildSession.ts` und `SiteOsClaimView.tsx`
übereinstimmend. Und der CTA lud im Rückfall zu einer Übernahme ein, die es
nicht gibt: `/app/siteos/claim` schickt zuerst nach `/welcome`, der Besucher
legt ein Konto an und erfährt **erst danach**, dass serverseitig keine
Sitzung existiert. `buildSession.ts` verlangt ausdrücklich das Gegenteil.

Farben, Typografie, Grid, Abstände, Icon-Set und Sektionsreihenfolge sind
unberührt; das Abzeichen nutzt die im Repo vorhandene Amber-Warnoptik. Der
Rückfall selbst bleibt, was er ist: Übergang, kein Dauerzustand — sobald der
anonyme Pfad überall ausgerollt ist, entfallen Sperre und Abzeichen mit ihm.
Gesichert durch `test/siteos/claim-moves-not-rebuilds.test.ts`.

**2026-09-01 — Vorschau-Inhalte: nichts behaupten, was der Scan nicht hergibt**

Anlass war ein Screenshot des Eigentümers: Die Live-Vorschau einer
AI-Governance-Plattform warb mit **„Termin anfragen"** und versprach unter
„Warum wir" eine **„Persönliche Betreuung — Feste Ansprechpartner statt
Warteschleife."** Urteil: „Das ist komplett am Ziel vorbei."

Zu Recht. Beide Texte standen fest in `blueprint/synthesize.ts` (Zeilen 157
und 177–181) und gingen unverändert an **jeden** Kunden **jeder** Branche.
Sie stammten nicht aus der gescannten Website. Für nahezu jeden Empfänger
waren sie damit falsch.

Auf die Fragepflicht nach §10.3 hat der Eigentümer entschieden: **„Ja — aus
dem Scan speisen"**, ausdrücklich mit der Maßgabe „wo der Scan nichts
hergibt, bleibt der Block leer statt falsch."

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Hero-CTA | fest „Termin anfragen" | folgt dem Ziel im Seitenplan: `/termin` → „Termin anfragen", `/reservierung` → „Tisch reservieren", `/anfrage` → „Anfrage senden", sonst „Kontakt aufnehmen" |
| Features-Block | drei erfundene Sätze | `brief.highlights` aus dem Scan; ohne Beleg leer und als `requiresRealContent` gemeldet |
| `SiteBrief` / `BriefEnrichment` | — | neues Feld `highlights` als Kanal für belegte Vorzüge |
| `sanitizeEnrichment` | ließ das Feld fallen | reicht `highlights` durch — in **beiden** Kopien (`builder.ts`, `anonymous.ts`) |

**Der Hash-Preis ist bekannt und akzeptiert**: `synthesize.ts` ist
deterministisch und gehasht („gleicher Brief ⇒ gleicher Blueprint ⇒ gleicher
Hash"). Jeder neu erzeugte Blueprint bekommt damit einen anderen Hash als
vor dem 2026-09-01. Bestehende Artefakte bleiben unangetastet — sie werden
nicht neu gebaut. Der Determinismus selbst bleibt: gleicher Brief ergibt
weiterhin byte-gleiches Ergebnis, geprüft.

**Was der Scan heute wirklich hergibt — gemessen, nicht vermutet**:
`handlers/discover.ts:77` bildet `services` als
`unique([...headings, ...extractServiceLikeText(visibleText)])`. Die
Überschriften sind also **vollständig in den Leistungen enthalten**; eine
zweite, unabhängige Quelle für „Warum wir" existiert im Scan nicht. Der
Block bleibt deshalb heute in der Regel leer — das ist der freigegebene
Zustand, nicht ein unfertiger. Der Kanal steht bereit, sobald Redaktion
oder ein Content-Agent echte Vorzüge liefert.

**Regel daraus**: Ein Vorschau-Block, der etwas über ein fremdes Unternehmen
behauptet, braucht eine Quelle. Ohne Quelle bleibt er leer und trägt
`requiresRealContent: true` — dieselbe Behandlung wie `testimonials`, und
aus demselben Grund (§ 5 UWG). Plausibel klingender Fülltext ist keine
Vorschau, sondern eine Behauptung, für die niemand einstehen kann.

Gesichert durch `test/siteos/preview-content-honesty.test.ts` — die Prüfung
fragt nach der **Herkunft** des Textes, weil erfundener Text technisch
genauso aussieht wie belegter und deshalb von keinem Render- oder
Typ-Test gefunden wird. Die beanstandeten Formulierungen sind dort
namentlich gesperrt.

**2026-09-01 (2) — Zusammenfassung im Brief: sachlich statt werbend**

Nachtrag zur Freigabe oben, gleiche Klasse an anderer Stelle. `parseBrief`
setzte die Zusammenfassung auf „… — persönliche Beratung, transparente
Leistungen und kurze Wege." Sie wird zur **Meta-Description und zur
Hero-Unterzeile**, landet also im ausgelieferten Dokument und im
Suchindex — aus einem Prompt allein ist keine der drei Zusagen belegbar.

Auf die Fragepflicht nach §10.3 hat der Eigentümer entschieden: **„Ja — nur
Zusammenfassung"**.

| Was | Vorher | Nachher |
|---|---|---|
| `parseBrief`-Zusammenfassung | „Zahnarztpraxis in Hamburg — persönliche Beratung, transparente Leistungen und kurze Wege." | „Zahnarztpraxis in Hamburg." |
| `defaultServices` | erfindet Leistungen je Branche | **unverändert** — ausdrücklich nicht freigegeben |

Leer wäre keine Option gewesen: Dann griffe `seo.missing-description`. Eine
Längenregel gibt es nicht — geprüft wird allein auf „vorhanden", am Code
nachgesehen (`analysis/blueprint.ts`, `analysis/observation.ts` führen nur
`missing-` bzw. `not-delivered`-Codes). `renameInSummary` greift weiter:
Ein echter Firmenname ersetzt weiterhin den führenden Katalogbegriff.
Der Scan-Pfad ist unberührt — `mergeBrief` ersetzt die Zusammenfassung
ohnehin durch die echte Beschreibung der Website.

**Weiterhin offen, nicht freigegeben**: `defaultServices` in `brief.ts`
erfindet die Leistungen je Branche (für eine Zahnarztpraxis „Prophylaxe,
Zahnerhaltung, Implantologie …"). Im Scan-Pfad überschreibt `mergeBrief`
sie mit echten Daten; im reinen Prompt-Pfad bleiben sie stehen. Bewusst
stehengelassen — der Leistungsblock ist zentral, und ohne ihn wäre die
Startseite im Prompt-Pfad deutlich leerer. Gehört entschieden, nicht
nebenbei geändert.

**2026-09-01 (3) — Hero-Überschrift: langer einteiliger Name wurde abgeschnitten**

Gefunden beim Nachstellen der reparierten Vorschau **mit einem echten
Browser** — nicht im Code, nicht in einem Test. Die Layoutschicht begrenzt
die Hero-Überschrift auf `max-width:16ch` und der Hero trägt
`overflow:hidden`. Ein Firmenname ohne Leerzeichen ist aber ein einziges
Wort, und ein Wort bricht bei `overflow-wrap:normal` nicht: Der Überhang
wurde nicht umgebrochen, sondern **weggeschnitten**.

Gemessen in Chromium bei 1280 px: „RealSyncDynamics.AI" ergab **648 px Text
in einem 570 px breiten Kasten — 78 px fehlten.** Bei Markennamen und
Domains ist der einteilige Name der Normalfall, nicht die Ausnahme.

Der Fehler ist **älter als PR #1194**: `BuildStudioPage` und
`siteos/preview.ts` rendern seit jeher `showcase` und waren gleich
betroffen. Der PR hat ihn nur sichtbar gemacht.

Auf die Fragepflicht nach §10.3: **„Ja — break-word ergänzen"**.

| Was | Vorher | Nachher |
|---|---|---|
| `[id*="--hero--"]>h1,>h2` | `max-width:16ch` ohne Umbruchregel | zusätzlich `overflow-wrap:break-word` |

**Warum `break-word` und nicht `anywhere`**: Der erste Versuch war
`anywhere` — die Messwerte sahen gut aus (kein Überlauf), das **Bild aber
nicht**. `anywhere` zählt beim Ermitteln der Mindestbreite mit und ließ die
Textspalte im Hero-Raster von 570 px auf 226 px zusammenfallen; die
Überschrift brach dann dreizeilig mitten im Wort. `break-word` bricht erst,
wenn es sonst überliefe, und lässt die Spaltenbreite in Ruhe. Auf 1280,
768 und 390 px geprüft: Spaltenbreite unverändert, nichts abgeschnitten,
kein Seitenüberlauf.

**Lehre, und sie ist die eigentliche**: Zwei Fehler dieser Sitzung waren
weder im Code noch in 3990 grünen Tests zu sehen — erst das gerenderte Bild
hat sie gezeigt. Und beim Fix hätten die Messwerte allein zur falschen
Lösung geführt. Bei einer Änderung an der Vorschau-Optik gehört ein Blick
auf das tatsächliche Rendering dazu, nicht nur eine grüne Suite.

Gesichert durch `test/siteos/hero-longword.test.ts`. Geprüft wird am CSS,
nicht am Pixel: Ein Pixel-Test hinge an der Schriftart des CI-Runners,
während die fehlerhafte Kombination — Begrenzung plus `overflow:hidden`
ohne Umbruchregel — eine Eigenschaft des Stylesheets ist.

**2026-09-01 — Ein Flow für den Start: drei Freigaben nach der Add-on-Buchung**

Auf die drei Fragen nach §10.3 aus `docs/product/addon-booking.md` §6 hat
der Eigentümer mit **„go"** geantwortet — gelesen als Ja zu allen dreien,
im Rahmen seines Auftrags „der Start ist am Ende immer der gleiche Flow".

| Frage | Antwort |
|---|---|
| 1. Textänderung: Enterprise aus `availableFor` der fünf Add-ons nehmen, die Enterprise schon vollständig enthält | **Ja** |
| 2. Funktionsänderung: `/checkout/success` nach `/app/dashboard` statt `/app/billing` leiten | **Ja** |
| 3. Funktionsänderung: Registrierung von `/unified-entry/*` auf `/welcome?next=…` legen und `/os/app/*` hinter `AppGate` stellen | **Ja** |

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| `availableFor` von Response Pack, Voice, Compliance Pack, Agency Bot Pack, White Label | `['growth', 'enterprise']` | `['growth']` — `plan.addons` von Enterprise unverändert |
| `/checkout/success`, Weiterleitung und Knopf „Go to Dashboard Now" | `/app/billing?subscription=…` | `/app/dashboard?subscription=…` |
| `/unified-entry/register` | eigenes Formular, danach `/unified-entry/onboarding` | Weiterleitung `/welcome?next=/unified-entry/onboarding` (Parameter bleiben) |
| `/flow/login`, Knopf „Zur Anmeldung" | `/os/login` | `/welcome` |
| `/os/app/*` (12 Routen) | ohne Auth-Wrapper | hinter `AppGate` |

Farben, Typografie, Grid, Sektionsreihenfolge und Icon-Set sind unberührt.
`/os/login` und `/os/signup` bleiben bestehen und erreichbar — sie sind nur
kein Ziel des Flows mehr. Hergang: `docs/product/addon-booking.md` §6.

**2026-09-04 — AP11 Aufräumen: verwaiste Dateien**

Auf die drei Fragen zur AP11-Liste (gemessen am Import-Graphen von `src`,
Stand `main` `6c8e98c`) hat der Eigentümer mit **„go"** geantwortet —
gelesen wie am 2026-09-01: Ja zu den Ja/Nein-Fragen 1 und 3; Frage 2 war
offen formuliert („welche bekommen eine Route?") und ist mit „go" nicht
beantwortet.

| Frage | Antwort |
|---|---|
| 1. Sechs verwaiste Duplikate löschen, deren gerouteter Zwilling existiert | **Ja** |
| 2. Elf ungeroutete Views mit echtem Backend: welche bekommen eine Route, welche fallen weg? | **offen** — nur die fünf mit geroutetem Nachfolger entfernt |
| 3. Mock-Views und ungenutzte Landing-Bausteine löschen | **Ja** |

Umfang — und **nur** dieser: 52 `.tsx`-Dateien, die keine andere Datei
importiert (statische und dynamische Imports, Re-Exports, Alias `@/`,
geprüft auch gegen `test/`, `tests/`, `e2e/`, `scripts/`). Kein Grid, keine
Farbe, kein sichtbarer Text ändert sich; die eingefrorene Startseite nutzt
keinen der entfernten Bausteine. Vollständige Liste, bewusst Stehengelassenes
und die 14 Folge-Waisen: `docs/product/ap11-aufraeumen.md`.

Bewusst **nicht** gelöscht: `components/landing/FrankfurtSkyline.tsx` (wird
nirgends gerendert, aber `test/landing/frankfurt-skyline.test.ts` schützt sie
ausdrücklich — Route oder Löschung entscheidet der Eigentümer),
`features/api/OAuth2ConfigView.tsx` (der Gate-Test in PR #1196 liest die
Datei), und die sechs Views aus Frage 2 ohne Nachfolger
(`IntegrationMarketplaceView`, `UnknownTrackersView`, `AgentsView`,
`ApiUsageStats`, `NewsletterForm`, `PolicyPackAutoActivator`).

