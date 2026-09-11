import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { sphereNodePosition } from './governance-sphere-nodes';
import { capitalsVisibleAtZoom, WORLD_CAPITALS, type WorldCapital } from './geo/capitals';
import { CONTINENT_LABEL_MAX_ZOOM, CONTINENT_LABELS } from './geo/continents';

const BORDERS_URL = '/textures/earth-borders-110m.json';
const BORDER_COLOR = '#d8ecf8';
const CAPITAL_COLOR = '#f3d9a0';

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

function useCountryBorders(enabled: boolean) {
  const [positions, setPositions] = useState<Float32Array | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BORDERS_URL);
        if (!res.ok) return;
        const json = (await res.json()) as BordersPayload;
        if (cancelled || !json?.d?.length || !json.s) return;
        const scale = 1 / json.s;
        const radius = 1.595;
        const out = new Float32Array((json.d.length / 2) * 3);
        // d is lon,lat,lon,lat… → convert each endpoint to xyz
        let o = 0;
        for (let i = 0; i + 1 < json.d.length; i += 2) {
          const lon = json.d[i] * scale;
          const lat = json.d[i + 1] * scale;
          const [x, y, z] = sphereNodePosition(lat, lon, radius);
          out[o++] = x;
          out[o++] = y;
          out[o++] = z;
        }
        if (!cancelled) setPositions(out);
      } catch {
        // Borders are progressive enhancement — Earth remains useful without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return positions;
}

function CountryBorders({
  zoomRef,
  reducedMotion,
  isMobile,
}: {
  zoomRef: MutableRefObject<{ zoom: number }>;
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  const positions = useCountryBorders(!reducedMotion);
  const lineRef = useRef<THREE.LineSegments>(null!);
  const matRef = useRef<THREE.LineBasicMaterial>(null!);

  const geometry = useMemo(() => {
    if (!positions) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame(() => {
    if (!matRef.current) return;
    const z = zoomRef.current.zoom;
    // Subtle at default; clearer when zoomed — still no clutter on mobile default.
    const base = isMobile ? 0.28 : 0.42;
    const boost = THREE.MathUtils.smoothstep(z, 0.95, 1.45) * (isMobile ? 0.25 : 0.35);
    matRef.current.opacity = reducedMotion ? 0.15 : base + boost;
  });

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <lineSegments ref={lineRef} geometry={geometry} raycast={() => null} frustumCulled>
      <lineBasicMaterial
        ref={matRef}
        color={BORDER_COLOR}
        transparent
        opacity={0.45}
        depthWrite={false}
        depthTest
        toneMapped={false}
      />
    </lineSegments>
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
    <group position={pos}>
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
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(capital);
        }}
      >
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh scale={active ? 1.35 : 1} raycast={() => null}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial
          color={CAPITAL_COLOR}
          transparent
          opacity={active ? 0.95 : 0.7}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {active && (
        <Html
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[20, 0]}
          position={[0, 0.06, 0]}
        >
          <div
            className="rounded-md border border-[#e8c98a]/35 bg-black/75 px-2 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
            data-capital-label={capital.iso2}
          >
            <p className="whitespace-nowrap font-mono text-[10px] tracking-[0.12em] text-[#f3d9a0]">
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
  const [autoLabel, setAutoLabel] = useState(false);
  const lastKey = useRef('');
  const autoLabelRef = useRef(false);

  useFrame(() => {
    if (reducedMotion) return;
    const z = zoomRef.current.zoom;
    const list = capitalsVisibleAtZoom(z, isMobile);
    const key = `${list.length}:${list[0]?.iso2 ?? ''}:${list[list.length - 1]?.iso2 ?? ''}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      setVisible(list);
      if (selected && !list.some((c) => c.iso2 === selected.iso2)) {
        setSelected(null);
      }
    }
    // Auto-label tier-1 only in a narrow zoom band with few markers.
    const nextAuto = !isMobile && z >= 1.12 && z < 1.35 && list.length > 0 && list.length <= 30;
    if (nextAuto !== autoLabelRef.current) {
      autoLabelRef.current = nextAuto;
      setAutoLabel(nextAuto);
    }
  });

  if (reducedMotion) return null;

  return (
    <group>
      {visible.map((c) => {
        const showLabel =
          hovered?.iso2 === c.iso2 ||
          selected?.iso2 === c.iso2 ||
          (autoLabel && c.tier === 1);
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
  const labelRadius = earthRadius * 1.045;
  const capitalRadius = earthRadius * 1.028;

  return (
    <group>
      <CountryBorders zoomRef={zoomRef} reducedMotion={reducedMotion} isMobile={isMobile} />
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
