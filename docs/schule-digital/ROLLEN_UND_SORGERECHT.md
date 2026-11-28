# Rollen, Berechtigungen und Sorgerecht – Konzept

**Status:** KONZEPT  
**Stand:** 27.11.2026, 23:55 (Europe/Berlin), `main` @ `a53dce7c`

Dieses Dokument beschreibt, welche Rollen Schule DIGITAL braucht und was im Repo bereits existiert. Es ist kein Schema-Entwurf zum unmittelbaren Migrieren und keine Implementationsfreigabe.

## 1. Bestand im Repo (Fakten)

Zwei getrennte Rollenkataloge existieren bereits:

| Modell | Rollen | Beleg |
|---|---|---|
| `tenant_memberships` | `owner`, `admin`, `member`, `viewer` | `supabase/migrations/20260602100000_runtime_events_backbone.sql:78-79` |
| `organization_members` | `owner`, `admin`, `editor`, `viewer_auditor` | `supabase/migrations/20260406000000_entitlements_schema.sql:21` |

RLS-Helper sind vorhanden: `is_tenant_member` (`supabase/migrations/20260723000001_rls_recursion_fix_security_definer.sql:21`) und `is_tenant_admin` (`supabase/migrations/20260621000000_p0a_mfa_security.sql:21`). MFA-Einstellungen liegen in `tenant_security_settings` (`supabase/migrations/20260621000000_p0a_mfa_security.sql:40`).

Nicht gefunden in `supabase/migrations` (Suche 27.11.2026 gegen `origin/main` nach guardian, sorgerecht, student, schüler, pupil, parental, minderjähr):

- keine Schulrollen
- kein Sorgerechts- oder Vertretungsverhältnis (Eltern ↔ Kind)
- kein Schüler-, Klassen- oder Elternkonto-Modell

`user_consents` (`supabase/migrations/20260608000001_user_consents.sql:1-22`) protokolliert nur den Consent-Typ `platform_improvement_analytics` (anonymisierte Plattform-Analyse, widerrufbar). Das ist kein Eltern- oder altersabhängiges Einwilligungsmodell.

Ein Treffer `minors_data` existiert in der AI-Act-Bewertung (`supabase/migrations/20260705010000_ai_act_assessments.sql:74` und `:200`) als Risikoindikator, nicht als Sorgerechtsmodell. `parent_id` in `org_units` (`supabase/migrations/20260824120000_org_subject_model_approval_gates.sql:29`) ist eine Organisationshierarchie, kein familiäres Vertretungsverhältnis.

## 2. Zielrollen aus dem Master-Prompt t30u (Vorschlag)

Der Master-Prompt nennt als Nutzergruppen: Schüler, Eltern, Lehrer, Schulleitungen, Schulträger, Sekretariate, Fördervereine und externe Dienstleister. Die folgende Matrix ist ein Konzept, keine implementierte Tabelle.

| Rolle | Typische Aufgabe | Datenbezug (Konzept) | Bestehende Entsprechung |
|---|---|---|---|
| Schulleitung | Schule führen, Berichte, Freigaben | ganze Schule | am nächsten: `owner` / `admin` |
| Sekretariat | Verwaltung, Termine, Krankmeldungen entgegennehmen | ganze Schule, operative Vorgänge | keine |
| Lehrer | Klasse, Hausaufgaben, Kommunikation | nur eigene Klasse / Kurse | keine |
| Schüler | Lernen, eigene Daten, eingeschränkte Kommunikation | nur eigene Daten, altersabhängig | keine |
| Eltern / Erziehungsberechtigte | Infos, Freigaben, Zahlungen, Krankmeldung | nur eigene Kinder, laut Sorgerecht | keine |
| Schulträger | übergreifende Reports, Verträge, Audit | aggregiert über zugeordnete Schulen, kein Einzelaktendzugriff als Default (Vorschlag) | `organizations` / `viewer_auditor` höchstens als grobes Muster |
| Förderverein | Mitglieder, Beiträge, Projekte | Vereinsdaten, keine Schülerakten als Default (Vorschlag) | keine |
| Externer Dienstleister | eng begrenzter Auftrag (z. B. Foto, Catering, Zugangstechnik) | nur freigegebene Zweckdaten, zeitlich begrenzt | keine |

Die vorhandenen Rollen `owner`/`admin`/`member`/`viewer` sind für ein Schulwesen zu grob: Sie unterscheiden weder Kind und Erwachsenen noch Klasse, Sorgerecht oder Zweckbindung.

## 3. Berechtigungsprinzipien (Vorschlag)

1. **Mandantentrennung zuerst.** Keine Rolle darf Daten einer anderen Schule sehen. Das setzt ein kanonisches Mandantenmodell voraus (siehe [MANDANTENMODELL_ENTSCHEIDUNG.md](./MANDANTENMODELL_ENTSCHEIDUNG.md)) und die Schließung der RLS-Schuld (P0-1).
2. **Need-to-know innerhalb der Schule.** Lehrer sehen die eigene Klasse, nicht alle Schüler der Schule. Sekretariat und Schulleitung brauchen klar getrennte Zwecke.
3. **Elternzugriff nur über ein geprüftes Sorgerechts- oder Vertretungsverhältnis.** Kein „Account der Familie“ ohne Zuordnung zum Kind.
4. **Kinderschutz vor Komfort.** KI-Funktionen (SYNC, Lernunterstützung, Voice) erst, wenn das Gateway Login und `tenant_id` erzwingt (`src/config/featureFlags.ts:5-19`) und das Alters-/Einwilligungsmodell steht.
5. **Keine simulierte Produktionsreife.** Neue Rollen bleiben Konzept, bis Schema, RLS-Policies, Tests und Review (NOVA) vorliegen und Dominik die Implementierung freigibt.

## 4. Sorgerechts- und Einwilligungsmodell (Konzept)

### 4.1 Was fehlen würde (Vorschlag, nicht gebaut)

- eine Beziehung zwischen erwachsener Person und Kind (Typ: Sorgerecht, Vollmacht, ergänzende Pflege, institutionelle Vertretung)
- Gültigkeit (von/bis), Status (beantragt, geprüft, aktiv, widerrufen, beendet)
- Regelung für gemeinsames Sorgerecht, alleinige Sorge und widersprüchliche Freigaben
- Altersgrenzen für eigene Einwilligung des Kindes (rechtlich prüfen lassen; hier keine Rechtsauskunft)
- Zweckbindung je Einwilligung (Kommunikation, Foto, Zahlung, KI-Nutzung, Weitergabe an Dienstleister)
- Widerruf und Nachweis (anbindbar an vorhandene DSR- und Evidence-Bausteine)

### 4.2 Was wiederverwendet werden kann

| Baustein | Nutzen | Beleg | Lücke |
|---|---|---|---|
| `user_consents` | Muster für widerrufbaren Consent mit Version | `supabase/migrations/20260608000001_user_consents.sql:10-22` | nur Analytics, kein Eltern-/Kindbezug |
| `dsr_requests` und Functions `gdpr-export`, `gdpr-delete`, `governance-dsr`, `governance-erasure-sweeper` | Betroffenenrechte | `supabase/migrations/20260515200000_dsr_tracker.sql:1` | noch keine Eltern-an-Kind-Anfrage |
| Evidence Vault | Nachweis von Einwilligungen und Freigaben | `src/product/implementation-status.ts:163-165` | nicht auf Schulzwecke ausgelegt |
| `tenant_invites` | Einladung in einen Mandanten | `supabase/migrations/20260430300000_tenant_invites.sql:8` | keine Rollen Schüler/Eltern |

### 4.3 Offene rechtliche und fachliche Entscheidungen

Diese Punkte sind offen und werden hier nicht entschieden:

- Welche Altersgrenzen und welche Einwilligungskombinationen (Kind, Eltern, beide) gelten in den Ziel-Bundesländern?
- Wie werden widersprüchliche Entscheidungen bei gemeinsamem Sorgerecht behandelt?
- Wer prüft die Sorgerechtsangabe (Schule, Selbstauskunft, Dokument)?
- Wie werden Kinder ohne Smartphone oder ohne eigenes Konto vertreten (Master-Prompt: alternative Zugangsverfahren)?
- SCHOOL PAY: regulierter Zahlungsdienstleister und ob Elternfreigaben vor jeder Zahlung nötig sind.

Eine formale DSFA der Plattform und eine anwaltlich geprüfte Datenschutzerklärung stehen laut NOVA noch aus (P0-7). Das ist Voraussetzung für einen Schulpilot, nicht nur für dieses Rollenkonzept.

## 5. Empfohlene Reihenfolge (Vorschlag)

1. Mandantenentscheidung und Live-RLS-Messung ([RLS_MESSUNG.sql](./RLS_MESSUNG.sql), P0-1, P0-2).
2. Konzeptreview durch NOVA (dieses Dokument).
3. Erst danach ein eigener Draft-PR für Schema und RLS-Policies – nur nach ausdrücklicher Freigabe Dominiks, weil eine Migration die Produktionsdatenbank ändern kann.
4. Tests für Mandantentrennung und für „Eltern sieht nur eigene Kinder“, bevor Module wie CONNECT oder LEARN Daten anlegen.
