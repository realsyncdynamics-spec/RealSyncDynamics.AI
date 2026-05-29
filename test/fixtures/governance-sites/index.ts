export type { GoldenFixture, GoldenExpectation } from './types';
export { cleanSiteFixture } from './cleanSite';
export { gdprRiskSiteFixture } from './gdprRiskSite';
export { edgeCaseSiteFixture } from './edgeCaseSite';

import { cleanSiteFixture } from './cleanSite';
import { gdprRiskSiteFixture } from './gdprRiskSite';
import { edgeCaseSiteFixture } from './edgeCaseSite';
import type { GoldenFixture } from './types';

export const ALL_FIXTURES: GoldenFixture[] = [
  cleanSiteFixture,
  gdprRiskSiteFixture,
  edgeCaseSiteFixture,
];
