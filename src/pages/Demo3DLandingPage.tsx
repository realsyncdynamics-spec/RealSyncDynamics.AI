/**
 * RealSyncDynamics.AI – Interaktive 3D-Landingpage (Template-Demo)
 * Route: /demo/3d-landingpage (src/App.tsx), Einstieg über Landing v6, Abschnitt „Websites“
 *
 * - Three.js-Szene wird erst bei Bedarf geladen (dynamischer Import → eigener Chunk)
 * - Kein Scroll-Jacking: die Seite scrollt normal, die Kamera liest nur die Position
 * - WebGL-Fallback und "Ohne 3D"-Alternative, Reduced Motion, Tastaturbedienung
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { SceneConfig, SceneHandle, ProjectedHotspot, LightMood, BackgroundStyle } from '../components/visual/demo-3d/archScene';
import { isWebGLAvailable, detectQuality, type QualityTier } from '../components/visual/demo-3d/capabilities';
import { COMPANY, HOTSPOTS, SECTIONS } from '../components/visual/demo-3d/content';
import '../components/visual/demo-3d/demo3d.css';

export interface Demo3DLandingPageProps {
  /** Ziel für „Eigene Landingpage erstellen“. Ohne Wert wird der CTA als „folgt“ gekennzeichnet. */
  builderHref?: string;
  /** Zurück zur Produktseite */
  backHref?: string;
}

const DEFAULT_CONFIG: SceneConfig = {
  primaryColor: '#22d3ee',
  lightMood: 'abend',
  rotationSpeed: 0.6,
  background: 'tiefblau',
};

const COLOR_PRESETS = [
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Gold', value: '#f5b84b' },
  { name: 'Koralle', value: '#ff6b5e' },
  { name: 'Mint', value: '#5ee6a8' },
  { name: 'Violett', value: '#a78bfa' },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

export default function Demo3DLandingPage({ builderHref, backHref }: Demo3DLandingPageProps) {
  const reducedPref = usePrefersReducedMotion();
  const [webgl] = useState(() => (typeof window === 'undefined' ? false : isWebGLAvailable()));
  const [use3D, setUse3D] = useState(true);
  const [config, setConfig] = useState<SceneConfig>(DEFAULT_CONFIG);
  const [headline, setHeadline] = useState('Architektur, die man betreten kann.');
  const [projected, setProjected] = useState<ProjectedHotspot[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // ?qualitaet=hoch|mittel|niedrig legt die Stufe fest (z. B. für Bildschirmaufnahmen) und schaltet die Automatik ab.
  const [forcedQuality] = useState<QualityTier | null>(() => {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('qualitaet');
    return q === 'hoch' ? 'high' : q === 'mittel' ? 'medium' : q === 'niedrig' ? 'low' : null;
  });
  const [quality, setQuality] = useState<QualityTier>(() =>
    typeof window === 'undefined' ? 'medium' : (forcedQuality ?? detectQuality()),
  );
  const [sceneState, setSceneState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const show3D = webgl && use3D;

  // Aktueller Stand für den asynchronen Szenenstart: Änderungen während des Ladens gehen nicht verloren.
  const latest = useRef({ config, reducedPref, openId });
  useEffect(() => {
    latest.current = { config, reducedPref, openId };
  });

  // Szene lazy laden und sauber aufräumen
  useEffect(() => {
    if (!show3D || !stageRef.current) return;
    let cancelled = false;
    setSceneState('loading');
    import('../components/visual/demo-3d/archScene')
      .then(({ createArchScene }) => {
        if (cancelled || !stageRef.current) return;
        handleRef.current = createArchScene({
          container: stageRef.current,
          config: latest.current.config,
          hotspots: HOTSPOTS,
          reducedMotion: latest.current.reducedPref,
          quality,
          lockQuality: forcedQuality !== null,
          onHotspots: setProjected,
          onQualityChange: setQuality,
        });
        handleRef.current.focusHotspot(latest.current.openId);
        setSceneState('ready');
      })
      .catch(() => !cancelled && setSceneState('error'));
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
      setProjected([]);
    };
    // config/quality bewusst nicht als Abhängigkeit: Änderungen laufen über setConfig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show3D]);

  useEffect(() => handleRef.current?.setConfig(config), [config]);
  useEffect(() => handleRef.current?.setReducedMotion(reducedPref), [reducedPref]);
  useEffect(() => handleRef.current?.focusHotspot(openId), [openId]);

  // Scroll-Fortschritt (passiv, ohne Scroll-Jacking)
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / total));
      handleRef.current?.setScrollProgress(p);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sceneState]);

  const openHotspot = useCallback((id: string, trigger: HTMLElement | null) => {
    lastTriggerRef.current = trigger;
    setOpenId(id);
  }, []);
  const closeHotspot = useCallback(() => {
    setOpenId(null);
    requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);

  // Esc schließt Karte bzw. Panel; Fokus in die Karte setzen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Fokus bleibt im geöffneten Detaildialog (aria-modal)
      if (e.key === 'Tab' && openId && dialogRef.current) {
        const items = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
        );
        const first = items[0] ?? dialogRef.current;
        const last = items[items.length - 1] ?? dialogRef.current;
        const cur = document.activeElement;
        const inside = cur instanceof Node && dialogRef.current.contains(cur);
        if (e.shiftKey ? !inside || cur === first || cur === dialogRef.current : !inside || cur === last) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (e.key !== 'Escape') return;
      if (openId) closeHotspot();
      else if (panelOpen) setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, panelOpen, closeHotspot]);
  useEffect(() => {
    if (openId) dialogRef.current?.focus();
  }, [openId]);

  const active = HOTSPOTS.find((h) => h.id === openId);
  const set = <K extends keyof SceneConfig>(k: K, v: SceneConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));

  return (
    <div
      ref={rootRef}
      className={`rsd3d rsd3d--bg-${config.background}`}
      style={{ ['--rsd3d-primary' as string]: config.primaryColor }}
    >
      {/* Bühne: sticky, damit die Inhalte darüber normal scrollen */}
      <div className="rsd3d-stage-wrap">
        {show3D ? (
          <div ref={stageRef} className="rsd3d-stage">
            {sceneState === 'loading' && <div className="rsd3d-loading">3D-Szene wird geladen …</div>}
            {sceneState === 'error' && <div className="rsd3d-loading">3D konnte nicht geladen werden.</div>}
            {projected.map((p) => {
              const h = HOTSPOTS.find((x) => x.id === p.id)!;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`rsd3d-hotspot${openId === p.id ? ' is-active' : ''}`}
                  style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
                  hidden={!p.visible}
                  aria-label={`Detail öffnen: ${h.label}`}
                  aria-haspopup="dialog"
                  aria-expanded={openId === p.id}
                  onClick={(e) => openHotspot(p.id, e.currentTarget)}
                >
                  <span className="rsd3d-hotspot-dot" />
                  <span className="rsd3d-hotspot-label">{h.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rsd3d-fallback-art" role="img" aria-label="Stilisierte Darstellung eines modernen Gebäudes">
            <div className="rsd3d-fb-slab s1" />
            <div className="rsd3d-fb-slab s2" />
            <div className="rsd3d-fb-slab s3" />
            <div className="rsd3d-fb-slab s4" />
          </div>
        )}
      </div>

      {/* Inhalt */}
      <div className="rsd3d-content">
        <header className="rsd3d-topbar">
          <div className="rsd3d-brand">
            <span className="rsd3d-logo" aria-hidden="true" />
            {COMPANY.name}
          </div>
          <div className="rsd3d-topbar-right">
            <span className="rsd3d-badge" title="Fiktives Unternehmen – Template-Demo von RealSyncDynamics.AI">
              Demo · fiktives Unternehmen
            </span>
            {backHref && (
              <a className="rsd3d-link" href={backHref}>
                ← Zurück
              </a>
            )}
          </div>
        </header>

        <section className="rsd3d-hero" aria-labelledby="rsd3d-h1">
          <p className="rsd3d-kicker">{COMPANY.tagline}</p>
          <h1 id="rsd3d-h1" className="rsd3d-h1">
            {headline || ' '}
          </h1>
          <p className="rsd3d-lead">
            Ziehe das Modell, scrolle und klicke auf die Markierungen. Diese Seite läuft vollständig im Browser.
          </p>
          <div className="rsd3d-cta-row">
            <a className="rsd3d-btn rsd3d-btn--primary" href="#rsd3d-raum">
              Projekt entdecken
            </a>
            <button type="button" className="rsd3d-btn" onClick={() => setPanelOpen(true)} aria-controls={panelId}>
              Design anpassen
            </button>
          </div>
          {!webgl && (
            <p className="rsd3d-note" role="status">
              Dein Browser unterstützt kein WebGL. Du siehst die bedienbare Version ohne 3D.
            </p>
          )}
        </section>

        {SECTIONS.map((s) => (
          <section key={s.id} id={`rsd3d-${s.id}`} className="rsd3d-section" aria-labelledby={`rsd3d-${s.id}-h`}>
            <div className="rsd3d-card">
              <p className="rsd3d-kicker">{s.kicker}</p>
              <h2 id={`rsd3d-${s.id}-h`}>{s.title}</h2>
              <p>{s.text}</p>
            </div>
          </section>
        ))}

        {/* Bedienbare Alternative ohne 3D: alle Details als Liste */}
        <section className="rsd3d-section rsd3d-section--list" aria-labelledby="rsd3d-details-h">
          <div className="rsd3d-card rsd3d-card--wide">
            <p className="rsd3d-kicker">Details</p>
            <h2 id="rsd3d-details-h">Alle Projektdetails</h2>
            <ul className="rsd3d-detail-list">
              {HOTSPOTS.map((h) => (
                <li key={h.id}>
                  <button type="button" className="rsd3d-detail-btn" onClick={(e) => openHotspot(h.id, e.currentTarget)}>
                    <strong>{h.label}</strong>
                    <span>{h.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rsd3d-final" aria-labelledby="rsd3d-final-h">
          <h2 id="rsd3d-final-h">Diese Landingpage ist eine echte Website.</h2>
          <p>
            Erstellt als Template-Demo mit RealSyncDynamics.AI. Die automatische Erstellung solcher 3D-Seiten im Builder ist{' '}
            <strong>geplant</strong>.
          </p>
          <div className="rsd3d-cta-row rsd3d-cta-row--center">
            {builderHref ? (
              <a className="rsd3d-btn rsd3d-btn--primary" href={builderHref}>
                Eigene Landingpage erstellen
              </a>
            ) : (
              <span className="rsd3d-btn rsd3d-btn--disabled" aria-disabled="true">
                Eigene Landingpage erstellen · Verknüpfung folgt
              </span>
            )}
          </div>
          <p className="rsd3d-small">Darstellung: Qualitätsstufe {quality === 'high' ? 'hoch' : quality === 'medium' ? 'mittel' : 'niedrig'}{reducedPref ? ' · reduzierte Bewegung aktiv' : ''}</p>
        </section>
      </div>

      {/* Drehen per Button (Tastatur- und Touch-Alternative zum Ziehen) */}
      {show3D && sceneState === 'ready' && (
        <div className="rsd3d-rotate" role="group" aria-label="Modell drehen">
          <button type="button" aria-label="Modell nach links drehen" onClick={() => handleRef.current?.rotateBy(-Math.PI / 6)}>
            <span aria-hidden="true">↺</span>
          </button>
          <button type="button" aria-label="Modell nach rechts drehen" onClick={() => handleRef.current?.rotateBy(Math.PI / 6)}>
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      )}

      {/* Konfigurator */}
      <button
        type="button"
        className="rsd3d-fab"
        aria-expanded={panelOpen}
        aria-controls={panelId}
        onClick={() => setPanelOpen((o) => !o)}
      >
        {panelOpen ? 'Schließen' : 'Anpassen'}
      </button>
      <aside id={panelId} className={`rsd3d-panel${panelOpen ? ' is-open' : ''}`} aria-label="Design anpassen" hidden={!panelOpen}>
        <h2 className="rsd3d-panel-h">Live anpassen</h2>

        <label className="rsd3d-field">
          <span>Überschrift</span>
          <input type="text" value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} />
        </label>

        <fieldset className="rsd3d-field">
          <legend>Primärfarbe</legend>
          <div className="rsd3d-swatches">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`rsd3d-swatch${config.primaryColor === c.value ? ' is-active' : ''}`}
                style={{ background: c.value }}
                aria-label={c.name}
                aria-pressed={config.primaryColor === c.value}
                onClick={() => set('primaryColor', c.value)}
              />
            ))}
            <input
              type="color"
              aria-label="Eigene Farbe"
              value={config.primaryColor}
              onChange={(e) => set('primaryColor', e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="rsd3d-field">
          <legend>Lichtstimmung</legend>
          <div className="rsd3d-seg">
            {(['tag', 'abend', 'nacht'] as LightMood[]).map((v) => (
              <button key={v} type="button" aria-pressed={config.lightMood === v} onClick={() => set('lightMood', v)}>
                {v === 'tag' ? 'Tag' : v === 'abend' ? 'Abend' : 'Nacht'}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="rsd3d-field">
          <span>
            Rotation <output>{config.rotationSpeed.toFixed(1)}×</output>
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={config.rotationSpeed}
            onChange={(e) => set('rotationSpeed', Number(e.target.value))}
          />
        </label>

        <fieldset className="rsd3d-field">
          <legend>Hintergrund</legend>
          <div className="rsd3d-seg">
            {(['tiefblau', 'anthrazit', 'hell'] as BackgroundStyle[]).map((v) => (
              <button key={v} type="button" aria-pressed={config.background === v} onClick={() => set('background', v)}>
                {v === 'tiefblau' ? 'Tiefblau' : v === 'anthrazit' ? 'Anthrazit' : 'Hell'}
              </button>
            ))}
          </div>
        </fieldset>

        {webgl && (
          <label className="rsd3d-toggle">
            <input type="checkbox" checked={!use3D} onChange={(e) => setUse3D(!e.target.checked)} />
            <span>Ohne 3D anzeigen</span>
          </label>
        )}
        <button type="button" className="rsd3d-btn rsd3d-btn--ghost" onClick={() => { setConfig(DEFAULT_CONFIG); setHeadline('Architektur, die man betreten kann.'); }}>
          Zurücksetzen
        </button>
      </aside>

      {/* Detailkarte */}
      {active && (
        <div className="rsd3d-dialog-backdrop" onClick={closeHotspot}>
          <div
            ref={dialogRef}
            className="rsd3d-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rsd3d-dialog-h"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="rsd3d-kicker">{active.label}</p>
            <h2 id="rsd3d-dialog-h">{active.title}</h2>
            <p>{active.text}</p>
            <ul>
              {active.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button type="button" className="rsd3d-btn rsd3d-btn--primary" onClick={closeHotspot}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
