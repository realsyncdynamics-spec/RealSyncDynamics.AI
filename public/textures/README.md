# Earth textures — sources & licenses

Used by `PhotorealEarthMesh` (Governance Sphere + `/welcome`).

## Runtime assets

The fast baseline stays WebP. BasisLZ KTX2 is an adaptive GPU-memory path for memory-constrained devices on a non-slow connection; every KTX2 load falls back to the matching WebP asset if the transcoder, WebAssembly, GPU format, or request fails.

Day/night are sRGB. Cloud/specular masks are sampled linearly.

| Asset family | Resolution | WebP | KTX2 BasisLZ | Runtime role |
|---|---:|---:|---:|---|
| Day | 4096×2048 | 325 KB | 692 KB | High/desktop day surface |
| Day | 2048×1024 | 94 KB | 204 KB | Boot + low/medium day surface |
| Night | 2048×1024 | 47 KB | 168 KB | City-light layer |
| Clouds | 2048×1024 | 339 KB | 352 KB | Cloud layer |
| Specular | 1024×512 | 30 KB | 40 KB | Water/specular mask |
| **Total** | — | **835 KB measured** | **1,481,834 bytes measured** | Texture files only |

The KTX2 route also needs `public/basis/basis_transcoder.js` and `basis_transcoder.wasm`. Because the KTX2 network payload is larger than WebP, it is deliberately **not** the default path for unconstrained devices. Its purpose is reducing decoded GPU texture residency through hardware block compression.

KTX2 generation uses Khronos KTX-Software 4.4.2, pinned by SHA-256 in the generator workflow used to create the committed binaries. Reproduction is available through `scripts/generate-globe-ktx2.sh`; the one-off workflow itself is not shipped on `main`.

The Basis transcoder files are copied from the installed Three.js distribution and are used by `KTX2Loader`. Basis Universal's transcoder is Apache-2.0 licensed.

## Canonical source assets (not deployed)

| File | Resolution | Source | License |
|------|------------|--------|---------|
| `assets-source/globe/earth-day-8k.jpg` | 8192×4096 | Solar System Scope Earth Day Map | CC BY 4.0 — credit Solar System Scope |
| `assets-source/globe/earth-clouds-4k.jpg` | 4096×2048 | Solar System Scope Earth Clouds | CC BY 4.0 — credit Solar System Scope |
| `assets-source/globe/earth-night-4k.jpg` | 4096×2048 | three-globe example `earth-night.jpg` (NASA city lights lineage) | NASA imagery (public domain) / package example asset |
| `assets-source/globe/earth-specular.jpg` | 2048×1024 | three.js examples `earth_specular_2048.jpg` | three.js examples (MIT) / NASA-derived water mask |

**Attribution:** Earth surface & cloud maps © Solar System Scope (CC BY 4.0), based on NASA Blue Marble / elevation data.

| `earth-borders-110m.json` | — | Country border line segments derived from world-atlas `countries-110m` (Natural Earth) | Natural Earth / BSD-3 (world-atlas) |

Adaptive loading: boot with 2K WebP day. Low/reduced-motion stays day-only. Medium uses 2K day + 2K overlays. High desktop upgrades the day surface to 4K while keeping night/cloud/specular at 2K/2K/1K. On eligible memory-constrained devices, the progressive upgrade prefers KTX2 BasisLZ and falls back to WebP. Borders load async for the Governance Sphere geography layer.
