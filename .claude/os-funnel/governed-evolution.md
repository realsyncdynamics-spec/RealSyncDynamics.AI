# Governed Evolution — Zielbild-Spec

**Stand:** 2026-10-10 (WP6-Prüfung gegen `main@5679551`) · **Status:** COMING SOON · nur Doku, keine Implementierung
**Einordnung:** Umsetzung **frühestens nach AP-3**. Der WP6-Auftrag (`.claude/commands/wp6-governed-evolution.md`) beschreibt AP-3 als „`governance_policies` als Tenant-SSoT"; eine Definition oder ein Status von AP-3 ist im Repo sonst nicht auffindbar (§6, Punkt O2). Zielbild für Agent OS Premium.

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

| # | Schritt | Ergebnis | Automatisch? | Grundlage im Bestand (§4) |
|---|---|---|---|---|
| 1 | Signal erkennen (Workflow scheitert, Policy greift häufig, Skill-Lauf problematisch) | `evolution_signal` | ja | fehlt |
| 2 | Änderungsvorschlag formulieren | `evolution_proposal` (Diff gegen Policy/Workflow/Agent-Config) | ja | fehlt |
| 3 | Einordnung gegen den Änderungsraum (§3) | `in_scope` · `substantial_modification_candidate` | ja | fehlt |
| 4 | Simulation gegen historische Entscheidungen (Shadow) | Verdikt-Differenz | ja | **teilweise**: Vergleich zweier Engines live, kein Replay eines Vorschlags |
| 5 | Governance-Gate | Freigabe über `governance_approvals` | **nie** automatisch | vorhanden |
| 6 | Übernahme mit neuer Version | versionierte Policy/Config | nur nach 5 | **teilweise**: Snapshots bei Änderung/Löschung, keine bei Anlage, kein lesender Code |
| 7 | Evidence | unveränderlicher Eintrag inkl. Vorschlag, Simulation, Freigeber | ja | vorhanden, Ziel offen (E-GE4) |

## 3. Änderungsraum und „wesentliche Veränderung"

**Quelle:** Verordnung (EU) 2024/1689 (KI-Verordnung), ABl. L vom 12.7.2024,
deutsche Fassung, abgerufen über EUR-Lex (CELEX `32024R1689`) am 2026-10-10.
Wortlaut unverändert übernommen.

**Art. 3 Nr. 23** — Begriff:

> „wesentliche Veränderung" eine Veränderung eines KI-Systems nach dessen
> Inverkehrbringen oder Inbetriebnahme, die in der vom Anbieter durchgeführten
> ursprünglichen Konformitätsbewertung nicht vorgesehen oder geplant war und durch
> die die Konformität des KI-Systems mit den Anforderungen in Kapitel III
> Abschnitt 2 beeinträchtigt wird oder die zu einer Änderung der Zweckbestimmung
> führt, für die das KI-System bewertet wurde;

**Art. 43 Abs. 4** — Folge und Ausnahme für weiterlernende Systeme:

> Hochrisiko-KI-Systeme, die bereits Gegenstand eines
> Konformitätsbewertungsverfahren gewesen sind, werden im Falle einer
> wesentlichen Änderung einem neuen Konformitätsbewertungsverfahren unterzogen,
> unabhängig davon, ob das geänderte System noch weiter in Verkehr gebracht oder
> vom derzeitigen Betreiber weitergenutzt werden soll. Bei Hochrisiko-KI-Systemen,
> die nach dem Inverkehrbringen oder der Inbetriebnahme weiterhin dazulernen,
> gelten Änderungen des Hochrisiko-KI-Systems und seiner Leistung, die vom Anbieter
> zum Zeitpunkt der ursprünglichen Konformitätsbewertung vorab festgelegt wurden
> und in den Informationen der technischen Dokumentation gemäß Anhang IV Nummer 2
> Buchstabe f enthalten sind, nicht als wesentliche Veränderung;

**Anhang IV Nr. 2 Buchst. f** — Inhalt der technischen Dokumentation:

> gegebenenfalls detaillierte Beschreibung der vorab bestimmten Änderungen an dem
> KI-System und seiner Leistung mit allen einschlägigen Informationen zu den
> technischen Lösungen, mit denen sichergestellt wird, dass das KI-System die
> einschlägigen in Kapitel III Abschnitt 2 festgelegten Anforderungen weiterhin
> dauerhaft erfüllt;

**Lesart für das Produkt** (Ableitung, keine Rechtsauskunft):

- Art. 3 Nr. 23 verlangt **zwei** Bedingungen zugleich: (1) die Veränderung war in
  der ursprünglichen Konformitätsbewertung nicht vorgesehen oder geplant, **und**
  (2) sie beeinträchtigt die Konformität mit Kapitel III Abschnitt 2 **oder** ändert
  die Zweckbestimmung. Eine bloße Abweichung vom Ist-Zustand genügt nicht.
- Die Ausnahme in Art. 43 Abs. 4 Satz 2 gilt nur für **Hochrisiko-KI-Systeme**, die
  weiterlernen, und nur für Änderungen, die der **Anbieter** zum Zeitpunkt der
  **ursprünglichen** Konformitätsbewertung festgelegt und in Anhang IV Nr. 2
  Buchst. f beschrieben hat.
- Die Verordnung verwendet „wesentliche Änderung" (Art. 43 Abs. 4 Satz 1) und
  „wesentliche Veränderung" (Art. 3 Nr. 23, Art. 43 Abs. 4 Satz 2) für denselben
  Begriff. Die Spec verwendet durchgehend „wesentliche Veränderung".

Daraus folgen zwei getrennte Grenzen:

- **Anbieter-Änderungsraum (Art. 43 Abs. 4 Satz 2):** vorab festgelegt, in Anhang IV
  Nr. 2 Buchst. f beschrieben. Nur Vorschläge **innerhalb dieses Raums** können
  `in_scope` sein.
- **Mandanten-Richtlinie:** Der Mandant kann den Raum für sich nur **enger** ziehen,
  nie erweitern. Eine Mandanten-Deklaration begründet für sich allein keine
  Ausnahme nach Art. 43 Abs. 4 — der Mandant ist nicht der Anbieter, und seine
  Deklaration ist nicht Teil der ursprünglichen Konformitätsbewertung.
- Vorschläge außerhalb des Anbieter-Raums, rein mandanten-definierte Änderungen
  oder nicht zuordenbare Änderungen erhalten `substantial_modification_candidate`
  → Stopp, menschliche Freigabe, fachliche/konformitätsrechtliche Prüfung.
- Beide Räume sind versioniert und Evidence-pflichtig.

*Rechtliche Einordnung ist vor Umsetzung mit einer fachkundigen Stelle zu prüfen.*

## 4. Bausteine im Bestand (geprüft gegen `main@5679551`)

| Baustein | Befund | Beleg |
|---|---|---|
| Freigaben | **vorhanden**: `governance_approvals` mit `status IN ('pending','approved','rejected','expired')`. Kein Ablaufjob für diese Tabelle (siehe `PLAN.md` §4). | `supabase/migrations/20260513200000_governance_approvals.sql` |
| Shadow-Beobachtung | **Tabelle vorhanden**, Spalten `source`, `legacy_status`, `v2_status`, `diverged`, `snapshot_version`, `detail`. Sie vergleicht **Alt-Engine und PDP v2 im Live-Betrieb** — kein Replay eines Änderungsvorschlags gegen historische Entscheidungen. `source` später erweitert. | `supabase/migrations/20260824090000_pdp_snapshots_shadow.sql`, `20260904120000_pdp_shadow_log_channels.sql` |
| ~~`observation_kind` (comparison · decision_only)~~ | **fehlt** — die frühere Fassung dieser Spec nannte die Spalte „laut Entscheidung 2026-09-21". Weder Spalte noch Entscheidung sind im Repo belegt (§6, O1). | — |
| Policy-Speicher | **vorhanden**: `governance_policies` (mandantenbezogen über `tenant_id`). Herkunft aus Policy-Packs inkl. `template_version`. | `supabase/migrations/20260512000000_governance_events.sql`, `20260928150000_tenant_boot_provisioning.sql` |
| Policy-Versionshistorie | **teilweise vorhanden**: `governance_policy_versions` speichert per Trigger `snapshot_versions` einen Snapshot **nach jeder Änderung oder Löschung** von `governance_policies` (ebenso `governance_assets`). Es fehlen ein Snapshot bei **Anlage** einer Policy und jeder Code, der die Historie liest (kein Treffer in `supabase/functions`, `src`, `shared`). `template_version` hält nur die Pack-Herkunft fest. | `20260620000004_governance_policy_versions.sql` |
| Evidence (Prüfpfad) | **vorhanden**: `audit_evidence`, **nicht** hash-verkettet. | angelegt `20260507100000_audit_evidence.sql`, abgeglichen `20260906000000_reconcile_audit_evidence.sql` |
| Evidence (hash-verkettet) | **zwei Stufen**: `governance_evidence` hat `content_hash`/`previous_hash`, aber **keine** Sperre gegen Ändern oder Löschen. Verzweigungsfreies Anhängen sichert `append_governance_evidence` (Mandantensperre + erwarteter Vorgänger-Hash) — genutzt von `tenant-audit` und `email-auth-rescan`; `governance-approvals` und `browser-execute` schreiben weiterhin direkt. `evidence_snapshots` (`content_sha256`, `prev_hash`) ist per Trigger `trg_evidence_snapshots_immutable` **append-only**, mit Retention. | `20260512000000_governance_events.sql`, `20260928140100_gate2_evidence_append_rpc.sql`, `20260701140000_evidence_vault_advanced.sql` |
| Signale, Vorschläge, Änderungsraum | **fehlt** — keine Tabelle, kein Typ, keine Funktion (`evolution_*`, Änderungsraum) in `src/`, `shared/`, `supabase/`. | — |

## 5. Was bewusst nicht gebaut wird

- Keine selbstständige Änderung von Policies, Workflows oder Agent-Konfigurationen.
- Keine Übernahme ohne menschliche Freigabe, auch nicht „in scope".
- Keine Landing-Aussage über Governed Evolution außer „Roadmap / Coming Soon".

## 6. Offene Entscheidungen und Punkte

**Entscheidungen**

- **E-GE1:** Granularität des Änderungsraums (je Policy · je Agent · je Mandant)
- **E-GE2:** Wer darf freigeben (Rolle aus `memberships`, Vier-Augen ab Risiko hoch?)
- **E-GE3:** Aufbewahrung von abgelehnten Vorschlägen (Evidence ja/nein, Frist)
- **E-GE4 (neu):** Evidence-Ziel für Ablaufschritt 7. `audit_evidence` ist nicht
  hash-verkettet. `governance_evidence` ist verkettet, aber nicht gegen Ändern
  oder Löschen gesperrt, und Freigaben (`governance-approvals`) schreiben dort
  bisher am Anhänge-Schutz vorbei. Durch die Datenbank erzwungen unveränderlich
  ist nur `evidence_snapshots`.

**Offene Punkte aus der WP6-Prüfung**

- **O1:** `pdp_shadow_log.observation_kind` und die „Entscheidung 2026-09-21" sind
  nicht belegt. Klären, ob die Entscheidung existiert und wo sie dokumentiert ist;
  sonst ersatzlos streichen.
- **O2:** AP-3 wird in `PLAN.md` §4 nur als Teil der „Enforcement-Master-Reihenfolge"
  (AP-1a → AP-3) genannt; eine Definition oder ein Status ist im Repo nicht
  auffindbar. Die Einordnung „frühestens nach AP-3" ist damit nicht prüfbar, bis
  AP-3 beschrieben ist.
- **O3:** Ablaufschritt 4 braucht ein Replay gegen historische Entscheidungen;
  `pdp_shadow_log` liefert das nicht.
- **O4:** Ablaufschritt 6 braucht eine vollständige Versionshistorie für
  `governance_policies`: `governance_policy_versions` erfasst Änderung und
  Löschung, aber nicht die Anlage, und kein Code liest die Historie bisher.
