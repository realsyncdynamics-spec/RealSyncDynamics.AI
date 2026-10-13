import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n/useLang';
import { evidenceEngine, type ChainBlock, type Verdict } from './evidenceEngine';
import '../../../styles/evidence-engine.css';

const DEMO_EVENTS: Array<{ system: string; verdict: Verdict; rule: string; message: string }> = [
  { system: 'support-agent', verdict: 'block', rule: 'no-customer-data-external', message: 'Kundendaten an externes Modell blockiert' },
  { system: 'finance-agent', verdict: 'require_approval', rule: 'payment-threshold', message: 'Zahlung an neuen Lieferanten — Freigabe erforderlich' },
  { system: 'code-assistant', verdict: 'allow', rule: 'repo-scope', message: 'PR-Beschreibung im erlaubten Scope' },
];

export function EvidenceEngine() {
  const { t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blocks, setBlocks] = useState<readonly ChainBlock[]>([]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = evidenceEngine.subscribe(() => {
      setBlocks([...evidenceEngine.getChain()]);
    });
    setBlocks([...evidenceEngine.getChain()]);
    return unsub;
  }, []);

  // Simple canvas backdrop (Policy Gate visual)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.5, 40 + i * 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  async function addDemo() {
    setBusy(true);
    const next = DEMO_EVENTS[blocks.length % DEMO_EVENTS.length];
    await evidenceEngine.push({ ...next, ts: Date.now() });
    setVerified(null);
    setBusy(false);
  }

  async function onVerify() {
    setBusy(true);
    const ok = await evidenceEngine.verify();
    setVerified(ok);
    setBusy(false);
  }

  async function onTamper() {
    setBusy(true);
    await evidenceEngine.tamperLast();
    setVerified(null);
    setBusy(false);
  }

  return (
    <section id="evidence" className="ee" aria-labelledby="ee-title">
      <div className="ee__wrap">
        <div className="ee__head">
          <p className="ee__kicker">Evidence Engine</p>
          <h2 id="ee-title" className="ee__h2">
            {t('v4HeroTitleA') /* fallback reuse */ || 'Nachweise, die sich nicht nachträglich ändern lassen.'}
          </h2>
          <p className="ee__lede">
            Jede Entscheidung wird per SHA-256 mit ihrem Vorgänger verkettet. Manipulation wird sofort sichtbar.
          </p>
        </div>

        <div className="ee__stage">
          <canvas ref={canvasRef} className="ee__canvas" width={640} height={320} aria-hidden="true" />
          <div className="ee__controls">
            <button type="button" className="ee__btn" onClick={addDemo} disabled={busy}>
              Entscheidung hinzufügen
            </button>
            <button type="button" className="ee__btn" onClick={onVerify} disabled={busy || !blocks.length}>
              Verifizieren
            </button>
            <button type="button" className="ee__btn ee__btn--ghost" onClick={onTamper} disabled={busy || !blocks.length}>
              Manipulation simulieren
            </button>
            {verified !== null && (
              <span className={`ee__status ${verified ? 'is-ok' : 'is-bad'}`}>
                {verified ? 'Kette intakt' : 'Manipulation erkannt'}
              </span>
            )}
          </div>
        </div>

        <ol className="ee__chain" aria-label="Evidence Chain">
          {blocks.map((b) => (
            <li key={b.index} className="ee__block">
              <div className="ee__block-head">
                <span>BLOCK {b.index}</span>
                <span className={`ee__verdict is-${b.event.verdict}`}>{b.event.verdict}</span>
              </div>
              <p className="ee__block-title">{b.event.system} · {b.event.message}</p>
              <dl className="ee__hash">
                <dt>rule</dt>
                <dd>{b.event.rule}</dd>
                <dt>hash</dt>
                <dd>{b.hash.slice(0, 16)}…</dd>
                <dt>prev</dt>
                <dd>{b.prev.slice(0, 16)}…</dd>
              </dl>
            </li>
          ))}
          {!blocks.length && <li className="ee__empty">Noch keine Einträge. Entscheidung hinzufügen oder live über window.RealSyncEvidence.push.</li>}
        </ol>
      </div>
    </section>
  );
}
