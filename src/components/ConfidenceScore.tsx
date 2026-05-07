/**
 * Confidence-Score-Indikator für Tool-Outputs.
 *
 * 3-Stufen-Badge (High / Medium / Low) mit optionaler Liste flagged
 * Sektionen, die manuelle Prüfung benötigen. Konsistent mit
 * /legal/methodology Sektion „Confidence-Indikator".
 *
 * Inline-Styles, weil Tool-Pages kein Tailwind nutzen.
 */
type Level = 'high' | 'medium' | 'low';

type Props = {
  /** Numerischer Score 0-100 */
  score: number;
  /** Optionale Sektionen die manuelle Prüfung benötigen */
  flags?: string[];
  /** Optional: Methodology-Version (z. B. "audit:2026.05.0") */
  methodologyVersion?: string;
  /** Compact-Mode: nur Pill, keine Erklärung */
  compact?: boolean;
};

function levelFromScore(score: number): Level {
  if (score >= 85) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

const LEVEL_META: Record<Level, { label: string; bg: string; border: string; text: string; explanation: string }> = {
  high: {
    label: 'High',
    bg: '#0a2818',
    border: '#16a34a',
    text: '#86efac',
    explanation: 'Eindeutige Regel-Übereinstimmung mit primären Quellen',
  },
  medium: {
    label: 'Medium',
    bg: '#3b2a00',
    border: '#f59e0b',
    text: '#fcd34d',
    explanation: 'Wahrscheinliche Übereinstimmung — Kontext kann Auslegung ändern',
  },
  low: {
    label: 'Low',
    bg: '#3b1515',
    border: '#dc2626',
    text: '#fca5a5',
    explanation: 'Mehrere Auslegungs-Möglichkeiten — manuelle Prüfung dringend',
  },
};

export function ConfidenceScore({ score, flags, methodologyVersion, compact }: Props) {
  const level = levelFromScore(score);
  const meta = LEVEL_META[level];

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: compact ? '3px 8px' : '4px 10px',
    background: meta.bg,
    border: `1px solid ${meta.border}`,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: meta.text,
  };

  if (compact) {
    return (
      <span style={pillStyle} title={`Confidence ${score}/100 · ${meta.explanation}`}>
        {meta.label} · {Math.round(score)}
      </span>
    );
  }

  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #1f2937',
        borderRadius: 8,
        padding: '12px 14px',
        margin: '8px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={pillStyle}>
          Confidence: {meta.label}
        </span>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>
          Score {Math.round(score)} / 100 · {meta.explanation}
        </span>
      </div>
      {flags && flags.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: '#fcd34d', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Manuelle Prüfung empfohlen für:
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, color: '#d1d5db', fontSize: 12, lineHeight: 1.5 }}>
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {methodologyVersion && (
        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>
          Methodology: {methodologyVersion} ·{' '}
          <a href="/legal/methodology" style={{ color: '#9ca3af', textDecoration: 'underline' }}>
            wie wir bewerten
          </a>
        </div>
      )}
    </div>
  );
}
