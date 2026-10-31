import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { CosmosGeographicGlobe } from '../components/visual/CosmosGeographicGlobe';
import { CosmosWalkableWorld } from '../components/visual/CosmosWalkableWorld';
import { CosmosTexturedBody } from '../components/visual/CosmosTexturedBody';
import {
  clampPlanetScale, scaledRadius, ORIGINAL_TEXTURE_ATTRIBUTION,
} from '../components/visual/cosmosOriginalTextures';
import {
  CELESTIAL_BODIES,
  clampSimulationSpeed,
  orbitPosition,
  type PlanetId,
} from '../components/visual/cosmosData';

type Focus = { center: [number, number, number]; distance: number };
type Planet = (typeof CELESTIAL_BODIES)[number];
const OVERVIEW: Focus = { center: [0, 0, 0], distance: 52 };
const PLANET_FACTS: Record<PlanetId | 'sun', string> = {
  sun: 'Die Sonne ist der Stern im Zentrum unseres Sonnensystems.',
  mercury: 'Merkur ist der kleinste und sonnennächste Planet.',
  venus: 'Venus besitzt eine dichte Atmosphäre und eine heiße Oberfläche.',
  earth: 'Die Erde besitzt Ozeane und erlaubt im geografischen Modus Ortsanflüge.',
  mars: 'Der rote Planet besitzt Vulkane und Polkappen.',
  jupiter: 'Jupiter ist der größte Planet unseres Sonnensystems.',
  saturn: 'Saturn besitzt ein weit ausgedehntes Ringsystem.',
  uranus: 'Uranus ist ein Eisriese mit stark geneigter Rotationsachse.',
  neptune: 'Neptun ist ein ferner Eisriese mit dynamischen Wettersystemen.',
};

function SimulationClock({ elapsed, running, speed }: {
  elapsed: MutableRefObject<number>; running: boolean; speed: number;
}) {
  useFrame((_, delta) => {
    if (running) elapsed.current += Math.min(delta, 0.1) * speed;
  });
  return null;
}

function OrbitTrack({ radius }: { radius: number }) {
  const line = useMemo(() => {
    const points = Array.from({ length: 193 }, (_, i) => {
      const angle = (i / 192) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    });
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: '#476580', transparent: true, opacity: 0.37 }),
    );
  }, [radius]);
  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }, [line]);
  return <primitive object={line} />;
}

function EarthSurface({ radius }: { radius: number }) {
  const day = useTexture('/textures/earth-day-2k.webp');
  const clouds = useTexture('/textures/earth-clouds-2k.webp');
  useEffect(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    day.needsUpdate = true;
  }, [day]);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshStandardMaterial map={day} roughness={0.9} metalness={0} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.014, 48, 32]} />
        <meshStandardMaterial
          map={clouds} transparent opacity={0.29} depthWrite={false} roughness={1}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.057, 40, 28]} />
        <meshBasicMaterial color="#448dff" transparent opacity={0.075}
          side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Moon({ elapsed, sizeScale, originalsEnabled }: {
  elapsed: MutableRefObject<number>;
  sizeScale: number;
  originalsEnabled: boolean;
}) {
  const orbit = useRef<THREE.Group>(null);
  useFrame(() => { if (orbit.current) orbit.current.rotation.y = elapsed.current * 0.8; });
  return (
    <group ref={orbit}>
      <group position={[Math.max(0.97 * sizeScale, 0.55 * sizeScale + 0.3), 0, 0]}>
        <CosmosTexturedBody id="moon" radius={scaledRadius(0.14, sizeScale)}
          fallbackColor="#b4b7bb" originalsEnabled={originalsEnabled} />
      </group>
    </group>
  );
}

function PlanetMesh({ planet, elapsed, onSelect, sizeScale, originalsEnabled }: {
  planet: Planet; elapsed: MutableRefObject<number>; onSelect: (id: PlanetId) => void;
  sizeScale: number; originalsEnabled: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const radius = scaledRadius(planet.radius, sizeScale);
  useFrame((_, delta) => {
    if (group.current) {
      group.current.position.set(...orbitPosition(
        planet.orbit, planet.phase, planet.speed, elapsed.current,
      ));
    }
    if (spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * 0.25;
  });
  return (
    <group ref={group} onClick={(event) => { event.stopPropagation(); onSelect(planet.id); }}>
      <group ref={spin}>
        {planet.id === 'earth'
          ? <EarthSurface radius={radius} />
          : <CosmosTexturedBody id={planet.id} radius={radius}
              fallbackColor={planet.color} originalsEnabled={originalsEnabled} />}
        {planet.id === 'saturn' && (
          <mesh rotation={[-Math.PI / 2.7, 0, 0]}>
            <ringGeometry args={[radius * 1.35, radius * 2.06, 96]} />
            <meshBasicMaterial color="#d9c7a2" side={THREE.DoubleSide}
              transparent opacity={0.69} depthWrite={false} />
          </mesh>
        )}
      </group>
      {planet.id === 'earth' && <Moon elapsed={elapsed} sizeScale={sizeScale} originalsEnabled={originalsEnabled} />}
    </group>
  );
}

function CameraFlight({ focus, onArrived }: { focus: Focus; onArrived: () => void }) {
  const { camera } = useThree();
  const flight = useRef<{ from: THREE.Vector3; to: THREE.Vector3;
    startTarget: THREE.Vector3; endTarget: THREE.Vector3; fraction: number } | null>(null);
  const oldTarget = useRef(new THREE.Vector3());
  useEffect(() => {
    const endTarget = new THREE.Vector3(...focus.center);
    const to = endTarget.clone().add(new THREE.Vector3(
      focus.distance * 0.22, focus.distance * 0.3, focus.distance,
    ));
    flight.current = {
      from: camera.position.clone(), to,
      startTarget: oldTarget.current.clone(), endTarget, fraction: 0,
    };
  }, [camera, focus]);
  useFrame((_, delta) => {
    const f = flight.current;
    if (!f) return;
    f.fraction = Math.min(1, f.fraction + Math.min(delta, 0.1) / 1.65);
    const t = f.fraction * f.fraction * (3 - 2 * f.fraction);
    camera.position.copy(f.from).lerp(f.to, t);
    const lookAt = f.startTarget.clone().lerp(f.endTarget, t);
    camera.lookAt(lookAt);
    if (f.fraction === 1) {
      oldTarget.current.copy(f.endTarget);
      flight.current = null;
      onArrived();
    }
  });
  return null;
}

function SolarScene({ elapsed, running, speed, focus, flying, onArrived, onSelect, sizeScale, originalsEnabled, quality }: {
  elapsed: MutableRefObject<number>; running: boolean; speed: number;
  focus: Focus; flying: boolean; onArrived: () => void; onSelect: (id: PlanetId) => void;
  sizeScale: number; originalsEnabled: boolean; quality: 'eco' | 'standard' | 'high';
}) {
  return (
    <>
      <color attach="background" args={['#040914']} />
      <ambientLight intensity={0.18} />
      <pointLight position={[0, 0, 0]} intensity={210} distance={150} decay={2} color="#fff0c7" />
      <Stars radius={92} depth={35}
        count={quality === 'eco' ? 700 : quality === 'high' ? 3200 : 1500}
        factor={3} saturation={0} fade speed={0.2} />
      <SimulationClock elapsed={elapsed} running={running} speed={speed} />
      <CosmosTexturedBody id="sun" radius={scaledRadius(2.25, sizeScale)}
        fallbackColor="#ffca5f" isSun originalsEnabled={originalsEnabled} />
      <mesh>
        <sphereGeometry args={[scaledRadius(2.39, sizeScale), 40, 28]} />
        <meshBasicMaterial color="#ffaa3c" transparent opacity={0.11}
          side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {CELESTIAL_BODIES.map((planet) => (
        <group key={planet.id}>
          <OrbitTrack radius={planet.orbit} />
          <PlanetMesh planet={planet} elapsed={elapsed} onSelect={onSelect}
            sizeScale={sizeScale} originalsEnabled={originalsEnabled} />
        </group>
      ))}
      <CameraFlight focus={focus} onArrived={onArrived} />
      <OrbitControls
        enabled={!flying}
        target={focus.center}
        enableDamping dampingFactor={0.055}
        enablePan={false}
        minDistance={1.1} maxDistance={115}
        maxPolarAngle={Math.PI * 0.95}
      />
    </>
  );
}

const shell: CSSProperties = {
  minHeight: '100dvh', height: '100dvh', background: '#040914',
  color: '#e8f4ff', position: 'relative', overflow: 'hidden',
  fontFamily: 'Inter, system-ui, sans-serif',
};
const action: CSSProperties = {
  color: '#e8f4ff', background: '#101d2c', border: '1px solid #405770',
  borderRadius: 0, padding: '9px 12px', cursor: 'pointer',
};
const panel: CSSProperties = {
  background: 'rgba(5, 12, 24, .87)', border: '1px solid #35516b',
  padding: 16, backdropFilter: 'blur(10px)',
};

/** Public, isolated 3D explorer. No authentication, payments or tenant data. */
export function CosmosExplorer() {
  const elapsed = useRef(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<PlanetId | 'sun' | null>(null);
  const [focus, setFocus] = useState<Focus>(OVERVIEW);
  const [flying, setFlying] = useState(false);
  const [geoMode, setGeoMode] = useState(false);
  const [walkMode, setWalkMode] = useState(false);
  const [quality, setQuality] = useState<'eco' | 'standard' | 'high'>('standard');
  const [sizeScale, setSizeScale] = useState(1);
  // Disabled until an explicit click; CDN images would send the visitor IP.
  const [originalsEnabled, setOriginalsEnabled] = useState(false);

  const selectBody = (id: PlanetId | 'sun') => {
    setRunning(false); // Freeze orbits so a selected body stays under OrbitControls.
    setSelected(id);
    setFlying(true);
    if (id === 'sun') {
      setFocus({ center: [0, 0, 0], distance: 7 });
      return;
    }
    const body = CELESTIAL_BODIES.find((p) => p.id === id)!;
    setFocus({
      center: orbitPosition(body.orbit, body.phase, body.speed, elapsed.current),
      distance: Math.max(2.35, scaledRadius(body.radius, sizeScale) * 3.9),
    });
  };

  const adjustSizeScale = (value: number) => {
    const nextScale = clampPlanetScale(value);
    setSizeScale(nextScale);
    // Prevent the camera clipping a scaled-up selected planet.
    if (selected === 'sun') {
      setFocus({ center: [0, 0, 0], distance: Math.max(7, 2.25 * nextScale * 3.1) });
      setFlying(true);
    } else if (selected) {
      const body = CELESTIAL_BODIES.find((item) => item.id === selected);
      if (body) {
        setFocus({
          center: orbitPosition(body.orbit, body.phase, body.speed, elapsed.current),
          distance: Math.max(2.35, scaledRadius(body.radius, nextScale) * 3.9),
        });
        setFlying(true);
      }
    }
  };

  const resetSimulation = () => {
    elapsed.current = 0;
    setSpeed(1);
    setSizeScale(1);
    setSelected(null);
    setRunning(true);
    setFlying(true);
    setFocus({ ...OVERVIEW, center: [...OVERVIEW.center] });
  };

  const overview = () => {
    setSelected(null);
    setRunning(true);
    setFlying(true);
    setFocus({ ...OVERVIEW, center: [...OVERVIEW.center] });
  };

  if (walkMode) {
    return <CosmosWalkableWorld onBack={() => setWalkMode(false)} />;
  }
  if (geoMode) {
    return <CosmosGeographicGlobe onBack={() => setGeoMode(false)} />;
  }

  return (
    <main style={shell}>
      <div aria-label="Interaktives 3D-Sonnensystem" style={{ position: 'absolute', inset: 0 }}>
        <Canvas camera={{ position: [0, 17, 52], fov: 45, near: 0.1, far: 240 }}
          dpr={quality === 'eco' ? 1 : quality === 'high' ? [1, 2] : [1, 1.5]}
          gl={{ antialias: quality !== 'eco', alpha: false }}
          fallback={<p role="alert">WebGL wird von diesem Gerät nicht unterstützt.</p>}>
          <Suspense fallback={null}>
            <SolarScene elapsed={elapsed} running={running} speed={speed}
              focus={focus} flying={flying} onArrived={() => setFlying(false)}
              onSelect={selectBody} sizeScale={sizeScale}
              originalsEnabled={originalsEnabled && quality !== 'eco'} quality={quality} />
          </Suspense>
        </Canvas>
      </div>
      <header style={{ ...panel, position: 'absolute', top: 14, left: 14,
        right: 14, maxWidth: 410, pointerEvents: 'auto' }}>
        <div style={{ color: '#7adbf8', fontSize: 11, letterSpacing: 2, fontWeight: 800 }}>
          REALSYNC DYNAMICS.AI
        </div>
        <h1 style={{ margin: '6px 0', fontSize: 23 }}>COSMOS Explorer</h1>
        <p style={{ fontSize: 12, color: '#afc0d1', margin: 0 }}>
          Sonnensystem und 3D-Erde · Darstellung nicht maßstabsgetreu
        </p>
      </header>
      <aside aria-label="Sonnensystem-Steuerung" style={{ ...panel, position: 'absolute',
        left: 14, bottom: 14, width: 'min(365px, calc(100% - 28px))', maxHeight: '54dvh',
        overflowY: 'auto', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button style={action} onClick={overview}>Gesamtansicht</button>
          <button style={action} onClick={resetSimulation}>Zurücksetzen</button>
          <button style={action} onClick={() => setWalkMode(true)}>3D-Landschaft (Simulation)</button>
          <button style={action} onClick={() => {
            setRunning(false);
            setGeoMode(true);
          }}>Erde geografisch erkunden</button>
          <button style={action} onClick={() => {
            if (!running && selected) overview();
            else setRunning((v) => !v);
          }}>{running ? 'Pause' : 'Abspielen'}</button>
        </div>
        <label htmlFor="cosmos-speed" style={{ fontSize: 12 }}>
          Simulationsgeschwindigkeit: {speed.toFixed(1)}×
        </label>
        <input id="cosmos-speed" type="range" min="0" max="3" step="0.1"
          value={speed} onChange={(event) =>
            setSpeed(clampSimulationSpeed(Number(event.target.value)))}
          style={{ width: '100%', accentColor: '#72d9ff', margin: '8px 0 14px' }} />
        <label htmlFor="cosmos-size" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Visuelle Planetengröße: {Math.round(sizeScale * 100)} %
        </label>
        <input id="cosmos-size" aria-label="Planetengröße skalieren" type="range"
          min="0.6" max="1.8" step="0.05" value={sizeScale}
          onChange={(event) => adjustSizeScale(Number(event.target.value))}
          style={{ width: '100%', accentColor: '#72d9ff', marginBottom: 15 }} />
        <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>
          <input type="checkbox" checked={originalsEnabled}
            onChange={(event) => setOriginalsEnabled(event.target.checked)} />
          {' '}Original-Planetentexturen laden (externer CDN)
          <span style={{ display: 'block', fontSize: 11, color: '#a5bed0', lineHeight: 1.4, marginTop: 5 }}>
            Erst nach deiner Auswahl: 2K-Bilddateien von jsDelivr, mit Übermittlung
            der IP-Adresse an den Anbieter. Energiesparmodus verwendet Farbflächen.
          </span>
        </label>
        <label htmlFor="cosmos-quality" style={{ fontSize: 12 }}>
          Darstellungsqualität
          <select id="cosmos-quality" value={quality}
            onChange={(event) => setQuality(event.target.value as typeof quality)}
            style={{ ...action, display: 'block', margin: '6px 0 14px', width: '100%' }}>
            <option value="eco">Energiesparen</option>
            <option value="standard">Standard</option>
            <option value="high">Hoch</option>
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
          <button style={action} aria-pressed={selected === 'sun'}
            onClick={() => selectBody('sun')}>Sonne</button>
          {CELESTIAL_BODIES.map((body) => (
            <button key={body.id} style={{
              ...action, borderColor: selected === body.id ? '#72d9ff' : '#405770',
            }} aria-pressed={selected === body.id}
              onClick={() => selectBody(body.id)}>{body.name}</button>
          ))}
        </div>
        {selected && (
          <div aria-live="polite" style={{ borderTop: '1px solid #35516b', marginTop: 12, paddingTop: 12 }}>
            <strong>{selected === 'sun' ? 'Sonne' :
              CELESTIAL_BODIES.find(body => body.id === selected)?.name}</strong>
            <p style={{ fontSize: 12, lineHeight: 1.45 }}>{PLANET_FACTS[selected]}</p>
            {selected === 'earth' && (
              <button style={action} onClick={() => setGeoMode(true)}>
                Zur Erdoberfläche und zu realen Koordinaten
              </button>
            )}
          </div>
        )}
        <p style={{ fontSize: 11, lineHeight: 1.55, color: '#a5bed0', marginBottom: 0 }}>
          Mit Finger oder Maus drehen, mit zwei Fingern oder Mausrad zoomen.
          Auswahl hält die Umlaufbewegung für den Kameraflug an.
          Planeten-Originalkarten © Solar System Scope (CC BY 4.0),
          Quelle: <a href={ORIGINAL_TEXTURE_ATTRIBUTION.source}
            target="_blank" rel="noreferrer" style={{ color: '#89dcfc' }}>
            Solar System Scope
          </a>.
          Skalierung ist bewusst schematisch und nicht astronomisch exakt.
          Erdoberfläche © Solar System Scope (CC BY 4.0), siehe
          <a href="/textures/README.md" style={{ color: '#89dcfc' }}> Lizenzhinweise</a>.
          Reale Geländehöhen und Gebäude werden ausschließlich aus lokal importierten Daten erzeugt.
        </p>
      </aside>
    </main>
  );
}
