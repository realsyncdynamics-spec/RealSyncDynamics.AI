import { motion, useReducedMotion } from 'framer-motion';

const steps = [
  { label: 'Anfrage', event: 'KI-Aktion erfasst' },
  { label: 'Richtlinie', event: 'Berechtigung geprüft' },
  { label: 'Entscheidung', event: 'Aktion freigegeben' },
  { label: 'Nachweis', event: 'Prüfergebnis protokolliert' },
];

export function RuntimeCanvasSection() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="runtime-canvas"
      aria-labelledby="runtime-canvas-title"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduceMotion ? 0 : 0.35 }}
      style={{ padding: 'clamp(36px,5vw,100px) var(--px)', borderTop: '1px solid var(--rs-line)' }}
    >
      <div style={{ maxWidth: 'var(--wrap)', margin: '0 auto' }}>
        <h2 id="runtime-canvas-title">Wie die Governance Runtime entscheidet</h2>
        <p>Beispielablauf mit simulierten Ereignissen</p>
        <svg viewBox="0 0 360 48" width="360" height="48" aria-hidden="true" style={{ maxWidth: '100%' }}>
          <path d="M20 24h320" stroke="var(--rs-line)" strokeWidth="2" />
          {steps.map(({ label }, index) => (
            <circle key={label} cx={20 + index * (320 / 3)} cy="24" r="7" fill="var(--rs-acc)" />
          ))}
        </svg>
        <ol style={{ display: 'grid', gap: '8px', maxWidth: '42rem', paddingInlineStart: '1.5rem' }}>
          {steps.map(({ label, event }) => (
            <li key={label}><strong>{label}</strong> · {event}</li>
          ))}
        </ol>
      </div>
    </motion.section>
  );
}
