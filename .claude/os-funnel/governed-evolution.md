# Governed Evolution — Zielbild-Spec

**Stand:** 2026-09-27 · **Status:** COMING SOON · nur Doku, keine Implementierung
**Einordnung:** frühestens nach AP-3 (`governance_policies` als Tenant-SSoT), Zielbild für Agent OS Premium

> Agenten dürfen handeln — aber nur innerhalb der Governance-Runtime.
> Governed Evolution erweitert das um einen Satz: Die Runtime darf sich
> verbessern — aber nur innerhalb eines vorab erklärten Änderungsraums.

## 1. Einordnung in den Control Loop

```
Observe → Evaluate → Decide → Act → Verify → Record → Learn → Observe …
                                                        └─ Governed Evolution
```

Alle Schritte bis **Record** sind Sichten auf den kanonischen Authority-Pfad
(`Request → Identity → Tenant → Policy → Risk → Approval → Execution →
Verification → Evidence`, siehe `.claude/os-funnel/PLAN.md` §2).
**Learn** ist der einzige neue Schritt.

## 2. Ablauf

| # | Schritt | Ergebnis | Automatisch? |
|---|---|---|---|
| 1 | Signal erkennen (Workflow scheitert, Policy greift häufig, Skill-Lauf problematisch) | `evolution_signal` | ja |
| 2 | Änderungsvorschlag formulieren | `evolution_proposal` (Diff gegen Policy/Workflow/Agent-Config) | ja |
| 3 | Einordnung gegen den Änderungsraum (§3) | `in_scope` · `substantial_modification_candidate` | ja |
| 4 | Simulation gegen historische Entscheidungen (Shadow) | Verdikt-Differenz | ja |
| 5 | Governance-Gate | Freigabe über `governance_approvals` | **nie** automatisch |
| 6 | Übernahme mit neuer Version | versionierte Policy/Config | nur nach 5 |
| 7 | Evidence | unveränderlicher Eintrag inkl. Vorschlag, Simulation, Freigeber | ja |

## 3. Änderungsraum und „wesentliche Änderung"

- Eine Änderung eines KI-Systems nach Inverkehrbringen kann eine **wesentliche
  Änderung** im Sinne von Art. 3 Nr. 23 EU AI Act sein.
- Nach Art. 43 Abs. 4 EU AI Act gelten bei Hochrisiko-Systemen, die nach dem
  Inverkehrbringen weiterlernen, Änderungen **nicht** als wesentlich, wenn sie vom
  Anbieter **vorab festgelegt** und in der technischen Dokumentation beschrieben
  wurden.
- Daraus folgt für das Produkt — zwei getrennte Grenzen:
  - **Anbieter-Änderungsraum (Art. 43 Abs. 4):** vom Anbieter bei der
    ursprünglichen Konformitätsbewertung vorab festgelegt und in der technischen
    Dokumentation (Anhang IV Nr. 2 Buchst. f) beschrieben. Nur Änderungen
    **innerhalb dieses Raums** können als `in_scope` gelten.
  - **Mandanten-Richtlinie:** Der Mandant kann den Raum für sich nur **enger**
    ziehen, nie erweitern. Eine Mandanten-Deklaration begründet für sich allein
    keine Ausnahme nach Art. 43 Abs. 4.
  - Vorschläge außerhalb des Anbieter-Raums, rein mandanten-definierte Änderungen
    oder nicht zuordenbare Änderungen erhalten `substantial_modification_candidate`
    → Stopp, menschliche Freigabe, fachliche/konformitätsrechtliche Prüfung.
  - Beide Räume sind versioniert und Evidence-pflichtig.

*Rechtliche Einordnung ist vor Umsetzung mit einer fachkundigen Stelle zu prüfen.*

## 4. Bausteine im Bestand (Stand `main@f392939`)

| Baustein | Bestand | Beleg |
|---|---|---|
| Freigaben | vorhanden: `governance_approvals` (`pending/approved/rejected/expired`) | `supabase/migrations/20260513200000_governance_approvals.sql` |
| Shadow-Beobachtung | vorhanden: `pdp_shadow_log` (`observation_kind` comparison · decision_only laut Entscheidung 2026-09-21) | `supabase/migrations/20260824090000_pdp_snapshots_shadow.sql` |
| Policy-Speicher | vorhanden: `governance_policies` (SSoT-Ausbau in AP-3) | `supabase/migrations/20260512000000_governance_events.sql` |
| Evidence | vorhanden: `audit_evidence` | `supabase/migrations/20260906000000_reconcile_audit_evidence.sql` |
| Signale, Vorschläge, Änderungsraum | **fehlt** | — |

## 5. Was bewusst nicht gebaut wird

- Keine selbstständige Änderung von Policies, Workflows oder Agent-Konfigurationen.
- Keine Übernahme ohne menschliche Freigabe, auch nicht „in scope".
- Keine Landing-Aussage über Governed Evolution außer „Roadmap / Coming Soon".

## 6. Offene Entscheidungen

- **E-GE1:** Granularität des Änderungsraums (je Policy · je Agent · je Mandant)
- **E-GE2:** Wer darf freigeben (Rolle aus `memberships`, Vier-Augen ab Risiko hoch?)
- **E-GE3:** Aufbewahrung von abgelehnten Vorschlägen (Evidence ja/nein, Frist)
