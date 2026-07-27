/**
 * Auto-Mapping coverage computation (Asset → Control-Status).
 * Pure function, kept separate from GovernanceRuntimeDashboard.tsx so it
 * can be unit tested without mounting the component.
 */
import type { DbGovernanceAsset, DbAssetControlMapping } from './governanceApi';

export interface AssetCoverageEntry {
  asset: DbGovernanceAsset;
  mappings: DbAssetControlMapping[];
  implemented: number;
  gaps: number;
  total: number;
  coveragePercent: number;
}

export function computeAssetCoverage(
  assets: DbGovernanceAsset[],
  mappings: DbAssetControlMapping[]
): AssetCoverageEntry[] {
  return assets
    .map((asset) => {
      const assetMappings = mappings.filter((m) => m.asset_id === asset.id);
      const implemented = assetMappings.filter((m) => m.status === 'implemented').length;
      const gaps = assetMappings.filter((m) => m.status === 'gap').length;
      const total = assetMappings.length;
      const coveragePercent = total > 0 ? Math.round((implemented / total) * 100) : 0;
      return { asset, mappings: assetMappings, implemented, gaps, total, coveragePercent };
    })
    .filter((entry) => entry.total > 0);
}
