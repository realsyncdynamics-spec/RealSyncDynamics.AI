import { useEffect, useRef } from 'react';
import './GovernanceGlobe.css';

// Knotenpunkte des Governance-Netzes (Prozentkoordinaten im 100x100-Viewport)
// und ihre Verbindungen. Rein dekorativ — die Grafik traegt aria-hidden.
const nodes = [
  { x: 27, y: 34, r: 1.8 }, { x: 42, y: 22, r: 1.4 }, { x: 56, y: 31, r: 2.1 },
  { x: 68, y: 24, r: 1.5 }, { x: 77, y: 40, r: 1.9 }, { x: 63, y: 51, r: 1.3 },
  { x: 48, y: 48, r: 2.2 }, { x: 35, y: 55, r: 1.5 }, { x: 58, y: 67, r: 1.8 },
  { x: 73, y: 63, r: 1.4 }, { x: 42, y: 73, r: 1.2 }, { x: 29, y: 63, r: 1.7 },
];
const links = [[0,1],[1,2],[2,3],[2,6],[3,4],[4,5],[5,6],[6,7],[6,8],[7,11],[8,9],[8,10],[10,11],[1,6],[2,5],[4,9]];

export default function GlobeVisual() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Wer reduzierte Bewegung eingestellt hat, bekommt auch keine Zeiger-
    // Parallaxe — das CSS neutralisiert sie zwar optisch, der Listener liefe
    // aber weiter und schriebe bei jeder Mausbewegung in den Stil.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      el.style.setProperty('--mx', `${pending.x * 14}deg`);
      el.style.setProperty('--my', `${pending.y * -10}deg`);
      pending = null;
    };

    // mousemove feuert deutlich oefter als der Bildschirm zeichnet; ohne die
    // rAF-Drosselung erzwaenge jeder Event ein Style-Recalc auf einem Element
    // mit 3D-Transform und Blur — messbar teuer im LCP-kritischen Hero.
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      pending = { x: (e.clientX - r.left) / r.width - .5, y: (e.clientY - r.top) / r.height - .5 };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="rs-governance-globe" aria-hidden="true">
    <div className="rs-globe-halo"/><div className="rs-globe-orbit rs-orbit-a"/><div className="rs-globe-orbit rs-orbit-b"/><div className="rs-globe-orbit rs-orbit-c"/>
    <div className="rs-globe-sphere"><div className="rs-globe-grid rs-grid-a"/><div className="rs-globe-grid rs-grid-b"/><div className="rs-globe-light"/>
      <svg viewBox="0 0 100 100" className="rs-globe-network"><defs><linearGradient id="rs-flow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#22d3ee" stopOpacity=".04"/><stop offset=".5" stopColor="#a5f3fc" stopOpacity="1"/><stop offset="1" stopColor="#22d3ee" stopOpacity=".04"/></linearGradient></defs>
      {links.map(([a,b],i)=>{const p=nodes[a],q=nodes[b];return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="rs-network-line" style={{animationDelay:`${i*90}ms`}}/>})}
      {nodes.map((n,i)=><g key={i} className="rs-network-node" style={{animationDelay:`${i*170}ms`}}><circle cx={n.x} cy={n.y} r={n.r*2.8} className="rs-node-pulse" style={{animationDelay:`${i*210}ms`}}/><circle cx={n.x} cy={n.y} r={n.r} className="rs-node-core"/></g>)}
      </svg>
    </div>
    <div className="rs-globe-scan"/><div className="rs-globe-label rs-label-ai">AI AGENTS</div><div className="rs-globe-label rs-label-api">API / WORKFLOW</div><div className="rs-globe-label rs-label-evidence">EVIDENCE</div><div className="rs-globe-label rs-label-policy">POLICY</div>
  </div>;
}
