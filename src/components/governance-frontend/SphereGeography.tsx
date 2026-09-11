import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { sphereNodePosition } from './governance-sphere-nodes';
import { capitalsVisibleAtZoom, WORLD_CAPITALS, type WorldCapital } from './geo/capitals';
import { CONTINENT_LABEL_MAX_ZOOM, CONTINENT_LABELS } from './geo/continents';

const BORDERS_URL = '/textures/earth-borders-110m.json';
const CAPITAL_COLOR = '#00E5FF';

type BordersPayload = {
  v: number;
  s: number;
  d: number[];
};

function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse), (max-width: 768px)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}

function useCountryBorderTexture(enabled: boolean) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const ownedRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BORDERS_URL);
        if (!res.ok) return;
        const json = (await res.json()) as BordersPayload;
        if (cancelled || !json?.d?.length || !json.s) return;

        const width = 2048;
        const height = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(230, 245, 255, 0.98)';
        ctx.lineWidth = 1.35;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const scale = 1 / json.s;
        const toX = (lon: number) => ((lon + 180) / 360) * width;
        const toY = (lat: number) => ((90 - lat) / 180) * height;

        for (let i = 0; i + 3 < json.d.length; i += 4) {
          const lon1 = json.d[i] * scale;
          const lat1 = json.d[i + 1] * scale;
          const lon2 = json.d[i + 2] * scale;
          const lat2 = json.d[i + 3] * scale;
          // Skip antimeridian wraps that streak across the map.
          if (Math.abs(lon1 - lon2) > 40) continue;
          ctx.beginPath();
          ctx.moveTo(toX(lon1), toY(lat1));
          ctx.lineTo(toX(lon2), toY(lat2));
          ctx.stroke();
        }

        if (cancelled) return;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        ownedRef.current?.dispose();
        ownedRef.current = tex;
        setTexture(tex);
      } catch {
        // Borders are progressive enhancement — Earth remains useful without them.
      }
    })();
    return () => {
      cancelled = true;
      ownedRef.current?.dispose();
      ownedRef.current = null;
    };
  }, [enabled]);

  return texture;
}

function CountryBorders({
  zoomRef,
  reducedMotion,
  isMobile,
  earthRadius,
}: {
  zoomRef: MutableRefObject<{ zoom: number }>;
  reducedMotion: boolean;
  isMobile: boolean;
  earthRadius: number;
}) {
  const texture = useCountryBorderTexture(!reducedMotion);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(() => {
    if (!matRef.current) return;
    const z = zoomRef.current.zoom;
    const base = isMobile ? 0.35 : 0.5;
    const boost = THREE.MathUtils.smoothstep(z, 0.95, 1.45) * (isMobile ? 0.2 : 0.3);
    matRef.current.opacity = reducedMotion ? 0.2 : base + boost;
  });

  if (!texture) return null;

  return (
    <mesh scale={1.012} raycast={() => null} renderOrder={4}>
      <sphereGeometry args={[earthRadius, 64, 64]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        transparent
        opacity={0.55}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function ContinentLabels({
  zoomRef,
  radius,
}: {
  zoomRef: MutableRefObject<{ zoom: number }>;
  radius: number;
}) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!group.current) return;
    const show = zoomRef.current.zoom < CONTINENT_LABEL_MAX_ZOOM;
    group.current.visible = show;
  });

  return (
    <group ref={group}>
      {CONTINENT_LABELS.map((c) => {
        const pos = sphereNodePosition(c.lat, c.lon, radius);
        return (
          <Html
            key={c.id}
            position={pos}
            center
            distanceFactor={14}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
            zIndexRange={[10, 0]}
          >
            <span
              className="whitespace-nowrap font-mono text-[9px] tracking-[0.18em] text-white/55 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] sm:text-[10px]"
              data-continent-label={c.id}
            >
              {c.name}
            </span>
          </Html>
        );
      })}
    </group>
  );
}

function CapitalMarker({
  capital,
  radius,
  active,
  onHover,
  onSelect,
}: {
  capital: WorldCapital;
  radius: number;
  active: boolean;
  onHover: (c: WorldCapital | null) => void;
  onSelect: (c: WorldCapital) => void;
}) {
  const pos = useMemo(
    () => sphereNodePosition(capital.lat, capital.lon, radius),
    [capital.lat, capital.lon, radius],
  );

  return (
    <group position={pos} renderOrder={7}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(capital);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
          document.body.style.cursor = 'grab';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(capital);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      >
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh scale={active ? 1.4 : 1} raycast={() => null} renderOrder={7}>
        <sphereGeometry args={[0.028, 10, 10]} />
        <meshBasicMaterial
          color={CAPITAL_COLOR}
          transparent
          opacity={active ? 1 : 0.85}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {!active && (
        <mesh scale={2.2} raycast={() => null} renderOrder={6}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshBasicMaterial
            color={CAPITAL_COLOR}
            transparent
            opacity={0.2}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {active && (
        <Html
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[20, 0]}
          position={[0, 0.08, 0]}
        >
          <div
            className="rounded-md border border-[#00E5FF]/28 bg-black/75 px-2 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
            data-capital-label={capital.iso2}
          >
            <p className="whitespace-nowrap font-mono text-[10px] tracking-[0.12em] text-[#00E5FF]">
              {capital.name}
            </p>
            <p className="mt-0.5 font-mono text-[8px] tracking-[0.14em] text-white/40">
              Hauptstadt · {capital.iso2}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

function CapitalsLayer({
  zoomRef,
  radius,
  isMobile,
  reducedMotion,
}: {
  zoomRef: MutableRefObject<{ zoom: number }>;
  radius: number;
  isMobile: boolean;
  reducedMotion: boolean;
}) {
  const [visible, setVisible] = useState<WorldCapital[]>([]);
  const [hovered, setHovered] = useState<WorldCapital | null>(null);
  const [selected, setSelected] = useState<WorldCapital | null>(null);
  const lastKey = useRef('');

  useFrame(() => {
    if (reducedMotion) return;
    const list = capitalsVisibleAtZoom(zoomRef.current.zoom, isMobile);
    const key = `${list.length}:${list[0]?.iso2 ?? ''}:${list[list.length - 1]?.iso2 ?? ''}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      setVisible(list);
      if (selected && !list.some((c) => c.iso2 === selected.iso2)) {
        setSelected(null);
      }
    }
  });

  if (reducedMotion) return null;

  return (
    <group>
      {visible.map((c) => {
        // Labels only on hover/select — dots alone at distance (progressive disclosure).
        const showLabel = hovered?.iso2 === c.iso2 || selected?.iso2 === c.iso2;
        return (
          <CapitalMarker
            key={c.iso2}
            capital={c}
            radius={radius}
            active={showLabel}
            onHover={setHovered}
            onSelect={(cap) => setSelected((prev) => (prev?.iso2 === cap.iso2 ? null : cap))}
          />
        );
      })}
    </group>
  );
}

export interface SphereGeographyProps {
  /** Shared controls — reads `.zoom` each frame for LOD. */
  zoomRef: MutableRefObject<{ zoom: number }>;
  earthRadius?: number;
  reducedMotion?: boolean;
}

/**
 * Countries (borders), continents (labels), capitals (progressive disclosure).
 * Pure geography — no invented risk scores.
 */
export function SphereGeography({
  zoomRef,
  earthRadius = 1.55,
  reducedMotion = false,
}: SphereGeographyProps) {
  const isMobile = useIsCoarsePointer();
  const labelRadius = earthRadius * 1.06;
  // Capitals must sit outside DragSurface (~1.62) so hover/select works.
  const capitalRadius = Math.max(earthRadius * 1.085, 1.68);

  return (
    <group>
      <CountryBorders
        zoomRef={zoomRef}
        reducedMotion={reducedMotion}
        isMobile={isMobile}
        earthRadius={earthRadius}
      />
      {!reducedMotion && <ContinentLabels zoomRef={zoomRef} radius={labelRadius} />}
      <CapitalsLayer
        zoomRef={zoomRef}
        radius={capitalRadius}
        isMobile={isMobile}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

/** Test helper — confirms capital catalog shape. */
export function governanceGeoSummary() {
  return {
    capitals: WORLD_CAPITALS.length,
    continents: CONTINENT_LABELS.length,
    bordersUrl: BORDERS_URL,
  };
}
