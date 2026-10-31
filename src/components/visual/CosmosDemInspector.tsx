import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  MATTERHORN_DEM, sampleTerrariumGrid, tileCenterWgs84, type HeightField,
} from './cosmosDem';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing'; message: string }
  | { status: 'ready'; field: HeightField; source: string };

async function decodeTile(blob: Blob): Promise<HeightField> {
  if (blob.size > 4_000_000) throw new Error('Höhenkachel überschreitet das 4-MB-Limit.');
  if (blob.type && !blob.type.startsWith('image/')) {
    throw new Error('Die Datei ist kein Bild mit Terrarium-RGB-Höhendaten.');
  }
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  try {
    if (bitmap.width !== 512 || bitmap.height !== 512) {
      throw new Error('Mapterhorn DEM-Kacheln müssen 512 × 512 Pixel haben.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Kein Canvas-2D-Kontext für DEM-Dekodierung.');
    context.drawImage(bitmap, 0, 0);
    return sampleTerrariumGrid(context.getImageData(0, 0, 512, 512), 97);
  } finally {
    bitmap.close();
  }
}

function TerrainSurface({ field }: { field: HeightField }) {
  const geometry = useMemo(() => {
    const segments = field.size - 1;
    const mesh = new THREE.PlaneGeometry(110, 110, segments, segments);
    mesh.rotateX(-Math.PI / 2);
    const position = mesh.getAttribute('position');
    const color = new Float32Array(position.count * 3);
    const shade = new THREE.Color();
    const span = Math.max(1, field.max - field.min);
    for (let i = 0; i < position.count; i++) {
      const fraction = (field.metres[i] - field.min) / span;
      position.setY(i, (field.metres[i] - field.min) * 0.035);
      shade.setHSL(0.25 - fraction * 0.21, 0.30, 0.25 + fraction * 0.49);
      color[i * 3] = shade.r;
      color[i * 3 + 1] = shade.g;
      color[i * 3 + 2] = shade.b;
    }
    position.needsUpdate = true;
    mesh.setAttribute('color', new THREE.BufferAttribute(color, 3));
    mesh.computeVertexNormals();
    return mesh;
  }, [field]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

const panel: CSSProperties = {
  background: 'rgba(3, 13, 27, 0.91)',
  border: '1px solid #44617f',
  color: '#eaf4ff',
  padding: 15,
  fontFamily: 'system-ui, sans-serif',
  backdropFilter: 'blur(10px)',
};
const button: CSSProperties = {
  border: '1px solid #56718c', background: '#123048',
  color: '#f0f9ff', borderRadius: 0, padding: '9px 12px', cursor: 'pointer',
};

/**
 * A real-height-data viewer only when an actual valid DEM image is present.
 * The optional repository asset is loaded from the same origin. A user
 * can supply a local 512px Mapterhorn tile without sending it to a server.
 * Never substitutes a synthetic field when the data is absent.
 */
export function CosmosDemInspector({ onBack }: { onBack: () => void }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(MATTERHORN_DEM.url, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok || !(response.headers.get('content-type') ?? '')
          .toLowerCase().startsWith('image/')) {
          throw new Error('Noch keine freigegebene, lokal gehostete DEM-Datei vorhanden.');
        }
        const field = await decodeTile(await response.blob());
        if (!controller.signal.aborted) {
          setLoad({ status: 'ready', field, source: 'Lokales Repository-Asset' });
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoad({
            status: 'missing',
            message: 'Echte Geländedaten fehlen noch. Keine Höhen werden erfunden.',
          });
        }
      }
    })();
    return () => controller.abort();
  }, []);

  const center = tileCenterWgs84(
    MATTERHORN_DEM.zoom, MATTERHORN_DEM.x, MATTERHORN_DEM.y,
  );
  return (
    <section style={{ position: 'relative', minHeight: '100dvh', background: '#061324',
      color: '#eaf4ff', overflow: 'hidden' }} aria-label="Echte DEM-Geländehöhen">
      {load.status === 'ready'
        ? <div style={{ position: 'absolute', inset: 0 }}>
            <Canvas camera={{ position: [79, 66, 79], fov: 53, near: 0.5, far: 350 }}
              dpr={[1, 1.5]} gl={{ antialias: true }}
              fallback={<p role="alert">WebGL auf diesem Gerät nicht verfügbar.</p>}>
              <color attach="background" args={['#90b9d1']} />
              <ambientLight intensity={1.25} />
              <directionalLight position={[60, 100, 35]} intensity={2.4}
                castShadow shadow-mapSize={[1024, 1024]} />
              <TerrainSurface field={load.field} />
              <OrbitControls enableDamping enablePan
                target={[0, Math.max(2, (load.field.max - load.field.min) * 0.013), 0]}
                minDistance={6} maxDistance={240} maxPolarAngle={Math.PI / 2.05} />
            </Canvas>
          </div>
        : null}
      <header style={{ ...panel, position: 'relative', margin: 12,
        maxWidth: 445, zIndex: 1 }}>
        <div style={{ color: '#8ae6ff', fontSize: 11, letterSpacing: 1.4 }}>
          REALSYNC COSMOS · TERRAIN PIPELINE
        </div>
        <h2 style={{ margin: '6px 0' }}>Matterhorn – DEM-Ansicht</h2>
        <p style={{ fontSize: 12, lineHeight: 1.55, margin: '7px 0' }}>
          Standort der Höhenkachel: {center.latitude.toFixed(4)}° N,
          {center.longitude.toFixed(4)}° E · Web-Mercator z13.
        </p>
        {load.status === 'ready'
          ? <>
              <p style={{ fontSize: 13 }}>Höhen:
                <strong> {Math.round(load.field.min)}–{Math.round(load.field.max)} m</strong>
                {' '}· {load.source}
              </p>
              <p style={{ fontSize: 12 }}>
                Geländehöhen aus dekodierter Bilddatei; Darstellung vertikal überhöht.
                Quelle bei Nutzerdateien nicht automatisch verifiziert.
              </p>
            </>
          : <p role="status" style={{ fontSize: 13, color: '#ffcf9f' }}>
              {load.status === 'loading' ? 'DEM-Datei wird überprüft …' : load.message}
            </p>}
        <p style={{ fontSize: 12, lineHeight: 1.45 }}>
          Mapterhorn verwendet Terrarium-Höhenkacheln. Der lokale Import findet nur
          im Browser statt; er lädt keine externen Kartenserver.
        </p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={button} onClick={onBack}>← Weltkugel</button>
          <label style={{ ...button, display: 'inline-block' }}>
            DEM-Datei auswählen
            <input style={{ display: 'block', maxWidth: 245, fontSize: 11, marginTop: 7 }}
              type="file" accept=".webp,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                setLoad({ status: 'loading' });
                void decodeTile(file).then((field) => {
                  setLoad({
                    status: 'ready', field,
                    source: 'Lokaler Dateiimport – Datenherkunft ungeprüft',
                  });
                }).catch((error: unknown) => {
                  setLoad({
                    status: 'missing',
                    message: error instanceof Error ? error.message : 'DEM-Import fehlgeschlagen.',
                  });
                });
              }} />
          </label>
        </div>
        <p style={{ fontSize: 11, lineHeight: 1.45, color: '#c1d5e3', marginBottom: 0 }}>
          Geländedaten: <a href={MATTERHORN_DEM.providerUrl}
            target="_blank" rel="noreferrer" style={{ color: '#8ae6ff' }}>
            {MATTERHORN_DEM.attribution}
          </a>.
          Die zugehörigen Ursprungsdaten-Lizenzen müssen vor Veröffentlichung
          eines Terrain-Assets separat verifiziert werden.
        </p>
      </header>
    </section>
  );
}
