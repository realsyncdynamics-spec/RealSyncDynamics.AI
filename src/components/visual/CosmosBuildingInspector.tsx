import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  localMetres, parseBuildingGeoJson, type BuildingsModel,
  type BuildingFootprint,
} from './cosmosBuildings';

const panel: CSSProperties = {
  background: 'rgba(4, 15, 30, 0.92)', color: '#e7f4ff',
  border: '1px solid #446680', padding: 15,
  fontFamily: 'system-ui, sans-serif', backdropFilter: 'blur(10px)',
};
const control: CSSProperties = {
  padding: '10px 13px', border: '1px solid #557c96',
  background: '#153149', color: '#f2faff', borderRadius: 0,
  cursor: 'pointer',
};

function Footprint({ footprint, model }: {
  footprint: BuildingFootprint;
  model: BuildingsModel;
}) {
  const geometry = useMemo(() => {
    const shapeFromRing = (ring: Array<[number, number]>) => ring
      .slice(0, -1).map(([lon, lat]) => {
        const [east, north] = localMetres(lon, lat, model.origin);
        return new THREE.Vector2(east, north);
      });
    const outer = shapeFromRing(footprint.rings[0]);
    const shape = new THREE.Shape(outer);
    for (const hole of footprint.rings.slice(1)) {
      shape.holes.push(new THREE.Path(shapeFromRing(hole)));
    }
    const mesh = new THREE.ExtrudeGeometry(shape, {
      depth: footprint.heightMetres, bevelEnabled: false,
      curveSegments: 1, steps: 1,
    });
    // GeoJSON: east -> +X, north -> -Z; height -> +Y.
    mesh.rotateX(-Math.PI / 2);
    mesh.computeVertexNormals();
    return mesh;
  }, [footprint, model.origin]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={footprint.heightEstimated ? '#aab8c8' : '#d1d9df'}
        metalness={0.1} roughness={0.76} side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function BuildingWorld({ model }: { model: BuildingsModel }) {
  const radius = Math.max(120, model.maxExtentMetres * 1.2);
  const cameraPosition: [number, number, number] = [
    radius * 0.84, radius * 0.65, radius * 0.86,
  ];
  return (
    <Canvas key={model.origin.latitude + ':' + model.origin.longitude}
      camera={{ position: cameraPosition, fov: 52, near: 0.5,
        far: Math.max(1000, radius * 8) }}
      dpr={[1, 1.5]} gl={{ antialias: true }}
      fallback={<p role="alert">WebGL wird nicht unterstützt.</p>}>
      <color attach="background" args={['#91b3ca']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[250, 400, 170]} intensity={2.6} />
      <gridHelper args={[Math.max(240, radius * 2.5), 24, '#446176', '#708c9b']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[Math.max(240, radius * 2.5), Math.max(240, radius * 2.5)]} />
        <meshStandardMaterial color="#6a867a" roughness={1} />
      </mesh>
      {model.buildings.map((footprint) => (
        <Footprint footprint={footprint} model={model} key={footprint.id} />
      ))}
      <OrbitControls
        makeDefault enableDamping
        target={[0, 13, 0]} enablePan
        minDistance={8} maxDistance={Math.max(900, radius * 5)}
        maxPolarAngle={Math.PI / 2.04}
      />
    </Canvas>
  );
}

/**
 * Visualizes user-provided actual WGS84 footprints. Provenance is unverified.
 * No external network access, and no building data is generated as a fallback.
 */
export function CosmosBuildingInspector({ onBack }: { onBack: () => void }) {
  const [model, setModel] = useState<BuildingsModel | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const importFile = async (file: File) => {
    setLoading(true);
    setError('');
    setModel(null);
    try {
      if (file.size > 2_000_000) {
        throw new RangeError('GeoJSON überschreitet 2 MB.');
      }
      const json: unknown = JSON.parse(await file.text());
      const parsed = parseBuildingGeoJson(json);
      setModel(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ungültige GeoJSON-Datei');
    } finally {
      setLoading(false);
    }
  };
  return (
    <section aria-label="Lokaler 3D-Gebäudeviewer" style={{
      minHeight: '100dvh', height: '100dvh', background: '#071525',
      position: 'relative', overflow: 'hidden', color: '#eef7ff',
    }}>
      {model && <div style={{ position: 'absolute', inset: 0 }}>
        <BuildingWorld model={model} />
      </div>}
      <header style={{
        ...panel, position: 'absolute', left: 12, right: 12,
        top: 12, maxWidth: 460,
        maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
      }}>
        <div style={{ color: '#81defc', letterSpacing: 1.3, fontSize: 11 }}>
          REALSYNC COSMOS · BUILDING IMPORT
        </div>
        <h2 style={{ fontSize: 21, margin: '5px 0' }}>Geografische 3D-Gebäude</h2>
        <p style={{ fontSize: 12, lineHeight: 1.55 }}>
          Importiere GeoJSON mit echten Gebäudegrundrissen in WGS84.
          Ohne Datei werden keine realen Gebäude vorgetäuscht. Die Daten bleiben
          auf deinem Gerät und werden auf einer flachen Ebene dargestellt.
          Gebäudehöhen ohne gemessenen Höhenwert sind Schätzungen.
        </p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button style={control} onClick={onBack}>← Weltkugel</button>
          <label style={{ ...control, display: 'inline-block' }}>
            GeoJSON auswählen
            <input type="file" accept=".geojson,.json,application/geo+json,application/json"
              style={{ display: 'block', maxWidth: 270, marginTop: 8 }}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) void importFile(file);
              }} />
          </label>
        </div>
        {loading && <p role="status">GeoJSON wird geprüft …</p>}
        {error && <p role="alert" style={{ color: '#ffb8a8' }}>{error}</p>}
        {model
          ? <div role="status" style={{ marginTop: 12, fontSize: 12 }}>
              <strong>{model.buildings.length} Gebäudegrundrisse</strong>
              <p>{model.estimatedHeights} Gebäudehöhen sind geschätzt.</p>
              <p>Zentrum: {model.origin.latitude.toFixed(5)}°,
                {' '}{model.origin.longitude.toFixed(5)}°</p>
              <p style={{ color: '#ffcf9f' }}>
                Datenquelle und Nutzungsrechte der Datei nicht verifiziert.
                Flacher Untergrund; noch keine Verbindung zu einem DEM.
              </p>
            </div>
          : <p role="status" style={{ color: '#ffd7aa', fontSize: 12 }}>
              Noch keine Gebäudedaten geladen.
            </p>}
        <p style={{ color: '#a8ccdf', fontSize: 11, lineHeight: 1.5 }}>
          Unterstützt Polygon und MultiPolygon, maximal 150 Gebäude,
          12.000 Punkte, 2 MB und 1,6 km Ausdehnung. Für aus OpenStreetMap
          entnommene Daten gelten die ODbL-Bedingungen und
          die vorgeschriebene Attribution © OpenStreetMap contributors.
        </p>
      </header>
    </section>
  );
}
