/**
 * Altes `/app/siteos/builder`. Links mit einer Ausgangsseite (`url`,
 * `domain`, `auditId`) laufen weiter in die bestehende Transformation, die
 * genau diese Parameter liest. Alles andere geht in den kanonischen Einstieg
 * `/build`. In beiden Faellen bleibt die Query erhalten (`prompt`,
 * `instruction`, `variant` …), damit alte Lesezeichen nichts verlieren.
 *
 * Bewusst ohne Import aus `./entry`: das zoege siteos-core in das eager
 * geladene App-Bundle. `test/build-studio/legacy-builder-redirect.test.tsx`
 * haelt den Default mit `DEFAULT_BUILD_KIND` gleich.
 */

import { Navigate, useLocation } from 'react-router-dom';

export const LEGACY_BUILDER_DEFAULT_KIND = 'website';

const SOURCE_PARAMS = ['url', 'domain', 'auditId', 'auditid'] as const;

export function legacyBuilderTarget(search: string): string {
  const params = new URLSearchParams(search);
  if (SOURCE_PARAMS.some((key) => params.has(key))) {
    const query = params.toString();
    return query ? `/unified-entry/transformation?${query}` : '/unified-entry/transformation';
  }
  if (!params.has('kind')) params.set('kind', LEGACY_BUILDER_DEFAULT_KIND);
  return `/build?${params.toString()}`;
}

export function LegacySiteOsBuilderRedirect() {
  const { search } = useLocation();
  return <Navigate to={legacyBuilderTarget(search)} replace />;
}
