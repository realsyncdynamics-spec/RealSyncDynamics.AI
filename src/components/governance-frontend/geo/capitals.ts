/**
 * World capitals for Governance Sphere progressive disclosure.
 * Geography only — no risk scores or live metrics.
 * Labels use common German names where they help EU customers.
 */

export type CapitalTier = 1 | 2 | 3;

export interface WorldCapital {
  /** Common label (DE-friendly where useful). */
  name: string;
  /** ISO 3166-1 alpha-2 country code. */
  iso2: string;
  lat: number;
  lon: number;
  /**
   * Progressive disclosure:
   * 1 = major hubs (show from light zoom)
   * 2 = regional capitals (medium zoom)
   * 3 = remaining (close zoom / hover)
   */
  tier: CapitalTier;
}

/** Curated set — not every UN capital; LOD-friendly for mobile. */
export const WORLD_CAPITALS: readonly WorldCapital[] = [
  // Tier 1 — globally / EU-relevant hubs
  { name: 'Berlin', iso2: 'DE', lat: 52.52, lon: 13.41, tier: 1 },
  { name: 'Paris', iso2: 'FR', lat: 48.86, lon: 2.35, tier: 1 },
  { name: 'London', iso2: 'GB', lat: 51.51, lon: -0.13, tier: 1 },
  { name: 'Brüssel', iso2: 'BE', lat: 50.85, lon: 4.35, tier: 1 },
  { name: 'Rom', iso2: 'IT', lat: 41.9, lon: 12.5, tier: 1 },
  { name: 'Madrid', iso2: 'ES', lat: 40.42, lon: -3.7, tier: 1 },
  { name: 'Amsterdam', iso2: 'NL', lat: 52.37, lon: 4.89, tier: 1 },
  { name: 'Wien', iso2: 'AT', lat: 48.21, lon: 16.37, tier: 1 },
  { name: 'Warschau', iso2: 'PL', lat: 52.23, lon: 21.01, tier: 1 },
  { name: 'Stockholm', iso2: 'SE', lat: 59.33, lon: 18.07, tier: 1 },
  { name: 'Dublin', iso2: 'IE', lat: 53.35, lon: -6.26, tier: 1 },
  { name: 'Lissabon', iso2: 'PT', lat: 38.72, lon: -9.14, tier: 1 },
  { name: 'Athen', iso2: 'GR', lat: 37.98, lon: 23.73, tier: 1 },
  { name: 'Washington, D.C.', iso2: 'US', lat: 38.91, lon: -77.04, tier: 1 },
  { name: 'Ottawa', iso2: 'CA', lat: 45.42, lon: -75.7, tier: 1 },
  { name: 'Brasilia', iso2: 'BR', lat: -15.79, lon: -47.88, tier: 1 },
  { name: 'Buenos Aires', iso2: 'AR', lat: -34.6, lon: -58.38, tier: 1 },
  { name: 'Mexiko-Stadt', iso2: 'MX', lat: 19.43, lon: -99.13, tier: 1 },
  { name: 'Tokio', iso2: 'JP', lat: 35.68, lon: 139.76, tier: 1 },
  { name: 'Peking', iso2: 'CN', lat: 39.9, lon: 116.41, tier: 1 },
  { name: 'New Delhi', iso2: 'IN', lat: 28.61, lon: 77.21, tier: 1 },
  { name: 'Seoul', iso2: 'KR', lat: 37.57, lon: 126.98, tier: 1 },
  { name: 'Singapur', iso2: 'SG', lat: 1.35, lon: 103.82, tier: 1 },
  { name: 'Canberra', iso2: 'AU', lat: -35.28, lon: 149.13, tier: 1 },
  { name: 'Pretoria', iso2: 'ZA', lat: -25.75, lon: 28.19, tier: 1 },
  { name: 'Kairo', iso2: 'EG', lat: 30.04, lon: 31.24, tier: 1 },
  { name: 'Abu Dhabi', iso2: 'AE', lat: 24.45, lon: 54.38, tier: 1 },
  { name: 'Moskau', iso2: 'RU', lat: 55.76, lon: 37.62, tier: 1 },

  // Tier 2 — regional capitals
  { name: 'Bern', iso2: 'CH', lat: 46.95, lon: 7.45, tier: 2 },
  { name: 'Prag', iso2: 'CZ', lat: 50.08, lon: 14.44, tier: 2 },
  { name: 'Budapest', iso2: 'HU', lat: 47.5, lon: 19.04, tier: 2 },
  { name: 'Bukarest', iso2: 'RO', lat: 44.43, lon: 26.1, tier: 2 },
  { name: 'Sofia', iso2: 'BG', lat: 42.7, lon: 23.32, tier: 2 },
  { name: 'Zagreb', iso2: 'HR', lat: 45.81, lon: 15.98, tier: 2 },
  { name: 'Belgrad', iso2: 'RS', lat: 44.82, lon: 20.46, tier: 2 },
  { name: 'Helsinki', iso2: 'FI', lat: 60.17, lon: 24.94, tier: 2 },
  { name: 'Oslo', iso2: 'NO', lat: 59.91, lon: 10.75, tier: 2 },
  { name: 'Kopenhagen', iso2: 'DK', lat: 55.68, lon: 12.57, tier: 2 },
  { name: 'Luxemburg', iso2: 'LU', lat: 49.61, lon: 6.13, tier: 2 },
  { name: 'Bratislava', iso2: 'SK', lat: 48.15, lon: 17.11, tier: 2 },
  { name: 'Ljubljana', iso2: 'SI', lat: 46.05, lon: 14.51, tier: 2 },
  { name: 'Tallinn', iso2: 'EE', lat: 59.44, lon: 24.75, tier: 2 },
  { name: 'Riga', iso2: 'LV', lat: 56.95, lon: 24.11, tier: 2 },
  { name: 'Vilnius', iso2: 'LT', lat: 54.69, lon: 25.28, tier: 2 },
  { name: 'Kyjiw', iso2: 'UA', lat: 50.45, lon: 30.52, tier: 2 },
  { name: 'Ankara', iso2: 'TR', lat: 39.93, lon: 32.86, tier: 2 },
  { name: 'Jerusalem', iso2: 'IL', lat: 31.77, lon: 35.22, tier: 2 },
  { name: 'Riad', iso2: 'SA', lat: 24.71, lon: 46.68, tier: 2 },
  { name: 'Teheran', iso2: 'IR', lat: 35.69, lon: 51.39, tier: 2 },
  { name: 'Islamabad', iso2: 'PK', lat: 33.68, lon: 73.05, tier: 2 },
  { name: 'Dhaka', iso2: 'BD', lat: 23.81, lon: 90.41, tier: 2 },
  { name: 'Bangkok', iso2: 'TH', lat: 13.76, lon: 100.5, tier: 2 },
  { name: 'Hanoi', iso2: 'VN', lat: 21.03, lon: 105.85, tier: 2 },
  { name: 'Jakarta', iso2: 'ID', lat: -6.21, lon: 106.85, tier: 2 },
  { name: 'Manila', iso2: 'PH', lat: 14.6, lon: 120.98, tier: 2 },
  { name: 'Kuala Lumpur', iso2: 'MY', lat: 3.14, lon: 101.69, tier: 2 },
  { name: 'Wellington', iso2: 'NZ', lat: -41.29, lon: 174.78, tier: 2 },
  { name: 'Santiago', iso2: 'CL', lat: -33.45, lon: -70.67, tier: 2 },
  { name: 'Lima', iso2: 'PE', lat: -12.05, lon: -77.04, tier: 2 },
  { name: 'Bogotá', iso2: 'CO', lat: 4.71, lon: -74.07, tier: 2 },
  { name: 'Caracas', iso2: 'VE', lat: 10.48, lon: -66.9, tier: 2 },
  { name: 'Lagos', iso2: 'NG', lat: 6.52, lon: 3.38, tier: 2 },
  { name: 'Nairobi', iso2: 'KE', lat: -1.29, lon: 36.82, tier: 2 },
  { name: 'Addis Abeba', iso2: 'ET', lat: 9.03, lon: 38.74, tier: 2 },
  { name: 'Accra', iso2: 'GH', lat: 5.56, lon: -0.19, tier: 2 },
  { name: 'Casablanca', iso2: 'MA', lat: 33.57, lon: -7.59, tier: 2 },
  { name: 'Algier', iso2: 'DZ', lat: 36.75, lon: 3.06, tier: 2 },
  { name: 'Tunis', iso2: 'TN', lat: 36.81, lon: 10.18, tier: 2 },

  // Tier 3 — closer zoom
  { name: 'Reykjavík', iso2: 'IS', lat: 64.15, lon: -21.94, tier: 3 },
  { name: 'Valletta', iso2: 'MT', lat: 35.9, lon: 14.51, tier: 3 },
  { name: 'Nikosia', iso2: 'CY', lat: 35.19, lon: 33.38, tier: 3 },
  { name: 'Tirana', iso2: 'AL', lat: 41.33, lon: 19.82, tier: 3 },
  { name: 'Skopje', iso2: 'MK', lat: 41.998, lon: 21.43, tier: 3 },
  { name: 'Sarajevo', iso2: 'BA', lat: 43.86, lon: 18.41, tier: 3 },
  { name: 'Podgorica', iso2: 'ME', lat: 42.43, lon: 19.26, tier: 3 },
  { name: 'Chișinău', iso2: 'MD', lat: 47.01, lon: 28.86, tier: 3 },
  { name: 'Tiflis', iso2: 'GE', lat: 41.72, lon: 44.79, tier: 3 },
  { name: 'Jerewan', iso2: 'AM', lat: 40.18, lon: 44.51, tier: 3 },
  { name: 'Baku', iso2: 'AZ', lat: 40.41, lon: 49.87, tier: 3 },
  { name: 'Astana', iso2: 'KZ', lat: 51.17, lon: 71.45, tier: 3 },
  { name: 'Taschkent', iso2: 'UZ', lat: 41.3, lon: 69.24, tier: 3 },
  { name: 'Kabul', iso2: 'AF', lat: 34.56, lon: 69.21, tier: 3 },
  { name: 'Bagdad', iso2: 'IQ', lat: 33.32, lon: 44.37, tier: 3 },
  { name: 'Amman', iso2: 'JO', lat: 31.95, lon: 35.93, tier: 3 },
  { name: 'Beirut', iso2: 'LB', lat: 33.89, lon: 35.5, tier: 3 },
  { name: 'Doha', iso2: 'QA', lat: 25.29, lon: 51.53, tier: 3 },
  { name: 'Kuwait', iso2: 'KW', lat: 29.38, lon: 47.99, tier: 3 },
  { name: 'Maskat', iso2: 'OM', lat: 23.59, lon: 58.41, tier: 3 },
  { name: 'Sanaa', iso2: 'YE', lat: 15.37, lon: 44.19, tier: 3 },
  { name: 'Kathmandu', iso2: 'NP', lat: 27.72, lon: 85.32, tier: 3 },
  { name: 'Colombo', iso2: 'LK', lat: 6.93, lon: 79.85, tier: 3 },
  { name: 'Rangun', iso2: 'MM', lat: 16.87, lon: 96.2, tier: 3 },
  { name: 'Phnom Penh', iso2: 'KH', lat: 11.56, lon: 104.92, tier: 3 },
  { name: 'Vientiane', iso2: 'LA', lat: 17.98, lon: 102.63, tier: 3 },
  { name: 'Ulaanbaatar', iso2: 'MN', lat: 47.92, lon: 106.91, tier: 3 },
  { name: 'Taipeh', iso2: 'TW', lat: 25.03, lon: 121.57, tier: 3 },
  { name: 'Port Moresby', iso2: 'PG', lat: -9.44, lon: 147.18, tier: 3 },
  { name: 'Suva', iso2: 'FJ', lat: -18.14, lon: 178.44, tier: 3 },
  { name: 'Havanna', iso2: 'CU', lat: 23.11, lon: -82.37, tier: 3 },
  { name: 'Santo Domingo', iso2: 'DO', lat: 18.49, lon: -69.93, tier: 3 },
  { name: 'Kingston', iso2: 'JM', lat: 17.97, lon: -76.79, tier: 3 },
  { name: 'Panama-Stadt', iso2: 'PA', lat: 8.98, lon: -79.52, tier: 3 },
  { name: 'San José', iso2: 'CR', lat: 9.93, lon: -84.09, tier: 3 },
  { name: 'Guatemala-Stadt', iso2: 'GT', lat: 14.63, lon: -90.51, tier: 3 },
  { name: 'Quito', iso2: 'EC', lat: -0.18, lon: -78.47, tier: 3 },
  { name: 'La Paz', iso2: 'BO', lat: -16.5, lon: -68.15, tier: 3 },
  { name: 'Asunción', iso2: 'PY', lat: -25.3, lon: -57.64, tier: 3 },
  { name: 'Montevideo', iso2: 'UY', lat: -34.9, lon: -56.16, tier: 3 },
  { name: 'Dakar', iso2: 'SN', lat: 14.72, lon: -17.47, tier: 3 },
  { name: 'Abidjan', iso2: 'CI', lat: 5.36, lon: -4.01, tier: 3 },
  { name: 'Kinshasa', iso2: 'CD', lat: -4.44, lon: 15.27, tier: 3 },
  { name: 'Luanda', iso2: 'AO', lat: -8.84, lon: 13.29, tier: 3 },
  { name: 'Maputo', iso2: 'MZ', lat: -25.97, lon: 32.57, tier: 3 },
  { name: 'Harare', iso2: 'ZW', lat: -17.83, lon: 31.05, tier: 3 },
  { name: 'Lusaka', iso2: 'ZM', lat: -15.39, lon: 28.32, tier: 3 },
  { name: 'Kampala', iso2: 'UG', lat: 0.35, lon: 32.58, tier: 3 },
  { name: 'Dar es Salaam', iso2: 'TZ', lat: -6.79, lon: 39.21, tier: 3 },
  { name: 'Khartum', iso2: 'SD', lat: 15.5, lon: 32.56, tier: 3 },
];

/** Zoom thresholds for capital tiers (sphere scale). */
export const CAPITAL_ZOOM = {
  tier1: 1.08,
  tier2: 1.28,
  tier3: 1.42,
} as const;

export function capitalsVisibleAtZoom(zoom: number, isMobile: boolean): WorldCapital[] {
  const z = zoom;
  // Mobile: fewer labels — tier 1 earlier, skip tier 3 until very close
  if (isMobile) {
    if (z >= CAPITAL_ZOOM.tier3 + 0.08) return WORLD_CAPITALS.filter((c) => c.tier <= 3);
    if (z >= CAPITAL_ZOOM.tier2 + 0.05) return WORLD_CAPITALS.filter((c) => c.tier <= 2);
    if (z >= CAPITAL_ZOOM.tier1) return WORLD_CAPITALS.filter((c) => c.tier === 1);
    return [];
  }
  if (z >= CAPITAL_ZOOM.tier3) return [...WORLD_CAPITALS];
  if (z >= CAPITAL_ZOOM.tier2) return WORLD_CAPITALS.filter((c) => c.tier <= 2);
  if (z >= CAPITAL_ZOOM.tier1) return WORLD_CAPITALS.filter((c) => c.tier === 1);
  return [];
}
