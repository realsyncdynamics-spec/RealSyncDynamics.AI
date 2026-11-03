/**
 * 3D-Universum der Unternehmens-Landing v5 (/unternehmen) — Port des
 * `<script type="module">` aus `design_handoff_realsync_v5/reference/
 * RealSync Dynamics v5.html` (Z. 599–853). Basis ist die v4-Szene
 * (src/components/landing/v4/heroEarthScene.ts); übernommen sind nur die
 * Unterschiede der v5-Referenz:
 * - Gold statt Cyan (Gradnetz, Atmosphäre, Fülllicht, Sonnen-Variablen 34…46°)
 * - Erde zentriert, `scale = min(3.7, vw·.27)` (schmal ·.34), `y = −1.45 − s·.1`,
 *   folgt der Maus (x ±.17, y ±.11); Exposure 1,22; DPR max 1,75 (mobil 1,5)
 * - Mond-Bahnradius 1,7·s; Mars ohne Ring auf eigener Bahn
 * - Tiefer Raum: 3 Nebel, Spiralgalaxie, Asteroidengürtel (260 Instanzen),
 *   Sternschnuppen alle 5–14 s
 * - Scroll-Kamerafahrt in drei Stufen: 0–13 % Zoom Erde, 28–50 % Mond, 66–92 % Mars
 * - Ein fixer Canvas hinter der ganzen Seite: gerendert wird immer, außer bei
 *   verstecktem Tab.
 *
 * Abweichungen zur Referenz, ohne sichtbare Änderung:
 * - Texturen self-hosted unter /textures/hero-v4/ (byte-gleich zu den
 *   CDN-Dateien der Referenz; CSP, keine Drittanbieter-Requests).
 * - `scene.backgroundRotation` wird nicht gesetzt (Referenz lief auf r160, wo es
 *   die Eigenschaft noch nicht gab) — wie in der v4-Szene.
 * - Mausposition kommt über `pointer` statt `window.__mx/__my`.
 * - Reduced Motion: statisches Bild in Ausgangsstellung (die Referenz rendert
 *   dort ein unbewegtes Bild ohne Sonne).
 */
import * as THREE from 'three';

const TEX = '/textures/hero-v4/';
const PASS = 42; // ISS-Überflug alle 42 s …
const PASS_LEN = 16; // … sichtbar 16 s
// Die Referenz deklariert mouseX/mouseY für den Sonnenstand, setzt sie aber nie.
const mouseX = 0;
const mouseY = 0;

const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/** Normierte Mausposition (−0,5 … 0,5), gemeinsam mit den Hero-Tafeln genutzt. */
export interface ScenePointer {
  x: number;
  y: number;
}

export interface SpaceSceneOptions {
  canvas: HTMLCanvasElement;
  /** Element, an dem die Sonnen-CSS-Variablen gesetzt werden. */
  cssTarget: HTMLElement;
  pointer: ScenePointer;
}

export function mountSpaceScene({ canvas, cssTarget, pointer }: SpaceSceneOptions): () => void {
  let disposed = false;
  let raf = 0;
  const cleanups: Array<() => void> = [];
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
    addEventListener(type, fn, { passive: true });
    cleanups.push(() => removeEventListener(type, fn));
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  cam.position.set(0, 0, 9);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scrollhöhe gecacht (Referenz: ResizeObserver auf <body> + resize/load).
  let maxS = 1;
  const measure = () => {
    maxS = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  };
  measure();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    cleanups.push(() => ro.disconnect());
  }

  const L = new THREE.TextureLoader();
  const MAXA = renderer.capabilities.getMaxAnisotropy();
  const load = (u: string, srgb = true) =>
    new Promise<THREE.Texture | null>((res) =>
      L.load(
        u,
        (t) => {
          t.anisotropy = MAXA;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.generateMipmaps = true;
          if (srgb) t.colorSpace = THREE.SRGBColorSpace;
          res(t);
        },
        undefined,
        () => res(null),
      ),
    );

  void (async () => {
    const [dayT, nightT, normT, specT, cloudT, moonT] = await Promise.all([
      load(TEX + 'earth-blue-marble.jpg'),
      load(TEX + 'earth-night.jpg'),
      load(TEX + 'earth_normal_2048.jpg', false),
      load(TEX + 'earth_specular_2048.jpg', false),
      load(TEX + 'earth_clouds_1024.png'),
      load(TEX + 'moon_1024.jpg'),
    ]);
    if (disposed) {
      [dayT, nightT, normT, specT, cloudT, moonT].forEach((t) => t?.dispose());
      return;
    }

    // ── Milchstraße: prozedurale Skybox (Equirect 4096×2048) ──
    const sky = document.createElement('canvas');
    sky.width = 4096;
    sky.height = 2048;
    const sk = sky.getContext('2d')!;
    sk.fillStyle = '#000';
    sk.fillRect(0, 0, 4096, 2048);
    const R = seeded(97);
    // Band (leicht geneigt) — Nebel
    sk.save();
    sk.translate(2048, 1024);
    sk.rotate(-0.28);
    for (let i = 0; i < 1400; i++) {
      const x = (R() - 0.5) * 5200, y = (R() - 0.5) * 2 * (90 + 120 * Math.pow(R(), 2.2)), r = 40 + R() * 160;
      const gd = sk.createRadialGradient(x, y, 0, x, y, r);
      const warm = R() < 0.55;
      gd.addColorStop(0, warm ? 'rgba(210,190,170,' + (0.025 + R() * 0.04) + ')' : 'rgba(150,170,220,' + (0.02 + R() * 0.035) + ')');
      gd.addColorStop(1, 'rgba(0,0,0,0)');
      sk.fillStyle = gd;
      sk.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Dunkelwolken im Band
    for (let i = 0; i < 260; i++) {
      const x = (R() - 0.5) * 5200, y = (R() - 0.5) * 160, r = 30 + R() * 110;
      const gd = sk.createRadialGradient(x, y, 0, x, y, r);
      gd.addColorStop(0, 'rgba(0,0,0,' + (0.25 + R() * 0.35) + ')');
      gd.addColorStop(1, 'rgba(0,0,0,0)');
      sk.fillStyle = gd;
      sk.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Sterne im Band, dicht
    for (let i = 0; i < 26000; i++) {
      const x = (R() - 0.5) * 5200, y = (R() - 0.5) * 2 * (60 + 260 * Math.pow(R(), 1.6));
      const r = R() < 0.02 ? 1.4 + R() * 1.2 : 0.3 + R() * 0.8, al = 0.35 + R() * 0.65;
      sk.fillStyle = R() < 0.15 ? 'rgba(255,225,190,' + al + ')' : 'rgba(235,240,255,' + al + ')';
      sk.beginPath();
      sk.arc(x, y, r, 0, 6.28);
      sk.fill();
    }
    sk.restore();
    // Sterne überall
    for (let i = 0; i < 9000; i++) {
      const x = R() * 4096, y = R() * 2048, r = R() < 0.03 ? 1.4 + R() * 1.4 : 0.3 + R() * 0.9, al = 0.3 + R() * 0.7;
      sk.fillStyle = R() < 0.2 ? 'rgba(255,225,190,' + al + ')' : R() < 0.3 ? 'rgba(190,205,255,' + al + ')' : 'rgba(240,244,255,' + al + ')';
      sk.beginPath();
      sk.arc(x, y, r, 0, 6.28);
      sk.fill();
    }
    // Spiralgalaxie oben rechts
    sk.save();
    sk.translate(3400, 560);
    sk.rotate(0.5);
    sk.scale(1, 0.55);
    for (let arm = 0; arm < 2; arm++)
      for (let i = 0; i < 2200; i++) {
        const t = R() * 5.5, rr = 12 + t * 36 + (R() - 0.5) * 26, ang = t + arm * Math.PI + (R() - 0.5) * 0.5;
        const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
        const gd = sk.createRadialGradient(x, y, 0, x, y, 6 + R() * 10);
        gd.addColorStop(0, 'rgba(' + (R() < 0.4 ? '255,225,200' : '190,210,255') + ',' + (0.06 + R() * 0.12) + ')');
        gd.addColorStop(1, 'rgba(0,0,0,0)');
        sk.fillStyle = gd;
        sk.fillRect(x - 16, y - 16, 32, 32);
      }
    {
      const gd = sk.createRadialGradient(0, 0, 0, 0, 0, 90);
      gd.addColorStop(0, 'rgba(255,245,225,.95)');
      gd.addColorStop(0.25, 'rgba(255,225,190,.45)');
      gd.addColorStop(1, 'rgba(0,0,0,0)');
      sk.fillStyle = gd;
      sk.fillRect(-90, -90, 180, 180);
    }
    sk.restore();
    // ein paar helle Sterne mit Glow
    for (let i = 0; i < 40; i++) {
      const x = R() * 4096, y = R() * 2048, r = 6 + R() * 14;
      const gd = sk.createRadialGradient(x, y, 0, x, y, r);
      gd.addColorStop(0, 'rgba(255,255,255,.95)');
      gd.addColorStop(0.25, 'rgba(235,238,242,.35)');
      gd.addColorStop(1, 'rgba(0,0,0,0)');
      sk.fillStyle = gd;
      sk.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const skyT = new THREE.CanvasTexture(sky);
    skyT.colorSpace = THREE.SRGBColorSpace;
    skyT.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = skyT;
    scene.backgroundIntensity = 0.28;

    // ── fliegende Sterne ──
    const N = 1800, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 160;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 2] = -Math.random() * 200;
      const warm = Math.random() < 0.2, c = warm ? [1, 0.85, 0.7] : Math.random() < 0.3 ? [0.75, 0.85, 1] : [0.95, 0.96, 1];
      col.set(c, i * 3);
      siz[i] = Math.random() < 0.04 ? 2.4 + Math.random() * 1.6 : 0.5 + Math.random() * 1.2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    const starsMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { uT: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
      vertexShader: 'attribute float aSize; varying vec3 vC; varying float vTw; uniform float uT; uniform float uPR; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); vTw = 0.55+0.45*sin(uT*1.7+position.x*3.1+position.y*2.3); gl_PointSize = aSize*uPR*(140.0/-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vTw; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vC, a*vTw*0.45); }',
    });
    const stars = new THREE.Points(sg, starsMat);
    scene.add(stars);

    // ── Erde (Blue Marble + Nachtlichter + Normal + Specular + Wolken) ──
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayT, normalMap: normT, normalScale: new THREE.Vector2(1.9, 1.9), specularMap: specT,
      specular: new THREE.Color(0x7a7266), shininess: 30, emissiveMap: nightT, emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 2.2,
    });
    // Stadtlichter nur auf der Nachtseite: weicher Übergang an der Terminator-Linie
    earthMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n  float gr = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);\n  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.68, 0.92, 0.62), smoothstep(0.0, 0.07, gr));\n  float mtn = smoothstep(0.35, 0.7, (diffuseColor.r + diffuseColor.g) * 0.5) * (1.0 - smoothstep(0.0, 0.05, gr)) * step(0.1, diffuseColor.r - diffuseColor.b);\n  diffuseColor.rgb *= 1.0 + 0.25 * mtn;',
      );
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  #if NUM_DIR_LIGHTS > 0\n  float sunN = dot(normal, directionalLights[0].direction);\n  totalEmissiveRadiance *= 1.0 - smoothstep(-0.18, 0.12, sunN);\n  #endif',
      );
    };
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 192), earthMat);
    earthGroup.add(earth);
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.008, 160, 160),
      new THREE.MeshLambertMaterial({ map: cloudT, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    earthGroup.add(clouds);
    const cshadow = new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 128, 128),
      new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: cloudT, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    earthGroup.add(cshadow);
    // Feines Gold-Gradnetz (Breiten-/Längenkreise)
    const grat = new THREE.Group();
    {
      const gm = new THREE.LineBasicMaterial({ color: 0xd9a85a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts: THREE.Vector3[] = [], r = Math.cos((lat * Math.PI) / 180) * 1.012, y = Math.sin((lat * Math.PI) / 180) * 1.012;
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * 6.2832;
          pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
        }
        grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gm));
      }
      for (let lon = 0; lon < 180; lon += 30) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * 6.2832;
          pts.push(new THREE.Vector3(
            Math.cos(a) * 1.012 * Math.cos((lon * Math.PI) / 180),
            Math.sin(a) * 1.012,
            Math.sin((lon * Math.PI) / 180) * Math.cos(a) * 1.012,
          ));
        }
        grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gm));
      }
    }
    earthGroup.add(grat);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.32, 1.325, 256),
      new THREE.MeshBasicMaterial({ color: 0xf2c98a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = Math.PI / 2;
    earthGroup.add(ring);
    // Atmosphäre: Rückseiten-Streuung, Nachtseite blau, Tagseite gold — kein Frontring
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { uSun: { value: new THREE.Vector3(-1, 0.55, 0.6).normalize() } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(normalMatrix*normal); vW = normalize((modelMatrix*vec4(normal,0.0)).xyz); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vN; varying vec3 vW; uniform vec3 uSun; void main(){ float d = dot(vN, vec3(0,0,1.0)); float rim = pow(max(0.0, 0.7 - d), 2.6); float lit = clamp(dot(vW, uSun)*0.5+0.5, 0.0, 1.0); vec3 c = mix(vec3(0.05,0.14,0.34), vec3(0.98,0.74,0.4), pow(lit,1.4)); gl_FragColor = vec4(c, 1.0)*rim*1.7*(0.3+0.7*lit); }',
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 96), atmoMat);
    earthGroup.add(atmo);
    earthGroup.rotation.z = -0.409;
    earth.rotation.y = 4.9;
    clouds.rotation.y = 4.9;
    cshadow.rotation.y = 4.9; // Europa zur Kamera

    // ── Mond ──
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 64, 64),
      new THREE.MeshPhongMaterial({ map: moonT, shininess: 2, specular: new THREE.Color(0x111111), emissiveMap: moonT, emissive: new THREE.Color(0x9aa4b4), emissiveIntensity: 0.5 }),
    );
    scene.add(moon);
    moon.visible = !!moonT;

    // ── Sonne: Scheibe mit realem Winkeldurchmesser (0,53°) + Korona-Glow ──
    const glowC = document.createElement('canvas');
    glowC.width = glowC.height = 512;
    {
      const g = glowC.getContext('2d')!, gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.05, 'rgba(255,252,240,1)');
      gr.addColorStop(0.12, 'rgba(255,228,175,.8)');
      gr.addColorStop(0.3, 'rgba(242,201,138,.3)');
      gr.addColorStop(0.6, 'rgba(242,201,138,.08)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 512);
    }
    const SUN_D = 90, SUN_R = SUN_D * Math.tan(THREE.MathUtils.degToRad(0.265));
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 32, 32), new THREE.MeshBasicMaterial({ color: 0xfffaf0, toneMapped: false }));
    scene.add(sunDisc);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowC), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
    sunGlow.renderOrder = 10;
    sunGlow.scale.setScalar(SUN_R * 95);
    scene.add(sunGlow);

    // Korona-Strahlen + Lens-Flare
    const rayC = document.createElement('canvas');
    rayC.width = rayC.height = 512;
    {
      const g = rayC.getContext('2d')!;
      g.translate(256, 256);
      const r0 = seeded(5);
      for (let i = 0; i < 90; i++) {
        const a = r0() * 6.283, len = 70 + r0() * 186, w = 0.004 + r0() * 0.012;
        const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        gr.addColorStop(0, 'rgba(255,236,200,.55)');
        gr.addColorStop(1, 'rgba(255,236,200,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len);
        g.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len);
        g.fill();
      }
    }
    const sunRays = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(rayC), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false, opacity: 0.8 }));
    sunRays.renderOrder = 9;
    sunRays.scale.setScalar(SUN_R * 70);
    scene.add(sunRays);
    const ghostC = document.createElement('canvas');
    ghostC.width = ghostC.height = 128;
    {
      const g = ghostC.getContext('2d')!, gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
      gr.addColorStop(0, 'rgba(242,201,138,0)');
      gr.addColorStop(0.8, 'rgba(242,201,138,.35)');
      gr.addColorStop(1, 'rgba(242,201,138,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }
    const ghostT = new THREE.CanvasTexture(ghostC);
    const ghosts = ([[-0.35, 5, 0xf2c98a], [-0.7, 9, 0xd9a85a], [-1.1, 3.5, 0xf2c98a], [-1.5, 14, 0xd9a85a]] as const).map(([k, s, c]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ghostT, color: c, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false, opacity: 0.5 }));
      sp.renderOrder = 11;
      sp.userData = { k, s };
      scene.add(sp);
      return sp;
    });
    const _g = new THREE.Vector3();

    // ── Mars (prozedural) ──
    const speckle = (g: CanvasRenderingContext2D, w: number, hgt: number, n: number, colr: string, rmin: number, rmax: number, seed: number) => {
      const r = seeded(seed);
      for (let i = 0; i < n; i++) {
        const x = r() * w, y = r() * hgt, rad = rmin + r() * (rmax - rmin), al = 0.15 + r() * 0.5;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, colr.replace('A', String(al)));
        grd.addColorStop(1, colr.replace('A', '0'));
        g.fillStyle = grd;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    };
    const crater = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, light: number) => {
      const grd = g.createRadialGradient(x, y, rad * 0.2, x, y, rad);
      grd.addColorStop(0, 'rgba(40,14,6,.55)');
      grd.addColorStop(0.75, 'rgba(60,24,10,.25)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, rad, 0, 6.28);
      g.fill();
      g.strokeStyle = 'rgba(235,170,130,' + light + ')';
      g.lineWidth = Math.max(1, rad * 0.12);
      g.beginPath();
      g.arc(x, y, rad * 0.95, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    };
    const mc = document.createElement('canvas');
    mc.width = 2048;
    mc.height = 1024;
    const mg = mc.getContext('2d')!;
    const mgd = mg.createLinearGradient(0, 0, 0, 1024);
    mgd.addColorStop(0, '#9a5236');
    mgd.addColorStop(0.35, '#c07048');
    mgd.addColorStop(0.6, '#ad5d3a');
    mgd.addColorStop(1, '#88452b');
    mg.fillStyle = mgd;
    mg.fillRect(0, 0, 2048, 1024);
    speckle(mg, 2048, 1024, 1400, 'rgba(240,170,120,A)', 20, 140, 51);
    speckle(mg, 2048, 1024, 1200, 'rgba(90,35,15,A)', 20, 160, 53);
    speckle(mg, 2048, 1024, 900, 'rgba(60,25,12,A)', 8, 60, 57);
    mg.fillStyle = 'rgba(70,30,15,.45)';
    mg.beginPath();
    mg.ellipse(1250, 430, 210, 150, 0.3, 0, 6.28);
    mg.fill();
    mg.fillStyle = 'rgba(70,30,15,.35)';
    mg.beginPath();
    mg.ellipse(560, 620, 300, 120, -0.2, 0, 6.28);
    mg.fill();
    mg.strokeStyle = 'rgba(50,18,8,.7)';
    mg.lineWidth = 26;
    mg.lineCap = 'round';
    mg.beginPath();
    mg.moveTo(300, 560);
    mg.bezierCurveTo(500, 520, 700, 600, 940, 560);
    mg.stroke();
    mg.strokeStyle = 'rgba(240,170,120,.45)';
    mg.lineWidth = 6;
    mg.beginPath();
    mg.moveTo(300, 545);
    mg.bezierCurveTo(500, 505, 700, 585, 940, 545);
    mg.stroke();
    const cr = seeded(61);
    for (let i = 0; i < 160; i++) crater(mg, cr() * 2048, 120 + cr() * 780, 6 + cr() * cr() * 60, 0.35 + cr() * 0.4);
    const om = mg.createRadialGradient(1700, 380, 0, 1700, 380, 120);
    om.addColorStop(0, 'rgba(230,160,120,.7)');
    om.addColorStop(0.3, 'rgba(160,80,50,.5)');
    om.addColorStop(1, 'rgba(0,0,0,0)');
    mg.fillStyle = om;
    mg.fillRect(1560, 240, 280, 280);
    let pc = mg.createLinearGradient(0, 0, 0, 120);
    pc.addColorStop(0, 'rgba(245,240,235,.95)');
    pc.addColorStop(1, 'rgba(245,240,235,0)');
    mg.fillStyle = pc;
    mg.fillRect(0, 0, 2048, 120);
    pc = mg.createLinearGradient(0, 1024, 0, 940);
    pc.addColorStop(0, 'rgba(245,240,235,.9)');
    pc.addColorStop(1, 'rgba(245,240,235,0)');
    mg.fillStyle = pc;
    mg.fillRect(0, 940, 2048, 84);
    const mb = document.createElement('canvas');
    mb.width = 1024;
    mb.height = 512;
    const mbg = mb.getContext('2d')!;
    mbg.fillStyle = '#808080';
    mbg.fillRect(0, 0, 1024, 512);
    speckle(mbg, 1024, 512, 1500, 'rgba(255,255,255,A)', 4, 40, 71);
    speckle(mbg, 1024, 512, 1500, 'rgba(0,0,0,A)', 4, 40, 73);
    const T = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 8;
      return t;
    };
    const marsMap = T(mc);
    marsMap.colorSpace = THREE.SRGBColorSpace;
    const marsGroup = new THREE.Group();
    scene.add(marsGroup);
    marsGroup.visible = false;
    const mars = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 96, 96),
      new THREE.MeshPhongMaterial({ map: marsMap, bumpMap: T(mb), bumpScale: 0.02, shininess: 4, specular: new THREE.Color(0x221108) }),
    );
    marsGroup.add(mars);
    const marsAtmo = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vN; void main(){ float d = dot(vN, vec3(0,0,1.0)); float i = pow(max(0.0, 0.64 - d), 3.2); gl_FragColor = vec4(0.95,0.6,0.4,1.0)*i*0.8; }',
      }),
    );
    marsGroup.add(marsAtmo);
    // v5: Mars ohne Ringsystem.

    // ── Tieferes Universum: Nebel, Galaxie, Asteroidengürtel, Sternschnuppen ──
    const nebC = (cols: readonly string[], seed: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d')!, r = seeded(seed);
      for (let i = 0; i < 46; i++) {
        const x = 130 + r() * 252, y = 130 + r() * 252, rad = 60 + r() * 150, col = cols[i % cols.length];
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(' + col + ',' + (0.05 + r() * 0.09) + ')');
        gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 512, 512);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const deepSpace: THREE.Sprite[] = (
      [
        [[-30, 12, -80], 90, ['182,130,53', '120,80,40'], 5, 0.46],
        [[34, -8, -95], 110, ['60,96,170', '90,70,150'], 9, 0.44],
        [[2, 26, -110], 120, ['170,80,100', '182,130,53'], 14, 0.34],
      ] as const
    ).map(([pp, sc, cols, sd, op]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebC(cols, sd), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: op, toneMapped: false, fog: false }));
      sp.position.set(pp[0], pp[1], pp[2]);
      sp.scale.setScalar(sc);
      sp.renderOrder = -9;
      scene.add(sp);
      return sp;
    });
    {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!, r = seeded(23);
      const coreG = g.createRadialGradient(128, 128, 0, 128, 128, 46);
      coreG.addColorStop(0, 'rgba(255,238,205,.95)');
      coreG.addColorStop(1, 'rgba(255,238,205,0)');
      g.fillStyle = coreG;
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3600; i++) {
        const arm = i % 2, rr = Math.pow(r(), 1.4) * 112, an = rr * 0.055 + arm * Math.PI + (r() - 0.5) * 0.5;
        const x = 128 + Math.cos(an) * rr, y = 128 + Math.sin(an) * rr * 0.62;
        g.fillStyle = 'rgba(' + (r() > 0.6 ? '190,205,255' : '255,225,180') + ',' + (0.1 + r() * 0.45) + ')';
        g.fillRect(x, y, 1.3, 1.3);
      }
      const gt = new THREE.CanvasTexture(c);
      gt.colorSpace = THREE.SRGBColorSpace;
      const gal = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0.62, toneMapped: false, fog: false }));
      gal.material.rotation = 0.5;
      gal.position.set(36, 17, -120);
      gal.scale.setScalar(40);
      gal.renderOrder = -8;
      scene.add(gal);
      deepSpace.push(gal);
    }
    const belt = new THREE.Group();
    {
      const NB = 260;
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshPhongMaterial({ color: 0x8a7a68, shininess: 6, flatShading: true }), NB);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), r = seeded(101);
      for (let i = 0; i < NB; i++) {
        const an = r() * Math.PI * 2, rad = 15 + r() * 7, sc = 0.05 + Math.pow(r(), 3) * 0.24;
        e.set(r() * 6, r() * 6, r() * 6);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(Math.cos(an) * rad, (r() - 0.5) * 1.1, Math.sin(an) * rad), q, new THREE.Vector3(sc * (0.7 + r() * 0.6), sc, sc * (0.7 + r() * 0.6)));
        im.setMatrixAt(i, m4);
      }
      belt.add(im);
      belt.rotation.x = 1.22;
      belt.rotation.z = -0.18;
      belt.position.set(0, 3.2, -26);
      scene.add(belt);
    }
    const shootingStars = [0, 1, 2].map(() => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      l.frustumCulled = false;
      scene.add(l);
      return { l, t0: -1, next: 3 + Math.random() * 6, p: new THREE.Vector3(), v: new THREE.Vector3() };
    });
    const _hd = new THREE.Vector3(), _tl = new THREE.Vector3();
    const shoot = (T0: number) => {
      for (const st of shootingStars) {
        if (st.t0 < 0 && T0 > st.next) {
          st.t0 = T0;
          const k = Math.random() < 0.5 ? 1 : -1;
          st.p.set(cam.position.x + (Math.random() - 0.5) * 16 + k * 3, cam.position.y + 2 + Math.random() * 4, cam.position.z - 14);
          st.v.set(-k * 26, -9 - Math.random() * 6, 0);
        }
        if (st.t0 < 0) continue;
        const age = T0 - st.t0, life = 0.75;
        const mat = st.l.material as THREE.LineBasicMaterial;
        if (age > life) {
          st.t0 = -1;
          st.next = T0 + 5 + Math.random() * 9;
          mat.opacity = 0;
          continue;
        }
        _hd.copy(st.p).addScaledVector(st.v, age);
        _tl.copy(_hd).addScaledVector(st.v, -0.16);
        const pa = st.l.geometry.attributes.position as THREE.BufferAttribute;
        pa.setXYZ(0, _hd.x, _hd.y, _hd.z);
        pa.setXYZ(1, _tl.x, _tl.y, _tl.z);
        pa.needsUpdate = true;
        mat.opacity = Math.sin((Math.PI * age) / life) * 0.9;
      }
    };

    // ── ISS: Modell aus Primitiven (Truss, Module, 8 Solarpaneele, Radiatoren) ──
    const iss = new THREE.Group();
    const alu = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.7, roughness: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.3 });
    const panel = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, metalness: 0.6, roughness: 0.25, emissive: 0x0a1630, emissiveIntensity: 0.4 });
    const radMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.2, roughness: 0.6 });
    iss.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.06), alu));
    for (const x of [-1.05, -0.62, 0.62, 1.05])
      for (const y of [0.32, -0.32]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.008), panel);
        p.position.set(x, y, 0);
        iss.add(p);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), alu);
        s.position.set(x, y, 0.012);
        iss.add(s);
      }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 16), alu);
    core.rotation.x = Math.PI / 2;
    iss.add(core);
    const node = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 16), gold);
    node.rotation.z = Math.PI / 2;
    node.position.z = 0.25;
    iss.add(node);
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 16), alu);
    lab.rotation.z = Math.PI / 2;
    lab.position.set(0.28, 0, 0.42);
    iss.add(lab);
    for (const x of [-0.3, 0.3]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.008), radMat);
      r.position.set(x, -0.35, -0.08);
      r.rotation.y = 0.4;
      iss.add(r);
    }
    iss.scale.setScalar(0.11);
    iss.visible = false;
    scene.add(iss);

    // ── Licht ──
    scene.add(new THREE.AmbientLight(0x2a3a55, 0.16));
    const sun = new THREE.DirectionalLight(0xfff1dc, 3.6);
    sun.position.set(-8, 4.5, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb68235, 0.55);
    fill.position.set(5, 2, 8);
    scene.add(fill);

    // ── Layout ──
    const VW = () => 2 * 9 * Math.tan(THREE.MathUtils.degToRad(38) / 2) * cam.aspect;
    const place = () => {
      const vw = VW();
      const narrow = cam.aspect < 1.5;
      const s = Math.min(3.7, vw * (narrow ? 0.34 : 0.27));
      earthGroup.scale.setScalar(s);
      earthGroup.position.set(0, -1.45 - s * 0.1, 0);
    };
    const fit = () => {
      renderer.setSize(innerWidth, innerHeight, false);
      measure();
      cam.aspect = innerWidth / innerHeight;
      cam.updateProjectionMatrix();
      place();
    };
    fit();

    // Sonnenstand → CSS-Variablen
    let lastSun = -Infinity;
    const sunDir = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Vector3();
    scene.add(sun.target);
    const _ax = new THREE.Vector3();
    const pushSun = (T0: number) => {
      if (T0 - lastSun < 0.1) return;
      lastSun = T0;
      // Sonne sitzt sichtbar hinter dem Erdrand (oben-links), wandert langsam am Limb entlang; ihr Ort treibt das Licht
      const orb = T0 * 0.05, eg = earthGroup.position, es2 = earthGroup.scale.x;
      const a = 2.55 + Math.sin(orb) * 0.18 + mouseX * 0.2, rr = 1.05 + Math.sin(orb * 0.7) * 0.02;
      _t.set(eg.x + Math.cos(a) * es2 * rr, eg.y + Math.sin(a) * es2 * rr - mouseY * 0.2, 0);
      _n.copy(_t).project(cam);
      _n.x = Math.max(-0.92, Math.min(0.92, _n.x));
      _n.y = Math.max(-0.8, Math.min(0.72, _n.y));
      _n.z = 0.5;
      _t.copy(_n).unproject(cam);
      _d.copy(_t).sub(cam.position).normalize();
      sunDisc.position.copy(cam.position).addScaledVector(_d, SUN_D);
      sunGlow.position.copy(sunDisc.position);
      sun.position.copy(sunDisc.position);
      sun.target.position.copy(eg);
      // Lichtrichtung: vom Sonnenort aus, seitlich nach vorn gezogen → breite Tagsichel statt schmalem Rand
      sunDir.copy(sunDisc.position).sub(eg).normalize().add(_n.set(-0.85, 0.25, 1.05)).normalize();
      sun.position.copy(eg).addScaledVector(sunDir, 30);
      atmoMat.uniforms.uSun.value.copy(sunDir);
      const elev = (sunDir.y + 1) / 2, front = (sunDir.z + 1) / 2;
      const hue = Math.round(34 + elev * 8 + front * 4); // Gold → Warmweiß
      const sat = Math.round(82 - elev * 8), lig = Math.round(50 + elev * 10), k = (0.5 + front * 0.5).toFixed(2);
      cssTarget.style.setProperty('--sun-h', String(hue));
      cssTarget.style.setProperty('--sun-s', sat + '%');
      cssTarget.style.setProperty('--sun-l', lig + '%');
      cssTarget.style.setProperty('--sun-k', k);
    };

    const tgt = { s0: 0, s1: 0, s2: 0, e0: null as THREE.Vector3 | null };
    const _f = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
    const ss = (a: number, b: number, x: number) => {
      const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return u * u * (3 - 2 * u);
    };

    const step = (T0: number, dt: number) => {
      pushSun(T0);
      sunRays.position.copy(sunDisc.position);
      sunRays.material.rotation = T0 * 0.02;
      sunRays.scale.setScalar(SUN_R * (68 + Math.sin(T0 * 0.8) * 5));
      _g.copy(sunDisc.position).project(cam);
      ghosts.forEach((sp) => {
        const { k, s } = sp.userData as { k: number; s: number };
        _n.set(_g.x * k, _g.y * k, 0.5).unproject(cam);
        sp.position.copy(_n);
        sp.scale.setScalar(SUN_R * s * 1.6);
        sp.material.opacity = 0.5 * Math.max(0, 1 - Math.hypot(_g.x, _g.y) * 0.4);
      });
      earth.rotation.y += dt * 0.06;
      clouds.rotation.y += dt * 0.072;
      cshadow.rotation.y = clouds.rotation.y;
      grat.rotation.y = earth.rotation.y;
      earthGroup.rotation.x = 0.55;
      earthGroup.rotation.z = -0.409; // Achsneigung 23,44°
      // Erde folgt der Maus (x ±0,17, y ±0,11 bei pointer ∈ [−0,5; 0,5]).
      earthGroup.position.y = -1.45 - earthGroup.scale.x * 0.1 - pointer.y * 0.22;
      earthGroup.position.x += (pointer.x * 0.34 - earthGroup.position.x) * 0.06;
      const ang = T0 * 0.07, ex = earthGroup.position.x, es = earthGroup.scale.x;
      marsGroup.position.set(ex + Math.cos(ang) * 2.4, 2.2 + Math.sin(ang * 0.7) * 0.5, -1.6 + Math.sin(ang) * 1.2);
      mars.rotation.y += dt * 0.12;
      marsGroup.rotation.z = 0.35;
      belt.rotation.y += dt * 0.012;
      deepSpace.forEach((n, i) => {
        n.position.x += Math.sin(T0 * 0.02 + i) * dt * 0.12;
      });
      if (!reduce) shoot(T0);
      // Mond: 3D-Bahn um die Erde, Bahnneigung 5,1° + Blick leicht von oben; gebundene Rotation
      const ma = T0 * 0.045 + 2.4;
      moon.scale.setScalar((es * 0.273) / 0.27);
      _m.set(Math.cos(ma) * es * 1.7, 0, Math.sin(ma) * es * 1.7)
        .applyAxisAngle(_ax.set(1, 0, 0), 0.089 + 0.3)
        .applyAxisAngle(_ax.set(0, 0, 1), -0.12);
      moon.position.set(ex + _m.x, earthGroup.position.y + _m.y, _m.z);
      moon.rotation.set(0, -ma + Math.PI / 2, 0.089);
      // ISS: Orbit vor der Erde, unten-links nach oben-rechts, langsam taumelnd
      const ph = T0 % PASS;
      if (!reduce && ph < PASS_LEN) {
        const u = ph / PASS_LEN;
        iss.visible = true;
        const orb = -0.55 + u * 1.9;
        iss.position.set(ex + Math.cos(orb) * es * 1.12 - es * 0.15, earthGroup.position.y + Math.sin(orb) * es * 0.62 - 0.1, es * 1.05);
        iss.rotation.set(0.35, orb * 0.5 + T0 * 0.15, 0.2);
        iss.scale.setScalar(0.09 + Math.sin(u * Math.PI) * 0.05);
      } else iss.visible = false;
      // Scroll-Kamerafahrt: 0–13 % Zoom Erde, 28–50 % Mond, 66–92 % Mars
      const sp = Math.min(1, Math.max(0, scrollY / maxS));
      const kk = Math.min(1, dt * 3);
      tgt.s0 += (ss(0.0, 0.13, sp) - tgt.s0) * kk;
      tgt.s1 += (ss(0.28, 0.5, sp) - tgt.s1) * kk;
      tgt.s2 += (ss(0.66, 0.92, sp) - tgt.s2) * kk;
      marsGroup.visible = tgt.s2 > 0.01 || sp > 0.5;
      if (!tgt.e0) tgt.e0 = new THREE.Vector3(ex, earthGroup.position.y, 0);
      _f.set(0, tgt.e0.y * 0.75 * tgt.s0, 0);
      _f.lerp(_a.set(moon.position.x, moon.position.y + 0.1, 0), tgt.s1);
      _f.lerp(_b.set(marsGroup.position.x, marsGroup.position.y, 0), tgt.s2);
      let cz = 9 - 3.6 * tgt.s0;
      cz += (7.6 - cz) * tgt.s1;
      cz += (4.6 - cz) * tgt.s2;
      cam.position.set(_f.x, _f.y, cz);
      starsMat.uniforms.uT.value = T0;
      stars.rotation.z += dt * 0.006;
      const p = stars.geometry.attributes.position.array as Float32Array;
      for (let i = 2; i < p.length; i += 3) {
        p[i] += dt * 2.0;
        if (p[i] > 8) p[i] -= 200;
      }
      stars.geometry.attributes.position.needsUpdate = true;
    };

    if (reduce) {
      // Statisches Bild: Ausgangsstellung einmal berechnen, nur bei Resize neu zeichnen.
      step(0, 0);
      renderer.render(scene, cam);
      on('resize', () => {
        fit();
        lastSun = -Infinity;
        step(0, 0);
        renderer.render(scene, cam);
      });
    } else {
      on('resize', fit);
      let last = performance.now();
      const loop = (t: number) => {
        if (disposed) return;
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        if (!document.hidden) {
          step(t / 1000, dt);
          renderer.render(scene, cam);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
  })();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
        m.dispose();
      }
    });
    if (scene.background instanceof THREE.Texture) scene.background.dispose();
    renderer.dispose();
  };
}
