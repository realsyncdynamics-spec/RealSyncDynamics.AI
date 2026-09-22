/* =============================================================
   RealSync Dynamics AI — Frontend-Patch 03
   Erd-Texturen verkleinern: ~6,6 MB → ~700 KB
   Stand: 21.09.2026

   AUSFÜHREN im Repo-Root:
     npm i -D sharp
     node scripts/patch-03-texturen.mjs

   Danach die Pfade in der Three.js-Szene auf die .webp-Dateien
   umstellen und die alten JPGs erst löschen, wenn der Build
   grün ist.

   AUSGANGSLAGE (live gemessen):
     earth-day-8k.jpg .......... 4 458 KB
     earth-clouds-4k.jpg ....... 1 492 KB
     earth-night-4k.jpg .......... 451 KB
     earth-specular.jpg .......... 218 KB
     -------------------------------------
     Summe ..................... 6 619 KB

   Begründung der Zielgrößen: Der Globus wird im Hero mit rund
   600–900 CSS-Pixeln Durchmesser gerendert und ist zusätzlich
   abgedunkelt. Eine 8k-Äquirektangular-Textur (8192x4096) liefert
   dabei keinen sichtbaren Vorteil gegenüber 4k; die Wolken- und
   Specular-Maps sind noch unkritischer und vertragen 2k.
   ============================================================= */

import sharp from 'sharp'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

// Falls die Texturen woanders liegen: nur diese Zeile anpassen.
const SRC_DIR = 'public/textures'
const OUT_DIR = 'public/textures'

const JOBS = [
  // Tagseite: einmal 4k für Desktop, einmal 2k für Tablet/klein
  { in: 'earth-day-8k.jpg',     out: 'earth-day-4k.webp',      w: 4096, q: 76 },
  { in: 'earth-day-8k.jpg',     out: 'earth-day-2k.webp',      w: 2048, q: 74 },

  // Nachtseite: Lichter, verträgt starke Kompression
  { in: 'earth-night-4k.jpg',   out: 'earth-night-2k.webp',    w: 2048, q: 70 },

  // Wolken: weiches Graustufenbild, der größte Einsparhebel
  { in: 'earth-clouds-4k.jpg',  out: 'earth-clouds-2k.webp',   w: 2048, q: 68 },

  // Specular/Roughness: reine Maske, 1k genügt
  { in: 'earth-specular.jpg',   out: 'earth-specular-1k.webp', w: 1024, q: 65 },
]

const kb = (n) => Math.round(n / 1024)

await mkdir(OUT_DIR, { recursive: true })

let before = 0
let after = 0
const seen = new Set()

for (const job of JOBS) {
  const src = path.join(SRC_DIR, job.in)
  const dst = path.join(OUT_DIR, job.out)

  try {
    const s = await stat(src)
    if (!seen.has(job.in)) {
      before += s.size
      seen.add(job.in)
    }

    await sharp(src)
      .resize({ width: job.w, withoutEnlargement: true })
      .webp({ quality: job.q, effort: 6 })
      .toFile(dst)

    const d = await stat(dst)
    after += d.size

    console.log(
      `${job.in.padEnd(24)} ${String(kb(s.size)).padStart(5)} KB  ->  ` +
      `${job.out.padEnd(26)} ${String(kb(d.size)).padStart(5)} KB`
    )
  } catch (err) {
    console.error(`FEHLER bei ${job.in}: ${err.message}`)
    process.exitCode = 1
  }
}

console.log('\n' + '-'.repeat(72))
console.log(`Quellen gesamt : ${kb(before)} KB`)
console.log(`Ergebnis gesamt: ${kb(after)} KB`)
console.log(`Ersparnis      : ${kb(before - after)} KB (${Math.round((1 - after / before) * 100)} %)`)
console.log('-'.repeat(72))

/* -------------------------------------------------------------
   ANSCHLUSS in der Three.js-Szene: Textur nach Viewport wählen,
   damit Handys nicht die 4k-Variante ziehen.

     const big = window.matchMedia('(min-width: 1024px)').matches
     const loader = new THREE.TextureLoader()

     const day      = loader.load(big
       ? '/textures/earth-day-4k.webp'
       : '/textures/earth-day-2k.webp')
     const night    = loader.load('/textures/earth-night-2k.webp')
     const clouds   = loader.load('/textures/earth-clouds-2k.webp')
     const specular = loader.load('/textures/earth-specular-1k.webp')

     // Farbraum korrekt setzen, sonst wirkt WebP flauer als das JPG:
     day.colorSpace = THREE.SRGBColorSpace
     night.colorSpace = THREE.SRGBColorSpace
     // Masken bleiben linear:
     clouds.colorSpace = THREE.NoColorSpace
     specular.colorSpace = THREE.NoColorSpace

   STUFE 2 (optional, größter Effekt auf schwachen Geräten):
   KTX2/Basis statt WebP. Komprimierte Texturen werden direkt
   auf der GPU gehalten statt dekodiert im RAM zu liegen —
   spart auf Mittelklasse-Handys nochmals 60–80 % Speicher.
     npx @gltf-transform/cli ...  bzw.  toktx --bcmp
   Lohnt sich erst, wenn Stufe 1 live ist und misst.
   ------------------------------------------------------------- */
