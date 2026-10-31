/** Deterministic, fictional terrain. NOT geographic or elevation data. */
export function terrainHeight(x: number, z: number): number {
  const hills = 1.8 * Math.sin(x * 0.13) * Math.cos(z * 0.12)
    + 1.4 * Math.sin(z * 0.24 + x * 0.06)
    + 0.05 * Math.max(0, Math.hypot(x, z) - 18);
  const lakeBasin = 6 * Math.exp(-(((x + 18) ** 2 + (z + 14) ** 2) / 190));
  return hills - lakeBasin;
}

/** No randomness or remote resources so the example is reproducible. */
export function treeLocations(): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  for (let x = -47; x <= 47; x += 7) {
    for (let z = -45; z <= 45; z += 8) {
      const px = x + Math.sin(x * 3.2 + z) * 2.5;
      const pz = z + Math.cos(z * 2.9 + x) * 2.3;
      const nearLake = Math.hypot(px + 18, pz + 14) < 13;
      const nearRoad = Math.abs(px - (4 + Math.sin(pz * 0.09) * 3)) < 5.5;
      const nearVillage = Math.hypot(px - 15, pz + 5) < 18;
      if (!nearLake && !nearRoad && !nearVillage) {
        points.push([px, terrainHeight(px, pz), pz]);
      }
    }
  }
  return points;
}
