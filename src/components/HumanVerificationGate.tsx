import { useState } from 'react';

/**
 * Human Verification Gate.
 *
 * Vor jedem Export/Download eines rechtlich relevanten Tool-Outputs
 * (AVV, DSFA, TOM, AI-Act-Klassifikation, Bußgeld-Simulation) blockiert
 * diese Komponente die Aktion bis zur expliziten User-Bestätigung.
 *
 * Strategischer Hintergrund: Reduziert Haftung deutlich gegenüber einem
 * passiven Footer-Disclaimer. Der User trägt aktiv bei zur Erkenntnis,
 * dass die Vorlage juristische Prüfung braucht.
 *
 * Inline-Styles, weil Tool-Pages kein Tailwind nutzen.
 */
export type HumanVerificationGateContext = 'avv' | 'dsfa' | 'tom' | 'classification' | 'simulation' | 'audit';

type Props = {
  context: HumanVerificationGateContext;
  /** Wenn User bestätigt hat — Aktion ausführen (z. B. PDF-Download triggern) */
  onProceed: () => void;
  /** Custom Button-Label (Default: kontextspezifisch) */
  proceedLabel?: string;
};

const CONTEXT_TEXT: Record<HumanVerificationGateContext, { title: string; bullets: string[]; checkbox: string; defaultLabel: string }> = {
  avv: {
    title: 'AVV-Vorlage exportieren',
    bullets: [
      'Automatisch generierte Vorlage auf Basis von Art. 28 DSGVO Standardklauseln',
      'Keine individuelle Rechtsberatung im Sinne des RDG',
      'Anpassung an konkrete Auftragsverarbeitung notwendig',
      'Juristische Prüfung vor Vertragsschluss empfohlen',
    ],
    checkbox: 'Ich verstehe, dass dieses Dokument vor produktivem Einsatz durch Anwalt oder DSB geprüft werden muss.',
    defaultLabel: 'AVV-Vorlage downloaden',
  },
  dsfa: {
    title: 'DSFA-Entwurf exportieren',
    bullets: [
      'Wizard-Output basierend auf Art. 35 DSGVO + EDPB-Leitlinien',
      'Final-Bewertung muss durch Verantwortlichen / DSB erfolgen',
      'Bei Hochrisiko-Verarbeitung: vorherige Konsultation der Aufsichtsbehörde nach Art. 36 erforderlich',
      'Erweiterung um konkrete TOMs und Risikoanalyse erforderlich',
    ],
    checkbox: 'Ich bestätige, dass die finale DSFA durch unseren DSB / Verantwortlichen erstellt wird und dieser Entwurf nur als strukturierte Vorlage dient.',
    defaultLabel: 'DSFA-Entwurf herunterladen',
  },
  tom: {
    title: 'TOM-Dokumentation exportieren',
    bullets: [
      'Vorlage nach Art. 32 DSGVO + ISO-27001-Mapping',
      'Tatsächliche Umsetzung muss vom IT-Verantwortlichen verifiziert werden',
      'Audit-Pflicht: regelmäßige Überprüfung und Aktualisierung',
    ],
    checkbox: 'Ich verstehe, dass die hier gelisteten Maßnahmen tatsächlich implementiert sein müssen — die Vorlage ersetzt keine Audit-Pflicht.',
    defaultLabel: 'TOM-Dokument herunterladen',
  },
  classification: {
    title: 'AI-Act-Klassifikation übernehmen',
    bullets: [
      'Vor-Klassifikation auf Basis Annex III + Art. 5/52 — keine bindende Conformity-Bewertung',
      'High-Risk-Bestätigung erfordert Notified-Body-Prüfung',
      'Use-Case-Kontext (Trainingsdaten, Einsatzbereich, Schutzgut) kann Auslegung ändern',
    ],
    checkbox: 'Ich verstehe, dass die finale AI-Act-Konformitätsbewertung nicht durch dieses Tool, sondern durch eine Notified Body bzw. anwaltliche Prüfung erfolgt.',
    defaultLabel: 'Klassifikation übernehmen',
  },
  simulation: {
    title: 'Bußgeld-Simulation übernehmen',
    bullets: [
      'Bandbreiten-Simulation auf Basis Art. 83 DSGVO + DSK-Bußgeld-Konzept',
      'Tatsächliche Bußgelder hängen von Aufsichtsbehörden-Ermessen ab',
      'Keine Vorhersage, keine Rechtsberatung',
    ],
    checkbox: 'Ich verstehe, dass dieser Wert nur eine Orientierungs-Bandbreite ist — verbindliche Bußgelder bestimmt ausschließlich die Aufsichtsbehörde.',
    defaultLabel: 'Simulation speichern',
  },
  audit: {
    title: 'Audit-Bericht exportieren',
    bullets: [
      'Statische Erstanalyse — kein vollständiges Datenschutz-Audit',
      'False Negatives bei Server-Side-Tracking, dynamischen Skripten oder verschachtelten Trackern möglich',
      'Manuelle Prüfung der gekennzeichneten Sektionen empfohlen',
    ],
    checkbox: 'Ich verstehe, dass dieser Bericht eine automatisierte Erstanalyse ist und kein vollständiges DSGVO-Audit ersetzt.',
    defaultLabel: 'Bericht exportieren',
  },
};

const wrapperStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #f59e0b',
  borderRadius: 8,
  padding: 18,
  margin: '16px 0',
};

const titleStyle: React.CSSProperties = {
  color: '#fef3c7',
  fontWeight: 700,
  fontSize: 15,
  margin: '0 0 10px 0',
};

const listStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  paddingLeft: 18,
  color: '#fcd34d',
  fontSize: 13,
  lineHeight: 1.6,
};

const checkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  marginBottom: 12,
};

const checkLabelStyle: React.CSSProperties = {
  color: '#e5e7eb',
  fontSize: 13,
  lineHeight: 1.5,
  cursor: 'pointer',
  userSelect: 'none',
};

const buttonStyleEnabled: React.CSSProperties = {
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '11px 22px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const buttonStyleDisabled: React.CSSProperties = {
  ...buttonStyleEnabled,
  background: '#374151',
  color: '#6b7280',
  cursor: 'not-allowed',
};

export function HumanVerificationGate({ context, onProceed, proceedLabel }: Props) {
  const text = CONTEXT_TEXT[context];
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div style={wrapperStyle}>
      <div style={titleStyle}>
        <span aria-hidden="true" style={{ marginRight: 6 }}>⚠️</span>
        {text.title} — manuelle Prüfung empfohlen
      </div>
      <ul style={listStyle}>
        {text.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div style={checkRowStyle}>
        <input
          type="checkbox"
          id={`hvg-${context}`}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={{ accentColor: '#dc2626', width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
        />
        <label htmlFor={`hvg-${context}`} style={checkLabelStyle}>
          {text.checkbox}
        </label>
      </div>
      <button
        type="button"
        disabled={!confirmed}
        onClick={() => confirmed && onProceed()}
        style={confirmed ? buttonStyleEnabled : buttonStyleDisabled}
      >
        {proceedLabel || text.defaultLabel}
      </button>
    </div>
  );
}
