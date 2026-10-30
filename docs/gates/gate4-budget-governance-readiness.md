# G4 — Budget-Governance und Telefonreserve (Vorbereitung, noch nicht implementiert)

Status: BLOCKED (nur Bestandsaufnahme; keine Runtime-Freigabe)  
Referenz: main `6e8c85fb60d1c0f5979636e03260b1e864fae9da`  
Scope: Gate 4. PR C und W1 bleiben gesperrt. Kein Merge oder Deployment.

## Bestätigte Codebefunde
- `supabase/migrations/20260604000000_economic_intelligence.sql`: `tenant_cost_caps.llm_usd_monthly` hat Default 250.00 USD; keine explizite Budget-Genehmigung.
- `supabase/migrations/20261028170000_cost_ledger_fail_closed.sql`: `cost_check_and_reserve` fällt bei fehlenden Tenant-Caps auf 250.00 USD zurück. Offene LLM-Reservierungen fließen in die Deckelprüfung ein.
- `cost_writer_settle` kann abgelaufene geschätzte LLM-Reservierungen durch Korrekturbuchungen ersetzen; `cost_sweep_expired_reservations` verbucht ausstehende LLM-Schätzungen.
- LLM-Buchungsarten: `llm_input`, `llm_output`, `llm_estimate`; bestehender Ledger-CHECK führt keine dedizierten Telefonkostenarten.
- Code-Suche nach `phone_reserve` lieferte auf dem Referenzstand keine Treffer.
- `docs/runbooks/governance-runtime-pilot-runbook.md` dokumentiert Budget- und Warnschwellen und muss konsistent aktualisiert werden.

## Sicherheitskritische Anforderungen für die Implementierung
1. `250.00 USD` nicht ändern oder als genehmigt markieren. Für Altdaten Default-Status `provisional`; Genehmigung nur nach autorisiertem, revisionsfähigem Übergang `approved`, zusätzlich `suspended`.
2. Budgetstatus muss an tatsächlichen **kostenpflichtigen Startpunkten** durchgesetzt werden; ein neues Datenfeld allein wäre kein Gate. Bei ungeklärter Freigabe neue kostenpflichtige Aktionen **fail-closed**, ohne laufende Anrufe migrationsbedingt abzubrechen.
3. Telefonreserve getrennt, explizit konfigurierbar, zu Beginn unbestätigt/deaktiviert. Keine automatische Null- oder Fantasiefreigabe. Für Twilio und ElevenLabs prüfen, welche Komponenten Kosten tragen, bevor Kostenarten definiert werden.
4. Reservierung, Monatsdeckel-Prüfung und Verbuchung müssen bei parallelen Aktionen **atomar** sein (z.B. tenant-/budgetbezogene Sperre in einer DB-Transaktion). Bestehender Check ist in der gelesenen Migration nicht sichtbar serialisiert.
5. Provider-Events mit stabilen Idempotenzschlüsseln verarbeiten; bei verspäteten Abrechnungen Korrekturbuchung statt stiller Überschreibung. Brutto-/Netto-Split und LLM/Voice/Telefonie-Kostenkomponenten einmalig und nachweisbar zuordnen.
6. Service-role-Funktionen mit minimalen Rechten und gesperrtem PUBLIC EXECUTE; Mandantentrennung, RLS, Auth und `SECURITY DEFINER` gesondert überprüfen.
7. Bereits vorhandene Migrationen **nicht ändern**. Neue Migration erst nach Schema-/Pfadprüfung mit Supabase CLI erzeugen.
8. Keine Änderungen an Checkout, Pricing, Stripe-Produkten, PR C oder W1.

## Noch zu erledigen (Gate 4 ist NICHT fertig)
- [ ] Alle Twilio- und ElevenLabs-Start-/Webhook-/Abrechnungspfade inspizieren und einen vollständigen Kostenträgerplan erstellen.
- [ ] Live-Schema nur lesend mit Repository-Migrationen abgleichen; keine Produktions-SQL-Änderung.
- [ ] Additive Migration für Status/Genehmigungs-Audit und Telefonreserve implementieren.
- [ ] Atomare Budgetreservierung und Provider-Abrechnung integrieren, inklusive Fehler- und Retry-Pfaden.
- [ ] Tests: provisional, approved, suspended, Monatsende, Parallelität, provider missing data, doppelte Webhooks, Korrekturen, Tenant-Isolation, DB-Ausfall, Alt-Daten.
- [ ] Preis-/Stripe-Unverändertheit anhand Diffs belegen; Dokumentation ergänzen.
- [ ] CI-/DB-Testlauf auf PR-Head belegen, Sicherheitsreview, Rollback-Plan.

## Abnahmeregel
`GATE 4 READY` ist erst zulässig, wenn Runtime, Migration, Integrationstests, CI und Belege vorliegen. Dieser Dokumentations-Commit ist **GATE 4 BLOCKED** und erteilt weder Merge- noch Deployfreigabe.

## Weitere Gates
Gate 1: tatsächliche Call-Beendigung beim Provider nicht live verifiziert.
Gate 2: CI-Laufergebnisse gesondert verifizieren.
Gate 3: Preview-/Produktionssecret-Isolation gesondert verifizieren.
