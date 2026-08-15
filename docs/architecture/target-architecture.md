# RealSyncDynamics.AI — Zielarchitektur (Plattformmodell)

**Status**: `adopted` (strategische Referenz) · **Ebene**: cross · **Stand**: 2026-08-15

**Kurzfassung**: RealSyncDynamics.AI ist kein Audit-Tool und kein Website-Scanner.
Es ist eine Governance- und Transformationsplattform, die eine bestehende digitale
Infrastruktur **kontinuierlich beobachtet, verbessert und kontrolliert**.

---

## 0. Geltung dieses Dokuments

| Frage | Zuständiges Dokument |
| --- | --- |
| Wie ist das Repo **heute** gebaut? | [`CLAUDE.md`](../../CLAUDE.md) · [`docs/ARCHITECTURE_CURRENT.md`](../ARCHITECTURE_CURRENT.md) |
| Wohin geht die Plattform? | **dieses Dokument** |
| Wie ist SiteOS heute umgesetzt? | [`docs/SITEOS_ARCHITECTURE.md`](../SITEOS_ARCHITECTURE.md) |
| Welche Preise/Pläne gelten? | [`shared/pricing.ts`](../../shared/pricing.ts) + [`docs/product/pricing-governance.md`](../product/pricing-governance.md) |

Bei Widerspruch gilt: für **Implementierungsfragen** der Ist-Stand (CLAUDE.md),
für **Richtungsfragen** dieses Dokument. Das bekannte Delta steht in §11 — es ist
Arbeitsvorrat, keine Beschreibung des Vorhandenen.

Dieses Dokument beschreibt **Ebenen, Verantwortungen und Verträge**, bewusst nicht
einzelne Features, Buttons oder Seiten. Sobald eine Diskussion auf Feature-Ebene
abrutscht, ist die Frage: *Auf welcher Ebene sitzt das, und welchen Vertrag erfüllt es?*

---

## 1. Der Produktsatz

> Der Kunde bezahlt zunächst für **Sicherheit und Kontrolle**.
> Danach bezahlt er für **Automatisierung, Governance-Tiefe und Reichweite**.

Daraus folgt unmittelbar, was das Produkt **nicht** ist:

- Nicht: „Wir scannen Ihre Website." → Der Scan ist ein technisches Werkzeug der
  Beobachtungsebene. Er ist ein Mittel, kein Produkt.
- Nicht: „Scan → Report → fertig." → Ein Bericht ist ein Ausgabeformat eines
  Zustands, kein Vorgang mit Ende.
- Sondern: „Wir überwachen Ihre digitale Infrastruktur kontinuierlich und
  reagieren kontrolliert auf relevante Veränderungen."

Die vollständige Kette, die die Plattform abbildet:

```
Digital Assets
   → Continuous Observation
   → Evidence
   → AI Intelligence
   → Governance Engine
   → Automated Workflows
   → Human Approval
   → Controlled Transformation
   → Continuous Monitoring
   → Publish / Operate
```

Diese Kette ist zyklisch: `Publish / Operate` mündet zurück in
`Continuous Observation`. Es gibt keinen Endzustand „fertig geprüft".

---

## 2. Die fünf Ebenen

```text
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER EXPERIENCE                      │
│                                                             │
│  Website / Transformation / Dashboard / Reports / Actions   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SITEOS / CONTROL PLANE                   │
│                                                             │
│  Websites • Projekte • Workflows • Skills • Integrationen   │
│  Findings • Evidence • Governance • Publishing              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    GOVERNANCE ENGINE                        │
│                                                             │
│  Policy → Evidence → Risk → Decision → Approval → Action    │
│                                                             │
│  tenant-specific • industry-specific • policy-specific      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENT / AUTOMATION LAYER                 │
│                                                             │
│  AI Skills • Workflows • Agents • Integrations • Runtime    │
│  continuous monitoring / remediation / orchestration        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                     │
│                                                             │
│  Website • CMS • GitHub • Cloudflare • Microsoft • Google   │
│  CRM • Analytics • Identity • Storage • APIs • etc.         │
└─────────────────────────────────────────────────────────────┘
```

| Ebene | Verantwortung | Darf ausdrücklich nicht |
| --- | --- | --- |
| **1 Customer Experience** | Darstellung von Zustand, Vorschlag, Entscheidung und Ergebnis | Governance-Entscheidungen treffen oder ableiten |
| **2 SiteOS / Control Plane** | Digitale Objekte, ihr Lebenszyklus, ihre Zuordnung zu Policies, Workflows und Integrationen | Regeln auslegen oder Risiko bewerten |
| **3 Governance Engine** | Aus Policy + Evidence + Kontext + Risiko eine nachvollziehbare Entscheidung erzeugen | Aktionen selbst ausführen |
| **4 Agent / Automation** | Beobachten, analysieren, vorschlagen, nach Freigabe ausführen | Ohne Entscheidung der Ebene 3 wirksam werden |
| **5 Infrastructure** | Die tatsächlichen Systeme des Kunden | Eigene Wahrheit über Compliance-Zustand halten |

**Ebenenregel**: Jede Ebene spricht nur mit der unmittelbar darunterliegenden.
Die Customer Experience erreicht die Infrastruktur nie direkt — das ist dieselbe
Regel, die im Ist-Zustand als „der Browser spricht nie direkt mit privilegierten
Ressourcen" gilt, nur eine Abstraktionsstufe höher formuliert.

---

## 3. Ebene 1 — Customer Experience: zwei getrennte Welten

Die Kundenoberfläche zerfällt in genau zwei Welten. Die Trennung ist strikt,
weil sie zwei verschiedene Fragen beantworten.

### `/app` — Control Plane

Für Kunden, die ihre **Governance-Infrastruktur als Ganzes** verwalten:
Organisation, Benutzer, Websites, Policies, Integrationen, Skills, Workflows,
Governance, Reports, Settings. Das ist Unternehmenssteuerung.

Leitfrage: *Wie steht meine Organisation?*

### `/app/siteos` — Customer Transformation Workspace

Kein zweites Governance-Dashboard. Hier steht das digitale Produkt selbst im
Vordergrund:

```text
Meine Website
      ↓
Was wurde erkannt?
      ↓
Was wurde verbessert?
      ↓
Wie sieht die neue Version aus?
      ↓
Ist sie freigegeben?
      ↓
Veröffentlichen
```

Leitfrage: *Was passiert mit **diesem** Asset?*

### Zuordnungsregel

| Ein Feature gehört nach … | wenn … |
| --- | --- |
| `/app` | es organisationsweit gilt oder mehrere Assets gleichzeitig betrifft |
| `/app/siteos` | es an genau einem Asset hängt und dessen Lebenszyklus vorantreibt |

Ein Feature, das in beiden Welten auftaucht, ist ein Hinweis auf einen
Modellfehler — nicht auf einen Bedarf nach Duplikat.

---

## 4. Ebene 2 — SiteOS als digitale Objektebene

SiteOS ist die zentrale **Objekt-Ebene**: die Menge aller digitalen Assets einer
Organisation und ihres Zustands.

```text
Unternehmen
│
├── Website A
├── Website B
├── Website C
│
├── Kundenportal
├── Landingpages
├── interne Anwendungen
└── weitere digitale Assets
```

Ein Asset ist nicht auf Websites beschränkt. Alles, was beobachtbar, bewertbar
und veränderbar ist, ist ein Asset — inklusive Repositories, APIs und
KI-Systemen. Deshalb ist die Objektebene der richtige Ort für die Verbindung zur
bestehenden `ai_systems`-Registry.

### 4.1 Asset Lifecycle

Der Kern des Modells ist der **Lebenszyklus**, nicht der Vorgang.

```text
discovered
    ↓
observed
    ↓
analyzed
    ↓
transformed
    ↓
governance_pending
    ↓
approved
    ↓
published
    ↓
continuously_monitored
```

| Zustand | Bedeutung | Übergang wird ausgelöst durch |
| --- | --- | --- |
| `discovered` | Asset ist bekannt, aber noch nicht beobachtet | Anlage, Import, Integration, Crawl |
| `observed` | Rohsignale liegen vor (Header, DOM, Konfiguration, Repo-Stand) | Beobachtungslauf |
| `analyzed` | Aus Signalen sind benannte Befunde mit Norm und Behebung geworden | Analysator / Skill |
| `transformed` | Eine geänderte, gehashte Version existiert — noch ohne Wirkung nach außen | Agent oder Mensch |
| `governance_pending` | Die Änderung liegt der Governance Engine zur Bewertung vor | Übergabe an Ebene 3 |
| `approved` | Entscheidung liegt vor, inklusive nötiger menschlicher Freigabe | Governance Decision + ggf. Approval |
| `published` | Die Änderung ist nach außen wirksam | Publish-Aktion nach bestandenem Gate |
| `continuously_monitored` | Regelbetrieb: Beobachtung läuft, Abweichungen erzeugen Ereignisse | Übergang nach `published` |

**Regeln**

1. Der Zustand wird **serverseitig** gehalten und gesetzt. Kein Client leitet ihn ab.
2. Jeder Übergang ist ein Ereignis im Prüfpfad — mit Auslöser, Zeitpunkt und Anker.
3. `governance_pending` ist **nicht überspringbar**. Ein Weg von `transformed`
   direkt nach `published` existiert nicht.
4. `continuously_monitored` ist der einzige Dauerzustand. Eine erkannte
   Abweichung führt zurück nach `analyzed` — nicht nach `discovered`; die
   Vorgeschichte bleibt erhalten.
5. Zustände werden **fortgeschrieben, nicht überschrieben**. Rückschritte sind
   neue Ereignisse, keine Korrekturen alter.

### 4.2 Verhältnis zum heutigen Modell

Heute trägt `siteos_blueprints.status` vier Werte: `draft`, `approved`,
`deployed`, `archived` (Migration `20260728000000_siteos_core.sql`).

| Zielzustand | Heute abgebildet als | Lücke |
| --- | --- | --- |
| `discovered` | — | Assets entstehen heute durch Blueprint-Erzeugung, nicht durch Entdeckung |
| `observed` | `siteos_runtime_scans` (Lauf, kein Assetzustand) | Beobachtung ist ein Lauf, kein Zustand am Objekt |
| `analyzed` | Befunde + `siteos_scores` | vorhanden, aber nicht als Lebenszyklus-Position |
| `transformed` | `draft` (neue, verkettete Version) | vorhanden |
| `governance_pending` | `awaiting_approval` **nur auf Agent-Läufen** | fehlt auf Assetebene |
| `approved` | `approved` | vorhanden, aber **ohne Gate-Nachweis** (§7) |
| `published` | `deployed` | Zustand vorhanden, Deployment-Pfad noch offen (SITEOS_ARCHITECTURE §6) |
| `continuously_monitored` | Cron `governance-monitoring-scheduler`, SiteOS-Agenten noch nicht angebunden | fehlt als Assetzustand |

Der Umbau ist additiv möglich: der Lebenszyklus gehört an das **Asset**, nicht an
die Blueprint-Version. Eine Version bleibt `draft|approved|deployed|archived`;
das Asset bekommt den Zyklus darüber.

---

## 5. Ebene 3a — Continuous Observation

Der Unterschied zu klassischen Wettbewerbern liegt hier, nicht in der Tiefe eines
einzelnen Scans.

```text
Website
   │
   ├── Content
   ├── Code
   ├── Configuration
   ├── Privacy
   ├── Security
   ├── AI Risk
   ├── Performance
   └── Governance
           │
           ▼
      Observation
           │
           ▼
        Evidence
           │
           ▼
        Findings
           │
           ▼
       Risk Engine
           │
           ▼
      Governance
           │
           ▼
        Action
```

**Regeln**

1. **Beobachtung ohne Evidence ist Meinung.** Jede Beobachtung, die zu einem
   Befund führt, hinterlässt einen Nachweis, der später ohne erneuten Zugriff
   auf das Fremdsystem prüfbar ist.
2. **Ein Befund ohne Norm und Behebungsschritt ist kein Befund.** Das gilt im
   Kern bereits (`RuntimeFinding`) und wird auf alle Beobachtungsquellen ausgedehnt.
3. **Datenminimierung ist Teil der Beobachtung, nicht ein Nachgedanke.**
   Persistiert werden abgeleitete Signale, nicht Rohkopien fremder Systeme
   (Art. 5 Abs. 1 lit. c DSGVO) — wie in `siteos-runtime-scan` bereits umgesetzt.
4. **Nur Veränderung erzeugt ein Ereignis.** Ein Lauf mit identischem Ergebnis
   erzeugt keine neue Version und keinen neuen Nachweis. Das ist dieselbe
   Entscheidung wie `unchanged: true` im Blueprint-Pfad: eine Kette voller
   identischer Einträge entwertet den Prüfpfad.
5. **Beobachtung ist quellenagnostisch.** Ein Crawl, ein Webhook einer
   Integration, ein Repository-Diff und ein Konfigurationsabruf erzeugen
   dieselbe Ereignisform.

---

## 6. Ebene 3b — Governance Engine

Die Governance Engine ist der eigentliche Moat. Sie beantwortet nicht
„Ist diese Website gut?", sondern:

> „Darf diese Veränderung unter den für **diesen** Kunden geltenden Regeln
> durchgeführt und veröffentlicht werden?"

| Eingabe | Frage | Herkunft |
| --- | --- | --- |
| **Policy** | Was ist erlaubt? | `policy_packs`, `ai_policies`, `governance_controls` |
| **Evidence** | Was wissen wir tatsächlich? | Evidence Vault, Beobachtungsläufe, Provenance-Kette |
| **Context** | Wer ist der Kunde? Branche, Anforderungen, Integrationen | Tenant, Branchenprofil, aktivierte Module |
| **Risk** | Welche Auswirkung hat die Änderung? | Risk Engine, Befundschwere, Scores |

```text
Policy
  +
Evidence
  +
Context
  +
Risk
      ↓
Governance Decision
      ↓
┌───────────────┐
│ ALLOW         │
│ REVIEW        │
│ BLOCK         │
└───────────────┘
```

**Regeln**

1. **Deterministisch**: gleiche Eingaben ⇒ gleiche Entscheidung. Eine Entscheidung,
   die sich ohne Änderung der Eingaben ändert, ist im Audit wertlos.
2. **Fail-closed**: fehlende oder unvollständige Eingaben führen nie zu `ALLOW`.
   Unbekannt ist nicht erlaubt.
3. **Entscheidungen werden gespeichert, nicht nachgerechnet.** Wer sie später
   zitiert, zitiert den festgehaltenen Vorgang mitsamt Eingabeankern.
4. **`REVIEW` ist ein vollwertiges Ergebnis**, kein Fehlerfall. Es benennt genau,
   wer entscheiden muss und worüber.
5. Die Engine **führt nichts aus**. Sie autorisiert. Ausführung ist Ebene 4.

---

## 7. Der SiteOS Publish Gate Contract (normativ)

Dies ist die schärfste Einzelfestlegung dieses Dokuments.

**Der Client darf niemals selbst entscheiden:**

```text
approved === publishable        ← unzulässig
```

Stattdessen:

```text
SiteOS
   ↓
Governance Evaluation
   ↓
serverseitiger Contract
```

### Contract

```ts
{
  status: "passed" | "blocked" | "pending",

  evidence_complete: boolean,

  backend_preservation:
    "preserve_all"
    | "changed"
    | "unknown",

  policy_compliant: boolean,

  human_approval_required: boolean,

  publishable: boolean,

  evaluated_at: string,

  evaluation_id: string
}
```

### Ableitungsregel

```text
publishable =
    status === "passed"
    AND evidence_complete === true
    AND backend_preservation === "preserve_all"
    AND policy_compliant === true
    AND human_approval_required === false
```

Serverseitig ausgewertet. Das Frontend zeigt ausschließlich das Ergebnis an.

### Verbindliche Regeln

| # | Regel | Begründung |
| --- | --- | --- |
| **G1** | Die Auswertung läuft serverseitig (Edge Function). Der Client sendet keine Teilergebnisse und rechnet nichts nach. | Ein clientseitig berechnetes `publishable` ist manipulierbar und damit kein Nachweis. |
| **G2** | Das Frontend rendert `publishable` und die Begründung — es leitet sie nie aus Einzelfeldern ab. | Zwei Ableitungswege driften; im Zweifel gewinnt der falsche. |
| **G3** | Fail-closed: fehlende Antwort, Zeitüberschreitung oder `backend_preservation: "unknown"` ⇒ **nicht** veröffentlichbar. | „Wir wissen es nicht" ist kein Freigabegrund. |
| **G4** | `publishable` ist rein abgeleitet. Es gibt kein manuelles Überschreiben. Eine Ausnahme ist immer ein **Approval**, nie ein Flag. | Ein Override-Flag ohne Person und Begründung zerstört die Zurechenbarkeit. |
| **G5** | `evaluation_id` ist der Prüfpfad-Anker. Jede Publish-Aktion referenziert genau eine Evaluation. | Ohne Anker lässt sich später nicht belegen, *welche* Bewertung die Veröffentlichung getragen hat. |
| **G6** | Eine Evaluation gilt für genau **einen** Artefakt-Hash. Ändert sich das Artefakt, verfällt sie. | Sonst trägt eine alte Freigabe einen neuen Inhalt — der klassische Weg, ein Gate auszuhebeln. |

### Warum `backend_preservation` ein eigenes Feld ist

Bei einer Transformation ist die sichtbare Oberfläche der leicht prüfbare Teil.
Der gefährliche Teil ist alles, was daran hängt: Formularziele, Zahlungswege,
Buchungsstrecken, Tracking-Einwilligungen, Schnittstellen. Eine Änderung, die
optisch und rechtlich sauber ist, aber ein Formularziel verliert, ist ein
Produktionsausfall. Deshalb wird die Erhaltung des Backends **separat**
festgestellt und ist nicht Teil von `policy_compliant`. `unknown` ist ein
zulässiges, aber blockierendes Ergebnis — ehrlicher als eine geratene Zusage.

### Verhältnis zum Ist-Zustand

Heute existiert `siteos_blueprints.status = 'approved'` ohne einen solchen
Vertrag; der Deployment-Pfad ist noch offen (SITEOS_ARCHITECTURE §6). Genau
deshalb ist jetzt der richtige Zeitpunkt für die Festlegung: das Gate gehört
**vor** den ersten Publish-Pfad, nicht danach. Vorgesehener Ort: eine eigene
Edge Function (Auswertung + Persistenz der Evaluation) und der Contract-Typ im
abhängigkeitsfreien Kern `packages/siteos-core`, damit SPA, Deno und Tests
dieselbe Definition benutzen.

---

## 8. Ebene 4 — Agent / Automation Layer

Die KI-Fähigkeiten sitzen hier — **nicht als 50 einzelne Buttons**, sondern als
Skills und daraus zusammengesetzte Workflows.

```text
Skills
├── Website Intelligence
├── Privacy Intelligence
├── Security Intelligence
├── Content Intelligence
├── SEO Intelligence
├── AI Risk Intelligence
├── Accessibility Intelligence
└── Transformation Intelligence
```

```text
Workflows
├── Website Transformation
├── Privacy Review
├── AI Governance
├── Continuous Compliance
├── Change Monitoring
├── Incident Response
├── Content Governance
└── Publishing Governance
```

**Regeln**

1. **Kein Feature ohne Skill-Zuordnung.** Ein Einstiegspunkt in der Oberfläche
   ist die Sicht auf einen Skill oder Workflow, nicht auf eine Funktion.
2. **Agenten reparieren nur, was genau eine richtige Lösung hat.** Alles, was
   eine redaktionelle oder rechtliche Entscheidung verlangt, bleibt offen und
   wird begründet zurückgemeldet. Ein erfundener Inhalt ist schlimmer als ein
   offener Befund, weil er ihn verdeckt.
3. **Ändernde Agenten schreiben nie in eine bestehende Version**, sondern
   erzeugen eine neue, verkettete. Die alte bleibt mitsamt Nachweis gültig.
4. **Freigabepflichtige Skills warten**, sie umgehen nichts. `awaiting_approval`
   ist ein regulärer Zustand.
5. **Orchestrierung ist Plattformaufgabe.** Reihenfolge, Wiederholung,
   Doppelausführungsschutz und Nachvollziehbarkeit liegen bei der Plattform,
   nicht beim einzelnen Agenten.

Heute vorhanden: sieben SiteOS-Agenten (`compliance`, `seo`, `accessibility`,
`security`, `performance`, `content`, `monitoring`) mit deterministischer
Behebung, sowie `automation_skills` / `automation_runs` als Datenmodell für
Skill-Läufe. Die Zusammenfassung zu benannten **Workflows** über Assetgrenzen
hinweg fehlt noch.

---

## 9. Ebene 5 — Integrations & Infrastructure

Für kleine Kunden reicht:

```text
Website
+
SiteOS
+
Governance
```

Für größere Kunden entsteht hier die eigentliche Skalierung:

```text
SiteOS
 │
 ├── GitHub
 ├── Microsoft 365
 ├── Google Workspace
 ├── Cloudflare
 ├── CRM
 ├── Identity Provider
 ├── SIEM
 ├── Ticketing
 ├── DMS
 └── interne APIs
```

Die Skalierungsachse ist damit **nicht primär die Anzahl der Webseiten**, sondern
das Ausmaß an Kontrolle über die digitale Infrastruktur.

**Regeln**

1. Jede Integration ist **beidseitig**: sie liefert Beobachtungen und akzeptiert
   Aktionen. Eine reine Datenabholung ohne Handlungsweg ist ein Datensilo.
2. Zugangsdaten sind mandantengebunden, minimal berechtigt und liegen
   ausschließlich serverseitig — nie im Client, nie in `VITE_*`.
3. Der Compliance-Zustand eines Fremdsystems wird **bei uns** geführt, abgeleitet
   aus Beobachtung und Nachweis. Fremdsysteme sind Quelle, nicht Urteil.
4. Ausfall einer Integration ist ein bekannter Zustand mit Ereignis, kein
   stiller Datenverlust — eine ausgefallene Beobachtung ist beobachtbar.

---

## 10. Pricing-Architektur

Die Preislogik folgt der Ebenenlogik. Die heutige Achse „mehr Websites = mehr
Preis" ist zu grob und bestraft kleine, aber komplexe Unternehmen.

**Nicht:**

```text
79 €  = 1 Website
249 € = 5 Websites
699 € = 20 Websites
```

**Sondern drei Achsen:**

```text
BASE
│
└── Rechtssicherer / governancefähiger Betrieb
    einer digitalen Präsenz
```

```text
MODULE / FUTURES
│
├── Industry Governance
├── Advanced Privacy
├── AI Governance
├── Automation
├── Workflow Engine
├── Integrations
├── Advanced Evidence
├── Continuous Monitoring
└── Enterprise Control
```

```text
SCALE
│
├── zusätzliche Websites
├── zusätzliche Assets
├── zusätzliche Teams
└── zusätzliche Infrastruktur
```

```text
              VALUE
                ▲
                │
        ┌───────┴───────┐
        │ Governance    │
        │ Automation    │
        │ Intelligence  │
        │ Integration   │
        └───────┬───────┘
                │
        ┌───────┴───────┐
        │   BASE        │
        │ Safe Operation│
        └───────┬───────┘
                │
        ┌───────┴───────┐
        │     SCALE     │
        │ Websites      │
        │ Assets        │
        │ Users         │
        └───────────────┘
```

**Regeln**

1. **Die Basis ist für alle vollwertig.** Ein kleiner Kunde bekommt keine
   abgeschwächte Sicherheitslogik. Governance-Grundfähigkeit ist nicht die
   Variable, an der gespart wird.
2. **Tiefe vor Menge.** Ein Einzelunternehmen mit einer komplexen Website landet
   über Module in einer mittleren Preisstufe, ohne auf eine Enterprise-Stufe
   gezwungen zu werden, deren Skalierungsanteil es nicht braucht.
3. **Skalierung ist die dritte Achse, nicht die erste.** Anzahl Assets, Teams und
   Infrastruktur wirken additiv, nicht als Eintrittshürde für Funktionalität.

### Verhältnis zur heutigen Preis-SSoT

Heute gelten genau sechs Abo-Pläne (`free` · `starter` · `growth` · `agency` ·
`enterprise` · `partner`) plus Einmalprodukte, definiert in `shared/pricing.ts`.
Dieses Zielbild ändert daran **jetzt nichts**. Es bindet drei Dinge fest:

- Die Single Source of Truth bleibt `shared/pricing.ts`. Ein Umbau der
  Preisachsen ist eine Änderung **dort** plus Generatorlauf — nicht verteilt im Code.
- Zugriffsprüfungen laufen weiter ausschließlich über `hasPermission()`,
  `hasModule()` und `limitOf()`. **Genau das macht den Umbau überhaupt möglich**:
  weil kein Code an Plan-Namen hängt, ist die Umstellung auf BASE + MODULE +
  SCALE eine Katalogänderung, kein Refactoring der Anwendung.
- Die Achse heißt **Skalierung**. Ein Plan mit dem Namen „Scale" bleibt
  untersagt (siehe `docs/product/pricing-governance.md`); der Name kollidiert mit
  dem abgelösten Legacy-Plan und ist durch Tests gesperrt.

Modul-Namen aus §10 sind Produktachsen, keine Schlüssel. Bei Umsetzung werden sie
auf bestehende Modul-Schlüssel abgebildet, nicht als zweite Modul-Welt eingeführt.

---

## 11. Delta: Ist → Ziel

| Baustein | Ist-Zustand (2026-08-15) | Lücke zum Ziel |
| --- | --- | --- |
| Fünf-Ebenen-Modell | drei Produktebenen (`docs/architecture/README.md`), Runtime-orientiert | Ebenenmodell ist jetzt fünfstufig; die drei Runtime-Ebenen liegen in Ebene 2–3 |
| `/app` vs. `/app/siteos` | beide Routen existieren, Abgrenzung nicht festgeschrieben | Zuordnungsregel (§3) anwenden, Doppelungen auflösen |
| Asset-Objektebene | `website_projects`, `ai_systems`, `siteos_blueprints` — kein gemeinsames Asset-Objekt | gemeinsame Objektebene mit Lebenszyklus |
| Asset Lifecycle | 4 Blueprint-Status | 8 Assetzustände, additiv oberhalb der Versionsstatus |
| Continuous Observation | Scans als Läufe, Cron für Governance-Monitoring; SiteOS-Agenten noch SPA-getriggert | Beobachtung als Dauerzustand am Asset, Agenten an den Cron |
| Governance Decision | Policies, Controls, Approvals, Incidents vorhanden | benannte, gespeicherte Entscheidung mit ALLOW/REVIEW/BLOCK und Eingabeankern |
| **Publish Gate** | **nicht vorhanden** | Contract §7 vor dem ersten Publish-Pfad umsetzen |
| Deployment-Pfad | Renderer erzeugt gehashtes Artefakt; Upload/Domain offen | Publish nur über das Gate |
| Skills / Workflows | 7 SiteOS-Agenten, `automation_skills`/`automation_runs` | 8 Skills als Vokabular, Workflows über Assetgrenzen |
| Integrationen | `integration_connectors`, `remediation_actions`, Feature `src/features/integrations` | beidseitige Integrationen als Beobachtungs- **und** Aktionsquelle |
| Pricing | 6 Abo-Pläne + Einmalprodukte in `shared/pricing.ts` | BASE + MODULE + SCALE als Katalogänderung |

Die Reihenfolge der Umsetzung folgt der Abhängigkeit, nicht der Sichtbarkeit:
**Objektebene + Lebenszyklus → Publish Gate → Workflows → Integrationen → Pricing.**

---

## 12. Was diese Architektur ausschließt

| Ausgeschlossen | Warum |
| --- | --- |
| „Scan → Report → fertig" als Produktkern | Der Scan ist Werkzeug der Beobachtungsebene. Ein Bericht ist ein Ausgabeformat, kein Vorgang. |
| Preisachse primär nach Anzahl Websites | Bestraft kleine, komplexe Kunden und bepreist nicht den gelieferten Wert. |
| Clientseitige Ableitung von `publishable` | Manipulierbar, damit kein Nachweis (§7 G1/G2). |
| Zweite Evidence-/Hash-Kette | Bei Abweichung ist keine der beiden Ketten belastbar — das ist ein Integritäts-, kein Redundanzproblem. |
| Drittes Frontend für denselben Kundenworkflow | Ein weiterer Stack teilt Auth, Nachweis und Governance erneut auf. |
| Feature-Einstiege ohne Skill-/Workflow-Zuordnung | Führt zur Button-Sammlung statt zu einer Plattform. |
| Automatisch erfundene Inhalte in Compliance-Pfaden | Verdeckt einen offenen Befund und erzeugt zusätzliches Rechtsrisiko. |
| Stiller Ausfall einer Beobachtung oder Integration | Eine nicht stattgefundene Prüfung darf nie wie eine bestandene aussehen. |

---

## 13. Verhältnis zu bestehenden Dokumenten

| Dokument | Verhältnis |
| --- | --- |
| [`CLAUDE.md`](../../CLAUDE.md) | Ist-Zustand und verbindliche Arbeitsregeln. Hat bei Implementierungsfragen Vorrang. |
| [`docs/ARCHITECTURE_CURRENT.md`](../ARCHITECTURE_CURRENT.md) | Ist-Zustand der Produktoberfläche. Ergänzt dieses Dokument, widerspricht ihm nicht. |
| [`docs/SITEOS_ARCHITECTURE.md`](../SITEOS_ARCHITECTURE.md) | Umsetzung von Ebene 2 in Phase 1, inkl. begründeter Abweichungen. |
| [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | **abgelöst** für die Zielarchitektur auf Produktebene. Der dortige Ziel-Stack (Next.js, Fastify, Prisma, Keycloak) widerspricht ADR 0001 und CLAUDE.md. Fachlich weiter gültig: Rule Engine, Evidence Layer, Findings-Normalisierung. |
| [`docs/architecture/README.md`](./README.md) | Registry aller Architekturdokumente. Dieses Dokument steht dort. |
| [`docs/product/pricing-governance.md`](../product/pricing-governance.md) | Verbindliche Preisregeln. §10 ist Zielbild, ersetzt sie nicht. |
| ADR [0001](../adr/0001-stay-on-supabase-gh-pages-for-v1.md) / [0002](../adr/0002-future-monorepo-migration.md) | Stack-Entscheidungen. Dieses Dokument macht keine Stack-Aussage und hebt sie nicht auf. |

---

## 14. Pflege

- Änderungen an den **Ebenen**, am **Lebenszyklus** oder am **Publish-Gate-Contract**
  sind Architekturentscheidungen und laufen über einen eigenen PR mit Begründung.
- §11 (Delta) wird bei jedem geschlossenen Punkt aktualisiert — ein Delta-Eintrag
  ohne Datum im Ist-Zustand ist ein Wartungsfehler.
- Wird ein Punkt aus §12 doch umgesetzt, gehört die Begründung hierher, nicht in
  den Code-Kommentar.
