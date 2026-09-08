# RealSync OS — Zielarchitektur (Phase 0, Vorschlag)

**Status: Vorschlag zur Freigabe. Nicht umgesetzt.**
Grundlage: die Messungen in `realsync-os-current-state.md` vom 2026-09-08.

> **Verhältnis zu `docs/architecture/target-architecture.md`**: Jenes Dokument
> ist laut CLAUDE.md §2 das bestehende Zielbild (Fünf-Ebenen-Modell, Asset
> Lifecycle, Publish-Gate-Contract, Pricing-Achsen) und bleibt gültig. Dieses
> Dokument ergänzt es um **eine** Frage, die dort nicht beantwortet ist: wie
> viele Arbeitsflächen der Kunde sieht. Bei Widerspruch gilt für alles Übrige
> weiterhin `target-architecture.md`.

---

## 1. Das Ziel in einem Satz

**Eine Shell, zwei Modi, ein Kern** — statt drei Flächen, die denselben
Anspruch erheben.

```
                         REALSYNC OS
                              │
                         /assistant
                              │
              ┌───────────────┴───────────────┐
         STANDARD MODE                   EXPERT MODE
      einfache Nutzerführung       Governance Control Plane
              └───────────────┬───────────────┘
                              │
                    derselbe Mandant, derselbe Run
                              │
                      REALSYNC KERNEL
              Planner → Policy → Approval → Executor
                              │
                   Edge Function `ai-gateway`
                    (heute schon gemeinsam)
                              │
              ┌───────────────┼───────────────┐
           GOVERN           BUILD          AUTOMATE
              └───────────────┼───────────────┘
                              │
                    OBSERVE / VERIFY
                              │
                  GOVERNANCE + EVIDENCE
```

---

## 2. Was davon bereits existiert

Die Zielarchitektur ist zu erheblichen Teilen kein Neubau:

| Ebene | Stand |
|---|---|
| Gemeinsamer KI-Durchgangspunkt | **`LIVE`** — beide Flächen laufen auf `ai-gateway` |
| Alias-Mechanik für Routen | **`LIVE`** — `/command-center` → `/assistant` |
| Kernel (Planner/Policy/Executor) | **PR #1261**, ohne Route |
| PDP als Entscheider | **`LIVE`**, fünf Pfade im Beobachtungsbetrieb |
| Evidence, Prüfpfad, Hash-Ketten | **`LIVE`** |
| Eine Preis-/Entitlement-Quelle | **`LIVE`** — `shared/pricing.ts` |
| Ein Gate-Register | **`LIVE`** — `featureAccess.ts` |
| Eine kanonische Seitenoperation | **PR #1260** |

**Zu bauen ist im Kern eine Sache**: der Modus-Umschalter und das Einhängen der
beiden anderen Flächen darunter.

---

## 3. Was ausdrücklich **nicht** entsteht

§18 des Auftrags verbietet zweite Systeme. Für jedes gilt: es existiert bereits
eines, und das bleibt.

| Nicht neu | Bestehend |
|---|---|
| zweite Agent-Runtime | `apps/agent-runtime`, `ai-gateway` |
| zweite Policy Engine | PDP, `governance-decide` |
| zweiter Evidence Store | Evidence Vault |
| zweites Entitlement-System | `shared/pricing.ts` + `tenant_entitlements()` |
| zweiter Token-Ledger | `token_usage` |
| zweiter Builder-Backend | SiteOS |
| zweite Kasse | `/checkout/:planKey` |

---

## 4. Der Enforcement-Zustand bleibt, wie er ist

Alle sechs PDP-Schalter stehen auf `shadow`. Der Umbau der Oberfläche ändert
daran **nichts** — und darf es nicht.

`pdp_shadow_readiness()` und `/app/governance/shadow` existieren seit dem
2026-09-06; erst deren Auswertung entscheidet über `enforce`. Ein
Oberflächen-Umbau ist kein Anlass, einen Schalter umzulegen.

**Besonders zu beachten**: Bei `M365_PDP_ENFORCEMENT` bedeutet `enforce` nicht
„anhalten", sondern „Reaktion auslösen". Wer die Modi zusammenführt, darf diese
Unterscheidung nicht in einer gemeinsamen Oberfläche einebnen.

---

## 5. Reihenfolge (§38)

| Phase | Inhalt | Voraussetzung |
|---|---|---|
| **0** | Bestandsaufnahme | **erledigt** — dieses Dokumentenset |
| 1 | Architekturentscheid | Eigentümer |
| 2 | Dashboard-Konsolidierung | Mandantenfrage geklärt, §10-Freigabe |
| 3 | Routen-Konsolidierung | Phase 2, Redirect-Tests |
| 4 | Funnel / Free Scan / Auth / Trial | Funnel-Dreieck entschieden, OAuth-IDs |
| 5 | Pricing + Entitlements | §10.4-Freigabe zu €699, Divergenz bereinigt |
| 6 | Token-Ökonomie | **Kostenrechnung** (§30) |
| 7–12 | Marketplace, Agenten, Connectors, Builder, Evidence-UX, E2E | Phasen 1–6 |

**Zwei harte Sperren:**

- **Phase 6 ist ohne die Kostenrechnung nicht startbar.** Ohne sie wäre jede
  Zahl erfunden.
- **Der Publish Gate steht vor dem ersten SiteOS-Publish-Pfad**, nicht danach
  (CLAUDE.md §14). Phase 10 darf Phase 2 nicht überholen.

---

## 6. Die Bedingungen, unter denen dieses Zielbild gilt

1. **Mandantenkontext von `/assistant` geklärt.** Solange offen, ist die
   Erhebung dieser Fläche zur primären Arbeitsfläche der riskanteste Schritt.
2. **§10 beachtet.** Ergänzen ist frei; Ändern und Entfernen brauchen die
   Fragepflicht, Design-Änderungen die Drei-Fragen-Regel. Der Modus-Umschalter
   ändert eine bestehende Fläche.
3. **Keine URL bricht.** Weiterleitungen ja, Löschungen nein — jede Alias-Zeile
   mit Test.
4. **Kein Enforcement-Schalter wird nebenbei umgelegt.**
5. **Messen, nicht herleiten.** Die Regel, die CLAUDE.md §5 aus zwei falschen
   Erklärungen gezogen hat, gilt hier besonders: Dieses Dokumentenset enthält
   selbst zwei Korrekturen an Annahmen, die plausibel klangen und falsch waren.
