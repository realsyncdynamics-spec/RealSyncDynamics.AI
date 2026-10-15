# Governed Evolution — Zielbild-Spec

**Stand:** 2026-10-15 (WP6-Prüfung gegen `main@a7ffc94`; Erstfassung 2026-09-27) · **Status:** COMING SOON · nur Doku, keine Implementierung
**Einordnung:** Umsetzung **frühestens nach AP-3** (`governance_policies` als Tenant-SSoT). Zielbild für Agent OS Premium.

> Agenten dürfen handeln — aber nur innerhalb der Governance-Runtime.
> Governed Evolution erweitert das um einen Satz: Die Runtime darf sich
> verbessern — aber nur innerhalb eines vorab erklärten Änderungsraums.

**Warum erst nach AP-3:** Schritt 6 (§2) übernimmt Änderungen „mit neuer
Version“. `governance_policies` hat heute keine eigene Version oder Historie;
eine Änderung überschreibt die Zeile (§4). Ohne Policy-SSoT mit Versionen gibt es
nichts, gegen das ein Vorschlag als Diff formuliert, simuliert und belegt werden
kann. AP-3 steht nur als Name in `.claude/os-funnel/PLAN.md` §4 (Reihenfolge
AP-1a → … → AP-3); ein Auftragstext liegt im Repo nicht vor (offener Punkt O6).
Vorarbeit im Bestand: `20260928150000_tenant_boot_provisioning.sql` ergänzt
Herkunft (`source_pack_id`, `source_template_id`, `template_version`) und
`mode` (`observe`/`enforce`), aber keine Versionierung der Mandanten-Policy.

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

| # | Schritt | Ergebnis | Automatisch? | Bestand (§4) |
|---|---|---|---|---|
| 1 | Signal erkennen (Workflow scheitert, Policy greift häufig, Skill-Lauf problematisch) | `evolution_signal` | ja | fehlt |
| 2 | Änderungsvorschlag formulieren | `evolution_proposal` (Diff gegen Policy/Workflow/Agent-Config) | ja | fehlt |
| 3 | Einordnung gegen den Änderungsraum (§3) | `in_scope` · `substantial_modification_candidate` | ja | fehlt |
| 4 | Simulation gegen historische Entscheidungen (Shadow) | Verdikt-Differenz | ja | teilweise: Live-Vergleich und versionierte Snapshots vorhanden, Replay fehlt |
| 5 | Governance-Gate | Freigabe über `governance_approvals` bzw. `pdp_approval_gates` | **nie** automatisch | vorhanden, mit Lücken |
| 6 | Übernahme mit neuer Version | versionierte Policy/Config | nur nach 5 | teilweise: nur `policy_snapshots` versioniert |
| 7 | Evidence | unveränderlicher Eintrag inkl. Vorschlag, Simulation, Freigeber | ja | vorhanden: `ai_evidence_events` |

## 3. Änderungsraum und „wesentliche Veränderung“

**Quelle:** Verordnung (EU) 2024/1689 (KI-Verordnung), ABl. L vom 12.7.2024,
ELI `http://data.europa.eu/eli/reg/2024/1689/oj`. Die folgenden Normen sind
**sinngemäß** wiedergegeben, nicht wörtlich (siehe Prüfhinweis unten).

- **Art. 3 Nr. 23 — „wesentliche Veränderung“:** eine Veränderung eines
  KI-Systems nach Inverkehrbringen oder Inbetriebnahme, die (a) in der
  ursprünglichen Konformitätsbewertung des Anbieters **nicht vorgesehen oder
  geplant** war und (b) die Konformität mit den Anforderungen aus Kapitel III
  Abschnitt 2 **beeinträchtigt** oder die **Zweckbestimmung ändert**, für die das
  System bewertet wurde. Beide Merkmale müssen zusammenkommen.
- **Art. 43 Abs. 4 Unterabs. 1:** Ein bereits bewertetes Hochrisiko-KI-System
  muss bei einer wesentlichen Veränderung **neu bewertet** werden — gleich, ob es
  weiter vertrieben oder vom bisherigen Betreiber weiter genutzt wird.
- **Art. 43 Abs. 4 Unterabs. 2:** Bei Hochrisiko-KI-Systemen, die nach
  Inverkehrbringen oder Inbetriebnahme **weiterlernen**, sind Änderungen des
  Systems und seiner Leistung **keine** wesentliche Veränderung, wenn der
  Anbieter sie bei der ursprünglichen Konformitätsbewertung **vorab festgelegt**
  hat und sie in der technischen Dokumentation nach **Anhang IV Nr. 2 Buchst. f**
  beschrieben sind.
- **Art. 25 Abs. 1 Buchst. b:** Wer — etwa ein Betreiber — an einem
  Hochrisiko-KI-System eine wesentliche Veränderung vornimmt, sodass es
  Hochrisiko bleibt, **gilt selbst als Anbieter** mit dessen Pflichten.

**Folgen für das Produkt — zwei getrennte Grenzen:**

- **Anbieter-Änderungsraum (Art. 43 Abs. 4 Unterabs. 2):** vom Anbieter bei der
  ursprünglichen Konformitätsbewertung vorab festgelegt und in Anhang IV Nr. 2
  Buchst. f beschrieben. Nur Änderungen **innerhalb dieses Raums** können als
  `in_scope` gelten.
- **Mandanten-Richtlinie:** Der Mandant kann den Raum für sich nur **enger**
  ziehen, nie erweitern. Eine Mandanten-Deklaration begründet für sich allein
  keine Ausnahme nach Art. 43 Abs. 4. Übernimmt ein Mandant eine Änderung
  außerhalb des Anbieter-Raums an einem Hochrisiko-System, kann er nach Art. 25
  Abs. 1 Buchst. b selbst zum Anbieter werden — das Gate (Schritt 5) muss das
  vor der Freigabe anzeigen.
- Vorschläge außerhalb des Anbieter-Raums, rein mandanten-definierte Änderungen
  oder nicht zuordenbare Änderungen erhalten `substantial_modification_candidate`
  → Stopp, menschliche Freigabe, fachliche/konformitätsrechtliche Prüfung.
- Beide Räume sind versioniert und Evidence-pflichtig.
- Unterabs. 2 gilt nur für **Hochrisiko**-Systeme. Für andere Systeme gibt es
  keine Vorab-Festlegung als Ausnahme; Vorschläge dort bleiben ohne Ausnahme
  freigabepflichtig (§5).
- Wer im Produkt „Anbieter“ eines gesteuerten KI-Systems ist, ist offen (E-GE4).

*Prüfhinweis:* Der amtliche deutsche Wortlaut auf EUR-Lex war bei der WP6-Prüfung
nicht abrufbar; die Wiedergabe oben ist nicht gegen ihn verifiziert. Laut
buzer.de wurde Art. 43 durch die **Verordnung (EU) 2026/1744** (ABl. vom
24.7.2026) geändert; ob Abs. 4, Art. 3 Nr. 23 oder Art. 25 betroffen sind, ist
offen (O7). *Rechtliche Einordnung vor Umsetzung mit einer fachkundigen Stelle
prüfen.*

## 4. Bausteine im Bestand (geprüft gegen `main@a7ffc94`)

| Baustein | Status | Beleg (Migration · Code) | Befund |
|---|---|---|---|
| Freigaben | vorhanden, mit Lücken | `supabase/migrations/20260513200000_governance_approvals.sql` · `supabase/functions/governance-approvals/index.ts` | `status` ∈ `pending/approved/rejected/expired`; auflösen nur `owner`/`admin` über `memberships`. Hängt an `event_id` (NOT NULL, UNIQUE) → ein Vorschlag braucht ein `governance_events`-Ereignis. Kein Ablaufjob für `expires_at` (PLAN §4, WP4-Folgepunkte). Keine Spalte für den Antragsteller, also keine Sperre gegen Selbstfreigabe. |
| Rollen-Gates | vorhanden (in der Erstfassung nicht genannt) | `supabase/migrations/20260824120000_org_subject_model_approval_gates.sql` · `governance-approvals` (`gate_approve`/`gate_reject`) | `pdp_approval_gates` mit `approver_role` (Rolle aus `role_bindings`), `requested_by`/`resolved_by`, setzt `expired` beim Auflösen, schreibt Evidence in `ai_evidence_events`. Naheliegender Träger für Schritt 5 und E-GE2. |
| Shadow-Beobachtung | vorhanden — **Erstfassung korrigiert** | `supabase/migrations/20260824090000_pdp_snapshots_shadow.sql` | `pdp_shadow_log` hat **keine** Spalte `observation_kind`; die zitierte „Entscheidung 2026-09-21“ ist im Repo nicht auffindbar. Tatsächlich: `source` (`telemetry-ai-event`/`governance-ingest`/`ai-gateway`), `legacy_status`, `v2_status`, `diverged`, `snapshot_version`, `detail`. Zweck: Live-Vergleich Alt-Engine ↔ PDP v2, **kein** Replay historischer Entscheidungen. Schreiben nur `service_role`, Mandant liest. |
| Policy-Snapshots | vorhanden (in der Erstfassung nicht genannt) | `supabase/migrations/20260824090000_pdp_snapshots_shadow.sql` | `policy_snapshots`: `UNIQUE (tenant_id, version)`, `compiled` jsonb, entsteht nur serverseitig (`governance-decide`). Einzige versionierte Policy-Grundlage — Basis für Schritt 4 und 6. |
| Policy-Speicher | vorhanden, **ohne Versionierung** | `supabase/migrations/20260512000000_governance_events.sql` · Ergänzungen `20260515600000_multi_environment.sql` (`environment`), `20260928150000_tenant_boot_provisioning.sql` (Herkunft, `mode`) | Keine eigene Versions- oder Historienspalte; `updated_at`-Trigger, Änderung in place. `template_version` beschreibt die Vorlage, nicht die Mandanten-Policy. SSoT-Ausbau = AP-3. |
| Evidence | vorhanden — **Erstfassung korrigiert** | `supabase/migrations/20260510_ai_governance_core.sql` (Hash-Kette `event_hash`/`prev_hash`/`chain_index`) · `20260901090000_evidence_append_only_anchors.sql` (UPDATE/DELETE gesperrt) | Träger ist `ai_evidence_events`. Die Erstfassung nannte `audit_evidence` (`20260507100000_audit_evidence.sql`, `20260906000000_reconcile_audit_evidence.sql`): zwar append-only, aber für Website-Scan-Belege (`type` ∈ screenshot, request_log, cookie_dump, dom_snapshot, script_reference, response_header; `audit_id` NOT NULL) — für Governance-Entscheidungen ungeeignet. |
| Governance-Evidence-Kette | vorhanden, mit Lücke | `supabase/migrations/20260512000000_governance_events.sql` (`governance_evidence`) · `20260928140100_gate2_evidence_append_rpc.sql` (`append_governance_evidence`) | `governance-approvals` schreibt die Freigabe-Evidence direkt mit `content_hash`/`previous_hash` = `null`, also **außerhalb** der Kette — obwohl der Kopfkommentar der Approvals-Migration „hash-chained“ sagt (O1). |
| Signale, Vorschläge, Änderungsraum | **fehlt** | — (kein `evolution_*` im Repo) | Neu in einer späteren Umsetzung, nach AP-3. |

## 5. Was bewusst nicht gebaut wird

- Keine selbstständige Änderung von Policies, Workflows oder Agent-Konfigurationen.
- Keine Übernahme ohne menschliche Freigabe, auch nicht „in scope".
- Keine Landing-Aussage über Governed Evolution außer „Roadmap / Coming Soon".

## 6. Offene Entscheidungen

- **E-GE1:** Granularität des Änderungsraums (je Policy · je Agent · je Mandant)
- **E-GE2:** Wer darf freigeben (Rolle aus `memberships` bzw. `approver_role` der
  `pdp_approval_gates`, Vier-Augen ab Risiko hoch?)
- **E-GE3:** Aufbewahrung von abgelehnten Vorschlägen (Evidence ja/nein, Frist)
- **E-GE4:** Wer ist im Produkt „Anbieter“ eines gesteuerten KI-Systems
  (RealSyncDynamics für eigene Runtime-Funktionen, der Mandant, dessen
  Lieferant)? Davon hängt ab, wer den Anbieter-Änderungsraum festlegen darf.

## 7. Offene Punkte aus der WP6-Prüfung

Nicht Teil von WP6 (kein Code), je eigener PR mit eigener Freigabe:

- **O1** Freigabe-Evidence aus `governance-approvals` über `append_governance_evidence` in die Kette bringen.
- **O2** `governance_approvals` ohne Antragsteller-Spalte → keine Selbstfreigabe-Sperre (betrifft E-GE2; braucht Migration).
- **O3** Kein Ablaufjob für `governance_approvals.expires_at`.
- **O4** Versionierung der Mandanten-Policies (AP-3).
- **O5** Replay-Simulation gegen historische Entscheidungen fehlt (Schritt 4).
- **O6** AP-3 hat im Repo keinen Auftragstext.
- **O7** Amtlichen Wortlaut von Art. 3 Nr. 23, Art. 25 Abs. 1 Buchst. b und Art. 43 Abs. 4 auf EUR-Lex prüfen, Änderungen durch VO (EU) 2026/1744 einarbeiten.
