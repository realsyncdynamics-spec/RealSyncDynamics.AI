# Earth textures — sources & licenses

Used by `PhotorealEarthMesh` (Governance Sphere + `/welcome`).

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

Adaptive loading: boot with 2K day → upgrade to 4K (mobile/medium) or 8K (desktop high). Night, clouds, and specular load after first paint. Borders load async for the Governance Sphere geography layer.
