# Pricing v2 — Abgleich der Zielpreise mit der Quelle (Phase 0)

**Gemessen am 2026-09-08** gegen `shared/pricing.ts` auf `main` @ `9587905`.
**Status: Befund und Entscheidungsvorlage. Nichts geändert.**

---

## 1. Der Befund: die Zielpreise existieren bereits

Der Auftrag (§27) nennt vier Zielpreise — €79 · €249 · €699 · €1.249 — als neu
zu entwerfendes Paketmodell. Gemessen sind das **exakt die heutigen Preise**
vier bestehender Pläne:

| Zielpreis | Bestehender Plan | `price.monthlyEur` | `availability` | Zeile |
|---|---|---|---|---|
| €79 | Starter | 79 | `self_service` | 550 |
| €249 | Growth | 249 | `self_service` | 626 |
| **€699** | **Agency** | 699 | **`legacy`** | 718 |
| **€1.249** | **Enterprise** | 1_249 | **`contract`** | 812 |

Es ist also **kein neues Preismodell zu entwerfen**. Zwei der vier Stufen sind
heute aber nicht als Self-Service verkäuflich — und bei einer davon ist das
eine ausdrückliche, dokumentierte Eigentümer-Entscheidung.

---

## 2. Der Konflikt: €699 zu verkaufen kehrt eine erteilte Freigabe um

CLAUDE.md §10 hält unter **„2026-08-24 (2) — Preisseite auf drei Stufen"** eine
Freigabe fest, die der Eigentümer mit **drei ausdrücklichen Ja** erteilt hat:

> | Frage | Antwort |
> |---|---|
> | 3. Agency und Partner ganz aus dem Verkauf nehmen | **Ja** |

Umgesetzt wurde das durch `availability: 'legacy'`, den Wechsel der
Anzeige-Listen auf `SALES_PLANS` / `SELF_SERVICE_PLANS` und die Umstellung von
`lg:grid-cols-5` auf `lg:grid-cols-3` an sieben Stellen. Am **2026-08-30 (2)**
folgte eine zweite Drei-Fragen-Freigabe, die die Agency-WhatsApp-Karte (699 €)
entfernte — ausdrücklich als „die letzte Stelle im Frontend, an der ein
Legacy-Plan über Self-Service kaufbar war".

**Eine €699-Stufe wieder in den Self-Service zu stellen, macht beide Freigaben
rückgängig.** Das ist keine Umsetzungsfrage, sondern eine
Eigentümer-Entscheidung nach §10.4 — und sie braucht ihre eigenen drei Fragen.
Bis dahin wird an `availability` nichts geändert.

**Nichts geht dabei verloren**: Legacy-Pläne behalten laut §7 Produkte, Preise,
Entitlements und laufende Abos vollständig und stehen weiterhin in
`PLAN_ORDER`, damit Rangvergleiche für Bestandskunden stimmen.

---

## 3. Drei Wege — zur Entscheidung, nicht zur Umsetzung

| | Weg A: heutiger Stand | Weg B: Agency reaktivieren | Weg C: neue Stufe |
|---|---|---|---|
| Self-Service | 79 · 249 | 79 · 249 · **699** | 79 · 249 · **699 (neu)** |
| Vertrag | 1.249 | 1.249 | 1.249 |
| §10-Freigabe nötig | **nein** | **ja** (kehrt zwei um) | **ja** (eine neue) |
| Bestandskunden | unberührt | unberührt | unberührt |
| Aufwand | 0 | `availability` + Anzeige-Listen + Raster | neuer Plan, Stripe-Produkte, Entitlements |
| Risiko | — | Agency-Entitlements sind auf Altbestand geschnitten | Namenskollision mit `legacy` Agency |

**Empfehlung**: Weg B ist billiger als C, aber C ist ehrlicher — die
Agency-Entitlements sind für Altbestand geschnitten, nicht für ein heutiges
Angebot. Die Entscheidung gehört dem Eigentümer; beide brauchen §10.4.

**Der Name „Scale" bleibt in jedem Fall untersagt** (CLAUDE.md §7).

---

## 4. Was der Auftrag als neu annimmt und bereits steht

| Forderung | Stand | Beleg |
|---|---|---|
| 14-Tage-Trial (§26) | **`LIVE`** auf Starter und Growth | `trialDays: 14`, Z. 615 / 707 |
| Eine Preis-Quelle (§9) | **`LIVE`** — `shared/pricing.ts` | CLAUDE.md §7 |
| Add-ons als Abo-Positionen (§28) | **`LIVE`** seit 2026-09-01 | `AddOn.grants` |
| Einmalprodukte | **`LIVE`** — Governance Launch, 349 € | `price.oneTimeEur` |
| Zugriff nie über Plan-Namen (§10) | **`LIVE`** — `hasPermission()` u. a. | CLAUDE.md §7 |
| Kein `if (plan === …)` | Ratsche **offen** in PR #1243 | PR #1243 |

---

## 5. Was §11 blockiert: die Kostenrechnung fehlt

§30 verlangt vor der Festlegung von Kontingenten und Preisen eine
Kostenrechnung (Cloudflare, Supabase, Stripe, KI-Provider, Browser-Ausführung,
Speicher, Support) mit Deckungsbeitrag, Durchschnitts-, Vielnutzer- und
Missbrauchsszenario.

**Diese Rechnung existiert nicht** und wurde in Phase 0 nicht erstellt — sie
braucht Verbrauchsdaten aus Produktion, auf die diese Sitzung keinen Zugriff
hatte. Solange sie fehlt, wäre jede Zahl in einem Paketentwurf erfunden.
`docs/product/token-economy.md` §4 nennt die Größen, die dafür zu messen sind.

**Konsequenz**: §11 und §27 bleiben in Phase 0 offen. Das ist kein
Versäumnis, sondern die Anwendung von §36 („Do not invent entitlement values.
Mark unknowns UNKNOWN").

---

## 6. Ein bestehender Konflikt, den der Umbau erben würde

CLAUDE.md §7 hält fest: Bei Kontingenten weichen `plan.limits.*` (Preisseite)
und `PLAN_ENTITLEMENTS['limit.*']` heute in **18 von 38 Paaren** ab.
`npm run check:limits` verhindert neue Divergenzen als Ratsche, löst die
bestehenden aber nicht auf.

**Regel, die auch für Pricing v2 gilt**: Kein neues Enforcement gegen einen
divergierenden Wert, solange er nicht bereinigt ist — und keine stillschweigende
Kürzung bei Bestandskunden. PR #1214 arbeitet an dieser Klasse und sollte vor
einem Paketumbau entschieden sein.

---

## 7. Preis-Matrix (§36)

Ausgefüllt nur, wo gemessen. `UNKNOWN` heißt: in Phase 0 nicht erhoben.

| Capability | Free | Trial | €79 Starter | €249 Growth | €699 Agency | €1.249 Ent. | Add-on | Token |
|---|---|---|---|---|---|---|---|---|
| `availability` | self | — | self | self | **legacy** | **contract** | — | — |
| `trialDays` | 0 | — | **14** | **14** | 0 | 0 | — | — |
| `domains` | 1 | UNKNOWN | 1 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | — |
| `seats` | 1 | UNKNOWN | 1 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | — |
| `evidenceStorageGb` | 0 | UNKNOWN | 2 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | — |
| `auditReportsPerMonth` | 1 | UNKNOWN | 2 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | — |
| `automationRunsPerMonth` | 0 | UNKNOWN | 25 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | ✓ |
| `bots` / `answersPerMonth` | 0 / 0 | UNKNOWN | 1 / 500 | UNKNOWN | UNKNOWN | UNKNOWN | ✓ | ✓ |
| `limit.ai_tokens_monthly` | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **−1** ¹ | UNKNOWN | ✓ |

¹ Auf Vertragsplänen bedeutet `-1` nach der Festlegung vom 2026-08-31
(Option A) **„das System begrenzt hier nicht, der Vertrag tut es"** — kein
„unbegrenzt". Auf diesen Feldern ist **kein Gate erlaubt**.
