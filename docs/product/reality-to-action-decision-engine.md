# Reality → Action — von Befunden zu belegbaren Handlungen

**Gebaut am**: 2026-08-30
**Code**: `shared/reality-decision.ts` · `test/product/reality-decision.test.ts`
**Oberfläche**: Abschnitt „Dein Massnahmenplan" in `src/features/audit/AuditResultView.tsx`
**Grundlage**: der gemessene Scanner-Vertrag aus `docs/product/free-scan-recovery.md`

---

## 1. Was die Engine löst

Der Bericht endete bisher in einer Mängelliste. Die geschäftliche
Auswirkung stand nur als Ableitung aus der Severity da — derselbe Satz für
jeden `critical`-Befund, unabhängig davon, ob eine Datenschutzerklärung
fehlt oder ein Tracker ohne Einwilligung lädt. Der Aufruf darunter führte
generisch auf `/pricing`.

Die Engine bildet jetzt **je Befund-Code** ab:

| | |
|---|---|
| Auswirkung | Was der Befund geschäftlich bedeutet, nicht was er technisch ist |
| Massnahme | Was konkret zu tun ist, in der Sprache des Auftraggebers |
| Spur | BUILD · AUTOMATE · GOVERN |
| Modul | Das Produkt, das die Massnahme umsetzt — oder ausdrücklich keines |
| Horizont | Jetzt · Danach · Laufend, abgeleitet aus der Severity |

---

## 2. Die zwei Grundsätze — und wie sie erzwungen werden

> **Ein Finding ohne Handlung ist unvollständig.**
> **Keine generischen Upsells.**

Beide sind als Test formuliert, nicht als Absicht. `reality-decision.test.ts`
prüft die Abbildung gegen `test/fixtures/gdpr-audit-production-contract.json`
in **beide** Richtungen:

1. **Kein Befund ohne Handlung** — jeder der 27 Codes, die der Scanner
   liefert, hat eine Abbildung.
2. **Keine Handlung ohne Befund** — kein Eintrag in `ACTION_MAP`, den der
   Scanner nie auslöst.

Die Gegenrichtung ist die wichtigere. Ohne sie wäre `ACTION_MAP` ein
Katalog von Verkaufsanlässen, in den mit der Zeit Empfehlungen wandern, die
aus nichts folgen. Mit ihr bleibt sie eine Abbildung.

Zusätzlich geprüft: Jedes referenzierte Modul existiert in
`BOOKABLE_MODULES`, und kein Text sichert Konformität zu.

---

## 3. Der wichtigste Befund: die AUTOMATE-Spur ist leer

Das Produktbild kennt drei Spuren. **Zwei lassen sich aus diesem Scan
belegen, eine nicht.**

Der Scan liest das ausgelieferte HTML **einer** Seite. Daraus ist ablesbar,
wie die Website gebaut ist (BUILD) und welche Rechts- und
Vertrauensrisiken sichtbar sind (GOVERN). Nicht ablesbar ist, wie das
Unternehmen **arbeitet**.

Die Zuordnung im Strategiepapier — „Lange Antwortzeiten, viele repetitive
Anfragen → Chatbot", „Kein Lead-Routing → Lead Automation" — beruht auf
Signalen, die der Scan nicht erhebt. „Sie haben ein Kontaktformular, also
brauchen Sie einen Chatbot" ist genau der generische Upsell, den Grundsatz
zwei verbietet: Die Prämisse trägt die Empfehlung nicht.

Die Spur bleibt deshalb leer, und `AUTOMATE_EVIDENCE_GAP` benennt, was
fehlt:

- Antwortzeit auf Anfragen (E-Mail, Formular, Telefon)
- Anfragevolumen und Anteil wiederkehrender Fragen
- Ob Anfragen in ein CRM laufen oder im Postfach liegen bleiben
- Nachfassquote bei nicht beantworteten Anfragen
- Terminaufkommen und Anteil telefonischer Terminvereinbarung

**Das ist ein Messergebnis über den Scan, kein Versäumnis der Engine.**
Wer AUTOMATE verkaufen will, erhebt zuerst diese Signale — nicht mehr
Befunde über HTML. Ein kurzer Fragebogen im Trichter oder eine Auswertung
nach der Übernahme wären die naheliegenden Wege; beides ist eine
Produktentscheidung, keine Implementierungsfrage.

Bis dahin gilt: Der freie Scan trägt **GOVERN und BUILD**. Das ehrlich zu
sagen ist wertvoller, als eine dritte Spur mit Empfehlungen zu füllen, die
auf nichts beruhen.

---

## 4. Wo bewusst kein Produkt steht

`module: null` heisst nicht „nichts gefunden", sondern: Dafür gibt es
nichts zu verkaufen.

| Befund | Warum kein Modul |
|---|---|
| `no_https`, `no_hsts`, `no_csp`, `no_xframe`, `mixed_content` | Zertifikate und Header sind Sache des Hostings |
| `no_imprint_link_non_de` | Rein informativ — § 5 TMG greift möglicherweise gar nicht |
| `scan_coverage_limited`, `fetch_failed` | Aussagen über den Scan, nicht über die Seite |

Ein Produkt an diese Befunde zu hängen wäre ein erfundener Bedarf.

---

## 5. Wohin die Aufrufe führen

Es gibt **keinen** Kaufweg je Modul: `stripe-checkout` nimmt ausschliesslich
einen `plan_key` entgegen (siehe `src/features/market/moduleCatalog.ts`).
Ein Knopf „Modul kaufen" griffe ins Leere — verboten nach CLAUDE.md §14.

- Angemeldet → `/app/marketplace` (zeigt Modul und den Plan, der es enthält)
- Nicht angemeldet → `/pricing`
- Primärer Schritt nach dem Bericht → `/onboarding/:auditId`

Der primäre Aufruf ist bewusst die **Übernahme des Scans**, nicht ein Kauf.
Ohne Konto ist der Bericht eine Momentaufnahme: kein Verlauf, keine
Wiedervorlage, kein Nachweis.

> ✅ **Die Kette ist seit dem 2026-08-31 geschlossen.** Der Claim-Writer
> (`supabase/functions/audit-claim/`) setzt `tenant_id`, `user_id` und
> `claimed_at`; damit wird das Audit über die Policy `gdpr_audits tenant_read`
> im Konto sichtbar. Vertrauensmodell und offene Punkte:
> `docs/product/audit-claim.md`. Die Function ist noch nicht deployt — bis zum
> nächsten `deploy.yml`-Lauf steht sie in `UNBACKED_CALLERS`.

---

## 6. Darstellung

Der Abschnitt „Dein Massnahmenplan" steht zwischen Befundliste und den
bestehenden Aufrufen. Rein **additiv** nach CLAUDE.md §10.2: ausschliesslich
vorhandene Klassen und Tokens, kein bestehender Text und kein bestehender
Aufruf verändert. Die Design-Freeze-Regeln bleiben unberührt.

Sind keine Befunde abgebildet, rendert der Abschnitt **nichts** — lieber
keine Empfehlung als eine erfundene.
