# Repository-Inventar (Phase 0)

**Gemessen am 2026-09-08** über `list_repos` der Organisation
`realsyncdynamics-spec`. **30 Repositories.**

> **Grenze dieser Messung, ausdrücklich**: klassifiziert wurde nach Metadaten
> (Name, Sichtbarkeit, letzter Push) — **nicht** nach Inhalt. In dieser Sitzung
> war ausschließlich `RealSyncDynamics.AI` ausgecheckt; die übrigen 29 wurden
> nicht geöffnet. Jede Zeile unterhalb von „ACTIVE PRODUCTION" ist damit eine
> **Hypothese mit Datum**, kein Befund. §31 des Auftrags verlangt vor jeder
> Löschung den Nachweis der Konsumenten — dieser Nachweis ist hier **nicht**
> erbracht und darf aus diesem Dokument nicht abgeleitet werden.

---

## 1. Klassifikation

| Repository | Sichtbar | Letzter Push | Status | Anmerkung |
|---|---|---|---|---|
| **RealSyncDynamics.AI** | public | 2026-09-08 | **ACTIVE PRODUCTION** | Hauptprodukt, hier gemessen |
| realsync-agent-os | public | 2026-09-04 | **ACTIVE SUPPORT?** | jüngster Nebenpush; Bezug zu ADR 0011 / PR #1207 zu prüfen |
| orbit-dove-quiet-timber | private | 2026-08-23 | UNKNOWN | Name entspricht Branch `claude/orbit-dove-quiet-timber-gruapa` (PR #1201) |
| beacon-reef-mint-brave | private | 2026-08-21 | UNKNOWN | Muster wie oben — vermutlich Sitzungs-Artefakt |
| bay-pearl-valley-pearl | private | 2026-08-21 | UNKNOWN | dito |
| kite-king-fjord-urban | private | 2026-08-21 | UNKNOWN | dito |
| realsyncdynamic.ai.gooogle-studio- | public | 2026-08-07 | EXPERIMENTAL | Tippfehler im Namen, **public** |
| realsync-infra | private | 2026-08-07 | ACTIVE SUPPORT? | Infrastruktur; Bezug zu `deploy/`, `infra/` zu prüfen |
| realsyncdynamics-spec-s-Org | private | 2026-06-21 | HISTORICAL | Org-Profil |
| Ultra-Premium-Space-Hero-… | private | 2026-06-21 | EXPERIMENTAL | Design-Versuch |
| ki-betriebssystem-website | private | 2026-06-19 | DORMANT | Website-Versuch |
| OpenClaw | private | 2026-05-20 | DORMANT | §21: eigener Sicherheitsbefund, siehe unten |
| creator-os | public | 2026-05-16 | DORMANT | CreatorSeal-Strang |
| realsyncdynamics-website | public | 2026-05-16 | HISTORICAL | Vorgänger-Website |
| realsync-platform | public | 2026-05-01 | DORMANT | Bezug zu `platform/` im Hauptrepo zu prüfen |
| Live-seal | private | 2026-04-29 | DORMANT | CreatorSeal |
| Live-creatorseal | private | 2026-04-29 | DORMANT | CreatorSeal |
| Creatorseal | private | 2026-04-29 | DORMANT | CreatorSeal |
| RealSync-Bildung | public | 2026-04-29 | EXPERIMENTAL | eigenes Produktfeld |
| realsync-v2 | private | 2026-04-23 | HISTORICAL | Vorgängergeneration |
| v0-best-projekt | private | 2026-04-12 | EXPERIMENTAL | v0-Export |
| digital-optimus | public | 2026-04-09 | DORMANT | — |
| creator-seal-defense | private | 2026-04-09 | DORMANT | CreatorSeal |
| realsync-ads | public | 2026-04-09 | DORMANT | Ads-Strang |
| handwerker-pro-billing | private | 2026-04-07 | DORMANT | Branchenversuch |
| paperclip | public (fork) | 2026-04-04 | HISTORICAL | Fremd-Fork |
| powershell-infra | public | 2026-03-30 | DORMANT | — |
| realsync-ad-engine | private | 2026-03-28 | DORMANT | Ads-Strang |
| RealSyncOptimusAgent | public | 2026-03-21 | DORMANT | Agenten-Versuch |
| realsync-dynamics | public | 2026-03-20 | HISTORICAL | Namensvorgänger |

---

## 2. Was auffällt

**Ein aktives Produkt, 29 Nebengleise.** Nur `RealSyncDynamics.AI` wurde in den
letzten 30 Tagen bewegt; `realsync-agent-os` ist das einzige weitere Repo mit
einem Push im September.

**Vier Repositories mit Zufallsnamen** (`orbit-dove-quiet-timber`,
`beacon-reef-mint-brave`, `bay-pearl-valley-pearl`, `kite-king-fjord-urban`)
tragen dasselbe Wortmuster wie die Sitzungs-Branches im Hauptrepo — z. B.
entspricht `orbit-dove-quiet-timber` dem Branch
`claude/orbit-dove-quiet-timber-gruapa` aus PR #1201. Sie sind mit hoher
Wahrscheinlichkeit versehentlich angelegte Sitzungs-Artefakte. **Nicht
gelöscht, nicht geprüft** — vor jeder Löschung ist ihr Inhalt anzusehen.

**Vier CreatorSeal-Repositories** (`Creatorseal`, `Live-creatorseal`,
`Live-seal`, `creator-seal-defense`) und **zwei Ads-Repositories**
(`realsync-ads`, `realsync-ad-engine`) sind je ein Konsolidierungskandidat.
CreatorSeal ist in CLAUDE.md §1 als Produktziel („Creator-Verifikation")
genannt — ob diese vier den aktuellen Stand tragen oder Altbestand sind, ist
`UNKNOWN`.

**Ein öffentliches Repository mit Tippfehler im Namen**:
`realsyncdynamic.ai.gooogle-studio-` (drei „o"). Für ein Produkt, das
EU-Souveränität und Prüfbarkeit zusagt, ist ein öffentlich sichtbares Repo mit
verunglücktem Namen ein Auftrittsbefund — kein technischer.

---

## 3. OpenClaw — §21 des Auftrags

`OpenClaw` (privat, letzter Push 2026-05-20) ist im Hauptrepo als
`services/openclaw-agent` präsent (systemd-Unit laut CLAUDE.md §2).

Der Auftrag verlangt ausdrücklich, **nichts** über Zugriff, Sichtbarkeit,
Vertrauen oder Rechte eines externen Agenten zu behaupten, was nicht gemessen
ist. **In Phase 0 wurde nichts davon gemessen.** Insbesondere gilt: Es wird
hier **nicht** behauptet, ein Widget oder Agent könne Dashboard-Inhalte lesen.
Herkunft, Netzaufrufe, Rechte, Mandantenkontext und Handlungsfähigkeit sind
sämtlich `UNKNOWN` und gehören in eine eigene Sicherheitsmessung.

---

## 4. Empfehlung

**Keine Löschung, keine Archivierung in dieser Phase** (§41). Vorgeschlagene
Reihenfolge für die Klärung:

1. **Vier Zufallsnamen-Repos** ansehen — falls leer oder Sitzungsreste:
   Archivierung dem Eigentümer vorschlagen. Geringstes Risiko, schnellster
   Gewinn an Übersicht.
2. **`realsync-agent-os`** gegen ADR 0011 und PR #1207/#1202 prüfen — hier ist
   eine echte Doppelung der Agenten-Ebene möglich.
3. **`realsync-platform`** gegen `platform/` im Hauptrepo prüfen — zwei Orte
   für denselben ruhenden Stack.
4. **CreatorSeal-Vierergruppe** konsolidieren, sobald das Produktfeld
   entschieden ist.
5. **`realsyncdynamic.ai.gooogle-studio-`** auf privat stellen oder umbenennen.
