-- Policy Packs — vollständige Control-Kataloge (Phase 2).
--
-- Ersetzt die kuratierten Foundational-Sets aus 20260701150000 durch
-- vollständige, referenzierbare Kataloge je Framework. Rein additiv:
--   * neue Controls -> framework_controls (ON CONFLICT DO NOTHING)
--   * bestehende Packs referenzieren nun den vollständigen Satz
--     (policy_pack_controls, ON CONFLICT DO NOTHING)
--   * Namen/Beschreibungen der Packs werden an die Vollständigkeit angepasst
--
-- Es werden KEINE bestehenden Zeilen entfernt oder umbenannt (Append-only).
-- Die Abdeckungs-/Empfehlungslogik (coverage.ts / recommend.ts) greift ohne
-- Codeänderung, da sie generisch über (framework, control_code) arbeitet.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FRAMEWORK_CONTROLS — vollständige Kataloge
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── DSGVO / GDPR ────────────────────────────────────────────────────────────
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('GDPR','Art.7','Bedingungen für die Einwilligung','Nachweisbare, freiwillige, widerrufbare Einwilligung.'),
    ('GDPR','Art.9','Besondere Kategorien personenbezogener Daten','Verarbeitung sensibler Daten nur mit Ausnahmetatbestand.'),
    ('GDPR','Art.12','Transparente Information und Kommunikation','Betroffenenrechte präzise, transparent und unentgeltlich.'),
    ('GDPR','Art.13','Informationspflicht bei Direkterhebung','Information der betroffenen Person bei Erhebung.'),
    ('GDPR','Art.14','Informationspflicht bei Dritterhebung','Information, wenn Daten nicht bei der Person erhoben werden.'),
    ('GDPR','Art.15','Auskunftsrecht der betroffenen Person','Auskunft über verarbeitete Daten und Umstände.'),
    ('GDPR','Art.16','Recht auf Berichtigung','Unverzügliche Berichtigung unrichtiger Daten.'),
    ('GDPR','Art.17','Recht auf Löschung','Löschung bei Wegfall der Rechtsgrundlage.'),
    ('GDPR','Art.18','Recht auf Einschränkung der Verarbeitung','Einschränkung in definierten Fällen.'),
    ('GDPR','Art.20','Recht auf Datenübertragbarkeit','Herausgabe in strukturiertem, maschinenlesbarem Format.'),
    ('GDPR','Art.21','Widerspruchsrecht','Widerspruch gegen Verarbeitung, insbesondere Direktwerbung.'),
    ('GDPR','Art.24','Verantwortung des Verantwortlichen','Geeignete technische und organisatorische Maßnahmen (Nachweis).'),
    ('GDPR','Art.25','Datenschutz durch Technikgestaltung','Privacy by Design und by Default.'),
    ('GDPR','Art.28','Auftragsverarbeiter','Auftragsverarbeitung nur mit Vertrag und Garantien (AVV).'),
    ('GDPR','Art.34','Benachrichtigung betroffener Personen','Benachrichtigung bei hohem Risiko durch Verletzung.'),
    ('GDPR','Art.37','Benennung eines Datenschutzbeauftragten','DSB bei Pflichtfällen benannt und eingebunden.'),
    ('GDPR','Art.44','Allgemeine Grundsätze der Datenübermittlung','Drittlandtransfer nur mit zulässiger Grundlage.'),
    ('GDPR','Art.46','Geeignete Garantien','Transfer über SCC, BCR oder gleichwertige Garantien.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ─── EU AI Act (Hochrisiko-Pflichten Art. 8–27 + Post-Market) ────────────────
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('EU_AI_ACT','Art.8','Einhaltung der Anforderungen','Hochrisiko-KI erfüllt sämtliche Anforderungen des Abschnitts.'),
    ('EU_AI_ACT','Art.11','Technische Dokumentation','Technische Dokumentation nach Anhang IV erstellt und aktuell.'),
    ('EU_AI_ACT','Art.16','Pflichten der Anbieter','Anbieterpflichten für Hochrisiko-KI erfüllt.'),
    ('EU_AI_ACT','Art.17','Qualitätsmanagementsystem','Dokumentiertes QMS für Konformität etabliert.'),
    ('EU_AI_ACT','Art.18','Aufbewahrung der Dokumentation','Dokumentation 10 Jahre vorgehalten.'),
    ('EU_AI_ACT','Art.19','Automatisch erzeugte Protokolle','Aufbewahrung der vom System erzeugten Logs.'),
    ('EU_AI_ACT','Art.20','Korrekturmaßnahmen und Informationspflicht','Korrekturmaßnahmen bei Nichtkonformität.'),
    ('EU_AI_ACT','Art.21','Zusammenarbeit mit den zuständigen Behörden','Auskunft und Kooperation auf Verlangen.'),
    ('EU_AI_ACT','Art.22','Bevollmächtigte','Bevollmächtigter in der Union benannt (falls zutreffend).'),
    ('EU_AI_ACT','Art.26','Pflichten der Betreiber','Deployer-Pflichten (Nutzung gemäß Anweisung, Aufsicht).'),
    ('EU_AI_ACT','Art.27','Grundrechte-Folgenabschätzung','FRIA vor Inbetriebnahme durchgeführt (falls zutreffend).'),
    ('EU_AI_ACT','Art.72','Beobachtung nach dem Inverkehrbringen','Post-Market-Monitoring-System eingerichtet.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ─── NIS2 (10 Maßnahmen aus Art. 21 Abs. 2 + weitere Artikel) ────────────────
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('NIS2','Art.21.a','Konzepte für Risikoanalyse und IT-Sicherheit','Risikoanalyse und Sicherheitskonzepte für Informationssysteme.'),
    ('NIS2','Art.21.b','Bewältigung von Sicherheitsvorfällen','Incident-Handling-Prozess etabliert.'),
    ('NIS2','Art.21.c','Aufrechterhaltung des Betriebs','Backup, Wiederherstellung und Krisenmanagement.'),
    ('NIS2','Art.21.d','Sicherheit der Lieferkette','Sicherheitsanforderungen an Lieferanten und Dienstleister.'),
    ('NIS2','Art.21.e','Sicherheit bei Erwerb, Entwicklung und Wartung','Sicherheit über den Lebenszyklus inkl. Schwachstellenmanagement.'),
    ('NIS2','Art.21.f','Bewertung der Wirksamkeit','Verfahren zur Bewertung der Wirksamkeit der Maßnahmen.'),
    ('NIS2','Art.21.g','Cyberhygiene und Schulungen','Grundlegende Cyberhygiene und Awareness-Schulungen.'),
    ('NIS2','Art.21.h','Kryptografie und Verschlüsselung','Konzepte und Verfahren für Kryptografie.'),
    ('NIS2','Art.21.i','Personalsicherheit und Zugriffskontrolle','Personalsicherheit, Zugriffskontrolle und Asset-Management.'),
    ('NIS2','Art.21.j','Multi-Faktor-Authentifizierung','MFA, gesicherte Sprach-/Video-/Textkommunikation, Notfallkommunikation.'),
    ('NIS2','Art.24','Verwendung europäischer Zertifizierungsschemata','Einsatz zertifizierter IKT-Produkte und -Dienste.'),
    ('NIS2','Art.25','Normung','Anwendung einschlägiger europäischer und internationaler Normen.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ─── DORA (IKT-Risikomanagement, Vorfälle, Tests, Drittparteien) ─────────────
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('DORA','Art.6','IKT-Risikomanagementrahmen','Umfassender, dokumentierter IKT-Risikomanagementrahmen.'),
    ('DORA','Art.7','IKT-Systeme, -Protokolle und -Tools','Angemessene, zuverlässige IKT-Systeme und -Werkzeuge.'),
    ('DORA','Art.8','Identifizierung','Identifizierung von IKT-gestützten Funktionen und Assets.'),
    ('DORA','Art.9','Schutz und Prävention','Schutzmaßnahmen und Präventionsmechanismen.'),
    ('DORA','Art.10','Erkennung','Mechanismen zur Erkennung anomaler Aktivitäten.'),
    ('DORA','Art.11','Reaktion und Wiederherstellung','Reaktions- und Wiederherstellungspläne (BCM).'),
    ('DORA','Art.12','Sicherungs-, Wiederherstellungsverfahren','Backup-Konzepte und -Wiederherstellungsverfahren.'),
    ('DORA','Art.13','Lernen und Weiterentwicklung','Kontinuierliche Verbesserung nach Vorfällen und Tests.'),
    ('DORA','Art.14','Kommunikation','Kommunikationspläne für IKT-Störungen.'),
    ('DORA','Art.18','Klassifizierung von Vorfällen','Klassifizierung von IKT-Vorfällen und Cyberbedrohungen.'),
    ('DORA','Art.19','Meldung schwerwiegender Vorfälle','Meldung schwerwiegender IKT-Vorfälle an die Behörde.'),
    ('DORA','Art.25','Testen von IKT-Tools und -Systemen','Programm für Tests der digitalen Resilienz.'),
    ('DORA','Art.26','Bedrohungsgeleitete Penetrationstests','TLPT für kritische Funktionen.'),
    ('DORA','Art.29','Konzentrationsrisiko auf Ebene der Drittanbieter','Bewertung von Konzentrationsrisiken bei IKT-Drittanbietern.'),
    ('DORA','Art.30','Vertragliche Bestimmungen','Pflichtinhalte der Verträge mit IKT-Drittanbietern.'),
    ('DORA','Art.45','Vereinbarungen zum Austausch von Informationen','Austausch von Bedrohungsinformationen (freiwillig).')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ─── ISO/IEC 27001:2022 Annex A — vollständige 93 Controls ───────────────────
-- A.5 Organisatorische Controls (37)
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('ISO_27001','A.5.1','Informationssicherheitsrichtlinien','Richtlinien definiert, genehmigt, veröffentlicht und überprüft.'),
    ('ISO_27001','A.5.2','Informationssicherheitsrollen und -verantwortlichkeiten','Rollen und Verantwortlichkeiten zugewiesen.'),
    ('ISO_27001','A.5.3','Aufgabentrennung','Konfligierende Aufgaben und Verantwortungen getrennt.'),
    ('ISO_27001','A.5.4','Verantwortlichkeiten der Leitung','Leitung fordert Einhaltung der Sicherheitsvorgaben.'),
    ('ISO_27001','A.5.5','Kontakt mit Behörden','Kontakt zu relevanten Behörden gepflegt.'),
    ('ISO_27001','A.5.6','Kontakt mit speziellen Interessengruppen','Kontakt zu Fachgruppen und Foren.'),
    ('ISO_27001','A.5.7','Bedrohungsintelligenz','Sammlung und Analyse von Bedrohungsinformationen.'),
    ('ISO_27001','A.5.8','Informationssicherheit im Projektmanagement','Sicherheit in Projekte integriert.'),
    ('ISO_27001','A.5.9','Inventar der Informationen und Assets','Inventar geführt und Eigentümer zugewiesen.'),
    ('ISO_27001','A.5.10','Zulässige Nutzung von Informationen und Assets','Regeln für zulässige Nutzung definiert.'),
    ('ISO_27001','A.5.11','Rückgabe von Assets','Rückgabe bei Beendigung des Beschäftigungsverhältnisses.'),
    ('ISO_27001','A.5.12','Klassifizierung von Informationen','Informationen nach Schutzbedarf klassifiziert.'),
    ('ISO_27001','A.5.13','Kennzeichnung von Informationen','Kennzeichnungsverfahren umgesetzt.'),
    ('ISO_27001','A.5.14','Informationsübertragung','Regeln und Vereinbarungen für Informationsübertragung.'),
    ('ISO_27001','A.5.15','Zugangssteuerung','Zugangssteuerung auf Basis von Anforderungen.'),
    ('ISO_27001','A.5.16','Identitätsmanagement','Verwaltung des vollständigen Identitätslebenszyklus.'),
    ('ISO_27001','A.5.17','Authentifizierungsinformationen','Verwaltung von Authentifizierungsgeheimnissen.'),
    ('ISO_27001','A.5.18','Zugangsrechte','Zuweisung, Überprüfung und Entzug von Zugangsrechten.'),
    ('ISO_27001','A.5.19','Informationssicherheit in Lieferantenbeziehungen','Sicherheit in Lieferantenbeziehungen berücksichtigt.'),
    ('ISO_27001','A.5.20','Sicherheit in Lieferantenvereinbarungen','Sicherheitsanforderungen vertraglich vereinbart.'),
    ('ISO_27001','A.5.21','Sicherheit in der IKT-Lieferkette','Risiken der IKT-Produkt- und Dienstleistungskette gesteuert.'),
    ('ISO_27001','A.5.22','Überwachung von Lieferantendiensten','Überwachung, Überprüfung und Änderungsmanagement.'),
    ('ISO_27001','A.5.23','Informationssicherheit bei Cloud-Diensten','Sicherheit bei Erwerb und Nutzung von Cloud-Diensten.'),
    ('ISO_27001','A.5.24','Planung und Vorbereitung des Vorfallmanagements','Incident-Management geplant und vorbereitet.'),
    ('ISO_27001','A.5.25','Bewertung und Entscheidung über Ereignisse','Sicherheitsereignisse bewertet und klassifiziert.'),
    ('ISO_27001','A.5.26','Reaktion auf Vorfälle','Reaktion gemäß dokumentierten Verfahren.'),
    ('ISO_27001','A.5.27','Lernen aus Vorfällen','Erkenntnisse zur Stärkung der Maßnahmen genutzt.'),
    ('ISO_27001','A.5.28','Sammlung von Beweismaterial','Verfahren zur Beweissicherung.'),
    ('ISO_27001','A.5.29','Informationssicherheit bei Störungen','Aufrechterhaltung der Sicherheit während Störungen.'),
    ('ISO_27001','A.5.30','IKT-Bereitschaft für Geschäftskontinuität','IKT-Kontinuität geplant und getestet.'),
    ('ISO_27001','A.5.31','Rechtliche und vertragliche Anforderungen','Identifikation und Einhaltung einschlägiger Anforderungen.'),
    ('ISO_27001','A.5.32','Geistige Eigentumsrechte','Schutz geistigen Eigentums.'),
    ('ISO_27001','A.5.33','Schutz von Aufzeichnungen','Aufzeichnungen vor Verlust und Fälschung geschützt.'),
    ('ISO_27001','A.5.34','Datenschutz und Schutz personenbezogener Daten','Schutz von PII gemäß Anforderungen.'),
    ('ISO_27001','A.5.35','Unabhängige Überprüfung der Informationssicherheit','Regelmäßige unabhängige Überprüfung.'),
    ('ISO_27001','A.5.36','Einhaltung von Richtlinien und Normen','Konformität mit Richtlinien und Standards.'),
    ('ISO_27001','A.5.37','Dokumentierte Betriebsabläufe','Betriebsabläufe dokumentiert und verfügbar.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- A.6 Personenbezogene Controls (8)
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('ISO_27001','A.6.1','Sicherheitsüberprüfung','Screening von Bewerbern vor Einstellung.'),
    ('ISO_27001','A.6.2','Beschäftigungsbedingungen','Sicherheitsverantwortung in Arbeitsverträgen.'),
    ('ISO_27001','A.6.3','Sensibilisierung, Aus- und Weiterbildung','Awareness und Schulungen für Personal.'),
    ('ISO_27001','A.6.4','Disziplinarverfahren','Formales Verfahren bei Sicherheitsverstößen.'),
    ('ISO_27001','A.6.5','Verantwortlichkeiten nach Beendigung','Pflichten nach Ausscheiden oder Wechsel.'),
    ('ISO_27001','A.6.6','Vertraulichkeitsvereinbarungen','NDAs abgeschlossen und gepflegt.'),
    ('ISO_27001','A.6.7','Telearbeit','Sicherheit bei Remote-Arbeit.'),
    ('ISO_27001','A.6.8','Meldung von Sicherheitsereignissen','Kanäle zur Meldung von Ereignissen.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- A.7 Physische Controls (14)
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('ISO_27001','A.7.1','Physische Sicherheitsperimeter','Definierte physische Sicherheitszonen.'),
    ('ISO_27001','A.7.2','Physischer Zutritt','Zutrittskontrollen für Sicherheitsbereiche.'),
    ('ISO_27001','A.7.3','Sicherung von Büros, Räumen und Einrichtungen','Physische Absicherung von Einrichtungen.'),
    ('ISO_27001','A.7.4','Physische Sicherheitsüberwachung','Überwachung physischer Bereiche.'),
    ('ISO_27001','A.7.5','Schutz vor physischen und Umweltbedrohungen','Schutz gegen Naturgefahren und Angriffe.'),
    ('ISO_27001','A.7.6','Arbeiten in Sicherheitsbereichen','Regeln für Arbeiten in Sicherheitsbereichen.'),
    ('ISO_27001','A.7.7','Aufgeräumter Arbeitsplatz und Bildschirm','Clear-Desk- und Clear-Screen-Regeln.'),
    ('ISO_27001','A.7.8','Platzierung und Schutz von Geräten','Sichere Aufstellung von Betriebsmitteln.'),
    ('ISO_27001','A.7.9','Sicherheit von Assets außerhalb der Räumlichkeiten','Schutz mobiler und externer Assets.'),
    ('ISO_27001','A.7.10','Speichermedien','Verwaltung und Schutz von Speichermedien.'),
    ('ISO_27001','A.7.11','Versorgungseinrichtungen','Schutz unterstützender Versorgung (Strom, Kühlung).'),
    ('ISO_27001','A.7.12','Sicherheit der Verkabelung','Schutz von Strom- und Datenleitungen.'),
    ('ISO_27001','A.7.13','Instandhaltung von Geräten','Wartung zur Sicherstellung der Verfügbarkeit.'),
    ('ISO_27001','A.7.14','Sichere Entsorgung oder Wiederverwendung','Sichere Löschung vor Entsorgung/Wiederverwendung.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- A.8 Technologische Controls (34)
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('ISO_27001','A.8.1','Endgeräte der Benutzer','Schutz von Benutzerendgeräten.'),
    ('ISO_27001','A.8.2','Privilegierte Zugangsrechte','Einschränkung und Steuerung privilegierter Rechte.'),
    ('ISO_27001','A.8.3','Beschränkung des Informationszugangs','Zugang nach Need-to-know.'),
    ('ISO_27001','A.8.4','Zugang zum Quellcode','Zugang zu Quellcode und Entwicklungswerkzeugen kontrolliert.'),
    ('ISO_27001','A.8.5','Sichere Authentifizierung','Sichere Authentifizierungsverfahren.'),
    ('ISO_27001','A.8.6','Kapazitätsmanagement','Überwachung und Planung von Kapazitäten.'),
    ('ISO_27001','A.8.7','Schutz vor Schadsoftware','Malware-Schutz umgesetzt.'),
    ('ISO_27001','A.8.8','Management technischer Schwachstellen','Schwachstellen erkannt und behandelt.'),
    ('ISO_27001','A.8.9','Konfigurationsmanagement','Sichere Konfigurationen etabliert und gepflegt.'),
    ('ISO_27001','A.8.10','Löschung von Informationen','Löschung nicht mehr benötigter Informationen.'),
    ('ISO_27001','A.8.11','Datenmaskierung','Maskierung sensibler Daten.'),
    ('ISO_27001','A.8.12','Verhinderung von Datenlecks','Data-Leakage-Prevention-Maßnahmen.'),
    ('ISO_27001','A.8.13','Sicherung von Informationen','Regelmäßige Backups gemäß Richtlinie.'),
    ('ISO_27001','A.8.14','Redundanz von Verarbeitungseinrichtungen','Redundanz zur Sicherstellung der Verfügbarkeit.'),
    ('ISO_27001','A.8.15','Protokollierung','Ereignisse protokolliert und geschützt.'),
    ('ISO_27001','A.8.16','Überwachungsaktivitäten','Überwachung auf anomales Verhalten.'),
    ('ISO_27001','A.8.17','Uhrzeitsynchronisation','Synchronisierte Systemuhren.'),
    ('ISO_27001','A.8.18','Nutzung privilegierter Hilfsprogramme','Einsatz privilegierter Dienstprogramme kontrolliert.'),
    ('ISO_27001','A.8.19','Installation von Software auf Systemen','Kontrollierte Software-Installation.'),
    ('ISO_27001','A.8.20','Netzwerksicherheit','Absicherung von Netzwerken.'),
    ('ISO_27001','A.8.21','Sicherheit von Netzwerkdiensten','Sicherheitsmechanismen für Netzwerkdienste.'),
    ('ISO_27001','A.8.22','Trennung von Netzwerken','Segmentierung von Netzwerken.'),
    ('ISO_27001','A.8.23','Webfilterung','Filterung des Zugriffs auf externe Websites.'),
    ('ISO_27001','A.8.24','Verwendung von Kryptografie','Kryptografie-Richtlinie umgesetzt.'),
    ('ISO_27001','A.8.25','Sicherer Entwicklungslebenszyklus','Secure SDLC etabliert.'),
    ('ISO_27001','A.8.26','Anforderungen an die Anwendungssicherheit','Sicherheitsanforderungen für Anwendungen.'),
    ('ISO_27001','A.8.27','Sichere Systemarchitektur und -entwicklung','Sichere Architektur- und Engineering-Prinzipien.'),
    ('ISO_27001','A.8.28','Sichere Codierung','Secure-Coding-Prinzipien angewendet.'),
    ('ISO_27001','A.8.29','Sicherheitstests in Entwicklung und Abnahme','Security-Tests im Entwicklungsprozess.'),
    ('ISO_27001','A.8.30','Ausgelagerte Entwicklung','Steuerung und Überwachung ausgelagerter Entwicklung.'),
    ('ISO_27001','A.8.31','Trennung von Entwicklungs-, Test- und Produktivumgebungen','Umgebungen getrennt.'),
    ('ISO_27001','A.8.32','Änderungsmanagement','Kontrollierte Änderungen an Systemen.'),
    ('ISO_27001','A.8.33','Testinformationen','Schutz von Testdaten.'),
    ('ISO_27001','A.8.34','Schutz von Informationssystemen bei Audits','Schutz während Audit-Tests.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ─── TISAX / VDA ISA — weitere Module ────────────────────────────────────────
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('TISAX','ISA-2','Personal (HR-Sicherheit)','Sensibilisierung, Verpflichtung und Schulung des Personals.'),
    ('TISAX','ISA-3','Physische Sicherheit und BCM','Physische Sicherheit und Geschäftskontinuität.'),
    ('TISAX','ISA-4','Identitäts- und Zugriffsmanagement','Verwaltung von Identitäten und Zugriffsrechten.'),
    ('TISAX','ISA-7','Lieferantenbeziehungen','Sicherheitsanforderungen an Lieferanten und Dienstleister.'),
    ('TISAX','ISA-8','Compliance und Audit','Einhaltung und interne Überprüfung (VDA ISA).')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ─── SOC 2 — Trust Services Common Criteria (CC-Serie) ───────────────────────
INSERT INTO public.framework_controls (framework, control_code, title, description) VALUES
    ('SOC_2','CC1','Kontrollumgebung','Integrität, ethische Werte und Governance-Aufsicht.'),
    ('SOC_2','CC2','Kommunikation und Information','Interne und externe Sicherheitskommunikation.'),
    ('SOC_2','CC3','Risikobewertung','Identifikation und Bewertung von Risiken.'),
    ('SOC_2','CC4','Überwachungsaktivitäten','Fortlaufende Bewertung der Kontrollen.'),
    ('SOC_2','CC5','Kontrollaktivitäten','Auswahl und Umsetzung von Kontrollen.'),
    ('SOC_2','CC6','Logische und physische Zugriffskontrollen','Zugriffsschutz für Systeme und Standorte.'),
    ('SOC_2','CC7','Systembetrieb','Erkennung und Behandlung von Anomalien und Vorfällen.'),
    ('SOC_2','CC8','Änderungsmanagement','Kontrollierte Änderungen an Systemen.'),
    ('SOC_2','CC9','Risikominderung','Minderung von Risiken aus Störungen und Lieferanten.')
ON CONFLICT (framework, control_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PACKS auf die vollständigen Kataloge erweitern (additiv)
-- ═══════════════════════════════════════════════════════════════════════════

-- DSGVO Essentials -> vollständiger DSGVO-Kernkatalog
INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
    ('dsgvo-essentials','GDPR','Art.7'),('dsgvo-essentials','GDPR','Art.9'),('dsgvo-essentials','GDPR','Art.12'),
    ('dsgvo-essentials','GDPR','Art.13'),('dsgvo-essentials','GDPR','Art.14'),('dsgvo-essentials','GDPR','Art.15'),
    ('dsgvo-essentials','GDPR','Art.16'),('dsgvo-essentials','GDPR','Art.17'),('dsgvo-essentials','GDPR','Art.18'),
    ('dsgvo-essentials','GDPR','Art.20'),('dsgvo-essentials','GDPR','Art.21'),('dsgvo-essentials','GDPR','Art.24'),
    ('dsgvo-essentials','GDPR','Art.25'),('dsgvo-essentials','GDPR','Art.28'),('dsgvo-essentials','GDPR','Art.34'),
    ('dsgvo-essentials','GDPR','Art.37'),('dsgvo-essentials','GDPR','Art.44'),('dsgvo-essentials','GDPR','Art.46')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- EU AI Act – High-Risk -> vollständige Hochrisiko-Pflichten
INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.8'),('eu-ai-act-high-risk','EU_AI_ACT','Art.11'),
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.16'),('eu-ai-act-high-risk','EU_AI_ACT','Art.17'),
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.18'),('eu-ai-act-high-risk','EU_AI_ACT','Art.19'),
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.20'),('eu-ai-act-high-risk','EU_AI_ACT','Art.21'),
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.22'),('eu-ai-act-high-risk','EU_AI_ACT','Art.26'),
    ('eu-ai-act-high-risk','EU_AI_ACT','Art.27'),('eu-ai-act-high-risk','EU_AI_ACT','Art.72')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- NIS2 Cybersicherheit -> Maßnahmenkatalog Art. 21(2) + Zertifizierung/Normung
INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
    ('nis2-cybersecurity','NIS2','Art.21.a'),('nis2-cybersecurity','NIS2','Art.21.b'),('nis2-cybersecurity','NIS2','Art.21.c'),
    ('nis2-cybersecurity','NIS2','Art.21.d'),('nis2-cybersecurity','NIS2','Art.21.e'),('nis2-cybersecurity','NIS2','Art.21.f'),
    ('nis2-cybersecurity','NIS2','Art.21.g'),('nis2-cybersecurity','NIS2','Art.21.h'),('nis2-cybersecurity','NIS2','Art.21.i'),
    ('nis2-cybersecurity','NIS2','Art.21.j'),('nis2-cybersecurity','NIS2','Art.24'),('nis2-cybersecurity','NIS2','Art.25')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- DORA -> vollständiger IKT-Resilienz-Katalog
INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
    ('dora-financial','DORA','Art.6'),('dora-financial','DORA','Art.7'),('dora-financial','DORA','Art.8'),
    ('dora-financial','DORA','Art.9'),('dora-financial','DORA','Art.10'),('dora-financial','DORA','Art.11'),
    ('dora-financial','DORA','Art.12'),('dora-financial','DORA','Art.13'),('dora-financial','DORA','Art.14'),
    ('dora-financial','DORA','Art.18'),('dora-financial','DORA','Art.19'),('dora-financial','DORA','Art.25'),
    ('dora-financial','DORA','Art.26'),('dora-financial','DORA','Art.29'),('dora-financial','DORA','Art.30'),
    ('dora-financial','DORA','Art.45')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- ISO 27001 -> vollständiger Annex A (2022): 93 Controls
INSERT INTO public.policy_pack_controls (pack_id, framework, control_code)
SELECT 'iso-27001-foundation', 'ISO_27001', control_code
  FROM public.framework_controls
 WHERE framework = 'ISO_27001'
   AND control_code ~ '^A\.[5-8]\.[0-9]+$'
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- TISAX Automotive -> weitere VDA-ISA-Module
INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
    ('tisax-automotive','TISAX','ISA-2'),('tisax-automotive','TISAX','ISA-3'),('tisax-automotive','TISAX','ISA-4'),
    ('tisax-automotive','TISAX','ISA-7'),('tisax-automotive','TISAX','ISA-8')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- FinTech-Kombi -> um zentrale Zusatz-Controls ergänzen
INSERT INTO public.policy_pack_controls (pack_id, framework, control_code) VALUES
    ('fintech-compliance','GDPR','Art.6'),('fintech-compliance','GDPR','Art.30'),('fintech-compliance','GDPR','Art.33'),
    ('fintech-compliance','NIS2','Art.21.b'),('fintech-compliance','NIS2','Art.23'),
    ('fintech-compliance','DORA','Art.6'),('fintech-compliance','DORA','Art.18'),('fintech-compliance','DORA','Art.19')
ON CONFLICT (pack_id, framework, control_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Pack-Beschreibungen an die Vollständigkeit anpassen
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE public.policy_pack_catalog SET
    name = 'DSGVO – Vollständig',
    description = 'Vollständiger DSGVO-Kernkatalog: Grundsätze, Rechtsgrundlagen, Betroffenenrechte, TOMs, Auftragsverarbeitung und Drittlandtransfer.'
 WHERE id = 'dsgvo-essentials';

UPDATE public.policy_pack_catalog SET
    description = 'Vollständige Pflichten für Hochrisiko-KI-Systeme (Art. 8–27) inkl. QMS, technischer Dokumentation, menschlicher Aufsicht und Post-Market-Monitoring.'
 WHERE id = 'eu-ai-act-high-risk';

UPDATE public.policy_pack_catalog SET
    description = 'NIS2 vollständig: Governance, 10-Punkte-Maßnahmenkatalog (Art. 21 Abs. 2), Berichterstattung, Zertifizierung und Normung.'
 WHERE id = 'nis2-cybersecurity';

UPDATE public.policy_pack_catalog SET
    description = 'DORA vollständig: IKT-Risikomanagementrahmen, Vorfallmanagement, Resilienztests (inkl. TLPT) und Steuerung von IKT-Drittparteien.'
 WHERE id = 'dora-financial';

UPDATE public.policy_pack_catalog SET
    name = 'ISO 27001 – Annex A (2022)',
    description = 'Vollständiger Annex A (ISO/IEC 27001:2022): 93 Controls in vier Themen — organisatorisch, personenbezogen, physisch und technologisch.'
 WHERE id = 'iso-27001-foundation';

UPDATE public.policy_pack_catalog SET
    description = 'TISAX/VDA ISA: IS-Management, Prototypenschutz, Datenschutz, Personal, physische Sicherheit/BCM, IAM, Lieferanten und Compliance.'
 WHERE id = 'tisax-automotive';
