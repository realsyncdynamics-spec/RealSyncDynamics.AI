-- Legal-RAG Phase 1 — Seed-Korpus.
--
-- Kleiner Starter-Datensatz, damit der Phase-1-Governance-Agent ab dem
-- Merge sofort sinnvolle Retrievals liefern kann. Alle Auszüge sind
-- aus EU-/DE-Primärquellen (öffentliche Verwaltungsdokumente, EUR-Lex
-- ist gemeinfrei nach §5 UrhG / Art. 4 Richtlinie 96/9/EG), Citation
-- via source_url + heading_path zur exakten Stelle.
--
-- Bewusst KEIN Komplett-Dump — nur die Artikel, die der Governance-
-- Agent in der Pilot-Phase tatsächlich am häufigsten zitieren wird:
--   GDPR  Art. 6, 7, 13, 25, 28, 32, 33, 35
--   AI-Act Art. 5, 6, 50
--   TTDSG §25
--
-- Die echte Ingestion-Pipeline (EUR-Lex Weekly Pull, EDPB Crawler)
-- ersetzt diesen Seed später; bis dahin ist er der minimale lebende
-- Korpus für End-to-End-Tests.
--
-- Idempotenz: ON CONFLICT (source_url) DO UPDATE erlaubt Re-Apply.
-- Chunks werden auf (document_id, chunk_index) dedupliziert via DELETE
-- vor INSERT pro Dokument.

-- ─────────────────────────────────────────────────────────────────────
-- Helper: idempotenter Upsert eines Dokuments inkl. Chunk-Ersetzung
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION pg_temp.seed_legal_doc(
  p_jurisdiction      TEXT,
  p_framework         TEXT,
  p_document_type     TEXT,
  p_source_authority  TEXT,
  p_source_url        TEXT,
  p_source_identifier TEXT,
  p_title             TEXT,
  p_published_at      DATE,
  p_chunks            JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_doc_id UUID;
  v_chunk  JSONB;
  v_idx    INT := 0;
BEGIN
  INSERT INTO public.legal_documents (
    tenant_id, jurisdiction, framework, document_type,
    source_authority, source_url, source_identifier,
    language, title, published_at
  ) VALUES (
    NULL, p_jurisdiction, p_framework, p_document_type,
    p_source_authority, p_source_url, p_source_identifier,
    'de', p_title, p_published_at
  )
  ON CONFLICT (source_url) DO UPDATE
    SET title         = EXCLUDED.title,
        published_at  = EXCLUDED.published_at,
        document_type = EXCLUDED.document_type,
        framework     = EXCLUDED.framework,
        updated_at    = now()
  RETURNING id INTO v_doc_id;

  DELETE FROM public.legal_chunks WHERE document_id = v_doc_id;

  FOR v_chunk IN SELECT * FROM jsonb_array_elements(p_chunks) LOOP
    INSERT INTO public.legal_chunks (
      document_id, chunk_index, chunk_text, heading_path, citation_anchor
    ) VALUES (
      v_doc_id,
      v_idx,
      v_chunk->>'text',
      v_chunk->>'heading',
      v_chunk->>'anchor'
    );
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_doc_id;
END $$;

-- legal_documents.source_url is UNIQUE-eligible (single canonical URL
-- per document). Add the constraint lazily — only if not present —
-- so re-apply on a DB that already has rows succeeds.
DO $$ BEGIN
  ALTER TABLE public.legal_documents
    ADD CONSTRAINT legal_documents_source_url_unique UNIQUE (source_url);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN duplicate_table  THEN NULL;
         WHEN unique_violation THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- DSGVO (GDPR)
-- ─────────────────────────────────────────────────────────────────────

SELECT pg_temp.seed_legal_doc(
  'eu', 'gdpr', 'regulation', 'eur-lex',
  'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679',
  'CELEX:32016R0679',
  'DSGVO — Verordnung (EU) 2016/679',
  '2016-04-27',
  $JSON$
  [
    { "heading": "Art. 6 Abs. 1",
      "anchor":  "#art_6",
      "text":    "Die Verarbeitung personenbezogener Daten ist nur rechtmäßig, wenn mindestens eine der folgenden Bedingungen erfüllt ist: a) Einwilligung der betroffenen Person; b) Erforderlichkeit für die Erfüllung eines Vertrags; c) rechtliche Verpflichtung; d) Schutz lebenswichtiger Interessen; e) Wahrnehmung einer im öffentlichen Interesse liegenden Aufgabe; f) berechtigte Interessen des Verantwortlichen, sofern nicht die Interessen der betroffenen Person überwiegen." },
    { "heading": "Art. 7",
      "anchor":  "#art_7",
      "text":    "Beruht die Verarbeitung auf einer Einwilligung, muss der Verantwortliche nachweisen können, dass die betroffene Person eingewilligt hat. Die Einwilligungserklärung muss in verständlicher und leicht zugänglicher Form, in einer klaren und einfachen Sprache erfolgen. Die betroffene Person hat das Recht, ihre Einwilligung jederzeit zu widerrufen — der Widerruf muss so einfach sein wie die Erteilung." },
    { "heading": "Art. 13 Abs. 1",
      "anchor":  "#art_13",
      "text":    "Werden personenbezogene Daten bei der betroffenen Person erhoben, teilt der Verantwortliche der betroffenen Person zum Zeitpunkt der Erhebung Folgendes mit: Name und Kontaktdaten des Verantwortlichen, ggf. Kontaktdaten des Datenschutzbeauftragten, Zwecke der Verarbeitung sowie Rechtsgrundlage, ggf. berechtigte Interessen, Empfänger oder Kategorien von Empfängern, ggf. Absicht der Übermittlung in Drittländer." },
    { "heading": "Art. 25",
      "anchor":  "#art_25",
      "text":    "Datenschutz durch Technikgestaltung und durch datenschutzfreundliche Voreinstellungen: Der Verantwortliche trifft sowohl zum Zeitpunkt der Festlegung der Mittel als auch zum Zeitpunkt der Verarbeitung selbst geeignete technische und organisatorische Maßnahmen, die dafür ausgelegt sind, die Datenschutzgrundsätze wirksam umzusetzen — insbesondere Datenminimierung." },
    { "heading": "Art. 28",
      "anchor":  "#art_28",
      "text":    "Erfolgt die Verarbeitung im Auftrag eines Verantwortlichen, so arbeitet dieser nur mit Auftragsverarbeitern, die hinreichend Garantien dafür bieten, dass geeignete technische und organisatorische Maßnahmen so durchgeführt werden, dass die Verarbeitung im Einklang mit dieser Verordnung erfolgt. Die Beziehung wird durch einen Vertrag geregelt (Auftragsverarbeitungsvertrag, AVV)." },
    { "heading": "Art. 32",
      "anchor":  "#art_32",
      "text":    "Unter Berücksichtigung des Stands der Technik, der Implementierungskosten, der Art und der Zwecke der Verarbeitung sowie des Risikos für die Rechte und Freiheiten natürlicher Personen treffen der Verantwortliche und der Auftragsverarbeiter geeignete technische und organisatorische Maßnahmen — Pseudonymisierung, Verschlüsselung, Vertraulichkeit, Integrität, Verfügbarkeit, Belastbarkeit." },
    { "heading": "Art. 33",
      "anchor":  "#art_33",
      "text":    "Bei einer Verletzung des Schutzes personenbezogener Daten meldet der Verantwortliche unverzüglich und möglichst binnen 72 Stunden, nachdem ihm die Verletzung bekannt wurde, diese der zuständigen Aufsichtsbehörde — es sei denn, die Verletzung führt voraussichtlich nicht zu einem Risiko für die Rechte und Freiheiten natürlicher Personen." },
    { "heading": "Art. 35",
      "anchor":  "#art_35",
      "text":    "Hat eine Form der Verarbeitung — insbesondere bei Verwendung neuer Technologien — aufgrund der Art, des Umfangs, der Umstände und der Zwecke der Verarbeitung voraussichtlich ein hohes Risiko für die Rechte und Freiheiten natürlicher Personen zur Folge, führt der Verantwortliche vorab eine Datenschutz-Folgenabschätzung (DSFA) durch." }
  ]
  $JSON$::JSONB
);

-- ─────────────────────────────────────────────────────────────────────
-- EU AI Act
-- ─────────────────────────────────────────────────────────────────────

SELECT pg_temp.seed_legal_doc(
  'eu', 'ai_act', 'regulation', 'eur-lex',
  'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R1689',
  'CELEX:32024R1689',
  'EU AI Act — Verordnung (EU) 2024/1689',
  '2024-06-13',
  $JSON$
  [
    { "heading": "Art. 5",
      "anchor":  "#art_5",
      "text":    "Verbotene Praktiken im Bereich der künstlichen Intelligenz: u.a. unterschwellige Beeinflussung; Ausnutzung von Schwächen aufgrund Alter oder Behinderung; Social Scoring durch Behörden; Echtzeit-Fernidentifikation in öffentlichen Räumen (mit eng definierten Ausnahmen)." },
    { "heading": "Art. 6",
      "anchor":  "#art_6",
      "text":    "Hochrisiko-KI-Systeme: KI-Systeme gelten als hochriskant, wenn sie als Sicherheitskomponente unter die Harmonisierungsrechtsakte (Anhang I) fallen ODER in einem der in Anhang III aufgeführten Bereiche eingesetzt werden — biometrische Identifikation, kritische Infrastruktur, Bildung, Beschäftigung, wesentliche Dienstleistungen, Strafverfolgung, Migration, Justiz." },
    { "heading": "Art. 50",
      "anchor":  "#art_50",
      "text":    "Transparenzpflichten für bestimmte KI-Systeme: Anbieter stellen sicher, dass KI-Systeme, die für die direkte Interaktion mit natürlichen Personen bestimmt sind, so gestaltet werden, dass natürliche Personen informiert werden, dass sie mit einem KI-System interagieren — es sei denn, dies ist aus dem Kontext offensichtlich. Generative KI-Outputs (synthetische Audio-, Bild-, Video- oder Textinhalte) müssen maschinenlesbar als künstlich erzeugt oder manipuliert gekennzeichnet werden." }
  ]
  $JSON$::JSONB
);

-- ─────────────────────────────────────────────────────────────────────
-- TTDSG (Telekommunikation-Telemedien-Datenschutz-Gesetz, DE)
-- ─────────────────────────────────────────────────────────────────────

SELECT pg_temp.seed_legal_doc(
  'de', 'ttdsg', 'regulation', 'bmj',
  'https://www.gesetze-im-internet.de/ttdsg/__25.html',
  'TTDSG-25',
  'TTDSG — § 25 Schutz der Privatsphäre bei Endeinrichtungen',
  '2021-12-01',
  $JSON$
  [
    { "heading": "§ 25 Abs. 1",
      "anchor":  "#abs_1",
      "text":    "Die Speicherung von Informationen in der Endeinrichtung des Endnutzers oder der Zugriff auf Informationen, die bereits in der Endeinrichtung gespeichert sind, sind nur zulässig, wenn der Endnutzer auf der Grundlage von klaren und umfassenden Informationen eingewilligt hat. Die Information des Endnutzers und die Einwilligung haben gemäß der Verordnung (EU) 2016/679 zu erfolgen." },
    { "heading": "§ 25 Abs. 2",
      "anchor":  "#abs_2",
      "text":    "Die Einwilligung nach Absatz 1 ist nicht erforderlich, wenn der alleinige Zweck der Speicherung oder des Zugriffs die Durchführung der Übertragung einer Nachricht über ein öffentliches Telekommunikationsnetz ist ODER wenn die Speicherung oder der Zugriff unbedingt erforderlich ist, damit der Anbieter eines Telemediendienstes einen vom Nutzer ausdrücklich gewünschten Dienst zur Verfügung stellen kann." }
  ]
  $JSON$::JSONB
);

-- Cleanup — drop the helper. pg_temp objects are session-scoped so
-- this is cosmetic, but keeps the function out of post-migration psql
-- sessions during local development.
DROP FUNCTION IF EXISTS pg_temp.seed_legal_doc(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, JSONB
);
