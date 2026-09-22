# Earth textures — sources & licenses

Used by `PhotorealEarthMesh` (Governance Sphere + `/welcome`).

## Runtime assets

The renderer uses WebP at runtime. Day/night are sRGB; cloud/specular masks are sampled linearly where appropriate.

| File | Resolution | Runtime role | Source lineage | License |
|------|------------|--------------|----------------|---------|
| `earth-day-2k.webp` | 2048×1024 | Boot + low/medium day map | Generated from `earth-day-8k.jpg` | CC BY 4.0 — Solar System Scope |
| `earth-day-4k.webp` | 4096×2048 | High/desktop day map | Generated from `earth-day-8k.jpg` | CC BY 4.0 — Solar System Scope |
| `earth-night-2k.webp` | 2048×1024 | Night lights | Generated from `earth-night-4k.jpg` | NASA imagery (public domain) / three-globe example lineage |
| `earth-clouds-2k.webp` | 2048×1024 | Cloud layer | Generated from `earth-clouds-4k.jpg` | CC BY 4.0 — Solar System Scope |
| `earth-specular-1k.webp` | 1024×512 | Specular/water mask | Generated from `earth-specular.jpg` | three.js examples (MIT) / NASA-derived water mask |

Measured generator output on 2026-09-22: 6,619 KB of source JPEG inputs → 835 KB of WebP runtime assets (87% smaller). See `scripts/patch-03-texturen.mjs`.

## Source assets

| File | Resolution | Source | License |
|------|------------|--------|---------|
| `earth-day.jpg` | 2048×1024 | [Solar System Scope](https://www.solarsystemscope.com/textures/) Earth Day Map (downscaled from 8K) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — credit Solar System Scope |
| `earth-day-4k.jpg` | 4096×2048 | Solar System Scope Earth Day Map (downscaled from 8K) | CC BY 4.0 — credit Solar System Scope |
| `earth-day-8k.jpg` | 8192×4096 | Solar System Scope Earth Day Map | CC BY 4.0 — credit Solar System Scope |
| `earth-clouds.jpg` / `earth-clouds-4k.jpg` | 2K / 4K | Solar System Scope Earth Clouds (downscaled from 8K) | CC BY 4.0 — credit Solar System Scope |
| `earth-night.jpg` / `earth-night-4k.jpg` | 2K / 4K | [three-globe](https://github.com/vasturiano/three-globe) example `earth-night.jpg` (NASA city lights lineage) | NASA imagery (public domain) / package example asset |
| `earth-specular.jpg` | 2048×1024 | [three.js examples](https://github.com/mrdoob/three.js) `earth_specular_2048.jpg` | three.js examples (MIT) / NASA-derived water mask |

**Attribution:** Earth surface & cloud maps © Solar System Scope (CC BY 4.0), based on NASA Blue Marble / elevation data.

| `earth-borders-110m.json` | — | Country border line segments derived from [world-atlas](https://github.com/topojson/world-atlas) `countries-110m` (Natural Earth) | Natural Earth / BSD-3 (world-atlas) |

Adaptive loading: boot with 2K WebP day. Low/reduced-motion stays day-only. Medium uses 2K day + 2K overlays. High desktop upgrades the day surface to 4K while keeping night/cloud/specular at 2K/2K/1K. Borders load async for the Governance Sphere geography layer.
