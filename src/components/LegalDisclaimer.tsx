/**
 * Haftungsausschluss-Banner für alle Self-Service-Tools, die rechtlich
 * relevante Dokumente generieren oder Risiko-Klassifikationen ausgeben.
 *
 * Inline-styles, weil die Tool-Seiten kein Tailwind nutzen.
 */
type Props = {
  context?: 'document' | 'classification' | 'calculator' | 'audit';
};

const CONTEXT_TEXT: Record<NonNullable<Props['context']>, { title: string; body: string }> = {
  document: {
    title: 'Automatisiert generierte Vorlage — kein Anwalts-Ersatz',
    body: 'Die hier generierten Dokumente sind Mustertexte. Sie ersetzen keine individuelle Rechtsberatung. Vor produktiver Verwendung empfohlen: Prüfung durch Fachanwalt für IT-Recht / externen Datenschutzbeauftragten. Wir übernehmen keine Gewähr für die Wirksamkeit der Vertragsklauseln im Einzelfall.',
  },
  classification: {
    title: 'Vorläufige Einschätzung — keine verbindliche Rechtsauskunft',
    body: 'Die automatisierte Klassifikation ist eine erste Orientierung. Die finale Einstufung nach EU AI Act / DSGVO Art. 35 hängt vom konkreten Use-Case, Trainingsdaten, Einsatzkontext und Schutzgut ab. Bei grenzwertigen Fällen ist eine manuelle Prüfung durch Fachanwalt oder Notified Body zwingend.',
  },
  calculator: {
    title: 'Bandbreiten-Schätzung — keine Bußgeld-Vorhersage',
    body: 'Art. 83 DSGVO sieht keinen festen Bußgeld-Tarif vor. Tatsächliche Bußgelder hängen u. a. von Schwere, Vorsatz, Kooperation, Vorerfahrung, Anzahl Betroffener und mildernden Umständen ab (Art. 83 Abs. 2 DSGVO). Dieser Rechner liefert nur eine grobe Bandbreite zur Orientierung. Verbindliche Beträge bestimmt ausschließlich die zuständige Aufsichtsbehörde.',
  },
  audit: {
    title: 'Automatisierte Erstanalyse — kein vollständiges Audit',
    body: 'Der Scan prüft öffentlich einsehbare Pflichtangaben, Cookie-Banner-Verhalten und HTTP-Header. Er ersetzt kein vollständiges DSGVO-Audit (VVT, AVV-Bestand, TOMs, DSFA, Sub-Processor-Bewertung, Mitarbeiter-Schulungen). False Negatives bei Server-Side-Tracking oder verschachtelten Trackern möglich.',
  },
};

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  background: '#3b2a00',
  border: '1px solid #f59e0b',
  borderRadius: 8,
  padding: '12px 14px',
  margin: '0 0 18px 0',
};

const iconStyle: React.CSSProperties = {
  flexShrink: 0,
  marginTop: 1,
  fontSize: 16,
  lineHeight: 1,
};

const textStyle: React.CSSProperties = {
  color: '#fcd34d',
  fontSize: 13,
  lineHeight: 1.5,
};

const titleStyle: React.CSSProperties = {
  display: 'block',
  color: '#fef3c7',
  fontWeight: 700,
  marginBottom: 4,
};

export function LegalDisclaimer({ context = 'document' }: Props) {
  const text = CONTEXT_TEXT[context];
  return (
    <div style={wrapperStyle}>
      <span style={iconStyle} aria-hidden="true">⚠️</span>
      <div style={textStyle}>
        <strong style={titleStyle}>{text.title}</strong>
        <span>{text.body}</span>
      </div>
    </div>
  );
}
