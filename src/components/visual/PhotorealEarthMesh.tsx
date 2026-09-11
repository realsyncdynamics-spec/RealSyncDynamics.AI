import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  EARTH_DAY_BOOT,
  detectEarthQuality,
  getEarthTextureSet,
  preloadImage,
  type EarthQuality,
  type EarthTextureSet,
} from './earthTextures';

/**
 * Shared photoreal Earth mesh — multi-layer day / night / specular / clouds + atmosphere.
 * Used by `/welcome` (PhotorealEarthScene) and the homepage Governance Sphere.
 */

/** Boot / low-tier day map path (also kept as literal for smoke tests). */
export const EARTH_DAY_TEXTURE = '/textures/earth-day.jpg';

/** Visual grade for shared Earth mesh. `landing-gold` = public Dark/Gold/Cream only. */
export type EarthPalette = 'default' | 'landing-gold';

export interface PhotorealEarthMeshProps {
  /** Sphere radius in scene units. */
  radius?: number;
  /** Auto-rotate when true (welcome panel). Governance Sphere drives rotation externally. */
  autoRotate?: boolean;
  reducedMotion?: boolean;
  /** Initial orientation — tip Europe / Atlantic toward camera by default. */
  rotation?: [number, number, number];
  /** Optional override for adaptive quality. */
  quality?: EarthQuality;
  /** World-space sun direction for day/night terminator + specular. */
  sunDirection?: THREE.Vector3;
  /**
   * Color grade. Default keeps NASA-style blue for `/welcome` + Governance Sphere.
   * `landing-gold` retints atmosphere/ocean/land toward Dominik Dark/Gold/Cream.
   */
  palette?: EarthPalette;
}

const LANDING_GOLD = {
  dayTint: '#e8ddc8',
  atmosphereGlow: '#e4cfa2',
  atmosphereWarm: '#efe6d5',
  outerGlow: '#b49a6b',
  specular: new THREE.Vector3(0.9, 0.82, 0.62),
  clouds: new THREE.Vector3(0.94, 0.9, 0.82),
  nightIntensity: 0.55,
} as const;

function configureMap(tex: THREE.Texture, anisotropy: number, colorSpace?: THREE.ColorSpace) {
  tex.colorSpace = colorSpace ?? THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
}

function loadTexture(url: string, anisotropy: number, colorSpace?: THREE.ColorSpace) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        configureMap(tex, anisotropy, colorSpace);
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

/** Fresnel atmosphere rim — stronger scattering without neon cyberpunk. */
function AtmosphereShell({
  radius,
  reducedMotion,
  palette,
}: {
  radius: number;
  reducedMotion: boolean;
  palette: EarthPalette;
}) {
  const gold = palette === 'landing-gold';
  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uGlow: {
          value: new THREE.Color(gold ? LANDING_GOLD.atmosphereGlow : '#7ad0f5'),
        },
        uWarm: {
          value: new THREE.Color(gold ? LANDING_GOLD.atmosphereWarm : '#ffb078'),
        },
        uIntensity: { value: reducedMotion ? (gold ? 0.55 : 0.7) : gold ? 0.92 : 1.18 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vWorld;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uGlow;
        uniform vec3 uWarm;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vWorld;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
          float rim = smoothstep(0.02, 0.94, fresnel);
          // Slight warm limb toward -X / -Y (sunrise side of the scene).
          float warmSide = smoothstep(-0.2, 0.85, normalize(vWorld).x * -0.55 + normalize(vWorld).y * -0.35);
          vec3 col = mix(uGlow, uWarm, warmSide * 0.55);
          gl_FragColor = vec4(col, rim * uIntensity);
        }
      `,
    });
  }, [reducedMotion, gold]);

  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <mesh scale={1.052} raycast={() => null} material={mat}>
      <sphereGeometry args={[radius, 64, 64]} />
    </mesh>
  );
}

function OuterGlow({ radius, palette }: { radius: number; palette: EarthPalette }) {
  const gold = palette === 'landing-gold';
  return (
    <mesh scale={1.14} raycast={() => null}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial
        color={gold ? LANDING_GOLD.outerGlow : '#2f82c4'}
        transparent
        opacity={gold ? 0.1 : 0.12}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Photoreal multi-layer Earth.
 * Day map stays unlit (meshBasic) so mobile / software WebGL never go black;
 * night lights + ocean specular are additive overlays keyed to sun direction.
 *
 * Boot day texture is loaded via R3F `useLoader` (cached, Strict-Mode safe).
 * Higher tiers upgrade in place without disposing the live map on remount.
 */
export function PhotorealEarthMesh({
  radius = 1.55,
  autoRotate = false,
  reducedMotion = false,
  rotation = [0.18, -0.55, 0.08],
  quality: qualityProp,
  sunDirection,
  palette = 'default',
}: PhotorealEarthMeshProps) {
  const group = useRef<THREE.Group>(null!);
  const cloudsRef = useRef<THREE.Mesh>(null!);
  const nightMat = useRef<THREE.ShaderMaterial>(null!);
  const specMat = useRef<THREE.ShaderMaterial>(null!);
  const upgradeTexRef = useRef<THREE.Texture[]>([]);
  const { gl, camera } = useThree();
  const gold = palette === 'landing-gold';

  const maxTex = gl.capabilities.maxTextureSize;
  const [quality] = useState<EarthQuality>(() => {
    const base = qualityProp ?? detectEarthQuality({ reducedMotion });
    // Cap to what the GPU can actually sample (8K needs ≥8192).
    if (base === 'high' && maxTex < 8192) return 'medium';
    if (base === 'medium' && maxTex < 4096) return 'low';
    return base;
  });
  const set = useMemo(() => getEarthTextureSet(quality), [quality]);

  // Cached boot map — never disposed by us (R3F loader cache owns it).
  const bootDay = useLoader(THREE.TextureLoader, EARTH_DAY_BOOT);
  useEffect(() => {
    configureMap(bootDay, Math.min(4, gl.capabilities.getMaxAnisotropy()));
  }, [bootDay, gl]);

  const [dayMap, setDayMap] = useState<THREE.Texture | null>(null);
  const [nightMap, setNightMap] = useState<THREE.Texture | null>(null);
  const [cloudMap, setCloudMap] = useState<THREE.Texture | null>(null);
  const [specMap, setSpecMap] = useState<THREE.Texture | null>(null);

  const sun = useMemo(() => new THREE.Vector3(4.5, 1.2, 2.8).normalize(), []);
  const activeDay = dayMap ?? bootDay;

  // Progressive upgrade — do NOT dispose on effect cleanup (Strict Mode remount).
  useEffect(() => {
    let cancelled = false;
    const maxAniso = Math.min(set.anisotropy, gl.capabilities.getMaxAnisotropy());
    const owned: THREE.Texture[] = [];

    (async () => {
      try {
        if (set.day !== EARTH_DAY_BOOT) {
          await preloadImage(set.day).catch(() => null);
          if (cancelled) return;
          const hi = await loadTexture(set.day, maxAniso);
          if (cancelled) {
            hi.dispose();
            return;
          }
          owned.push(hi);
          setDayMap(hi);
        }

        const jobs: Promise<void>[] = [];
        if (set.nightEnabled && set.night) {
          jobs.push(
            loadTexture(set.night, Math.min(8, maxAniso)).then((t) => {
              if (cancelled) {
                t.dispose();
                return;
              }
              owned.push(t);
              setNightMap(t);
            }),
          );
        }
        if (set.cloudsEnabled && set.clouds) {
          jobs.push(
            loadTexture(set.clouds, Math.min(8, maxAniso)).then((t) => {
              if (cancelled) {
                t.dispose();
                return;
              }
              owned.push(t);
              setCloudMap(t);
            }),
          );
        }
        if (set.specularEnabled && set.specular) {
          jobs.push(
            loadTexture(set.specular, 4, THREE.NoColorSpace).then((t) => {
              if (cancelled) {
                t.dispose();
                return;
              }
              owned.push(t);
              setSpecMap(t);
            }),
          );
        }
        await Promise.allSettled(jobs);
        if (!cancelled) {
          upgradeTexRef.current = owned;
        }
      } catch {
        // Boot day alone remains readable.
      }
    })();

    return () => {
      cancelled = true;
      // Soft cancel only — dispose owned upgrades on true unmount below.
    };
  }, [gl, set]);

  // Dispose upgrade textures only when the mesh unmounts for real.
  useEffect(() => {
    return () => {
      for (const tex of upgradeTexRef.current) tex.dispose();
      upgradeTexRef.current = [];
    };
  }, []);

  useFrame((_, delta) => {
    const lightDir = sunDirection ?? sun;
    if (nightMat.current) {
      nightMat.current.uniforms.uLight.value.copy(lightDir).normalize();
    }
    if (specMat.current) {
      specMat.current.uniforms.uLight.value.copy(lightDir).normalize();
      specMat.current.uniforms.uCam.value.copy(camera.position);
    }
    if (autoRotate && !reducedMotion && group.current) {
      group.current.rotation.y += delta * 0.045;
    }
    if (!reducedMotion && cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.012;
    }
  });

  const segments = set.segments;

  const dayTint = gold ? LANDING_GOLD.dayTint : '#f2f6ff';
  const nightIntensity = gold ? LANDING_GOLD.nightIntensity : 1.15;
  const specColor = gold ? LANDING_GOLD.specular : new THREE.Vector3(0.8, 0.92, 1.0);
  const cloudColor = gold ? LANDING_GOLD.clouds : new THREE.Vector3(0.96, 0.98, 1.0);
  const specIntensity = gold ? 0.38 : 0.62;
  const cloudOpacity = gold
    ? quality === 'high'
      ? 0.32
      : 0.24
    : quality === 'high'
      ? 0.5
      : 0.38;

  return (
    <group ref={group} rotation={rotation}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[radius, segments[0], segments[1]]} />
        {/* Default: cool lift for HUD glass. Landing-gold: cream day tint. */}
        <meshBasicMaterial map={activeDay} color={dayTint} toneMapped={false} />
      </mesh>

      {nightMap && set.nightEnabled && (
        <mesh scale={1.002} raycast={() => null}>
          <sphereGeometry args={[radius, segments[0], segments[1]]} />
          <shaderMaterial
            ref={nightMat}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            uniforms={{
              uNight: { value: nightMap },
              uLight: { value: sun.clone() },
              uIntensity: { value: nightIntensity },
              uWarm: { value: gold ? 1.0 : 0.0 },
            }}
            vertexShader={/* glsl */ `
              varying vec2 vUv;
              varying vec3 vNormalW;
              void main() {
                vUv = uv;
                vNormalW = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={/* glsl */ `
              uniform sampler2D uNight;
              uniform vec3 uLight;
              uniform float uIntensity;
              uniform float uWarm;
              varying vec2 vUv;
              varying vec3 vNormalW;
              void main() {
                float ndl = dot(normalize(vNormalW), normalize(uLight));
                float night = smoothstep(0.05, -0.3, ndl);
                vec3 lights = texture2D(uNight, vUv).rgb;
                float luma = max(lights.r, max(lights.g, lights.b));
                vec3 glow = lights * lights * 1.8 + lights * 0.45;
                // Landing gold: shift city lights toward amber, dim blue channels.
                glow = mix(glow, vec3(glow.r * 1.15, glow.g * 0.85, glow.b * 0.35), uWarm);
                // Darker night side overall when gold-graded.
                float side = mix(0.9, 0.55, uWarm);
                gl_FragColor = vec4(glow * uIntensity, night * luma * side);
              }
            `}
          />
        </mesh>
      )}

      {specMap && set.specularEnabled && (
        <mesh scale={1.003} raycast={() => null}>
          <sphereGeometry args={[radius, Math.min(segments[0], 64), Math.min(segments[1], 64)]} />
          <shaderMaterial
            ref={specMat}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            uniforms={{
              uSpec: { value: specMap },
              uLight: { value: sun.clone() },
              uCam: { value: camera.position.clone() },
              uIntensity: { value: specIntensity },
              uSpecColor: { value: specColor },
            }}
            vertexShader={/* glsl */ `
              varying vec2 vUv;
              varying vec3 vNormalW;
              varying vec3 vPosW;
              void main() {
                vUv = uv;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vPosW = wp.xyz;
                vNormalW = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * wp;
              }
            `}
            fragmentShader={/* glsl */ `
              uniform sampler2D uSpec;
              uniform vec3 uLight;
              uniform vec3 uCam;
              uniform float uIntensity;
              uniform vec3 uSpecColor;
              varying vec2 vUv;
              varying vec3 vNormalW;
              varying vec3 vPosW;
              void main() {
                float water = texture2D(uSpec, vUv).r;
                vec3 N = normalize(vNormalW);
                vec3 L = normalize(uLight);
                vec3 V = normalize(uCam - vPosW);
                vec3 H = normalize(L + V);
                float spec = pow(max(dot(N, H), 0.0), 48.0);
                float day = smoothstep(-0.05, 0.4, dot(N, L));
                float a = water * spec * day * uIntensity;
                gl_FragColor = vec4(uSpecColor * a, a);
              }
            `}
          />
        </mesh>
      )}

      {cloudMap && set.cloudsEnabled && (
        <mesh ref={cloudsRef} scale={1.018} raycast={() => null}>
          <sphereGeometry args={[radius, Math.min(segments[0], 64), Math.min(segments[1], 64)]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            toneMapped={false}
            uniforms={{
              uClouds: { value: cloudMap },
              uOpacity: { value: cloudOpacity },
              uCloudColor: { value: cloudColor },
            }}
            vertexShader={/* glsl */ `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={/* glsl */ `
              uniform sampler2D uClouds;
              uniform float uOpacity;
              uniform vec3 uCloudColor;
              varying vec2 vUv;
              void main() {
                vec3 c = texture2D(uClouds, vUv).rgb;
                float a = max(c.r, max(c.g, c.b)) * uOpacity;
                gl_FragColor = vec4(uCloudColor * c, a);
              }
            `}
          />
        </mesh>
      )}

      {set.atmosphere && (
        <AtmosphereShell radius={radius} reducedMotion={reducedMotion} palette={palette} />
      )}
      {set.atmosphere && <OuterGlow radius={radius} palette={palette} />}
    </group>
  );
}

export type { EarthQuality, EarthTextureSet };
