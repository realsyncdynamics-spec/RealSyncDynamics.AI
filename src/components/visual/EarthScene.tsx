import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * EarthScene — Europa-zentrierte 3D-Erde (Three.js + R3F).
 *
 * Visuelles Zielbild: GovTech-/Enterprise-Hero mit
 *   - fotorealistischer Tag-/Nacht-Erde (NASA Blue Marble, public domain,
 *     lokal unter /public/textures/planets — kein externer Runtime-Call)
 *   - City-Lights auf der Nachtseite über einen Tag/Nacht-Shader (Terminator)
 *   - Atmosphären-Rim-Glow (cyan/blau, additiv)
 *   - dünner Wolkenschicht
 *   - Sternenfeld mit langsamer Drift
 *
 * Sonnenrichtung kommt von rechts/oben → Europa (Front) liegt in der Dämmerung
 * und zeigt Lichter, der rechte Rand bekommt einen warmen Sonnenaufgang-Saum.
 *
 * Default-Export für Code-Splitting via React.lazy (eigener vendor-three-Chunk).
 * Respektiert prefers-reduced-motion: Rotation wird dann eingefroren.
 */

const TEX = (file: string) => `${import.meta.env.BASE_URL}textures/planets/${file}`;
const SUN_DIRECTION = new THREE.Vector3(1.5, 0.45, 0.35).normalize();

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Earth() {
  const groupRef = useRef<THREE.Group>(null!);
  const cloudRef = useRef<THREE.Mesh>(null!);

  const [dayMap, nightMap, cloudMap] = useLoader(THREE.TextureLoader, [
    TEX('earth_atmos_2048.jpg'),
    TEX('earth_lights_2048.png'),
    TEX('earth_clouds_1024.png'),
  ]);

  useMemo(() => {
    [dayMap, nightMap, cloudMap].forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });
  }, [dayMap, nightMap, cloudMap]);

  const surfaceMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayMap },
          nightTexture: { value: nightMap },
          sunDirection: { value: SUN_DIRECTION },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormalW;
          void main() {
            vUv = uv;
            vNormalW = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D dayTexture;
          uniform sampler2D nightTexture;
          uniform vec3 sunDirection;
          varying vec2 vUv;
          varying vec3 vNormalW;
          void main() {
            float intensity = dot(normalize(vNormalW), normalize(sunDirection));
            float dayMix = smoothstep(-0.12, 0.30, intensity);
            vec3 day = texture2D(dayTexture, vUv).rgb;
            vec3 night = texture2D(nightTexture, vUv).rgb * 1.65;
            // warmer Dämmerungs-Saum am Terminator
            float twilight = (1.0 - abs(intensity)) * smoothstep(-0.25, 0.15, intensity);
            vec3 color = mix(night, day, dayMix);
            color += vec3(0.35, 0.18, 0.05) * twilight * 0.6;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [dayMap, nightMap],
  );

  useFrame((_, delta) => {
    if (prefersReducedMotion) return;
    // ~0,5°/s ≈ 0.0087 rad/s
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0087;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.011;
  });

  return (
    <group ref={groupRef} rotation={[0.18, -1.9, 0.22]}>
      <mesh material={surfaceMaterial}>
        <sphereGeometry args={[1, 96, 96]} />
      </mesh>
      <mesh ref={cloudRef} scale={1.004}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={cloudMap}
          alphaMap={cloudMap}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { sunDirection: { value: SUN_DIRECTION } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          void main() {
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 sunDirection;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          void main() {
            float rim = pow(1.0 - abs(dot(vViewDir, vNormalW)), 2.6);
            float lit = smoothstep(-0.35, 0.55, dot(normalize(vNormalW), normalize(sunDirection)));
            vec3 color = mix(vec3(0.04, 0.18, 0.42), vec3(0.22, 0.66, 0.95), lit);
            gl_FragColor = vec4(color, rim * (0.45 + 0.65 * lit));
          }
        `,
      }),
    [],
  );

  return (
    <mesh scale={1.14} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

function Starfield() {
  const ref = useRef<THREE.Points>(null!);
  const geometry = useMemo(() => {
    const count = 1300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 14 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useFrame((_, delta) => {
    if (prefersReducedMotion) return;
    if (ref.current) ref.current.rotation.y += delta * 0.004;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.06} color="#bcd6ff" sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}

export default function EarthScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.05], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.8]}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 1.8, 1.4]} intensity={1.1} color="#fff6e8" />
      <Starfield />
      <Atmosphere />
      <Earth />
    </Canvas>
  );
}
