# Governed Evolution — Zielbild-Spec

**Stand:** 2026-10-28 (Nachprüfung gegen `main@d08abd6`; WP6-Prüfung 2026-10-15 gegen `main@a7ffc94`; Erstfassung 2026-09-27) · **Status:** COMING SOON · nur Doku, keine Implementierung
**Einordnung:** Umsetzung **frühestens nach AP-3** (`governance_policies` als Tenant-SSoT). Zielbild für Agent OS Premium.

> Agenten dürfen handeln — aber nur innerhalb der Governance-Runtime.
> Governed Evolution erweitert das um einen Satz: Die Runtime darf sich
> verbessern — aber nur innerhalb eines vorab erklärten Änderungsraums.

**Warum erst nach AP-3:** Schritt 6 (§2) übernimmt Änderungen „mit neuer
Version“. `governance_policies` hat keine Versionsnummer; es gibt nur eine
Nachher-Historie (`governance_policy_versions` sichert den alten Stand bei
UPDATE/DELETE, nicht bei Anlage, und kein Code liest sie, §4). Ohne Policy-SSoT
mit adressierbaren Versionen gibt es nichts, gegen das ein Vorschlag als Diff
formuliert, simuliert und belegt werden kann. AP-3 steht nur als Name in `.claude/os-funnel/PLAN.md` §4 (Reihenfolge
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
| 6 | Übernahme mit neuer Version | versionierte Policy/Config | nur nach 5 | teilweise: `policy_snapshots` versioniert, `governance_policy_versions` nur Historie |
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
und erneut bei der Nachprüfung am 2026-10-26 nicht abrufbar (leere Antwort auf
automatisierte Abrufe); die Wiedergabe oben ist nicht gegen ihn verifiziert. Ein
wörtliches Zitat (EUR-Lex-Abruf 2026-10-10) steht in PR #1854. Laut
buzer.de wurde Art. 43 durch die **Verordnung (EU) 2026/1744** (ABl. vom
24.7.2026) geändert; ob Abs. 4, Art. 3 Nr. 23 oder Art. 25 betroffen sind, ist
offen (O7). *Rechtliche Einordnung vor Umsetzung mit einer fachkundigen Stelle
prüfen.*

## 4. Bausteine im Bestand (geprüft gegen `main@a7ffc94`)

| Baustein | Status | Beleg (Migration · Code) | Befund |
|---|---|---|---|
| Freigaben | vorhanden, mit Lücken | `supabase/migrations/20260513200000_governance_approvals.sql` · `supabase/functions/governance-approvals/index.ts` | `status` ∈ `pending/approved/rejected/expired`; auflösen nur `owner`/`admin` über `memberships`. Hängt an `event_id` (NOT NULL, UNIQUE) → ein Vorschlag braucht ein `governance_events`-Ereignis. Kein Ablaufjob für `expires_at` (PLAN §4, WP4-Folgepunkte). **Seit #2024 (`c2e245e`, Schritt 1/4 aus #1724, nur Schema):** `20261028095440_browser_runtime_governed_sessions.sql` ergänzt `requested_by`, `browser_session_id` und Status `cancelled`; `decide_governance_approval` (nur `service_role`) setzt Entscheidung und verkettete Evidence in einer Transaktion und markiert abgelaufene Einträge erst beim Entscheiden als `expired` (Datenbankuhr). Keine Prüfung `decided_by ≠ requested_by` in der Funktion gefunden; noch kein Aufrufer in `supabase/functions/` (nur `test/runtime/db/browser-runtime-sessions.db.test.ts`). |
| Rollen-Gates | vorhanden (in der Erstfassung nicht genannt) | `supabase/migrations/20260824120000_org_subject_model_approval_gates.sql` · `governance-approvals` (`gate_approve`/`gate_reject`) | `pdp_approval_gates` mit `approver_role` (Rolle aus `role_bindings`), `requested_by`/`resolved_by`, setzt `expired` beim Auflösen, schreibt Evidence in `ai_evidence_events`. Naheliegender Träger für Schritt 5 und E-GE2. |
| Shadow-Beobachtung | vorhanden — **Erstfassung korrigiert** | `supabase/migrations/20260824090000_pdp_snapshots_shadow.sql` · `20260904120000_pdp_shadow_log_channels.sql` (erweitert `source`) | `pdp_shadow_log` hat **keine** Spalte `observation_kind`; die zitierte „Entscheidung 2026-09-21“ ist im Repo nicht auffindbar. Tatsächlich: `source` (Ingest-Kanäle), `legacy_status`, `v2_status`, `diverged`, `snapshot_version`, `detail`. Zweck: Live-Vergleich Alt-Engine ↔ PDP v2, **kein** Replay historischer Entscheidungen. Schreiben nur `service_role`, Mandant liest. |
| Policy-Snapshots | vorhanden (in der Erstfassung nicht genannt) | `supabase/migrations/20260824090000_pdp_snapshots_shadow.sql` | `policy_snapshots`: `UNIQUE (tenant_id, version)`, `compiled` jsonb, entsteht nur serverseitig (`governance-decide`). Einzige versionierte Policy-Grundlage — Basis für Schritt 4 und 6. |
| Policy-Speicher | vorhanden, **ohne Versionsnummer** | `supabase/migrations/20260512000000_governance_events.sql` · Ergänzungen `20260515600000_multi_environment.sql` (`environment`), `20260928150000_tenant_boot_provisioning.sql` (Herkunft, `mode`) | Änderung in place (`updated_at`-Trigger). `template_version` beschreibt die Vorlage, nicht die Mandanten-Policy. SSoT-Ausbau = AP-3. |
| Policy-Historie | teilweise vorhanden | `supabase/migrations/20260620000004_governance_policy_versions.sql` | `governance_policy_versions`: SECURITY-DEFINER-Trigger sichert den **alten** Stand bei UPDATE/DELETE von `governance_policies` (und `governance_assets`); Mandant liest, schreibt nicht. Fehlt: Eintrag bei Anlage, Versionsnummer, lesender Code (kein Treffer in `src/`, `shared/`, `supabase/functions/`). |
| Evidence | vorhanden — **Erstfassung korrigiert** | `supabase/migrations/20260510_ai_governance_core.sql` (Hash-Kette `event_hash`/`prev_hash`/`chain_index`) · `20260901090000_evidence_append_only_anchors.sql` (UPDATE/DELETE gesperrt) | Träger ist `ai_evidence_events`. Die Erstfassung nannte `audit_evidence` (`20260507100000_audit_evidence.sql`, `20260906000000_reconcile_audit_evidence.sql`): zwar append-only, aber für Website-Scan-Belege (`type` ∈ screenshot, request_log, cookie_dump, dom_snapshot, script_reference, response_header; `audit_id` NOT NULL) — für Governance-Entscheidungen ungeeignet. Ebenfalls per Trigger unveränderlich: `evidence_snapshots` (`20260701140000_evidence_vault_advanced.sql`, `prev_hash`-verkettet, Retention) — Ablage des Evidence Vault, nicht der Entscheidungs-Pfad. |
| Governance-Evidence-Kette | vorhanden, mit Lücke | `supabase/migrations/20260512000000_governance_events.sql` (`governance_evidence`) · `20260928140100_gate2_evidence_append_rpc.sql` (`append_governance_evidence`) · `supabase/functions/governance-approvals/evidence.ts` | Keine Sperre gegen UPDATE/DELETE gefunden. **Seit #2015 (`a0ad27b`):** `governance-approvals` hängt die Freigabe-Evidence per Compare-and-Swap über `append_governance_evidence` an (`content_hash` = SHA-256 über RFC-8785-JCS, `previous_hash` = Kettenkopf) und schreibt zusätzlich nach `ai_evidence_events`; Test `test/edge/governance-approvals-evidence.test.ts`. Auch `browser-execute` nutzt die RPC. **Weiter außerhalb der Kette:** `governance-ingest` schreibt `policy_snapshot`-Evidence mit `content_hash`/`previous_hash` = `null` (Kommentar „unchanged: not chained“, `supabase/functions/governance-ingest/index.ts` ~Z. 318) — O1b. |
| Signale, Vorschläge, Änderungsraum | **fehlt** | — (kein `evolution_*` im Repo) | Neu in einer späteren Umsetzung, nach AP-3. |

## 5. Was bewusst nicht gebaut wird

- Keine selbstständige Änderung von Policies, Workflows oder Agent-Konfigurationen.
- Keine Übernahme ohne menschliche Freigabe, auch nicht „in scope".
- Keine Landing-Aussage über Governed Evolution außer „Roadmap / Coming Soon".

## 6. Offene Entscheidungen

- **E-GE1:** Granularität des Änderungsraums (je Policy · je Agent · je Mandant)
- **E-GE2:** Wer darf freigeben (Rolle aus `memberships` bzw. `approver_role` der
  `pdp_approval_gates`, Vier-Augen ab Risiko hoch?). Muster im Bestand seit
  #2006: `20261025100000_siteos_four_eyes_approval.sql` erzwingt für SiteOS per
  Trigger owner/admin/dpo, nie den Auslöser (`requested_by`), mit dokumentierter
  Selbstfreigabe nur für Solo-Mandanten — gilt **nicht** für `governance_approvals`.
- **E-GE3:** Aufbewahrung von abgelehnten Vorschlägen (Evidence ja/nein, Frist)
- **E-GE4:** Wer ist im Produkt „Anbieter“ eines gesteuerten KI-Systems
  (RealSyncDynamics für eigene Runtime-Funktionen, der Mandant, dessen
  Lieferant)? Davon hängt ab, wer den Anbieter-Änderungsraum festlegen darf.

## 7. Offene Punkte aus der WP6-Prüfung

Nicht Teil von WP6 (kein Code), je eigener PR mit eigener Freigabe:

- ~~**O1**~~ ✅ Erledigt mit #2015 (`a0ad27b`): Freigabe-Evidence aus `governance-approvals` läuft über `append_governance_evidence`.
- **O1b** `governance-ingest` schreibt `policy_snapshot`-Evidence weiter unverkettet (`content_hash`/`previous_hash` = `null`). Für Schritt 4/7 relevant, weil Policy-Entscheidungen die Simulationsbasis sind.
- **O2** Selbstfreigabe-Sperre für `governance_approvals` (betrifft E-GE2). **Teilweise:** seit #2024 gibt es `requested_by`, aber `decide_governance_approval` vergleicht es nicht mit `decided_by`, und die Funktion hat noch keinen Aufrufer. Vorlage für die Sperre: SiteOS-Trigger aus #2006.
- **O3** Kein Ablaufjob für `governance_approvals.expires_at`. **Teilweise:** `decide_governance_approval` (#2024) setzt `expired` beim Entscheidungsversuch nach Datenbankuhr; offene, nie entschiedene Einträge bleiben `pending`.
- **O4** Versionierung der Mandanten-Policies (AP-3): `governance_policy_versions` um Anlage-Eintrag und Versionsnummer ergänzen oder durch eine SSoT-Version ersetzen; bisher liest kein Code die Historie.
- **O5** Replay-Simulation gegen historische Entscheidungen fehlt (Schritt 4).
- **O6** AP-3 hat im Repo keinen Auftragstext.
- **O7** Amtlichen Wortlaut von Art. 3 Nr. 23, Art. 25 Abs. 1 Buchst. b und Art. 43 Abs. 4 auf EUR-Lex prüfen, Änderungen durch VO (EU) 2026/1744 einarbeiten.
