import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  GEO_DESTINATIONS, globePoint, validCoordinates, type Coordinates,
} from './cosmosGeography';

type BorderPayload = { v: number; s: number; d: number[] };

const buttonStyle: CSSProperties = {
  background: '#10263c', color: '#e5f4ff', border: '1px solid #496b85',
  padding: '9px 11px', borderRadius: 0, cursor: 'pointer',
};
const panelStyle: CSSProperties = {
  background: 'rgba(3, 12, 24, 0.9)', color: '#e5f4ff', padding: 14,
  border: '1px solid #365770', backdropFilter: 'blur(10px)',
  fontFamily: 'system-ui, sans-serif',
};

/** Uses the existing locally licensed country-border data. No third-party tile traffic. */
function CountryOutlines() {
  const [overlay, setOverlay] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let texture: THREE.CanvasTexture | undefined;
    void (async () => {
      try {
        const response = await fetch('/textures/earth-borders-110m.json', {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json() as BorderPayload;
        if (controller.signal.aborted || !Array.isArray(data.d) ||
            !Number.isFinite(data.s) || data.s <= 0) return;
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = 'rgba(154, 233, 255, 0.86)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i + 3 < data.d.length; i += 4) {
          const lonA = data.d[i] / data.s;
          const latA = data.d[i + 1] / data.s;
          const lonB = data.d[i + 2] / data.s;
          const latB = data.d[i + 3] / data.s;
          if (Math.abs(lonA - lonB) > 40) continue; // antimeridian seam
          ctx.beginPath();
          ctx.moveTo((lonA + 180) / 360 * canvas.width,
            (90 - latA) / 180 * canvas.height);
          ctx.lineTo((lonB + 180) / 360 * canvas.width,
            (90 - latB) / 180 * canvas.height);
          ctx.stroke();
        }
        if (controller.signal.aborted) return;
        texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        setOverlay(texture);
      } catch {
        // Optional boundaries; the textured Earth remains navigable offline.
      }
    })();
    return () => {
      controller.abort();
      texture?.dispose();
    };
  }, []);
  if (!overlay) return null;
  return (
    <mesh>
      <sphereGeometry args={[1.009, 64, 48]} />
      <meshBasicMaterial map={overlay} transparent opacity={0.72} depthWrite={false} />
    </mesh>
  );
}

function GlobeSurface() {
  const day = useTexture('/textures/earth-day-2k.webp');
  const night = useTexture('/textures/earth-night-2k.webp');
  const clouds = useTexture('/textures/earth-clouds-2k.webp');
  useEffect(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    day.needsUpdate = true;
    night.needsUpdate = true;
  }, [day, night]);
  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 64, 48]} />
        <meshStandardMaterial map={day} roughness={0.95} metalness={0} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.013, 64, 48]} />
        <meshBasicMaterial map={night} transparent opacity={0.08}
          depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.020, 64, 48]} />
        <meshStandardMaterial map={clouds} transparent opacity={0.27}
          depthWrite={false} roughness={1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.053, 48, 36]} />
        <meshBasicMaterial color="#3787fb" transparent opacity={0.075}
          side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <CountryOutlines />
    </>
  );
}

function CoordinateMarkers({ focus, onSelect }: {
  focus: Coordinates;
  onSelect: (name: string, coords: Coordinates) => void;
}) {
  return (
    <>
      {GEO_DESTINATIONS.map((dest) => {
        const selected = focus.latitude === dest.latitude &&
          focus.longitude === dest.longitude;
        return (
          <mesh key={dest.id} position={globePoint(dest, 1.047)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(dest.name, dest);
            }}>
            <sphereGeometry args={[selected ? 0.034 : 0.021, 12, 12]} />
            <meshBasicMaterial color={selected ? '#ffd680' : '#80e2ff'} />
          </mesh>
        );
      })}
      <mesh position={globePoint(focus, 1.079)}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </>
  );
}

function FlyToCoordinate({ location, onArrived }: {
  location: Coordinates; onArrived: () => void;
}) {
  const { camera } = useThree();
  const animation = useRef<{
    from: THREE.Vector3;
    destination: THREE.Vector3;
    progress: number;
  } | null>(null);
  useEffect(() => {
    animation.current = {
      from: camera.position.clone(),
      destination: new THREE.Vector3(...globePoint(location, 3.1)),
      progress: 0,
    };
  }, [camera, location]);
  useFrame((_, delta) => {
    const a = animation.current;
    if (!a) return;
    a.progress = Math.min(1, a.progress + Math.min(delta, 0.1) / 1.5);
    const eased = a.progress ** 2 * (3 - 2 * a.progress);
    camera.position.copy(a.from).lerp(a.destination, eased);
    camera.lookAt(0, 0, 0);
    if (a.progress === 1) {
      animation.current = null;
      onArrived();
    }
  });
  return null;
}

function EarthScene({ location, flying, onArrived, onSelect }: {
  location: Coordinates; flying: boolean; onArrived: () => void;
  onSelect: (name: string, coords: Coordinates) => void;
}) {
  return (
    <>
      <color attach="background" args={['#040914']} />
      <Stars radius={75} depth={20} count={1700} factor={3} saturation={0} fade />
      <ambientLight intensity={0.23} />
      <directionalLight intensity={2.2} position={[4, 3, 5]} />
      <GlobeSurface />
      <CoordinateMarkers focus={location} onSelect={onSelect} />
      <FlyToCoordinate location={location} onArrived={onArrived} />
      <OrbitControls enableDamping enabled={!flying} enablePan={false}
        minDistance={1.4} maxDistance={8} target={[0, 0, 0]} />
    </>
  );
}

export function CosmosGeographicGlobe({ onBack }: { onBack: () => void }) {
  const [location, setLocation] = useState<Coordinates>(GEO_DESTINATIONS[0]);
  const [name, setName] = useState<string>(GEO_DESTINATIONS[0].name);
  const [flying, setFlying] = useState(true);
  const [latitude, setLatitude] = useState(String(GEO_DESTINATIONS[0].latitude));
  const [longitude, setLongitude] = useState(String(GEO_DESTINATIONS[0].longitude));
  const [error, setError] = useState('');

  const select = (targetName: string, coords: Coordinates) => {
    setLocation({ latitude: coords.latitude, longitude: coords.longitude });
    setName(targetName);
    setLatitude(String(coords.latitude));
    setLongitude(String(coords.longitude));
    setError('');
    setFlying(true);
  };

  return (
    <section style={{ height: '100dvh', position: 'relative',
      background: '#040914', overflow: 'hidden' }}
      aria-label="Geografischer 3D-Erdglobus">
      <div style={{ position: 'absolute', inset: 0 }}>
        <Canvas camera={{ position: [0, 0.4, 4.8], fov: 47, near: 0.05, far: 145 }}
          dpr={[1, 1.6]} gl={{ antialias: true }}
          fallback={<p role="alert">WebGL ist nicht verfügbar.</p>}>
          <Suspense fallback={null}>
            <EarthScene location={location} flying={flying}
              onArrived={() => setFlying(false)} onSelect={select} />
          </Suspense>
        </Canvas>
      </div>
      <header style={{ ...panelStyle, position: 'absolute', top: 12, left: 12,
        right: 12, maxWidth: 420, pointerEvents: 'auto' }}>
        <div style={{ color: '#8fe2ff', fontSize: 11, letterSpacing: 1.1 }}>
          REALSYNC COSMOS · GEO GLOBE
        </div>
        <h2 style={{ fontSize: 22, margin: '5px 0' }}>Erde erkunden</h2>
        <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.45 }}>
          Echte Koordinaten und Ländergrenzen auf einer 3D-Weltkugel.
          Noch keine Gelände- oder 3D-Gebäudedaten.
        </p>
        <button style={buttonStyle} onClick={onBack}>← Sonnensystem</button>
      </header>
      <aside style={{ ...panelStyle, position: 'absolute', bottom: 12, left: 12,
        width: 'min(410px, calc(100% - 24px))', maxHeight: '53dvh', overflowY: 'auto',
        pointerEvents: 'auto' }} aria-label="Geografische Navigation">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{name}</div>
        <div style={{ fontSize: 12, color: '#c3d4df', marginBottom: 12 }}>
          {location.latitude.toFixed(4)}° N/S · {location.longitude.toFixed(4)}° E/W
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {GEO_DESTINATIONS.map((dest) => (
            <button key={dest.id} style={{
              ...buttonStyle,
              borderColor: dest.name === name ? '#8fe2ff' : '#496b85',
            }} onClick={() => select(dest.name, dest)}>
              {dest.name}
            </button>
          ))}
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          const candidate = {
            latitude: Number(latitude), longitude: Number(longitude),
          };
          if (!latitude.trim() || !longitude.trim() ||
              !validCoordinates(candidate)) {
            setError('Bitte gültige Koordinaten angeben (Breite ±90°, Länge ±180°).');
            return;
          }
          select('Eigene Koordinaten', candidate);
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: 105, fontSize: 12 }}>
              Breitengrad
              <input type="number" step="any" min="-90" max="90" required
                value={latitude} onChange={e => setLatitude(e.target.value)}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box',
                  padding: 9, background: '#091a2a', color: '#fff',
                  border: '1px solid #496b85' }} />
            </label>
            <label style={{ flex: 1, minWidth: 105, fontSize: 12 }}>
              Längengrad
              <input type="number" step="any" min="-180" max="180" required
                value={longitude} onChange={e => setLongitude(e.target.value)}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box',
                  padding: 9, background: '#091a2a', color: '#fff',
                  border: '1px solid #496b85' }} />
            </label>
            <button style={buttonStyle} type="submit">Anfliegen</button>
          </div>
          {error && <p role="alert" style={{ color: '#ffb8aa', fontSize: 12 }}>{error}</p>}
        </form>
        <p style={{ fontSize: 11, color: '#a6c4d7', lineHeight: 1.5, marginBottom: 0 }}>
          Mit Maus oder Finger drehen und zoomen. Grenzen: Natural Earth (110m).
          Oberflächen- und Wolkentextur © Solar System Scope (CC BY 4.0).
          <a style={{ color: '#89dcfc', marginLeft: 4 }}
            href="/textures/README.md">Attribution und Datenquellen</a>.
        </p>
      </aside>
    </section>
  );
}
