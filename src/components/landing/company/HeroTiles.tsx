import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import { COMPANY_PRODUCTS, STATUS_DOT_CLASS, STATUS_TAG_CLASS, type CompanyProductId } from './companyProducts';
import type { ScenePointer } from './spaceSceneV5';

/** Gemeinsamer Zustand Seite ↔ Tafeln (Referenz: window.__mx/__my/__sy). */
export interface HeroFx {
  pointer: ScenePointer;
  /** Hero-Parallax aus dem Scroll-Handler: −min(y, vh)·0,32 */
  sy: number;
}

const ICONS: Record<CompanyProductId, ReactElement> = {
  governance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  voice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  ),
  builder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  ),
};

/** Mini-Animation je Tafel: Siegelkette / Wellenform / Seitenraster. */
function TileViz({ id }: { id: CompanyProductId }) {
  if (id === 'governance')
    return (
      <span className="tv seal" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    );
  if (id === 'voice')
    return (
      <span className="tv wv" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    );
  return (
    <span className="tv wf" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export interface HeroTilesProps {
  fx: HeroFx;
  /** Governance-Tafel: zum Abschnitt #p-os scrollen. */
  onGo: (e: ReactMouseEvent<HTMLAnchorElement>, id: string) => void;
  /** Voice/Builder: Dialog öffnen. */
  onOpen: (tab: number, trigger: HTMLElement) => void;
}

const BY = [5, 0, -5];

export function HeroTiles({ fx, onGo, onOpen }: HeroTilesProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  // Tiefe aus dem Hintergrund (klein/hinten → groß/vorn), gekoppelt an Maus + Scroll.
  useEffect(() => {
    const grp = groupRef.current;
    if (!grp || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tiles = Array.from(grp.querySelectorAll<HTMLElement>('.htile'));
    const S = tiles.map((el, i) => ({ el, d: 0, rx: 0, ry: 0, trx: 0, tr: 0, idle: i === 1 ? 0.82 : 0.74, ready: false }));
    const fine = matchMedia('(hover: hover)').matches;
    let hv = -1;
    let sy = 0;
    let last = performance.now();
    let raf = 0;
    const timeouts: number[] = [];
    const offs: Array<() => void> = [];
    const listen = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn);
      offs.push(() => el.removeEventListener(type, fn));
    };
    S.forEach((s, i) => timeouts.push(window.setTimeout(() => (s.ready = true), 250 + i * 230)));
    tiles.forEach((el, i) => {
      const on = () => {
        hv = i;
      };
      const off = () => {
        if (hv === i) {
          hv = -1;
          S[i].trx = 0;
          S[i].tr = 0;
        }
      };
      listen(el, 'pointerenter', on);
      listen(el, 'pointerleave', off);
      listen(el, 'focus', on);
      listen(el, 'blur', off);
      listen(el, 'pointermove', (e) => {
        if (!fine) return;
        const r = el.getBoundingClientRect();
        S[i].tr = ((e.clientX - r.left) / r.width - 0.5) * 14;
        S[i].trx = -((e.clientY - r.top) / r.height - 0.5) * 10;
        el.style.setProperty('--glx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        el.style.setProperty('--gly', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
        el.style.setProperty('--gla', '1');
      });
      listen(el, 'pointerleave', () => el.style.setProperty('--gla', '0'));
    });
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden || scrollY > innerHeight * 1.4) return;
      const k = 1 - Math.exp(-dt * 6.5), kt = 1 - Math.exp(-dt * 10);
      S.forEach((s, i) => {
        const tgt = !s.ready ? 0 : hv === i ? 1 : s.idle;
        s.d += (tgt - s.d) * k;
        s.rx += (s.trx - s.rx) * kt;
        s.ry += (s.tr - s.ry) * kt;
        const tt = now / 1000, fl = hv === i ? 0.25 : 1;
        const fx_ = Math.sin(tt * 0.6 + i * 2.1) * 7 * fl;
        const fy = Math.cos(tt * 0.5 + i * 1.7) * 6 * fl + sy * (0.8 + i * 0.18);
        const fz = Math.sin(tt * 0.42 + i * 1.3) * 22 * fl;
        const fr = Math.sin(tt * 0.35 + i * 2.6) * 2.2 * fl;
        const d = s.d, sc = 0.84 + 0.26 * d, z = -240 + 380 * d + fz;
        const tx = (1 - i) * (1 - d) * 26 + fx_, ty = (1 - d) * 46 + fy;
        const o = Math.max(0, Math.min(1, 0.15 + d * 1.25)), bl = Math.max(0, 0.45 - d) * 7;
        s.el.style.setProperty(
          '--t',
          `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${(s.ry + fr + BY[i] * (1 - d * 0.6)).toFixed(2)}deg) scale(${sc.toFixed(3)})`,
        );
        s.el.style.setProperty('--o', o.toFixed(3));
        s.el.style.setProperty('--f', bl > 0.15 ? `blur(${bl.toFixed(1)}px)` : 'none');
        s.el.style.zIndex = String(Math.round(d * 10));
      });
      sy += (fx.sy - sy) * k;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach((t) => window.clearTimeout(t));
      offs.forEach((f) => f());
    };
  }, [fx]);

  return (
    <div className="htiles" ref={groupRef}>
      {COMPANY_PRODUCTS.map((p, i) => {
        const inner = (
          <>
            <TileViz id={p.id} />
            <span className="ic">{ICONS[p.id]}</span>
            <b>{p.name}</b>
            <span className="hl">{p.headline}</span>
            <span className="pd">{p.description}</span>
            <span className={STATUS_TAG_CLASS[p.status]}>
              <i className={STATUS_DOT_CLASS[p.status]} aria-hidden="true" />
              {p.statusLabel}
            </span>
            <em className="try">{p.id === 'governance' ? 'Mehr erfahren →' : 'Ausprobieren →'}</em>
          </>
        );
        if (p.id === 'governance')
          return (
            <a
              key={p.id}
              className="htile"
              href={`#${p.anchor}`}
              data-product={p.id}
              data-testid={`product-tile-${p.id}`}
              onClick={(e) => onGo(e, p.anchor)}
            >
              {inner}
            </a>
          );
        return (
          <button
            key={p.id}
            // Anker für Deep-Links (#voice-agent, #sites); der Dialog öffnet über den Hash.
            id={p.anchor}
            type="button"
            className="htile"
            data-product={p.id}
            aria-haspopup="dialog"
            data-testid={`product-tile-${p.id}`}
            onClick={(e) => onOpen(i, e.currentTarget)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
