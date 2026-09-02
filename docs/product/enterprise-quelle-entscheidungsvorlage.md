# Entscheidung — wo der Enterprise-Vertragswert steht

> ## ✅ Entschieden am 2026-08-31: **Option A**
>
> Auf Plänen mit `availability: 'contract'` bedeutet `-1` bei einem
> `limit.*`-Key: **Das System begrenzt hier nicht. Der Vertrag tut es.**
>
> Damit ist §1.2 aus `kanonische-kontingente.md` erstmals ausführbar, ohne
> einen Ort für tenant-spezifische Werte zu schaffen. Die Quelle ist
> **benannt**, nicht aufgelöst — auf den acht Enterprise-Feldern entsteht
> weiterhin kein Gate.
>
> **Umgesetzt** (nur Dokumentation und Tests, wie unten bepreist):
> `shared/pricing.ts` (Kodierung am `PLAN_ENTITLEMENTS`-Kopf spezifiziert) ·
> `kanonische-kontingente.md` §1.2a · `test/billing/limit-canonicity.test.ts`
> (zwei neue Fälle) · `CLAUDE.md` §7.
>
> **Der Auslöser für Option B ist benannt:** der erste Enterprise-Vertrag mit
> einer vereinbarten **Obergrenze**. Unter A ist eine solche Grenze technisch
> nicht durchsetzbar; der Vertrag ist damit nicht abschließbar, ohne vorher
> auf B zu wechseln. Maschinell gemeldet wird das durch den Testfall
> „Vertragspläne tragen ausschliesslich `-1` als Kontingent" — er wird rot,
> sobald jemand einen endlichen Wert einträgt.
>
> Diese Datei bleibt als **Entscheidungsnachweis** bestehen. Die Abwägung
> unten ist der Stand, auf dem die Entscheidung getroffen wurde; sie wird
> nicht nachträglich umgeschrieben.

---

**Ursprünglicher Stand: 2026-08-25, gemessen auf `0fd8dcc`.** Read-only: kein
Code geändert, kein Wert gesetzt, keine Option vorweggenommen.

Die Regel steht (`kanonische-kontingente.md` §1.2): Für Vertragspläne ist der
**Vertrag** kanonisch, nicht die öffentliche Preisseite. Sie ist heute nicht
ausführbar, weil das Schema keinen Ort für einen vertragsspezifischen Wert
kennt (§4a). Diese Vorlage bereitet genau diese eine Entscheidung vor.

**Was hier ausdrücklich nicht passiert:** Die Enterprise-Regel wird bis zur
Entscheidung **nicht als implementierte Fachlogik behandelt**. Der Resolver
kann sie nicht deterministisch ausführen, also gilt sie als spezifiziert und
unimplementiert. Und die Deutung „`-1` heißt: der Vertrag entscheidet" bleibt
eine **Hypothese** — sie steht in keinem Code und in keinem Test.

---

## 1. Die Messung, die die Auswahl verändert

Gegen das Live-Projekt (`ebljyceifhnlzhjfyxup`, 2026-08-25):

| | |
|---|---:|
| | 2026-08-25 | 2026-08-31 |
|---|---:|---:|
| Tenants | 4 | **5** |
| Subscriptions | 4 | **5** |
| **Enterprise-Verträge** | **0** | **0** |
| `entitlement_grants` | 0 | 0 |
| Produkte | 22 | 23 |
| `product_entitlements` | 358 | 601 |
| Entitlement-Keys | 65 | 70 |

Vor der Entscheidung am 2026-08-31 nachgemessen, weil die Empfehlung
vollständig an einer dieser Zahlen hängt. **Sie hält:** weiterhin null
Enterprise-Verträge. Gewachsen ist nur die Katalogseite (`product_entitlements`
358 → 601 aus den AP-Merges), was an der Abwägung nichts ändert — es zeigt
allein, dass der Katalog wächst, während die Vertragsseite bei null steht.
Ebenfalls nachgezählt: `tenant_entitlements()` wird weiterhin von genau
**6** Migrationen neu definiert, zuletzt `20260831020000`.

**Es gibt heute keinen einzigen Enterprise-Vertrag.** Damit gibt es auch keine
Bestandsdaten, keine Migration und keinen Kunden, der von einer falschen
Entscheidung getroffen würde.

Das verschiebt die Abwägung erheblich. Die Aussage „für ein System mit vielen
Enterprise-Verträgen ist B langfristig am saubersten" ist richtig — nur ist
dieses System heute keines. Eine Overrides-Tabelle würde für **null** Kunden
gebaut, in einer Funktion, die in diesem PR bereits eine Regression hatte.

Die Zahl ist ein Momentzustand, kein Argument gegen B auf Dauer. Sie ist ein
Argument gegen B **jetzt**.

---

## 2. Der Blast-Radius, gemessen

Was ein Eingriff jeweils berührt:

| | Option A | Option B | Option C |
|---|---|---|---|
| Schemaänderung | nein | **ja** (neue Tabelle + RLS) | nein |
| `tenant_entitlements()` ändern | nein | **ja** | nein |
| Migrationen, die den Auflöser bereits neu definieren | — | **6** (zuletzt der Regressionsfix `20260831020000`) | — |
| Dateien, die Entitlements auflösen | 12 | 12 | 12 |
| Katalog-Generator + `check:pricing` | nein | nein | **ja** |
| `PLAN_ENTITLEMENTS`-Spiegel | nein | **ja** (kennt nur Pläne, keine Tenants) | **ja** |
| Prüfpfad je Vertragsänderung | fehlt | **ja**, je Zeile | über Produkt-Historie |
| Zusammenführungsregel `-1 gewinnt, sonst MAX` | unberührt | **muss durchbrochen werden** | unberührt |

Der letzte Punkt ist der unterschätzte: Heute gewinnt `-1`, sonst der
**größere** Wert. Ein Override, der ein Kontingent **senken** soll, kann in
diesem Modell nicht wirken — er müsste den Auflöser um eine Vorrangregel
erweitern. Das ist kein Feld, sondern eine Änderung an der Semantik der
Auflösung.

---

## 3. Die drei Optionen

### Option A — `-1` offiziell als „vertraglich geregelt / unbegrenzt" spezifizieren

Der Ist-Zustand wird zur Regel erklärt: Auf Vertragsplänen bedeutet `-1`
„das System begrenzt hier nicht, der Vertrag tut es".

| | |
|---|---|
| Eingriff | nur Dokumentation und Tests |
| Kosten | am geringsten |
| Setzt voraus | dass `-1` tatsächlich so gemeint war — **unbelegt** |
| Löst nicht | vertraglich vereinbarte **Ober**grenzen; jeder Enterprise-Vertrag ist technisch unbegrenzt |
| Risiko | Ein Vertrag über „bis zu 50 Sitze" ist technisch nicht durchsetzbar |

**Ehrlich benannt:** A löst das Problem nicht, sondern erklärt es für keines.
Das ist legitim, solange alle Enterprise-Verträge tatsächlich unbegrenzt
gemeint sind — und heute gibt es keinen, der etwas anderes sagt.

### Option B — Tenant-Overrides (`tenant × entitlement_key × value`)

Eine Tabelle, die je Tenant und Key einen Vertragswert trägt und im Auflöser
Vorrang bekommt.

| | |
|---|---|
| Eingriff | Schema + RLS + Auflöser + Prüfpfad |
| Kosten | am höchsten |
| Löst | alles, inklusive Obergrenzen und Vertragshistorie |
| Risiko | Änderung an `tenant_entitlements()` — sechs Migrationen tief, eine Regression in diesem PR |
| Zeitpunkt | für **0** Verträge verfrüht |

**Langfristig die richtige Lösung.** Der Einwand ist nicht die Richtung,
sondern der Zeitpunkt: Sie würde heute gebaut, ohne einen einzigen Fall, an
dem sich zeigen ließe, ob sie stimmt.

### Option C — ein Produkt je Vertragsvariante

Jeder Enterprise-Vertrag bekommt ein eigenes `products`-Zeile mit eigenen
`product_entitlements`.

| | |
|---|---|
| Eingriff | keine Schemaänderung; passt ins bestehende Modell |
| Kosten | mittel |
| Löst | Obergrenzen, ohne den Auflöser anzufassen |
| Risiko | vermischt **Katalog** mit **Vertragsdaten** |
| Reibung | `check:pricing` und der Katalog-Generator erzeugen `products` aus `shared/pricing.ts` — ein handgepflegtes Vertragsprodukt kollidiert mit dem Generator |

Der letzte Punkt ist konkret und nicht theoretisch: Der Generator schreibt die
Katalog-Migration aus der Quelle und `check:pricing` prüft sie gegen ebendiese.
Vertragsprodukte bräuchten eine ausdrückliche Ausnahme, sonst meldet der Guard
sie als Drift.

---

## 4. Empfehlung

**A jetzt, B wenn der erste Vertrag es erzwingt.** Mit einer Bedingung, die
zu A dazugehört.

Begründung:

1. **Null Verträge.** B und C lösen ein Problem, das heute niemand hat. Der
   Aufwand ist real, der Nutzen hypothetisch.
2. **A ist umkehrbar, B und C sind es kaum.** Eine Dokumentationsregel lässt
   sich ersetzen; eine Tabelle im Auflöser und eine Vertragsprodukt-Ausnahme
   im Generator bleiben.
3. **Der Auflöser ist die riskanteste Stelle im System.** Er wurde sechsmal
   neu definiert, zuletzt um eine Regression zu reparieren, die dieser PR
   selbst eingebaut hatte. Ihn ohne zwingenden Anlass erneut anzufassen, ist
   die schlechtere Wette.

**Die Bedingung:** A darf nicht bedeuten, dass die Frage verschwindet. Sie
gehört an die Stelle, an der der erste Enterprise-Vertrag entsteht — also an
den Vertriebsprozess, nicht nur in eine Datei. Solange A gilt, ist jeder
Enterprise-Vertrag technisch unbegrenzt; ein Vertrag mit Obergrenze ist damit
**nicht abschließbar**, ohne vorher auf B zu wechseln.

Wird A gewählt, ist der Auslöser für B benennbar: **der erste Enterprise-
Vertrag, der eine Obergrenze enthält.**

---

## 5. Was in jedem Fall gilt

Unabhängig von A, B oder C:

- Die acht Enterprise-Divergenzen bleiben `kanonische_quelle: 'vertrag'` und
  damit **unbestimmt**. Auf ihnen entsteht kein Gate.
- `-1` wird **nicht** als Vertragswert umgedeutet, solange die Hypothese nicht
  belegt oder per Option A ausdrücklich zur Regel erklärt ist.
- Ein späteres Produkt- oder Pricing-Refactoring darf `products → entitlements`
  **nicht wieder automatisch** als kanonische Quelle für Vertragspläne
  behandeln. Dagegen sichert `test/billing/limit-canonicity.test.ts` —
  siehe die Fälle „leitet die kanonische Quelle aus der Planart ab" und
  „`products → entitlements` ist für Vertragspläne nicht kanonisch".
- Klasse B (Starter, Growth) ist von dieser Entscheidung **unberührt** und
  kann unabhängig laufen.
