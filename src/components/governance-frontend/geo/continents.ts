/**
 * Continent label anchors for Governance Sphere (default distance).
 * Placement is approximate geographic centroids — geography UX only.
 */

export interface ContinentLabel {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const CONTINENT_LABELS: readonly ContinentLabel[] = [
  { id: 'europe', name: 'Europa', lat: 50, lon: 15 },
  { id: 'africa', name: 'Afrika', lat: 5, lon: 20 },
  { id: 'asia', name: 'Asien', lat: 40, lon: 90 },
  { id: 'namerica', name: 'Nordamerika', lat: 45, lon: -100 },
  { id: 'samerica', name: 'Südamerika', lat: -15, lon: -60 },
  { id: 'oceania', name: 'Ozeanien', lat: -25, lon: 135 },
  { id: 'antarctica', name: 'Antarktika', lat: -78, lon: 0 },
];

/** Hide continent names once capitals dominate the view. */
export const CONTINENT_LABEL_MAX_ZOOM = 1.32;
