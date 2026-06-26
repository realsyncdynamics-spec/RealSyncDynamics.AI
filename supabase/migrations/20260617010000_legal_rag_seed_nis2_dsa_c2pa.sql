-- Legal-RAG Phase 2 — Erweiterung des Seed-Korpus.
--
-- Ergänzt den Starter-Datensatz aus 20260616000000_legal_rag_seed_corpus.sql
-- um die für den Governance-Agenten und den Herkunftsnachweis-Workflow
-- relevanten Regelwerke:
--
--   NIS2   Richtlinie (EU) 2022/2555  — Art. 20, 21, 23
--   DSA    Verordnung (EU) 2022/2065  — Art. 14, 26, 34, 35
--   C2PA   Spezifikation v2.0         — Sec. 2, 7, 13
--
-- Idempotenz: Identische ON-CONFLICT-Logik wie Phase 1.
-- Der pg_temp-Helper wird pro Transaktion neu deklariert (temp-Schema
-- ist session-scoped; jede Migration läuft in einer eigenen Session).

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
-- NIS2 — Richtlinie (EU) 2022/2555
-- ─────────────────────────────────────────────────────────────────────

SELECT pg_temp.seed_legal_doc(
  'eu', 'nis2', 'directive', 'eur-lex',
  'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022L2555',
  'CELEX:32022L2555',
  'NIS-2-Richtlinie — Richtlinie (EU) 2022/2555',
  '2022-12-14',
  $JSON$
  [
    { "heading": "Art. 20 — Governance",
      "anchor":  "#art_20",
      "text":    "Artikel 20 der NIS-2-Richtlinie verpflichtet die Leitungsorgane wesentlicher und wichtiger Einrichtungen zur persönlichen Verantwortung für Cybersicherheitsmaßnahmen. Die Mitglieder der Leitungsorgane — also Geschäftsführung, Vorstand oder vergleichbare Führungsebene — müssen die von der Einrichtung ergriffenen Risikomanagementmaßnahmen im Bereich der Cybersicherheit billigen und deren Umsetzung überwachen. Eine Delegation dieser Verantwortung an nachgeordnete Stellen entlastet das Leitungsorgan nicht von der Aufsichtspflicht. Darüber hinaus schreibt Absatz 2 vor, dass die Mitglieder der Leitungsorgane an Schulungen zur Cybersicherheit teilnehmen müssen, um ausreichende Kenntnisse und Fähigkeiten zur Erkennung und Bewertung von Risiken sowie zur Beurteilung von Managementpraktiken zu erwerben. Die Mitgliedstaaten können vorschreiben, dass Einrichtungen vergleichbare Schulungsangebote auch für ihre Mitarbeiterinnen und Mitarbeiter regelmäßig bereitstellen. Bei Verstoß gegen die Pflichten aus Art. 20 können die Leitungsorgane persönlich haftbar gemacht werden; die Mitgliedstaaten haben hierzu wirksame, verhältnismäßige und abschreckende Sanktionsregelungen vorzusehen, einschließlich vorübergehender Tätigkeitsverbote für natürliche Personen in Leitungspositionen bei schwerwiegenden Verstößen." },
    { "heading": "Art. 21 — Cybersicherheitsmaßnahmen",
      "anchor":  "#art_21",
      "text":    "Artikel 21 verpflichtet wesentliche und wichtige Einrichtungen, geeignete und verhältnismäßige technische, operative und organisatorische Maßnahmen zu ergreifen, um die Risiken für die Sicherheit der Netz- und Informationssysteme zu beherrschen und die Auswirkungen von Sicherheitsvorfällen zu verhindern oder zu minimieren. Der Ansatz ist risikobasiert und berücksichtigt den Stand der Technik sowie einschlägige europäische und internationale Normen. Die Richtlinie benennt in Absatz 2 einen verbindlichen Mindestkanon an Maßnahmen: (a) Konzepte für Risikoanalyse und Sicherheit der Informationssysteme; (b) Bewältigung von Sicherheitsvorfällen; (c) Aufrechterhaltung des Betriebs und Krisenmanagement (Business Continuity Management, BCM) einschließlich Backup-Management und Notfallwiederherstellung; (d) Sicherheit der Lieferkette, einschließlich sicherheitsbezogener Aspekte der Beziehungen zwischen den Einrichtungen und ihren unmittelbaren Anbietern oder Diensteanbietern; (e) Sicherheitsmaßnahmen bei Erwerb, Entwicklung und Wartung von Netz- und Informationssystemen, einschließlich Management und Offenlegung von Schwachstellen; (f) Konzepte und Verfahren zur Bewertung der Wirksamkeit der Risikomanagementmaßnahmen; (g) grundlegende Verfahren im Bereich der Cyberhygiene und Schulungen im Bereich der Cybersicherheit; (h) Konzepte und Verfahren für den Einsatz von Kryptographie und ggf. Verschlüsselung; (i) Sicherheit des Personals, Konzepte für die Zugriffskontrolle und Management von Anlagen; (j) Verwendung von Lösungen zur Multi-Faktor-Authentifizierung (MFA) oder kontinuierlichen Authentifizierung sowie gesicherte Sprach-, Video- und Textkommunikation. Die zuständigen Behörden können technische Leitlinien zu diesen Maßnahmen erlassen." },
    { "heading": "Art. 23 — Meldepflichten bei Sicherheitsvorfällen",
      "anchor":  "#art_23",
      "text":    "Artikel 23 regelt die gestaffelten Meldepflichten für erhebliche Sicherheitsvorfälle. Ein Vorfall gilt als erheblich, wenn er erhebliche Betriebsstörungen der Dienste oder finanzielle Verluste für die betreffende Einrichtung verursacht hat oder verursachen kann, oder wenn er andere natürliche oder juristische Personen durch erhebliche materielle oder immaterielle Schäden beeinträchtigt hat oder beeinträchtigen kann. Kriterien für die Erheblichkeit umfassen insbesondere die Anzahl betroffener Nutzerinnen und Nutzer, die Dauer des Vorfalls, die betroffene geografische Ausdehnung sowie das Ausmaß der Betriebsunterbrechung und der finanziellen Verluste. Das dreistufige Meldeverfahren sieht vor: (1) Frühwarnung an die zuständige CSIRT oder Behörde unverzüglich, spätestens innerhalb von 24 Stunden nach Bekanntwerden des erheblichen Vorfalls — die Frühwarnung gibt an, ob der Vorfall auf rechtswidrige oder böswillige Handlungen zurückzuführen ist und ob er grenzüberschreitende Auswirkungen hat; (2) Vorfallsmeldung unverzüglich, spätestens 72 Stunden nach Bekanntwerden, mit einer ersten Bewertung des Schweregrads, der Auswirkungen und ggf. der Kompromittierungsindikatoren; (3) Abschlussbericht spätestens einen Monat nach Übermittlung der Vorfallsmeldung, mit detaillierter Beschreibung des Vorfalls, der Art der Bedrohung, der ergriffenen Abhilfemaßnahmen sowie grenzüberschreitenden Auswirkungen. Bei andauernden Vorfällen ist zum Zeitpunkt der Einreichung des Abschlussberichts ein Fortschrittsbericht zu übermitteln; der Abschlussbericht folgt innerhalb eines Monats nach Abschluss der Vorfallsbearbeitung." }
  ]
  $JSON$::JSONB
);

-- ─────────────────────────────────────────────────────────────────────
-- DSA — Verordnung (EU) 2022/2065
-- ─────────────────────────────────────────────────────────────────────

SELECT pg_temp.seed_legal_doc(
  'eu', 'dsa', 'regulation', 'eur-lex',
  'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022R2065',
  'CELEX:32022R2065',
  'Digital Services Act — Verordnung (EU) 2022/2065',
  '2022-10-19',
  $JSON$
  [
    { "heading": "Art. 14 — Melde- und Abhilfemechanismus",
      "anchor":  "#art_14",
      "text":    "Artikel 14 DSA verpflichtet Anbieter von Hosting-Diensten, einen Mechanismus einzurichten, der es jeder natürlichen oder juristischen Person ermöglicht, dem Anbieter das Vorhandensein bestimmter Informationen in seinem Dienst zu melden, die die meldende Person als illegale Inhalte betrachtet. Dieser Mechanismus muss leicht zugänglich, benutzerfreundlich und eine elektronische Meldung ermöglichen. Meldungen müssen hinreichend präzise und ausreichend begründet sein; Anbieter können entsprechende strukturierte Formulare bereitstellen. Der Anbieter ist verpflichtet, eingegangene Meldungen zeitnah, nicht willkürlich und objektiv zu bearbeiten. Trifft der Anbieter auf Grundlage einer Meldung eine Entscheidung über die Entfernung, Sperrung oder sonstige Einschränkung der Verfügbarkeit der gemeldeten Informationen, hat er der betroffenen Person, die die Informationen bereitgestellt hat, seine Entscheidung einschließlich einer klaren und spezifischen Begründung mitzuteilen. Die Begründung muss insbesondere angeben, auf welche Vertragsbestimmungen oder gesetzlichen Grundlagen die Maßnahme gestützt wird. Betroffene Personen haben das Recht, die Entscheidung im Rahmen eines internen Beschwerdemechanismus (Art. 20) und ggf. durch außergerichtliche Streitbeilegung (Art. 21) anzufechten." },
    { "heading": "Art. 26 — Werbung auf Online-Plattformen",
      "anchor":  "#art_26",
      "text":    "Artikel 26 DSA legt Transparenzpflichten für Werbung auf Online-Plattformen fest. Anbieter von Online-Plattformen, die Werbung auf ihrer Benutzeroberfläche anzeigen, müssen sicherstellen, dass für jeden einzelnen Werbeinhalt in Echtzeit und in klarer, deutlicher und eindeutiger Weise erkennbar ist: (a) dass es sich um eine Werbung handelt; (b) im wessen Auftrag die Werbung geschaltet wird (natürliche oder juristische Person, die Werbetreibende); (c) wer für die Finanzierung der Werbung verantwortlich ist, sofern diese Person vom Werbetreibenden abweicht. Darüber hinaus untersagt Absatz 3 ausdrücklich die Anzeige von Werbung, die auf Profiling im Sinne der DSGVO basiert und dabei besondere Kategorien personenbezogener Daten nach Artikel 9 DSGVO verwendet — darunter Gesundheitsdaten, politische Meinungen, religiöse Überzeugungen oder sexuelle Orientierung. Ein weiteres ausdrückliches Verbot gilt für profilbasiertes Targeting Minderjähriger: Anbieter dürfen keine Werbung präsentieren, die auf der Profilerstellung natürlicher Personen beruht, wenn sie hinreichend sicher wissen oder vernünftigerweise davon ausgehen müssen, dass die betreffende Person minderjährig ist. Diese Regelungen ergänzen die allgemeinen Anforderungen der DSGVO und schaffen spezifische Schranken für werbefinanzierte Plattformmodelle." },
    { "heading": "Art. 34 — Risikobewertung für sehr große Online-Plattformen",
      "anchor":  "#art_34",
      "text":    "Artikel 34 DSA verpflichtet Anbieter sehr großer Online-Plattformen (VLOP — Very Large Online Platforms) und sehr großer Online-Suchmaschinen (VLOSE) zur Durchführung einer jährlichen Risikobewertung. Die Risikobewertung muss sämtliche systemischen Risiken erfassen, die von der Konzeption, dem Funktionieren oder der Nutzung des Dienstes in der Union ausgehen oder durch diese verstärkt werden. Der Anbieter muss dabei mindestens die folgenden Risikokategorien analysieren: (a) Verbreitung illegaler Inhalte über seinen Dienst; (b) tatsächliche oder vorhersehbare negative Auswirkungen auf die Ausübung von Grundrechten, insbesondere der Menschenwürde, der Meinungs- und Informationsfreiheit, des Datenschutzes, des Schutzes von Kindern sowie der Nichtdiskriminierung; (c) tatsächliche oder vorhersehbare negative Auswirkungen auf die gesellschaftliche Debatte, auf Wahlprozesse und die öffentliche Sicherheit; (d) tatsächliche oder vorhersehbare negative Auswirkungen im Zusammenhang mit geschlechtsspezifischer Gewalt oder dem Schutz der öffentlichen Gesundheit und Minderjähriger. Bei der Bewertung sind die Art und Schwere der systemischen Risiken zu berücksichtigen, die Wechselwirkungen zwischen der Funktionsweise von Empfehlungssystemen und den Risiken sowie die Reichweite und Tiefe der möglichen Schäden. Die Ergebnisse der Risikobewertung sind der Europäischen Kommission und dem zuständigen Digital Services Coordinator auf Anfrage zu übermitteln." },
    { "heading": "Art. 35 — Risikominderungsmaßnahmen",
      "anchor":  "#art_35",
      "text":    "Artikel 35 DSA verpflichtet Anbieter sehr großer Online-Plattformen und sehr großer Online-Suchmaschinen, angemessene, verhältnismäßige und wirksame Risikominderungsmaßnahmen zu ergreifen, die auf die nach Artikel 34 ermittelten systemischen Risiken zugeschnitten sind. Die Maßnahmen müssen den Grundrechten gebührend Rechnung tragen. Der nicht abschließende Katalog möglicher Maßnahmen umfasst: (a) Anpassung der Konzeption, der Merkmale oder des Betriebs des Dienstes, einschließlich Online-Benutzeroberflächen; (b) Anpassung der allgemeinen Nutzungsbedingungen und deren Durchsetzung; (c) Anpassung von algorithmischen Systemen, einschließlich Empfehlungssystemen; (d) Anpassung von Werbesystemen oder Maßnahmen zur Stärkung der Transparenz bei Werbung; (e) gezielte Maßnahmen zum Schutz der Rechte des Kindes, einschließlich Altersverifizierungsinstrumenten; (f) Stärkung der internen Prozesse oder Aufsicht, einschließlich der Schulung und technischen Kapazitäten; (g) Einleitung oder Anpassung von Kooperationsmaßnahmen mit vertrauenswürdigen Hinweisgebern; (h) Einleitung oder Anpassung der Zusammenarbeit mit anderen Plattformanbietern durch die in Artikel 45 genannten Verhaltenskodizes; (i) Notfallprotokolle zur Reaktion auf nicht vorhersehbare Risiken für die öffentliche Sicherheit oder die öffentliche Gesundheit, insbesondere in Krisensituationen. Die Wirksamkeit der ergriffenen Maßnahmen ist im Rahmen des jährlichen unabhängigen Audits nach Artikel 37 zu überprüfen." }
  ]
  $JSON$::JSONB
);

-- ─────────────────────────────────────────────────────────────────────
-- C2PA — Spezifikation v2.0
-- ─────────────────────────────────────────────────────────────────────

SELECT pg_temp.seed_legal_doc(
  'other', 'c2pa', 'standard', 'c2pa.org',
  'https://c2pa.org/specifications/specifications/2.0/spec/C2PA_Specification.html',
  'C2PA-SPEC-2.0',
  'C2PA-Spezifikation v2.0 — Content Credentials und Herkunftsnachweise',
  '2023-11-01',
  $JSON$
  [
    { "heading": "Sec. 2 — Kernkonzepte",
      "anchor":  "#core-concepts",
      "text":    "Die C2PA-Spezifikation v2.0 definiert ein standardisiertes Framework zur Herstellung von Herkunftsnachweisen (Content Credentials) für digitale Medieninhalte. Das zentrale Strukturelement ist das C2PA-Manifest: Es bündelt alle Assertions (strukturierte Metadaten), den Claim (die kryptographisch signierte Zusammenfassung der Assertions) und die digitale Signatur des Claim Generators. Assertions beschreiben Fakten über den Inhalt und seinen Erstellungsprozess — etwa verwendete Werkzeuge, Aufnahmedaten, beteiligte Personen oder vorgenommene Bearbeitungsschritte. Sie können als Hard Binding oder Soft Binding mit dem zugehörigen Asset verknüpft sein: Hard Bindings erzeugen einen kryptographischen Hash des Asset-Inhalts, sodass nachträgliche Manipulation erkennbar wird; Soft Bindings ermöglichen die Verknüpfung auch bei verlustbehafteten Transformationen (z.B. Resampling, Format-Konvertierung) über steganographische Wasserzeichen oder Fingerprinting. Der Claim Generator ist der Dienst oder das Werkzeug, das das Manifest erstellt und signiert; er haftet durch seine Signatur für die Richtigkeit der enthaltenen Assertions. Manifeste können in einer Manifest-Store-Kette verkettet werden, um die vollständige Bearbeitungshistorie eines Assets nachvollziehbar zu dokumentieren. Dieses Konzept bildet die technische Grundlage für die Anforderungen des EU AI Acts (Art. 50) zur Kennzeichnung KI-generierter Inhalte." },
    { "heading": "Sec. 7 — Signaturen und Vertrauensankerpunkte",
      "anchor":  "#signing",
      "text":    "Abschnitt 7 der C2PA-Spezifikation definiert die kryptographischen Anforderungen an Signaturen und die Verwaltung von Vertrauensankern. Claims werden mittels X.509-Zertifikaten signiert, die von einer C2PA-akkreditierten Zertifizierungsstelle (CA) ausgestellt wurden. Die C2PA pflegt eine Trust Anchor List (TAL), die die zugelassenen Wurzelzertifikate enthält; Verifizierer MÜSSEN die Gültigkeit der Signatur gegen diese Liste prüfen. Signaturen werden im COSE_Sign1-Format (RFC 9052) erstellt; als Algorithmen sind mindestens ES256 (ECDSA mit P-256 und SHA-256) und Ed25519 verpflichtend zu unterstützen. Zur Sicherstellung der Langzeitgültigkeit ist ein Zeitstempel-Dienst (TSA, RFC 3161) zu verwenden: Der TSA-Zeitstempel wird im Claim eingebettet und erlaubt die Verifikation auch nach Ablauf des Signaturzertifikats. Für die Langzeitvalidierung (LTV) sind OCSP-Responses oder CRL-Einträge innerhalb des Manifests zu speichern, damit die Validierungskette auch ohne Netzzugang oder nach Ablauf von OCSP-Responder-Diensten vollständig rekonstruierbar bleibt. Abgelaufene Zertifikate invalidieren eine Signatur nicht rückwirkend, sofern der TSA-Zeitstempel beweist, dass die Signatur zum Zeitpunkt der Erstellung gültig war. Für den Einsatz im Unternehmenskontext — etwa im RealSyncDynamics AI-Workflow — können organisationsinterne Intermediate-CAs in die TAL eingebunden werden, sofern die Root-CA C2PA-akkreditiert ist." },
    { "heading": "Sec. 13 — Datenschutz und Metadatenminimierung",
      "anchor":  "#privacy",
      "text":    "Abschnitt 13 der C2PA-Spezifikation adressiert den Schutz personenbezogener Daten und die Minimierung datenschutzrelevanter Metadaten in Assertions. Da Manifeste typischerweise dauerhaft mit dem Asset verbunden sind und öffentlich einsehbar sein können, schreibt die Spezifikation das Prinzip der Metadatenminimierung vor: Assertions sollen nur die für den jeweiligen Verwendungszweck unbedingt erforderlichen Informationen enthalten. Zur Durchsetzung dieses Grundsatzes definiert die Spezifikation einen Redaktions-Mechanismus (Redaction): Bestimmte Assertions können aus dem veröffentlichten Manifest entfernt werden, ohne die kryptographische Integrität des verbleibenden Manifests zu verletzen — der Claim enthält einen Hash-Baum, der nachweist, dass die Redaktion durch eine autorisierte Stelle vorgenommen wurde. Dieser Mechanismus ermöglicht es, datenschutzsensitive Assertions (z.B. GPS-Koordinaten, Gerätekennungen, Autorendaten) vor Weitergabe zu entfernen und gleichzeitig die Nachweisbarkeit der nicht redigierten Assertions zu erhalten. In Bezug auf das Recht auf Löschung nach Art. 17 DSGVO weist die Spezifikation auf eine technische Grenze hin: Einmal in einem öffentlich verteilten Asset eingebettete Manifeste können nicht vollständig zurückgerufen werden. Empfohlen wird daher, personenbezogene Daten entweder von vornherein aus Assertions auszuschließen oder nur in redizierbaren Assertions zu speichern; für Cloud-basierte Manifest-Stores kann ein Widerrufsregister (Revocation Registry) geführt werden, das verifizierende Anwendungen zur Prüfung anhalten soll." }
  ]
  $JSON$::JSONB
);

-- Cleanup — drop the helper. pg_temp objects are session-scoped so
-- this is cosmetic, but keeps the function out of post-migration psql
-- sessions during local development.
DROP FUNCTION IF EXISTS pg_temp.seed_legal_doc(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, JSONB
);
